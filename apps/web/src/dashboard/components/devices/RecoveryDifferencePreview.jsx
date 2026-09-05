const ACTION_LABELS = {
  recover: 'Recover missing check', update: 'Update unpaid check',
  preserve: 'Keep server check', blocked: 'Needs attention', unchanged: 'Already matches',
}
const humanize = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

function Value({ field, value }) {
  if (value === null || value === undefined || value === '') return <span className="text-dash-tertiary">None</span>
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    if (field.endsWith('_cents')) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100)
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value)
  }
  if (Array.isArray(value)) return value.length
    ? <ul className="space-y-1">{value.map((item, index) => <li key={index}><Value field={field} value={item} /></li>)}</ul>
    : <span className="text-dash-tertiary">None</span>
  if (typeof value === 'object') return <span>
    {value.name || value.label || 'Item'}{value.quantity !== undefined ? ` × ${value.quantity}` : ''}
    {value.total_cents !== undefined && <> · <Value field="total_cents" value={value.total_cents} /></>}
    {value.seat_number != null && <span className="ml-1 text-dash-tertiary">· Seat {value.seat_number}</span>}
    {value.notes && <span className="block text-dash-tertiary">{value.notes}</span>}
  </span>
  return String(value)
}

export default function RecoveryDifferencePreview({ preview, referenceName = 'Selected device', checkingReadiness = true }) {
  if (!preview) return <p className="text-sm text-dash-secondary">Waiting for the source device and server comparison before changes can be reviewed.</p>
  const summary = preview.summary || {}
  const rows = preview.checks || []
  return <section className="space-y-3" aria-label="Proposed check changes">
    <div>
      <h3 className="text-sm font-semibold text-dash-cream">Proposed check changes</h3>
      <p className="mt-1 text-xs leading-5 text-dash-secondary">
        Review the differences before approving. Eligible changes update the server first, then ready terminals receive the reconciled checks.
        Checks missing from the source device are kept. Recorded payments are protected.
      </p>
    </div>
    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      {[
        ['Recover', summary.recover_checks], ['Update', summary.update_checks],
        ['Keep', summary.preserved_checks], ['Blocked', summary.blocked_checks],
      ].map(([name, count]) => <div key={name} className="rounded-lg border border-dash-border px-3 py-2">
        <dt className="text-xs text-dash-tertiary">{name}</dt><dd className="mt-1 font-semibold text-dash-cream">{count ?? 0}</dd>
      </div>)}
    </dl>
    {checkingReadiness && preview.can_apply !== true && <p role="status" className="rounded-lg border border-dash-warning/30 bg-dash-warning/10 p-3 text-sm text-dash-warning">
      Recovery cannot proceed yet. All POS terminals must be online and ready, and the comparison must have no blocked check changes.
    </p>}
    <div className="max-h-[28rem] space-y-2 overflow-y-auto">
      {rows.map((check, index) => <details key={check.order_id || index} open={check.action === 'blocked'} className="rounded-lg border border-dash-border p-3">
        <summary className="cursor-pointer text-sm text-dash-cream">
          <span className="font-medium">{check.label || `Check ${index + 1}`}</span>
          <span className={`ml-2 text-xs ${check.action === 'blocked' ? 'text-dash-warning' : 'text-dash-secondary'}`}>{ACTION_LABELS[check.action] || humanize(check.action)}</span>
        </summary>
        {check.action === 'preserve' && <p className="mt-2 text-xs text-dash-secondary">This check stays on the server and is included when terminals refresh.</p>}
        {Boolean(check.blockers?.length) && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-dash-warning">
          {check.blockers.map((blocker, blockerIndex) => <li key={blockerIndex}>{typeof blocker === 'object' ? blocker.message || humanize(blocker.code) : humanize(blocker)}</li>)}
        </ul>}
        {Boolean(check.changes?.length) && <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-dash-tertiary"><tr>
              <th scope="col" className="pb-2 pr-3 font-medium">Change</th>
              <th scope="col" className="pb-2 pr-3 font-medium">Server now</th>
              <th scope="col" className="pb-2 font-medium">From {referenceName}</th>
            </tr></thead>
            <tbody className="divide-y divide-dash-border text-dash-secondary">
              {check.changes.map((change, changeIndex) => <tr key={changeIndex}>
                <th scope="row" className="py-2 pr-3 align-top font-medium text-dash-cream">{change.label || humanize(change.field?.replace(/_cents$/, ''))}</th>
                <td className="py-2 pr-3 align-top"><Value field={change.field || ''} value={change.before} /></td>
                <td className="py-2 align-top"><Value field={change.field || ''} value={change.after} /></td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </details>)}
    </div>
  </section>
}

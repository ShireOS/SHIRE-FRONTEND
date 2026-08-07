// Verification banner for money reports. The backend recomputes accounting
// identities straight from raw transaction rows; this surfaces the result.
// Original report numbers are ALWAYS what is displayed and finalized — a
// mismatch only alerts, and the user can export the deltas for audit.
import { fetchWithSupabaseAuth } from '../query'

// One shared vocabulary for money terms, so no two reports use the same word
// for different math.
export const REPORT_GLOSSARY = {
  net_sales: 'Net sales — item sales after discounts and comps, before tax, tips, and service charges.',
  tax_collected: 'Tax collected — tax owed to the state from reported checks; not revenue.',
  card_tips_owed: 'Card tips owed — tips captured on card/gift payments that must be paid out to staff. Cash tips are already in staff pockets and are never owed again.',
  cash_collected: 'Cash collected — cash actually taken in, including cash tips, after dual-pricing adjustments.',
  total_collected: 'Total collected — everything charged across all tenders, including tips.',
  gratuity: 'Gratuity — automatic service charges on checks (e.g. large parties); distinct from voluntary tips.',
}

export const fetchReconciliation = (restaurantId, startDate, endDate) =>
  fetchWithSupabaseAuth(
    `/restaurants/${restaurantId}/reports/reconciliation?start_date=${startDate}&end_date=${endDate}`,
  )

export const acknowledgeReconciliation = (restaurantId, payload) =>
  fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/reconciliation/acknowledge`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const failedChecks = (recon, extraChecks = []) => ([
  ...(recon?.checks || []).filter(check => !check.ok),
  ...extraChecks.filter(check => !check.ok),
])

const csvCell = (value) => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// "Report with deltas": every check as a row — original value, independent
// recompute, delta, and the checks/orders behind it.
export function downloadDeltasCsv(recon, extraChecks = [], filename = 'report-verification.csv') {
  const rows = [[
    'check', 'status', 'report_value', 'recomputed_value', 'delta', 'orders', 'note',
  ]]
  for (const check of [...(recon?.checks || []), ...extraChecks]) {
    rows.push([
      check.label,
      check.ok ? 'ok' : 'MISMATCH',
      check.report_value ?? '',
      check.recomputed_value ?? '',
      check.delta ?? '',
      (check.order_ids || []).join(' '),
      check.note || '',
    ])
  }
  for (const [key, value] of Object.entries(recon?.recomputed || {})) {
    if (typeof value === 'object') continue
    rows.push([`recomputed: ${key}`, '', '', value, '', '', REPORT_GLOSSARY[key] || ''])
  }
  const blob = new Blob([rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function ReconciliationBanner({ recon, extraChecks = [], filename }) {
  if (!recon) return null
  const failing = failedChecks(recon, extraChecks)
  if (failing.length === 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200" title="Every total was independently recomputed from raw transactions and matches.">
        ✓ Totals verified against transactions
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-amber-300/30 bg-amber-300/[0.07] p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-amber-100">
          Verification found {failing.length} mismatch{failing.length === 1 ? '' : 'es'} — the report below shows the original numbers.
        </p>
        <button
          type="button"
          onClick={() => downloadDeltasCsv(recon, extraChecks, filename)}
          className="rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/10"
        >
          Download report with deltas (CSV)
        </button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {failing.map(check => (
          <li key={check.id} className="text-amber-100/90">
            <span className="font-medium">{check.label}</span>
            {check.delta != null && (
              <> — report {Number(check.report_value).toFixed(2)}, recomputed {Number(check.recomputed_value).toFixed(2)} (Δ {check.delta > 0 ? '+' : ''}{Number(check.delta).toFixed(2)})</>
            )}
            {check.order_ids?.length > 0 && (
              <span className="text-amber-100/70"> · checks {check.order_ids.slice(0, 8).join(', ')}{check.order_ids.length > 8 ? '…' : ''}</span>
            )}
            {check.note && <span className="block text-xs text-amber-100/60">{check.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

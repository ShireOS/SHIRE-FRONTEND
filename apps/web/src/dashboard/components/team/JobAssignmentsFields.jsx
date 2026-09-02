import { effectiveStaffPayRate } from '../../utils/staffPay'

const money = (value) => (
  value === null || value === undefined || value === ''
    ? '—'
    : `$${Number(value).toFixed(2)}/hr`
)

export default function JobAssignmentsFields({ rows, onChange, disabled = false }) {
  const selectedCount = rows.filter(row => row.selected).length

  const updateRow = (index, patch) => {
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  const togglePosition = (index) => {
    const target = rows[index]
    if (target.selected && selectedCount === 1) return
    const selecting = !target.selected
    let next = rows.map((row, rowIndex) => rowIndex === index
      ? { ...row, selected: selecting, is_primary: selecting ? row.is_primary : false }
      : row)
    const selected = next.filter(row => row.selected)
    if (selected.length > 0 && !selected.some(row => row.is_primary)) {
      const nextPrimary = selected[0].job_code_id
      next = next.map(row => ({ ...row, is_primary: row.job_code_id === nextPrimary }))
    }
    onChange(next)
  }

  const makePrimary = (index) => {
    onChange(rows.map((row, rowIndex) => ({
      ...row,
      selected: rowIndex === index ? true : row.selected,
      is_primary: rowIndex === index,
    })))
  }

  return (
    <div className="divide-y divide-dash-border border-y border-dash-border">
      {rows.map((row, index) => {
        const effectiveRate = effectiveStaffPayRate(row)
        const unavailable = row.is_active === false || !row.job_code_id
        return (
          <div key={row.job_code_id || row.code} className="grid gap-3 py-3 sm:grid-cols-[minmax(150px,1fr)_110px_minmax(190px,1.25fr)] sm:items-center">
            <label className="flex min-w-0 items-center gap-3">
              <input
                type="checkbox"
                checked={row.selected}
                disabled={disabled || (unavailable && !row.selected) || (row.selected && selectedCount === 1)}
                onChange={() => togglePosition(index)}
                className="h-4 w-4 accent-shell-accent"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-dash-cream">{row.label}</span>
                <span className="block text-[11px] text-dash-tertiary">
                  Default {money(row.default_hourly_rate)}
                  {row.is_active === false ? ' · archived' : !row.job_code_id ? ' · position setup required' : ''}
                </span>
              </span>
            </label>

            <label className={`flex items-center gap-2 text-xs font-semibold ${row.selected ? 'text-dash-secondary' : 'text-dash-tertiary'}`}>
              <input
                type="radio"
                name="primary-position"
                checked={row.selected && row.is_primary}
                disabled={disabled || !row.selected}
                onChange={() => makePrimary(index)}
                className="h-4 w-4 accent-shell-accent"
              />
              Primary
            </label>

            <div className={`flex min-w-0 flex-wrap items-center gap-2 ${row.selected ? '' : 'opacity-45'}`}>
              <label className="flex items-center gap-2 text-xs font-semibold text-dash-secondary">
                <input
                  type="checkbox"
                  checked={row.use_custom_rate}
                  disabled={disabled || !row.selected}
                  onChange={(event) => updateRow(index, {
                    use_custom_rate: event.target.checked,
                    hourly_rate_override: event.target.checked ? row.hourly_rate_override : '',
                  })}
                  className="h-4 w-4 accent-shell-accent"
                />
                Custom rate
              </label>
              {row.use_custom_rate ? (
                <span className="flex items-center gap-1">
                  <span className="text-xs text-dash-tertiary">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.hourly_rate_override}
                    disabled={disabled || !row.selected}
                    onChange={(event) => updateRow(index, { hourly_rate_override: event.target.value })}
                    aria-label={`${row.label} custom hourly rate`}
                    className="w-24 rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2 py-1.5 font-mono text-xs tabular-nums text-dash-cream outline-none focus:border-shell-accent/60"
                  />
                  <span className="text-xs text-dash-tertiary">/hr</span>
                </span>
              ) : (
                <span className="text-xs text-dash-tertiary">
                  Pays {effectiveRate === null ? 'no configured rate' : money(effectiveRate)}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

import { Check, Clock3, Users } from 'lucide-react'

const LONG_SHIFT_MINUTES = 16 * 60

const durationLabel = (minutes) => {
  const total = Math.max(0, Math.trunc(Number(minutes || 0)))
  const hours = Math.floor(total / 60)
  const remainder = total % 60
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`
}

const clockLabel = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Unknown time'
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const initials = (name) => String(name || '')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join('') || '?'

const roleLabel = (role) => {
  const normalized = String(role || '').replaceAll('_', ' ').trim()
  return normalized ? normalized.replace(/^./, (letter) => letter.toUpperCase()) : ''
}

export default function CloseDayTeamRoster({
  entries,
  allowSelection,
  selectedIds,
  onSelectAll,
  onSelectNone,
  onToggle,
}) {
  const selected = new Set(selectedIds)

  return (
    <div className="mt-5 border border-dash-border bg-dash-base/45 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-sky-400/10 text-sky-200">
            <Users size={18} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-dash-cream">Currently clocked in</h3>
            <p className="mt-0.5 text-xs text-dash-tertiary">
              {allowSelection
                ? 'Select any employees who should clock out when the day closes.'
                : 'Review this roster before continuing to the final close.'}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden="true" />
          {entries.length} {entries.length === 1 ? 'person' : 'people'}
        </span>
      </div>

      {allowSelection && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dash-border pt-4">
          <p className="text-sm font-semibold text-dash-cream">
            {selectedIds.length} of {entries.length} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSelectAll} className="min-h-[38px] bg-dash-cream px-3 text-xs font-bold text-dash-base">
              Clock out everyone
            </button>
            <button type="button" onClick={onSelectNone} className="min-h-[38px] border border-dash-border px-3 text-xs font-semibold text-dash-secondary hover:text-dash-cream">
              Leave everyone in
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => {
          const isSelected = selected.has(entry.id)
          const isLongShift = Number(entry.worked_minutes || 0) >= LONG_SHIFT_MINUTES
          const role = roleLabel(entry.role)
          const Card = allowSelection ? 'button' : 'div'

          return (
            <Card
              key={entry.id}
              {...(allowSelection ? {
                type: 'button',
                onClick: () => onToggle(entry.id),
                'aria-pressed': isSelected,
              } : {})}
              className={`min-h-[128px] border p-4 text-left ${allowSelection && isSelected ? 'border-dash-gold/70 bg-dash-gold/[0.07]' : 'border-dash-border bg-[var(--glass-bg)]'}`}
            >
              <span className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-400/10 text-xs font-bold text-sky-100">
                  {initials(entry.staff_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-dash-cream">{entry.staff_name}</span>
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" aria-hidden="true" />
                    <span className="font-semibold text-sky-100">Clocked in</span>
                    {role && <span className="truncate text-dash-tertiary">· {role}</span>}
                  </span>
                </span>
                {allowSelection && (
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${isSelected ? 'border-dash-gold bg-dash-gold text-dash-base' : 'border-dash-border text-transparent'}`} aria-hidden="true">
                    <Check size={13} strokeWidth={2.6} />
                  </span>
                )}
              </span>

              <span className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs text-dash-tertiary">
                  <Clock3 size={13} strokeWidth={1.8} aria-hidden="true" />
                  In <span className="font-semibold text-dash-secondary">{clockLabel(entry.clock_in_at)}</span>
                </span>
                <span className={`px-2 py-1 text-[11px] font-semibold tabular-nums ${isLongShift ? 'bg-amber-400/10 text-amber-200' : 'bg-white/[0.04] text-dash-secondary'}`}>
                  {isLongShift
                    ? `Long shift · ${durationLabel(entry.worked_minutes)}`
                    : `${durationLabel(entry.worked_minutes)} on clock`}
                </span>
              </span>

              <span className="mt-3 block text-xs text-dash-tertiary">
                Last POS activity <span className="font-semibold text-dash-secondary">{entry.last_activity_at ? clockLabel(entry.last_activity_at) : 'Not available'}</span>
              </span>
            </Card>
          )
        })}
      </div>

      <div className={`mt-4 flex items-center gap-3 border px-4 py-3 ${allowSelection ? 'border-emerald-400/20 bg-emerald-400/[0.06]' : 'border-sky-400/20 bg-sky-400/[0.06]'}`}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dash-base ${allowSelection ? 'text-emerald-300' : 'text-sky-200'}`}>
          {allowSelection ? <Check size={15} strokeWidth={2.4} aria-hidden="true" /> : <Clock3 size={15} strokeWidth={2} aria-hidden="true" />}
        </span>
        <div>
          <p className={`text-sm font-semibold ${allowSelection ? 'text-emerald-100' : 'text-sky-100'}`}>
            {allowSelection ? 'Clock-out selection' : 'Automatic clock-out is on'}
          </p>
          <p className="mt-0.5 text-xs text-dash-secondary">
            {allowSelection
              ? `${selectedIds.length} ${selectedIds.length === 1 ? 'person is' : 'people are'} selected. Everyone is selected by default.`
              : `All ${entries.length} ${entries.length === 1 ? 'person' : 'people'} will be clocked out automatically when the day closes. No selection is needed.`}
          </p>
        </div>
      </div>
    </div>
  )
}

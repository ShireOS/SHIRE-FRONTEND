import { ChevronLeft, ChevronRight } from 'lucide-react'
import { intervalLabel, normalizeInterval, setIntervalPreset, shiftInterval } from '../../utils/payrollIntervals'

const PRESETS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'pay_period', label: 'Pay period' },
  { id: 'custom', label: 'Custom' },
]

export default function IntervalControls({
  interval,
  preset,
  onChange,
  payrollFrequency = 'biweekly',
  payPeriodCalendar = null,
  onPayPeriodShift = null,
  payPeriodNavigationPending = false,
  className = '',
}) {
  const updatePreset = (nextPreset) => {
    if (nextPreset === 'pay_period' && payPeriodCalendar?.available) {
      const key = payPeriodCalendar.default_period === 'current_open' ? 'current_open' : 'last_completed'
      const period = payPeriodCalendar.periods?.[key]
      if (period?.start_date && period?.end_date) {
        onChange({ preset: nextPreset, interval: { start: period.start_date, end: period.end_date, preset: nextPreset, period_id: period.id } })
        return
      }
    }
    onChange({
      preset: nextPreset,
      interval: setIntervalPreset(nextPreset, interval, payrollFrequency),
    })
  }
  const shift = (direction) => {
    if (preset === 'pay_period' && payPeriodCalendar?.available && onPayPeriodShift) {
      void onPayPeriodShift(direction)
      return
    }
    onChange({ preset, interval: shiftInterval(interval, preset, direction) })
  }
  const updateDate = (field, value) => {
    onChange({ preset: 'custom', interval: normalizeInterval(field === 'start' ? value : interval.start, field === 'end' ? value : interval.end, 'custom') })
  }

  return (
    <div className={['flex flex-wrap items-center gap-2', className].filter(Boolean).join(' ')}>
      <div className="flex overflow-hidden rounded-lg border border-dash-border">
        {PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={payPeriodNavigationPending}
            onClick={() => updatePreset(item.id)}
            className={`px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
              preset === item.id ? 'bg-dash-gold/15 text-dash-gold' : 'text-dash-secondary hover:text-dash-cream'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-dash-border px-1 py-0.5">
        <button type="button" onClick={() => shift(-1)} disabled={payPeriodNavigationPending} title="Previous interval" className="rounded p-1 text-dash-secondary hover:text-dash-cream disabled:opacity-50">
          <ChevronLeft size={15} />
        </button>
        <span className="min-w-[11rem] text-center text-sm font-medium tabular-nums text-dash-cream">{intervalLabel(interval)}</span>
        <button type="button" onClick={() => shift(1)} disabled={payPeriodNavigationPending} title="Next interval" className="rounded p-1 text-dash-secondary hover:text-dash-cream disabled:opacity-50">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-dash-border px-2 py-1">
        <input
          type="date"
          value={interval.start}
          disabled={payPeriodNavigationPending}
          onChange={(event) => updateDate('start', event.target.value)}
          aria-label="Start date"
          className="w-[8.5rem] bg-transparent text-sm text-dash-cream outline-none"
        />
        <span className="text-dash-tertiary">to</span>
        <input
          type="date"
          value={interval.end}
          disabled={payPeriodNavigationPending}
          onChange={(event) => updateDate('end', event.target.value)}
          aria-label="End date"
          className="w-[8.5rem] bg-transparent text-sm text-dash-cream outline-none"
        />
      </div>
    </div>
  )
}

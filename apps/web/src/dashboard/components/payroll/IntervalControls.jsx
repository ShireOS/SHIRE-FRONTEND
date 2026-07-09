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
  className = '',
}) {
  const updatePreset = (nextPreset) => {
    onChange({
      preset: nextPreset,
      interval: setIntervalPreset(nextPreset, interval, payrollFrequency),
    })
  }
  const shift = (direction) => {
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
            onClick={() => updatePreset(item.id)}
            className={`px-3 py-1.5 text-xs font-semibold transition ${
              preset === item.id ? 'bg-dash-gold/15 text-dash-gold' : 'text-dash-secondary hover:text-dash-cream'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-dash-border px-1 py-0.5">
        <button type="button" onClick={() => shift(-1)} title="Previous interval" className="rounded p-1 text-dash-secondary hover:text-dash-cream">
          <ChevronLeft size={15} />
        </button>
        <span className="min-w-[11rem] text-center text-sm font-medium tabular-nums text-dash-cream">{intervalLabel(interval)}</span>
        <button type="button" onClick={() => shift(1)} title="Next interval" className="rounded p-1 text-dash-secondary hover:text-dash-cream">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-dash-border px-2 py-1">
        <input
          type="date"
          value={interval.start}
          onChange={(event) => updateDate('start', event.target.value)}
          aria-label="Start date"
          className="w-[8.5rem] bg-transparent text-sm text-dash-cream outline-none"
        />
        <span className="text-dash-tertiary">to</span>
        <input
          type="date"
          value={interval.end}
          onChange={(event) => updateDate('end', event.target.value)}
          aria-label="End date"
          className="w-[8.5rem] bg-transparent text-sm text-dash-cream outline-none"
        />
      </div>
    </div>
  )
}

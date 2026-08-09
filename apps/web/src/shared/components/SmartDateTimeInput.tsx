import { useEffect, useRef, useState } from 'react'

import { SmartTimeInput } from './SmartTimeInput'

type SmartDateTimeInputProps = {
  value?: string | null
  onChange: (value: string) => void
  minuteStep?: 1 | 5 | 10 | 15 | 30
  ariaLabel: string
  disabled?: boolean
  required?: boolean
  className?: string
}

const splitValue = (value?: string | null) => {
  const [date = '', rawTime = ''] = String(value || '').split('T')
  return { date, time: rawTime.slice(0, 5) }
}

export function SmartDateTimeInput({
  value,
  onChange,
  minuteStep = 15,
  ariaLabel,
  disabled = false,
  required = false,
  className = '',
}: SmartDateTimeInputProps) {
  const initial = splitValue(value)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const lastEmitted = useRef(String(value || ''))

  useEffect(() => {
    const external = String(value || '')
    if (external === lastEmitted.current) return
    const next = splitValue(external)
    setDate(next.date)
    setTime(next.time)
    lastEmitted.current = external
  }, [value])

  const emit = (nextDate: string, nextTime: string) => {
    const next = nextDate && nextTime ? `${nextDate}T${nextTime}` : ''
    lastEmitted.current = next
    onChange(next)
  }

  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${className}`}>
      <input
        type="date"
        aria-label={`${ariaLabel} date`}
        disabled={disabled}
        required={required}
        value={date}
        onChange={(event) => {
          const nextDate = event.target.value
          setDate(nextDate)
          emit(nextDate, time)
        }}
        className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-dash-cream outline-none transition focus:border-dash-gold/70 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <SmartTimeInput
        ariaLabel={`${ariaLabel} time`}
        disabled={disabled}
        required={required}
        minuteStep={minuteStep}
        value={time}
        onChange={(nextTime) => {
          setTime(nextTime)
          emit(date, nextTime)
        }}
      />
    </div>
  )
}

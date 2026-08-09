import { CalendarClock, Save, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SmartDateTimeInput } from './SmartDateTimeInput'

type Props = {
  label: string
  disabled?: boolean
  busy?: boolean
  onPublishNow: () => void | Promise<void>
  onSchedule: (scheduledFor: string, timezone: string) => void | Promise<void>
}

function defaultLocalDateTime() {
  const next = new Date(Date.now() + 60 * 60 * 1000)
  next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15, 0, 0)
  const offset = next.getTimezoneOffset() * 60_000
  return new Date(next.getTime() - offset).toISOString().slice(0, 16)
}

export function PublishControls({ label, disabled, busy, onPublishNow, onSchedule }: Props) {
  const [open, setOpen] = useState(false)
  const [localDateTime, setLocalDateTime] = useState(defaultLocalDateTime)
  const [error, setError] = useState('')
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', [])

  const schedule = async () => {
    const date = new Date(localDateTime)
    if (!localDateTime || Number.isNaN(date.getTime()) || date.getTime() < Date.now() + 10_000) {
      setError('Choose a future date and time.')
      return
    }
    setError('')
    setOpen(false)
    await onSchedule(date.toISOString(), timezone)
  }

  return <>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={disabled || busy} onClick={() => void onPublishNow()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-shell-cta px-3 py-2 text-sm font-semibold text-shell-cta-text disabled:opacity-50">
        <Save size={15} /> {busy ? 'Saving...' : label}
      </button>
      <button type="button" disabled={disabled || busy} onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-dash-border px-3 py-2 text-sm font-semibold disabled:opacity-50">
        <CalendarClock size={15} /> Save later
      </button>
    </div>
    {open && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={`Schedule ${label}`}>
      <div className="w-full max-w-md rounded-lg border border-dash-border bg-dash-surface p-5 text-dash-cream shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase text-dash-tertiary">Publish later</p><h2 className="mt-1 text-lg font-semibold">{label}</h2></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border"><X size={17} /></button>
        </div>
        <div className="mt-5 text-sm font-medium"><p className="mb-2">Date and time</p>
          <SmartDateTimeInput ariaLabel={`Schedule ${label}`} value={localDateTime} onChange={setLocalDateTime} />
        </div>
        <p className="mt-2 text-xs text-dash-tertiary">{timezone}. Selected changes will remain pending until this time.</p>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-dash-border px-4 py-2 text-sm font-semibold">Cancel</button>
          <button type="button" disabled={busy} onClick={() => void schedule()} className="rounded-md bg-shell-cta px-4 py-2 text-sm font-semibold text-shell-cta-text disabled:opacity-50">Schedule</button>
        </div>
      </div>
    </div>}
  </>
}

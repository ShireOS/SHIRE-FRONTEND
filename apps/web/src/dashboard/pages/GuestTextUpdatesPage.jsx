import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Loader2, MessageSquareText, RefreshCw } from 'lucide-react'
import { fetchReservationsApi } from '../../shared/api/reservationsClient'
import { queryClient, STALE_TIMES } from '../../shared/query'
import { Button } from '../components/shared/Button'

function ErrorNotice({ error }) {
  if (!error) return null
  return (
    <div className="border-y border-dash-danger/40 bg-dash-danger/10 px-4 py-3 text-sm text-dash-danger">
      <p className="font-semibold">Could not save text settings</p>
      <p className="mt-1 leading-6">{error.message}</p>
    </div>
  )
}

function SettingsSwitch({ checked, disabled, label, detail, onChange }) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-5 border-b border-dash-border py-3 last:border-b-0">
      <div>
        <p className="text-sm font-semibold text-dash-cream">{label}</p>
        <p className="mt-1 text-xs leading-5 text-dash-tertiary">{detail}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'border-shell-accent bg-shell-accent' : 'border-dash-border bg-[var(--glass-bg)]'}`}
      >
        <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}

export default function GuestTextUpdatesPage({ restaurantId, readOnly = false }) {
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const activeRestaurantRef = useRef(restaurantId)
  activeRestaurantRef.current = restaurantId
  const settingsQuery = useQuery({
    queryKey: ['reservationNotificationSettings', restaurantId],
    queryFn: () => fetchReservationsApi(`/locations/${restaurantId}/reservation-notification-settings`),
    enabled: Boolean(restaurantId),
    staleTime: STALE_TIMES.setup,
    retry: false,
  })

  useEffect(() => {
    setDraft(null)
    setError(null)
    setNotice('')
  }, [restaurantId])

  useEffect(() => {
    if (!settingsQuery.data || activeRestaurantRef.current !== restaurantId) return
    setDraft({
      confirmationSmsEnabled: settingsQuery.data.confirmationSmsEnabled !== false,
      reminderEnabled: settingsQuery.data.reminderEnabled !== false,
      reminderHoursBefore: Number(settingsQuery.data.reminderHoursBefore || 24),
      sameDayReminderEnabled: settingsQuery.data.sameDayReminderEnabled === true,
      sameDayReminderHoursBefore: Number(settingsQuery.data.sameDayReminderHoursBefore || 3),
    })
  }, [restaurantId, settingsQuery.data])

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const save = async () => {
    const requestRestaurantId = restaurantId
    setSaving(true)
    setError(null)
    setNotice('')
    try {
      const next = await fetchReservationsApi(`/locations/${requestRestaurantId}/reservation-notification-settings`, {
        method: 'PUT',
        body: JSON.stringify(draft),
      })
      if (activeRestaurantRef.current !== requestRestaurantId) return
      queryClient.setQueryData(['reservationNotificationSettings', requestRestaurantId], next)
      setNotice('Guest text timing saved.')
    } catch (saveError) {
      if (activeRestaurantRef.current === requestRestaurantId) setError(saveError)
    } finally {
      if (activeRestaurantRef.current === requestRestaurantId) setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-dash-border pb-5 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dash-border text-shell-accent">
            <MessageSquareText size={17} aria-hidden="true" />
          </span>
          <div>
            <p className="label-mono">Shared Shire number</p>
            <h2 className="mt-2 text-2xl font-semibold text-dash-cream">Guest text updates</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-dash-secondary">
              Every message begins with this restaurant's name. Guests can receive updates for several restaurants on the same phone without mixing reservations.
            </p>
          </div>
        </div>
        {!readOnly && draft && (
          <Button
            size="sm"
            icon={saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            disabled={saving}
            onClick={() => void save()}
          >
            Save text timing
          </Button>
        )}
      </header>

      {settingsQuery.isLoading && <div className="h-28 animate-pulse rounded-lg bg-dash-cream/5" />}
      {settingsQuery.error && (
        <div className="flex items-center justify-between gap-4 border-y border-dash-danger/40 py-3 text-sm text-dash-danger">
          <span>{settingsQuery.error.message}</span>
          <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => settingsQuery.refetch()}>Retry</Button>
        </div>
      )}
      {draft && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(260px,0.7fr)]">
          <div className="border-y border-dash-border">
            <SettingsSwitch
              checked={draft.confirmationSmsEnabled}
              disabled={readOnly}
              label="Booking confirmations and changes"
              detail="Send an immediate text when a reservation is booked, changed, confirmed, or canceled."
              onChange={(value) => update('confirmationSmsEnabled', value)}
            />
            <SettingsSwitch
              checked={draft.reminderEnabled}
              disabled={readOnly}
              label="Reservation reminder"
              detail="Send the first reminder before the reservation time."
              onChange={(value) => update('reminderEnabled', value)}
            />
            <SettingsSwitch
              checked={draft.sameDayReminderEnabled}
              disabled={readOnly}
              label="Final reminder"
              detail="Optionally send a second, closer reminder before arrival."
              onChange={(value) => update('sameDayReminderEnabled', value)}
            />
          </div>
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="label-mono block">First reminder</span>
              <select
                value={draft.reminderHoursBefore}
                disabled={readOnly || !draft.reminderEnabled}
                onChange={(event) => update('reminderHoursBefore', Number(event.target.value))}
                className="min-h-11 w-full rounded-lg border border-dash-border bg-[var(--glass-bg)] px-3 text-sm text-dash-cream outline-none focus:border-shell-accent/60 disabled:opacity-50"
              >
                {[2, 3, 6, 12, 24, 48, 72, 168].map((hours) => <option key={hours} value={hours}>{hours < 24 ? `${hours} hours before` : `${hours / 24} ${hours === 24 ? 'day' : 'days'} before`}</option>)}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="label-mono block">Final reminder</span>
              <select
                value={draft.sameDayReminderHoursBefore}
                disabled={readOnly || !draft.sameDayReminderEnabled}
                onChange={(event) => update('sameDayReminderHoursBefore', Number(event.target.value))}
                className="min-h-11 w-full rounded-lg border border-dash-border bg-[var(--glass-bg)] px-3 text-sm text-dash-cream outline-none focus:border-shell-accent/60 disabled:opacity-50"
              >
                {[1, 2, 3, 4, 6, 8, 12].map((hours) => <option key={hours} value={hours}>{hours} {hours === 1 ? 'hour' : 'hours'} before</option>)}
              </select>
            </label>
          </div>
        </div>
      )}
      <ErrorNotice error={error} />
      {notice && <p className="text-sm text-dash-success">{notice}</p>}
      {readOnly && (
        <p className="flex items-center gap-2 text-xs text-dash-tertiary">
          This page is in summary mode. Change your Back Office view to edit text settings.
        </p>
      )}
    </div>
  )
}

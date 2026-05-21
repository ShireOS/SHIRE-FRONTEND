import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, CheckCircle2, Clock, Loader2, PartyPopper, Users } from 'lucide-react'
import { reservationApi } from '../shared/api/reservationApi'
import type {
  PublicAvailabilitySlot,
  PublicBookableLocation,
  PublicBookingConfig,
  PublicReservation,
} from '../shared/api/reservationApi'

const todayInputValue = () => new Date().toISOString().slice(0, 10)

const normalizeTime = (slot: PublicAvailabilitySlot): string =>
  slot.reservationTime || slot.time || slot.startTime || ''

const formatTime = (value: string): string => {
  if (!value) return ''
  const [hours = '0', minutes = '00'] = value.split(':')
  const date = new Date()
  date.setHours(Number(hours), Number(minutes), 0, 0)
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const isTechnicalLabel = (value: string): boolean =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ||
  /^[a-f0-9-]{24,}$/i.test(value)

const getDisplayName = (...values: Array<string | undefined>): string => {
  const cleanValue = values.find((value) => {
    const trimmed = value?.trim()
    return trimmed && !isTechnicalLabel(trimmed)
  })

  return cleanValue?.trim() || 'Book your table'
}

const hasPublicDisplayName = (value: string): boolean => value !== 'Book your table'

function getSlugFromPath(): string {
  const [, slug = ''] = window.location.pathname.match(/^\/book\/([^/?#]+)/) || []
  return decodeURIComponent(slug)
}

export function PublicBookingApp() {
  const slug = useMemo(() => getSlugFromPath(), [])
  const source = new URLSearchParams(window.location.search).get('source')
  const [location, setLocation] = useState<PublicBookableLocation | null>(null)
  const [config, setConfig] = useState<PublicBookingConfig | null>(null)
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([])
  const [selectedTime, setSelectedTime] = useState('')
  const [serviceDate, setServiceDate] = useState(todayInputValue())
  const [partySize, setPartySize] = useState(2)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [slotError, setSlotError] = useState('')
  const [confirmation, setConfirmation] = useState<PublicReservation | null>(null)

  const locationId = location?.locationId
  const restaurantName = getDisplayName(
    config?.restaurantName,
    config?.name,
    location?.displayName,
    location?.restaurantName,
    location?.name,
    slug
  )

  const minPartySize = config?.publicMinPartySize || config?.minPartySize || 1
  const maxPartySize = config?.publicMaxPartySize || config?.maxPartySize || 12

  useEffect(() => {
    let cancelled = false

    async function loadInitialBookingData() {
      if (!slug) {
        setError('This booking link is missing a restaurant slug.')
        setInitialLoading(false)
        return
      }

      setInitialLoading(true)
      setError('')

      try {
        const resolvedLocation = await reservationApi.getPublicBookableLocation(slug)
        if (cancelled) return

        setLocation(resolvedLocation)

        const bookingConfig = await reservationApi.getPublicBookingConfig(resolvedLocation.locationId)
        if (cancelled) return

        setConfig(bookingConfig)
        if (bookingConfig.defaultPartySize) {
          setPartySize(bookingConfig.defaultPartySize)
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'This booking link could not be loaded.'))
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false)
        }
      }
    }

    loadInitialBookingData()

    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    let cancelled = false

    async function loadSlots() {
      if (!locationId || !serviceDate || !partySize) return

      setSlotsLoading(true)
      setSlotError('')
      setSelectedTime('')

      try {
        const nextSlots = await reservationApi.getPublicAvailability(
          locationId,
          serviceDate,
          partySize,
          source === 'google' ? 'google' : 'public_web'
        )
        if (!cancelled) {
          setSlots(nextSlots)
        }
      } catch (err) {
        if (!cancelled) {
          setSlots([])
          setSlotError(getErrorMessage(err, 'Available times could not be loaded.'))
        }
      } finally {
        if (!cancelled) {
          setSlotsLoading(false)
        }
      }
    }

    loadSlots()

    return () => {
      cancelled = true
    }
  }, [locationId, serviceDate, partySize, source])

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (!locationId) return

      if (!guestName.trim() || !guestPhone.trim() || !selectedTime) {
        setError('Add your name, phone number, and a reservation time before confirming.')
        return
      }

      if (!smsConsent) {
        setError('Please agree to receive SMS messages to confirm your reservation.')
        return
      }

      setSubmitting(true)
      setError('')

      try {
        const reservation = await reservationApi.createPublicReservation(locationId, {
          guestName: guestName.trim(),
          guestPhone: guestPhone.replace(/\D/g, ''),
          guestEmail: guestEmail.trim() || undefined,
          partySize,
          serviceDate,
          reservationTime: selectedTime,
          source: source === 'google' ? 'google_business_profile' : 'public_web',
        })
        setConfirmation(reservation)
      } catch (err) {
        setError(getErrorMessage(err, 'Reservation could not be created. Please try another time.'))
      } finally {
        setSubmitting(false)
      }
    },
    [guestEmail, guestName, guestPhone, locationId, partySize, selectedTime, serviceDate, smsConsent, source]
  )

  if (initialLoading) {
    return (
      <main className="booking-shell">
        <section className="booking-panel booking-centered">
          <Loader2 className="spin" size={28} />
          <p>Loading booking details...</p>
        </section>
      </main>
    )
  }

  if (error && !location) {
    return (
      <main className="booking-shell">
        <section className="booking-panel booking-centered">
          <h1>Booking link unavailable</h1>
          <p>{error}</p>
          <p className="powered">Powered by SHIRE</p>
        </section>
      </main>
    )
  }

  if (confirmation) {
    const confirmedTime = confirmation.reservationTime || selectedTime
    return (
      <main className="booking-shell">
        <section className="booking-panel booking-confirmation">
          <CheckCircle2 size={34} />
          <p className="eyebrow">Reservation requested at</p>
          <h1 className="booking-title">{restaurantName}</h1>
          <p className="confirmation-line">
            {partySize} guests on {serviceDate} at {formatTime(confirmedTime)}
          </p>
          {confirmation.confirmationCode && (
            <p className="confirmation-code">Confirmation {confirmation.confirmationCode}</p>
          )}
          <p className="powered">Powered by SHIRE</p>
        </section>
      </main>
    )
  }

  return (
    <main className="booking-shell">
      <section className="booking-panel">
        <header className="booking-header">
          <p className="eyebrow">Booking at</p>
          <h1 className="booking-title">{restaurantName}</h1>
          <p className="booking-intent">
            {hasPublicDisplayName(restaurantName)
              ? 'Reserve a table for this location.'
              : 'Confirm this booking link before choosing a time.'}
          </p>
          {location?.address && <p className="subtle">{location.address}</p>}
        </header>

        <form onSubmit={handleSubmit} className="booking-form">
          <div className="booking-grid">
            <label>
              <span><Calendar size={16} /> Date</span>
              <input
                type="date"
                value={serviceDate}
                min={todayInputValue()}
                onChange={(event) => setServiceDate(event.target.value)}
              />
            </label>
            <label>
              <span><Users size={16} /> Party size</span>
              <input
                type="number"
                value={partySize}
                min={minPartySize}
                max={maxPartySize}
                onChange={(event) => setPartySize(Number(event.target.value))}
              />
            </label>
          </div>

          <section className="slots-section">
            <div className="section-title">
              <Clock size={17} />
              <h2>Available times</h2>
            </div>

            {slotsLoading && (
              <div className="slot-state">
                <Loader2 className="spin" size={20} />
                Checking availability...
              </div>
            )}

            {!slotsLoading && slotError && <p className="error">{slotError}</p>}

            {!slotsLoading && !slotError && slots.length === 0 && (
              <p className="slot-state">No available times for that date and party size.</p>
            )}

            {!slotsLoading && slots.length > 0 && (
              <div className="slot-grid">
                {slots.map((slot, index) => {
                  const time = normalizeTime(slot)
                  const isAvailable = slot.available !== false
                  return (
                    <button
                      key={slot.id || `${time}-${index}`}
                      type="button"
                      disabled={!isAvailable}
                      className={selectedTime === time ? 'selected' : ''}
                      onClick={() => setSelectedTime(time)}
                    >
                      {slot.label || formatTime(time)}
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <div className="booking-grid">
            <label>
              <span>Name</span>
              <input
                type="text"
                value={guestName}
                autoComplete="name"
                placeholder="Sarah M."
                onChange={(event) => setGuestName(event.target.value)}
              />
            </label>
            <label>
              <span>Phone</span>
              <input
                type="tel"
                value={guestPhone}
                autoComplete="tel"
                placeholder="5551234567"
                onChange={(event) => setGuestPhone(event.target.value)}
              />
            </label>
          </div>

          <label>
            <span>Email optional</span>
            <input
              type="email"
              value={guestEmail}
              autoComplete="email"
              placeholder="sarah@example.com"
              onChange={(event) => setGuestEmail(event.target.value)}
            />
          </label>

          <label className="sms-consent">
            <input
              type="checkbox"
              checked={smsConsent}
              onChange={(event) => setSmsConsent(event.target.checked)}
            />
            <span>
              I agree to receive Delivery Notification, Account Notification SMS messages from Shire at the number provided. Msg frequency varies. Msg &amp; data rates may apply. Reply Help for Help. Reply STOP to opt-out. Please see <a href="/privacy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="/terms/" target="_blank" rel="noopener noreferrer">Terms of Use</a>.
            </span>
          </label>

          {error && <p className="error">{error}</p>}

          <button
            className="confirm-button"
            type="submit"
            disabled={submitting || !selectedTime || !smsConsent}
          >
            {submitting ? <Loader2 className="spin" size={18} /> : <PartyPopper size={18} />}
            Confirm reservation
          </button>
        </form>

        <p className="powered">Powered by SHIRE</p>
      </section>
    </main>
  )
}

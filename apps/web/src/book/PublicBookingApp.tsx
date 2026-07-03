import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, CheckCircle2, Clock, Loader2, PartyPopper, Users } from 'lucide-react'
import { getApiUrl } from '../shared/api/config'
import { ENDPOINTS } from '../shared/api/endpoints'

interface PublicBookableLocation {
  locationId: string
  slug?: string
  name?: string
  displayName?: string
  restaurantName?: string
  timezone?: string
  address?: string
  phone?: string
}

interface PublicBookingConfig {
  locationId?: string
  minPartySize?: number
  maxPartySize?: number
  bookingHorizonDays?: number
  defaultPartySize?: number
  timezone?: string
  restaurantName?: string
  name?: string
}

interface PublicAvailabilitySlot {
  id?: string
  time?: string
  startTime?: string
  reservationTime?: string
  available?: boolean
  remainingCovers?: number
  label?: string
}

interface PublicReservation {
  id?: string
  reservationId?: string
  confirmationCode?: string
  status?: string
  guestName?: string
  partySize?: number
  serviceDate?: string
  reservationTime?: string
}

const todayInputValue = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

const unwrapAvailabilitySlots = (response: unknown): PublicAvailabilitySlot[] => {
  if (Array.isArray(response)) return response as PublicAvailabilitySlot[]
  if (response && typeof response === 'object') {
    const record = response as Record<string, unknown>
    if (Array.isArray(record.slots)) return record.slots as PublicAvailabilitySlot[]
    if (Array.isArray(record.availability)) return record.availability as PublicAvailabilitySlot[]
    if (Array.isArray(record.availableSlots)) return record.availableSlots as PublicAvailabilitySlot[]
  }
  return []
}

async function publicRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(getApiUrl(endpoint), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const errorData = await response.json()
      message = String(errorData.detail || errorData.message || message)
    } catch {
      // Leave the HTTP status as the visible error.
    }
    throw new Error(message)
  }

  return response.json()
}

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
  const [initialLoading, setInitialLoading] = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [slotError, setSlotError] = useState('')
  const [confirmation, setConfirmation] = useState<PublicReservation | null>(null)

  const locationId = location?.locationId
  const restaurantName =
    config?.restaurantName ||
    config?.name ||
    location?.displayName ||
    location?.restaurantName ||
    location?.name ||
    slug

  const minPartySize = config?.minPartySize || 1
  const maxPartySize = config?.maxPartySize || 12

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
        const resolvedLocation = await publicRequest<PublicBookableLocation>(
          ENDPOINTS.publicBookableLocation(slug)
        )
        if (cancelled) return

        setLocation(resolvedLocation)

        const bookingConfig = await publicRequest<PublicBookingConfig>(
          ENDPOINTS.publicBookingConfig(resolvedLocation.locationId)
        )
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

    void loadInitialBookingData()

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
        const response = await publicRequest<unknown>(
          ENDPOINTS.publicAvailability(
            locationId,
            serviceDate,
            partySize,
            source === 'google' ? 'google' : 'public_web'
          )
        )
        if (!cancelled) {
          setSlots(unwrapAvailabilitySlots(response))
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

    void loadSlots()

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

      setSubmitting(true)
      setError('')

      try {
        const reservation = await publicRequest<PublicReservation>(
          ENDPOINTS.publicReservations(locationId),
          {
            method: 'POST',
            body: JSON.stringify({
              guestName: guestName.trim(),
              guestPhone: guestPhone.replace(/\D/g, ''),
              guestEmail: guestEmail.trim() || undefined,
              partySize,
              serviceDate,
              reservationTime: selectedTime,
              source: source === 'google' ? 'google_business_profile' : 'public_web',
            }),
          }
        )
        setConfirmation(reservation)
      } catch (err) {
        setError(getErrorMessage(err, 'Reservation could not be created. Please try another time.'))
      } finally {
        setSubmitting(false)
      }
    },
    [guestEmail, guestName, guestPhone, locationId, partySize, selectedTime, serviceDate, source]
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
          <p className="eyebrow">Reservation requested</p>
          <h1>{restaurantName}</h1>
          <p className="confirmation-line">
            {partySize} guests on {serviceDate} at {formatTime(confirmedTime)}
          </p>
          {confirmation.confirmationCode && (
            <p className="confirmation-code">Confirmation {confirmation.confirmationCode}</p>
          )}
          <p className="subtle">The restaurant will receive your request immediately.</p>
          <p className="powered">Powered by SHIRE</p>
        </section>
      </main>
    )
  }

  return (
    <main className="booking-shell">
      <section className="booking-panel">
        <header className="booking-header">
          <p className="eyebrow">Book a table</p>
          <h1>{restaurantName}</h1>
          <p className="subtle">Choose a party size and time. We will send your request to the host stand.</p>
        </header>

        <form className="booking-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="booking-grid">
            <label>
              <span><Calendar size={16} /> Date</span>
              <input
                type="date"
                min={todayInputValue()}
                value={serviceDate}
                onChange={(event) => setServiceDate(event.target.value)}
                required
              />
            </label>
            <label>
              <span><Users size={16} /> Party size</span>
              <input
                type="number"
                min={minPartySize}
                max={maxPartySize}
                value={partySize}
                onChange={(event) => setPartySize(Number(event.target.value) || minPartySize)}
                required
              />
            </label>
          </div>

          <section className="slots-section">
            <h2><Clock size={16} /> Available times</h2>
            {slotsLoading && <p className="slot-state">Checking availability...</p>}
            {slotError && <p className="error">{slotError}</p>}
            {!slotsLoading && !slotError && slots.length === 0 && (
              <p className="slot-state">No times are available for this date and party size.</p>
            )}
            <div className="slot-grid">
              {slots.map((slot) => {
                const time = normalizeTime(slot)
                const disabled = slot.available === false
                return (
                  <button
                    type="button"
                    key={slot.id || time}
                    className={selectedTime === time ? 'selected' : ''}
                    disabled={disabled || !time}
                    onClick={() => setSelectedTime(time)}
                  >
                    {slot.label || formatTime(time)}
                  </button>
                )
              })}
            </div>
          </section>

          <div className="booking-grid">
            <label>
              <span>Name</span>
              <input value={guestName} onChange={(event) => setGuestName(event.target.value)} required />
            </label>
            <label>
              <span>Phone</span>
              <input
                type="tel"
                value={guestPhone}
                onChange={(event) => setGuestPhone(event.target.value)}
                required
              />
            </label>
          </div>

          <label>
            <span>Email optional</span>
            <input
              type="email"
              value={guestEmail}
              onChange={(event) => setGuestEmail(event.target.value)}
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button className="confirm-button" type="submit" disabled={submitting || !selectedTime}>
            {submitting ? <Loader2 className="spin" size={18} /> : <PartyPopper size={18} />}
            Request reservation
          </button>
          <p className="powered">Powered by SHIRE</p>
        </form>
      </section>
    </main>
  )
}

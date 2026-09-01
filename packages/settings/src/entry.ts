/**
 * Shared entry helpers for onboarding and permanent setup editors.
 *
 * These helpers deliberately keep draft values as strings. They make typing
 * predictable without silently inventing a valid saved value; authoritative
 * payload validation still runs before a request is sent and on the server.
 */

export const digitsOnly = (value: unknown, maxLength?: number): string => {
  const digits = String(value ?? '').replace(/\D/g, '')
  return typeof maxLength === 'number' ? digits.slice(0, maxLength) : digits
}

export const formatUsPhoneInput = (value: unknown): string => {
  let digits = digitsOnly(value)
  if (digits.length > 10 && digits.startsWith('1')) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  if (!digits) return ''
  if (digits.length < 4) return `(${digits}`
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export const normalizeUsPhoneE164 = (value: unknown): string | null => {
  let digits = digitsOnly(value)
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  return digits.length === 10 ? `+1${digits}` : null
}

export const usPhoneError = (value: unknown, required = false): string => {
  if (!String(value ?? '').trim()) return required ? 'Phone number is required.' : ''
  return normalizeUsPhoneE164(value) ? '' : 'Enter a complete 10-digit phone number.'
}

export const formatEinInput = (value: unknown): string => {
  const digits = digitsOnly(value, 9)
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}-${digits.slice(2)}`
}

export const einError = (value: unknown, required = false): string => {
  if (!String(value ?? '').trim()) return required ? 'EIN is required.' : ''
  return digitsOnly(value).length === 9 ? '' : 'Enter a complete 9-digit EIN.'
}

export const normalizeEmailInput = (value: unknown): string => {
  const trimmed = String(value ?? '').trim()
  const at = trimmed.lastIndexOf('@')
  if (at < 0) return trimmed
  return `${trimmed.slice(0, at)}@${trimmed.slice(at + 1).toLowerCase()}`
}

export const isValidEmail = (value: unknown): boolean => {
  const email = normalizeEmailInput(value)
  return email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

export const emailError = (value: unknown, required = false): string => {
  if (!String(value ?? '').trim()) return required ? 'Email is required.' : ''
  return isValidEmail(value) ? '' : 'Enter a complete email address.'
}

export const sanitizeDecimalInput = (
  value: unknown,
  { decimalPlaces = 2, wholeDigits = 9 }: { decimalPlaces?: number; wholeDigits?: number } = {},
): string => {
  const source = String(value ?? '')
  const sign = source.trimStart().startsWith('-') ? '-' : ''
  const cleaned = source.replace(/[^\d.]/g, '')
  const dotIndex = cleaned.indexOf('.')
  const wholeSource = dotIndex < 0 ? cleaned : cleaned.slice(0, dotIndex)
  const fractionSource = dotIndex < 0 ? '' : cleaned.slice(dotIndex + 1).replace(/\./g, '')
  const whole = wholeSource.slice(0, wholeDigits)
  if (dotIndex < 0 || decimalPlaces === 0) return `${sign}${whole}`
  return `${sign}${whole || '0'}.${fractionSource.slice(0, decimalPlaces)}`
}

export const sanitizeMoneyInput = (value: unknown): string =>
  sanitizeDecimalInput(value, { decimalPlaces: 2, wholeDigits: 9 })

export const sanitizePercentInput = (value: unknown): string =>
  sanitizeDecimalInput(value, { decimalPlaces: 2, wholeDigits: 3 })

export const sanitizeCountInput = (value: unknown, maxDigits = 5): string =>
  digitsOnly(value, maxDigits)

export const numberRangeError = (
  value: unknown,
  label: string,
  { required = false, min = 0, max, integer = false }: { required?: boolean; min?: number; max?: number; integer?: boolean } = {},
): string => {
  const draft = String(value ?? '').trim()
  if (!draft) return required ? `${label} is required.` : ''
  const parsed = Number(draft)
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) {
    return `Enter a valid ${integer ? 'whole number' : 'number'} for ${label.toLowerCase()}.`
  }
  if (parsed < min) return `${label} must be at least ${min}.`
  if (max != null && parsed > max) return `${label} cannot exceed ${max}.`
  return ''
}

export const percentageError = (value: unknown, label: string, required = false): string =>
  numberRangeError(value, label, { required, min: 0, max: 100 })

export const isValidAbaRoutingNumber = (value: unknown): boolean => {
  const digits = digitsOnly(value)
  if (digits.length !== 9 || /^0{9}$/.test(digits)) return false
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1]
  const checksum = digits.split('').reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0)
  return checksum % 10 === 0
}

export const routingNumberError = (value: unknown, required = false): string => {
  if (!String(value ?? '').trim()) return required ? 'Routing number is required.' : ''
  return isValidAbaRoutingNumber(value) ? '' : 'Enter a valid 9-digit U.S. routing number.'
}

export const bankAccountError = (value: unknown, required = false): string => {
  const digits = digitsOnly(value)
  if (!digits) return required ? 'Account number is required.' : ''
  return digits.length >= 4 && digits.length <= 17
    ? ''
    : 'Account number must contain 4 to 17 digits.'
}

export const parseEmailList = (value: unknown): string[] => {
  const source = (Array.isArray(value) ? value : [value])
    .flatMap(item => String(item ?? '').split(/[;,\n]/))
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of source) {
    const email = normalizeEmailInput(item)
    const key = email.toLowerCase()
    if (!email || seen.has(key)) continue
    seen.add(key)
    result.push(email)
  }
  return result
}

export const emailListError = (value: unknown): string => {
  const source = (Array.isArray(value) ? value : [value])
    .flatMap(item => String(item ?? '').split(/[;,\n]/))
  const invalid = source.map(normalizeEmailInput).filter(Boolean).filter(email => !isValidEmail(email))
  return invalid.length ? `Check ${invalid[0]}; it is not a complete email address.` : ''
}

export const collapseEntryWhitespace = (value: unknown): string =>
  String(value ?? '').trim().replace(/\s+/g, ' ')

export const duplicateName = (values: unknown[], value: unknown, currentIndex = -1): boolean => {
  const key = collapseEntryWhitespace(value).toLocaleLowerCase()
  if (!key) return false
  return values.some((candidate, index) => index !== currentIndex && collapseEntryWhitespace(candidate).toLocaleLowerCase() === key)
}

export const dateRangeError = (start: unknown, end: unknown, label = 'Date range'): string => {
  const startValue = String(start ?? '').trim()
  const endValue = String(end ?? '').trim()
  if (!startValue || !endValue) return ''
  return endValue < startValue ? `${label} must end on or after it starts.` : ''
}

export const isValidIsoDate = (value: unknown): boolean => {
  const text = String(value ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const parsed = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text
}

type ReservationTimingValues = {
  reservation_timing_same_for_channels?: boolean
  reservation_online_booking_horizon_days?: unknown
  reservation_online_lead_time_minutes?: unknown
  reservation_online_grace_period_minutes?: unknown
  reservation_staff_booking_horizon_days?: unknown
  reservation_staff_lead_time_minutes?: unknown
  reservation_staff_grace_period_minutes?: unknown
  reservation_slot_interval_minutes?: unknown
  reservation_min_party_size?: unknown
  reservation_max_party_size?: unknown
  reservation_default_duration_minutes?: unknown
}

/** Validates reservation settings without silently clamping what the user typed. */
export const reservationTimingError = (values: ReservationTimingValues): string => {
  const fields: Array<[unknown, string, number, number]> = [
    [values.reservation_slot_interval_minutes, 'Reservation interval', 5, 180],
    [values.reservation_min_party_size, 'Minimum party size', 1, 99],
    [values.reservation_max_party_size, 'Maximum party size', 1, 99],
    [values.reservation_default_duration_minutes, 'Default reservation duration', 15, 240],
    [values.reservation_online_booking_horizon_days, 'Online booking horizon', 0, 365],
    [values.reservation_online_lead_time_minutes, 'Online lead time', 0, 10080],
    [values.reservation_online_grace_period_minutes, 'Online grace period', 0, 360],
  ]
  if (!values.reservation_timing_same_for_channels) {
    fields.push(
      [values.reservation_staff_booking_horizon_days, 'Staff booking horizon', 0, 365],
      [values.reservation_staff_lead_time_minutes, 'Staff lead time', 0, 10080],
      [values.reservation_staff_grace_period_minutes, 'Staff grace period', 0, 360],
    )
  }
  for (const [value, label, min, max] of fields) {
    const error = numberRangeError(value, label, { required: true, min, max, integer: true })
    if (error) return error
  }
  const interval = Number(values.reservation_slot_interval_minutes)
  if (interval % 5 !== 0) return 'Reservation interval must use 5-minute increments.'
  const duration = Number(values.reservation_default_duration_minutes)
  if (duration % 5 !== 0) return 'Default reservation duration must use 5-minute increments.'
  if (Number(values.reservation_min_party_size) > Number(values.reservation_max_party_size)) {
    return 'Maximum party size must be at least the minimum party size.'
  }
  return ''
}

/** Network printers must be addressed by a private/local host, never a public endpoint. */
export const printerHostError = (value: unknown, required = false): string => {
  const host = String(value ?? '').trim().toLowerCase()
  if (!host) return required ? 'Printer address is required.' : ''
  if (/^https?:\/\//.test(host) || /[/?#\s]/.test(host)) {
    return 'Enter only the printer IP address or local hostname.'
  }
  if (host === 'localhost' || host.endsWith('.local')) return ''
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number)
    if (octets.some(octet => octet > 255)) return 'Enter a valid private printer IP address.'
    const [a, b] = octets
    if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return ''
    return 'Use the printer’s private network IP address.'
  }
  if (/^(?=.{1,63}$)(?!-)[a-z0-9-]+(?<!-)$/.test(host)) return ''
  return 'Enter a valid printer IP address or local hostname.'
}

type ModifierGroupRuleValues = {
  is_required?: unknown
  min_selections?: unknown
  max_selections?: unknown
  included_count?: unknown
  overage_price?: unknown
}

/** Validates the shared question rules consumed by every menu editor and the POS. */
export const modifierGroupRuleError = (values: ModifierGroupRuleValues): string => {
  const required = values.is_required === true
  const minError = numberRangeError(values.min_selections ?? 0, 'Minimum selections', {
    required: true,
    min: required ? 1 : 0,
    max: 99,
    integer: true,
  })
  if (minError) return minError
  const maxError = numberRangeError(values.max_selections, 'Maximum selections', { min: 0, max: 99, integer: true })
  if (maxError) return maxError
  const includedError = numberRangeError(values.included_count ?? 0, 'Included selections', { required: true, min: 0, max: 99, integer: true })
  if (includedError) return includedError
  const overageError = numberRangeError(values.overage_price, 'Overage price', { min: 0 })
  if (overageError) return overageError
  const minimum = Number(values.min_selections ?? 0)
  if (values.max_selections != null && values.max_selections !== '') {
    const maximum = Number(values.max_selections)
    if (maximum < minimum) return 'Maximum selections cannot be below the minimum.'
    if (Number(values.included_count ?? 0) > maximum) return 'Included selections cannot exceed the maximum.'
  }
  return ''
}

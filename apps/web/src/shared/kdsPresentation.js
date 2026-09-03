export const DEFAULT_TICKET_AGE_COLORS = Object.freeze({
  normal: '#E8E3D7',
  warning: Object.freeze({ after_seconds: 480, color: '#E3B34D' }),
  late: Object.freeze({ after_seconds: 720, color: '#D97845' }),
  rush: '#C93632',
})

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

export function normalizeTicketAgeColors(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const stage = (key, fallback) => {
    const candidate = raw[key]
    const seconds = Number(candidate?.after_seconds)
    return candidate && typeof candidate === 'object' && Number.isInteger(seconds) && seconds >= 0 && seconds <= 7200 && HEX_COLOR.test(String(candidate.color || ''))
      ? { after_seconds: seconds, color: String(candidate.color).toUpperCase() }
      : { ...fallback }
  }
  return {
    normal: HEX_COLOR.test(String(raw.normal || '')) ? String(raw.normal).toUpperCase() : DEFAULT_TICKET_AGE_COLORS.normal,
    warning: stage('warning', DEFAULT_TICKET_AGE_COLORS.warning),
    late: stage('late', DEFAULT_TICKET_AGE_COLORS.late),
    rush: HEX_COLOR.test(String(raw.rush || '')) ? String(raw.rush).toUpperCase() : DEFAULT_TICKET_AGE_COLORS.rush,
  }
}

export function isRushRed(value) {
  if (!HEX_COLOR.test(String(value || ''))) return false
  const color = String(value).slice(1)
  const red = Number.parseInt(color.slice(0, 2), 16)
  const green = Number.parseInt(color.slice(2, 4), 16)
  const blue = Number.parseInt(color.slice(4, 6), 16)
  return red >= 120 && red >= green * 1.35 && red >= blue * 1.35
}

export function ticketTimingError(colors, rushAfterSeconds) {
  const value = normalizeTicketAgeColors(colors)
  const rush = Number(rushAfterSeconds)
  if (!Number.isInteger(rush) || rush < 1 || rush > 7200) return 'Rush time must be between 1 second and 120 minutes.'
  if (value.warning.after_seconds >= value.late.after_seconds) return 'Warning time must be before Late time.'
  if (value.late.after_seconds >= rush) return 'Late time must be before Rush time.'
  if (!isRushRed(value.rush)) return 'Rush must use a red header color.'
  return ''
}

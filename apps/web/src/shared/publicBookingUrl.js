export const DEFAULT_PUBLIC_BOOKING_BASE_URL = 'https://shire-reservations.vercel.app'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function resolvePublicBookingBaseUrl(configuredBaseUrl, production = false) {
  const configured = String(configuredBaseUrl || '').trim()
  if (!configured) return DEFAULT_PUBLIC_BOOKING_BASE_URL

  try {
    const parsed = new URL(configured)
    if (!['http:', 'https:'].includes(parsed.protocol)) return DEFAULT_PUBLIC_BOOKING_BASE_URL
    if (production && parsed.protocol !== 'https:') return DEFAULT_PUBLIC_BOOKING_BASE_URL
    if (production && LOOPBACK_HOSTS.has(parsed.hostname)) return DEFAULT_PUBLIC_BOOKING_BASE_URL
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
  } catch {
    return DEFAULT_PUBLIC_BOOKING_BASE_URL
  }
}

export function buildPublicBookingUrl({
  slug,
  canonicalBookingUrl,
  configuredBaseUrl,
  production = false,
}) {
  const baseUrl = resolvePublicBookingBaseUrl(configuredBaseUrl, production)
  const fallbackPath = `/book/${encodeURIComponent(String(slug || '').trim() || 'restaurant')}`
  let bookingPath = fallbackPath

  if (canonicalBookingUrl) {
    try {
      const parsed = new URL(String(canonicalBookingUrl), `${baseUrl}/`)
      if (/^\/book\/[^/]+\/?$/.test(parsed.pathname)) bookingPath = parsed.pathname.replace(/\/$/, '')
    } catch {
      // Use the current slug when the API did not return a valid booking path.
    }
  }

  return `${baseUrl}${bookingPath}`
}

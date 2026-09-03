export const DEFAULT_PUBLIC_BOOKING_BASE_URL: string

export function resolvePublicBookingBaseUrl(
  configuredBaseUrl?: string | null,
  production?: boolean,
): string

export function buildPublicBookingUrl(options: {
  slug?: string | null
  canonicalBookingUrl?: string | null
  configuredBaseUrl?: string | null
  production?: boolean
}): string

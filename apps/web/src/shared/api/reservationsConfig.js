export function resolveReservationsApiBaseUrl(configuredUrl, developmentFallback = '') {
  const configured = String(configuredUrl || '').trim().replace(/\/+$/, '')
  if (configured) return configured
  return String(developmentFallback || '').trim().replace(/\/+$/, '')
}

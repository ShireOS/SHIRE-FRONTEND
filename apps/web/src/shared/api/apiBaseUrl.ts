export const DEFAULT_API_BASE_PATH = '/ml-api'

export function isSafeSameOriginApiBasePath(value: string): boolean {
  // A production override is a URL base, not a general URL. Restrict it to a
  // root-relative pathname so URL parsing can never reinterpret `//host`, a
  // backslash, a query, or a fragment as a different request destination.
  return /^\/(?!\/)[^\\?#\u0000-\u001f\u007f]*$/.test(value)
}

export function resolveProductionApiBasePath(value: string | undefined): string {
  const candidate = value?.trim() || ''
  return isSafeSameOriginApiBasePath(candidate) ? candidate : DEFAULT_API_BASE_PATH
}

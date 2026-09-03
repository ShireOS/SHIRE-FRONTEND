export function normalizeSupabaseUrl(value) {
  const candidate = typeof value === 'string' ? value.trim() : ''
  if (!candidate) return null

  try {
    const parsed = new URL(candidate)
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null
    return parsed.origin
  } catch {
    return null
  }
}

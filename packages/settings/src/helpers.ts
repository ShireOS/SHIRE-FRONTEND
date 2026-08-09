// Shared primitives used by every settings domain. These were copy-pasted
// (with drift) across the web setup panel, web onboarding, and mobile admin
// settings; this package is now the single source of truth.

/** Keep digits and at most one decimal point; the text stays editable. */
export function sanitizeNumber(value: unknown): string {
  return String(value ?? '')
    .replace(/[^\d.]/g, '')
    .replace(/(\..*)\./g, '$1')
    .slice(0, 10)
}

/** Digits only (party sizes, hold minutes, weekday numbers typed as text). */
export function sanitizeInteger(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '')
}

export function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

/** Role keys match the job_codes.code shape: lowercase snake, letter first. */
export function slugRoleCode(value: unknown, fallback = 'role'): string {
  const raw = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return /^[a-z]/.test(raw) ? raw.slice(0, 80) : `role_${raw || fallback}`.slice(0, 80)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

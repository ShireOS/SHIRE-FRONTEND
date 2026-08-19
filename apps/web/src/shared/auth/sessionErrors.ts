interface SessionErrorLike {
  message?: string
  code?: string
}

const UNRECOVERABLE_SESSION_CODES = new Set([
  'refresh_token_not_found',
  'invalid_refresh_token',
  'session_not_found',
])

export function isUnrecoverableSessionError(error: SessionErrorLike | null | undefined): boolean {
  const code = String(error?.code || '').trim().toLowerCase()
  if (UNRECOVERABLE_SESSION_CODES.has(code)) return true

  const message = String(error?.message || '').trim().toLowerCase()
  return message.includes('invalid refresh token')
    || message.includes('refresh token not found')
    || message.includes('session not found')
}

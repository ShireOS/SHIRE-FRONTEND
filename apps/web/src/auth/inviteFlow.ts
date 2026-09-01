export const PENDING_INVITE_STORAGE_KEY = 'shire_pending_access_invite_token'

export function safeAuthNext(value: string | null | undefined): string | null {
  if (!value?.startsWith('/') || value.startsWith('//')) return null
  if (value.startsWith('/auth/callback')) return null
  return value
}

export function invitePath(token: string): string {
  return `/invite?token=${encodeURIComponent(token)}`
}

export function inviteAuthRoutes(token: string, email: string) {
  const next = invitePath(token)
  const encodedNext = encodeURIComponent(next)
  const encodedEmail = encodeURIComponent(email)
  return {
    next,
    login: `/auth/login?next=${encodedNext}&email=${encodedEmail}`,
    signup: `/auth/signup?next=${encodedNext}&email=${encodedEmail}&invited=1`,
  }
}

export function createAppAuthUrl(
  origin: string,
  path: 'callback' | 'reset-password',
  next?: string | null,
): string {
  const url = new URL(`/auth/${path}`, origin)
  const safeNext = safeAuthNext(next)
  if (safeNext) url.searchParams.set('next', safeNext)
  return url.toString()
}

export function callbackNext(search: string): string | null {
  return safeAuthNext(new URLSearchParams(search).get('next'))
}

const SESSION_REFRESH_SKEW_MS = 60_000

interface SessionLike {
  access_token?: string
  expires_at?: number
}

interface SessionResult {
  data?: { session?: SessionLike | null } | null
  error?: { message?: string } | null
}

interface AuthClientLike {
  getSession: () => Promise<SessionResult>
  refreshSession: () => Promise<SessionResult>
}

interface AuthenticatedRequestOptions {
  auth: AuthClientLike
  request: (accessToken: string) => Promise<Response>
  signal?: AbortSignal | null
  nowMs?: number
}

const refreshes = new WeakMap<object, Promise<string>>()

export class PosSessionError extends Error {
  status = 401
  code = 'pos_session_expired'

  constructor(message = 'Your dashboard session expired. Sign in again.') {
    super(message)
    this.name = 'PosSessionError'
  }
}

export function sessionExpiresSoon(
  session: SessionLike | null | undefined,
  nowMs = Date.now(),
  skewMs = SESSION_REFRESH_SKEW_MS,
): boolean {
  if (!session?.expires_at) return false
  return session.expires_at * 1000 <= nowMs + skewMs
}

async function readSession(auth: AuthClientLike): Promise<SessionLike> {
  const result = await auth.getSession()
  if (result.error) throw new PosSessionError(result.error.message)
  const session = result.data?.session
  if (!session?.access_token) throw new PosSessionError()
  return session
}

async function refreshAccessToken(
  auth: AuthClientLike,
  rejectedToken: string,
  nowMs = Date.now(),
): Promise<string> {
  const activeRefresh = refreshes.get(auth as object)
  if (activeRefresh) return activeRefresh

  const refresh = (async () => {
    const current = await readSession(auth)

    // Another tab or request may already have rotated the rejected token.
    if (current.access_token !== rejectedToken && !sessionExpiresSoon(current, nowMs)) {
      return current.access_token as string
    }

    const result = await auth.refreshSession()
    const refreshed = result.data?.session
    if (!result.error && refreshed?.access_token) return refreshed.access_token

    // Cross-tab refreshes can win while this call is in flight. Read storage
    // once more before forcing a user whose session was actually recovered out.
    try {
      const latest = await readSession(auth)
      if (latest.access_token !== current.access_token && !sessionExpiresSoon(latest)) {
        return latest.access_token as string
      }
    } catch {
      // Preserve the refresh failure below.
    }

    throw new PosSessionError(result.error?.message)
  })()

  refreshes.set(auth as object, refresh)
  try {
    return await refresh
  } finally {
    if (refreshes.get(auth as object) === refresh) refreshes.delete(auth as object)
  }
}

export async function getValidPosAccessToken(
  auth: AuthClientLike,
  nowMs = Date.now(),
): Promise<string> {
  const session = await readSession(auth)
  if (!sessionExpiresSoon(session, nowMs)) return session.access_token as string
  return refreshAccessToken(auth, session.access_token as string, nowMs)
}

export async function requestWithPosSession({
  auth,
  request,
  signal,
  nowMs = Date.now(),
}: AuthenticatedRequestOptions): Promise<Response> {
  let token = await getValidPosAccessToken(auth, nowMs)
  let response = await request(token)

  if (response.status !== 401 || signal?.aborted) return response

  token = await refreshAccessToken(auth, token)
  response = await request(token)
  return response
}

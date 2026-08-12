import { supabase } from '../lib/supabase'
import { API_CONFIG } from '../api/config'
import { fetchPosApi } from '../api/posClient'
import { requestWithPosSession } from '../api/posSession'
import { withOptionalRequestDeadline } from '../api/requestDeadline'

const POS_OWNED_RESTAURANT_ROUTE =
  /^\/restaurants\/([^/]+)\/(?:tips-payroll-settings|pay-periods|tip-pools(?:\/|$)|job-codes(?:\/|$))/

export async function fetchWithSupabaseAuth<T = any>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const posRoute = endpoint.match(POS_OWNED_RESTAURANT_ROUTE)
  if (posRoute) {
    return fetchPosApi<T>(decodeURIComponent(posRoute[1]), endpoint, options)
  }
  const { timeoutMs, ...init } = options
  const response = await withOptionalRequestDeadline(
    (requestSignal) => requestWithPosSession({
      auth: supabase.auth,
      signal: requestSignal,
      request: (accessToken) => {
        const headers = new Headers(init.headers || {})
        if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
        headers.set('Authorization', `Bearer ${accessToken}`)
        return fetch(`${API_CONFIG.baseUrl}${endpoint}`, { ...init, headers, signal: requestSignal })
      },
    }),
    { signal: init.signal, timeoutMs, message: 'The dashboard took too long to load. Try again.' },
  )
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body.detail || body.message
    const message = typeof detail === 'string'
      ? detail
      : detail
        ? JSON.stringify(detail)
        : `Request failed (${response.status})`
    const error = new Error(message) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  if (response.status === 204) return null as T
  return response.json() as Promise<T>
}

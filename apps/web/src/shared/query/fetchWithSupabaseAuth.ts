import { supabase } from '../lib/supabase'
import { API_CONFIG } from '../api/config'
import { fetchPosApi } from '../api/posClient'

const POS_OWNED_RESTAURANT_ROUTE =
  /^\/restaurants\/([^/]+)\/(?:tips-payroll-settings|pay-periods|tip-pools(?:\/|$)|job-codes(?:\/|$))/

export async function fetchWithSupabaseAuth<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const posRoute = endpoint.match(POS_OWNED_RESTAURANT_ROUTE)
  if (posRoute) {
    return fetchPosApi<T>(decodeURIComponent(posRoute[1]), endpoint, options)
  }
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  const headers = new Headers(options.headers || {})
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
    ...options,
    headers,
  })
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

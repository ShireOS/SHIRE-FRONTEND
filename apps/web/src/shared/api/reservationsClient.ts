import { supabase } from '../lib/supabase'
import { resolveReservationsApiBaseUrl } from './reservationsConfig.js'

const configuredBaseUrl = (
  import.meta.env.VITE_RESERVATIONS_API_BASE_URL ||
  import.meta.env.VITE_RESERVATIONS_API_BASE ||
  ''
)

export const reservationsApiBaseUrl = resolveReservationsApiBaseUrl(
  configuredBaseUrl,
)

export class ReservationsApiError extends Error {
  status: number
  code: string | null
  details: Record<string, unknown>

  constructor(message: string, status: number, code: string | null, details: Record<string, unknown>) {
    super(message)
    this.name = 'ReservationsApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export async function fetchReservationsApi<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  if (!reservationsApiBaseUrl) {
    throw new Error('Reservations API is not configured for this deployment.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const headers = new Headers(options.headers || {})
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (sessionData?.session?.access_token) {
    headers.set('Authorization', `Bearer ${sessionData.session.access_token}`)
  }

  let response: Response
  try {
    response = await fetch(`${reservationsApiBaseUrl}${endpoint}`, { ...options, headers })
  } catch {
    throw new Error('Reservations service is currently unreachable.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body?.message || body?.detail
    throw new ReservationsApiError(
      typeof detail === 'string' ? detail : `Reservations request failed (${response.status})`,
      response.status,
      typeof body?.code === 'string' ? body.code : null,
      body && typeof body === 'object' ? body : {},
    )
  }
  if (response.status === 204) return null as T
  return response.json() as Promise<T>
}

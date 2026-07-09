import { supabase } from '../lib/supabase'

// Second backend: the POS API (Shire_POS_backend). The dashboard talks to it
// for time clock management; auth is the dashboard's Supabase JWT plus an
// X-Restaurant-Id header (the POS backend resolves owner/member access itself).
const POS_API_BASE = (
  import.meta.env.VITE_POS_API_BASE_URL ||
  import.meta.env.VITE_POS_API_BASE ||
  (import.meta.env.DEV
    ? 'http://localhost:8005/api/v1/dev-v2'
    : 'https://shire-pos-api-production.up.railway.app/api/v1/dev-v2')
).replace(/\/+$/, '')

export async function fetchPosApi<T = any>(
  restaurantId: string,
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  const headers = new Headers(options.headers || {})
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  headers.set('X-Restaurant-Id', restaurantId)

  const response = await fetch(`${POS_API_BASE}${endpoint}`, { ...options, headers })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body.detail || body.message
    const message = typeof detail === 'string'
      ? detail
      : detail
        ? JSON.stringify(detail)
        : `POS request failed (${response.status})`
    const error = new Error(message) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  if (response.status === 204) return null as T
  return response.json() as Promise<T>
}

export interface TimeClockBreak {
  id?: string
  break_name: string
  break_type: 'paid' | 'unpaid'
  break_in_at: string
  break_out_at?: string | null
}

export interface TimeClockEntryInput {
  staff_id: string
  clock_in_at: string
  clock_out_at?: string | null
  role?: string | null
  reason: string
  breaks?: TimeClockBreak[]
}

export const posTimeClockApi = {
  rangeReport: (restaurantId: string, startDate: string, endDate: string) =>
    fetchPosApi(restaurantId, `/manager/timeclock/entries?start_date=${startDate}&end_date=${endDate}`),
  createEntry: (restaurantId: string, input: TimeClockEntryInput) =>
    fetchPosApi(restaurantId, '/manager/timeclock/entries', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateEntry: (restaurantId: string, entryId: string, input: Partial<TimeClockEntryInput>) =>
    fetchPosApi(restaurantId, `/manager/timeclock/entries/${entryId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  voidEntry: (restaurantId: string, entryId: string, reason: string) =>
    fetchPosApi(restaurantId, `/manager/timeclock/entries/${entryId}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
}

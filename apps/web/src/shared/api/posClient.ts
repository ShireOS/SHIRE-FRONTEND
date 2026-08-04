import { supabase } from '../lib/supabase'

// Second backend: the POS API (Shire_POS_backend). The dashboard talks to it
// for time clock management, printing, and report tooling; auth is the
// dashboard's Supabase JWT plus an X-Restaurant-Id header (the POS backend
// resolves owner/member access itself). The POS backend consolidates its POS
// surface under /api/v1/dev-v2 on every deployment; only a few integration
// routes (host handoffs, the reseller menu workspace) live on the plain
// /api/v1 mount. The base URL is therefore normalized to end at /api/v1 and
// the mount is chosen per call via options.mount. Production uses the Vercel
// same-origin proxy so authenticated browser requests do not depend on CORS.
const POS_API_BASE = (
  import.meta.env.VITE_POS_API_BASE_URL ||
  import.meta.env.VITE_POS_API_BASE ||
  '/pos-api'
)
  .replace(/\/+$/, '')
  .replace(/\/dev-v2$/, '')

export interface FetchPosApiOptions extends RequestInit {
  // 'pos' (default) targets the consolidated /api/v1/dev-v2 surface;
  // 'integration' targets the plain /api/v1 mount.
  mount?: 'pos' | 'integration'
}

export async function fetchPosApi<T = any>(
  restaurantId: string,
  endpoint: string,
  options: FetchPosApiOptions = {},
): Promise<T> {
  const { mount = 'pos', ...init } = options
  const base = mount === 'integration' ? POS_API_BASE : `${POS_API_BASE}/dev-v2`
  const { data: sessionData } = await supabase.auth.getSession()
  let token = sessionData?.session?.access_token
  const request = (accessToken?: string) => {
    const headers = new Headers(init.headers || {})
    if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('X-Restaurant-Id', restaurantId)
    return fetch(`${base}${endpoint}`, { ...init, headers })
  }

  const method = String(init.method || 'GET').toUpperCase()
  const canRetryTransport = method === 'GET' || (method === 'POST' && endpoint.endsWith('/preview'))
  const requestWithTransportRetry = async (accessToken?: string) => {
    try {
      return await request(accessToken)
    } catch (error) {
      if (!canRetryTransport || init.signal?.aborted) throw error
      await new Promise(resolve => setTimeout(resolve, 400))
      return request(accessToken)
    }
  }

  let response = await requestWithTransportRetry(token)
  if (response.status === 401 && !init.signal?.aborted) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    const refreshedToken = refreshed.session?.access_token
    if (refreshedToken && refreshedToken !== token) {
      token = refreshedToken
      response = await requestWithTransportRetry(token)
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body.detail || body.message
    const message = typeof detail === 'string'
      ? detail
      : detail
        ? JSON.stringify(detail)
        : `POS request failed (${response.status})`
    const error = new Error(message) as Error & { status?: number; detail?: unknown; responseBody?: unknown }
    error.status = response.status
    error.detail = detail
    error.responseBody = body
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

export interface CheckLedgerQuery {
  business_date?: string | null
  date_from?: string | null
  date_to?: string | null
  tab?: 'all' | 'transactions' | 'needs_attention'
  search?: string
  status?: string
  payment_status?: string
  payment_method?: string
  occurred_from?: string
  occurred_to?: string
  waiter_id?: string
  metric?: 'sales' | 'transactions' | 'active_checks' | 'voids' | 'refunds' | 'discounts' | 'comps'
  event_type?: string
  reason?: string
  page?: number
  page_size?: number
}

// Read-only manager check ledger (active/closed/history + per-check detail).
// Same POS endpoints the in-store manager ledger uses; card data is brand +
// last four only and no mutations are exposed to the dashboard.
export const posCheckLedgerApi = {
  list: (restaurantId: string, query: CheckLedgerQuery = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
    }
    const qs = params.toString()
    return fetchPosApi(restaurantId, `/manager/check-ledger${qs ? `?${qs}` : ''}`, { signal })
  },
  detail: (restaurantId: string, orderId: string, signal?: AbortSignal) =>
    fetchPosApi(restaurantId, `/manager/check-ledger/${encodeURIComponent(orderId)}`, { signal }),
}

export interface CloseDayFinalizeInput {
  business_date?: string
  close_attempt_id: string
  notes?: string
  discard_print_jobs: boolean
  confirm_auto_clock_out?: boolean
  opening_bank: number
  paid_in: number
  paid_out: number
  cash_refunds: number
  counted_cash: number
  retained_bank: number
  deposit_amount: number
  variance_reason?: string
  decisions: Array<Record<string, unknown>>
}

export const posRefundApi = {
  reasonPresets: (restaurantId: string, signal?: AbortSignal) =>
    fetchPosApi<Array<{
      id: string
      label: string
      code: string
      action_type: 'payment_refund'
      sort_order: number
      is_active: boolean
    }>>(restaurantId, '/manager/reason-presets?action_type=payment_refund', { signal }),
  request: (
    restaurantId: string,
    paymentId: string,
    input: {
      request_id: string
      amount: number
      reason: string
      reason_preset_id: string
      reason_note?: string
      manager_passcode: string
      device_id?: string
    },
  ) => fetchPosApi(restaurantId, `/manager/payments/${encodeURIComponent(paymentId)}/refund-requests`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
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

export interface OpenTimeClockEntry {
  id: string
  staff_id: string
  staff_name: string
  role?: string | null
  clock_in_at: string
  worked_minutes?: number
}

export interface CloseDayPreview {
  business_date: string
  active_business_date?: string
  open_checks: number
  exception_count?: number
  exceptions?: Array<Record<string, unknown>>
  gross_subtotal: number
  discounts: number
  tax: number
  sales_before_tip: number
  tips: number
  total_collected: number
  cash_collected: number
  card_collected: number
  payment_count: number
  closed_checks: number
  voided_checks: number
  pending_print_jobs?: number
  open_timeclock_entries?: OpenTimeClockEntry[]
  business_day?: {
    status: 'open' | 'closed' | 'reopened'
    closed_at?: string | null
    closed_by_name?: string | null
  }
  closeout_settings?: {
    cash_tracking_mode?: string
    require_starting_bank?: boolean
    opening_bank_source?: 'none' | 'fixed' | 'previous_retained'
    opening_bank_default?: number
    track_deposit_at_close?: boolean
    blind_drawer_close?: boolean
    cash_variance_threshold?: number
  }
  cash_reconciliation?: {
    opening_bank: number
    opening_bank_policy?: {
      source: 'none' | 'fixed' | 'previous_retained'
      amount: number
      fallback_amount: number
      fallback_used: boolean
      source_business_date?: string | null
      warning?: { code: string; message: string } | null
    }
    cash_sales: number
    paid_in: number
    paid_out: number
    cash_refunds: number
    expected_cash: number
  }
}

export interface CloseDayInput {
  business_date: string
  close_attempt_id: string
  confirm_auto_clock_out: boolean
  opening_bank: number
  paid_in: number
  paid_out: number
  cash_refunds: number
  counted_cash: number
  retained_bank: number
  deposit_amount: number
  variance_reason?: string
}

export interface CloseDayResult {
  id: string
  business_date: string
  active_business_date: string
  closed_at: string
  totals: CloseDayPreview
  auto_clocked_out: OpenTimeClockEntry[]
  email_delivery?: { status?: string; recipients?: string[] }
  idempotent_replay?: boolean
}

export const posCloseDayApi = {
  preview: (restaurantId: string, businessDate?: string, signal?: AbortSignal) => {
    const query = businessDate ? `?business_date=${encodeURIComponent(businessDate)}` : ''
    return fetchPosApi<CloseDayPreview>(restaurantId, `/manager/close-day/preview${query}`, { signal })
  },
  finalize: (restaurantId: string, input: CloseDayFinalizeInput) =>
    fetchPosApi(restaurantId, '/manager/close-day', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  close: (restaurantId: string, input: CloseDayInput) =>
    fetchPosApi<CloseDayResult>(restaurantId, '/manager/close-day', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
}

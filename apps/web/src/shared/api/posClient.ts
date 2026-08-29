import { supabase } from '../lib/supabase'
import { PosSessionError, requestWithPosSession } from './posSession'
import { redirectForUnrecoverableSession } from '../auth/sessionRecovery'
import { DEFAULT_API_TIMEOUT_MS, withOptionalRequestDeadline } from './requestDeadline'

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
  timeoutMs?: number
}

export async function fetchPosApi<T = any>(
  restaurantId: string,
  endpoint: string,
  options: FetchPosApiOptions = {},
): Promise<T> {
  const { mount = 'pos', timeoutMs, ...init } = options
  const base = mount === 'integration' ? POS_API_BASE : `${POS_API_BASE}/dev-v2`
  const request = (requestSignal?: AbortSignal | null, accessToken?: string) => {
    const headers = new Headers(init.headers || {})
    if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('X-Restaurant-Id', restaurantId)
    return fetch(`${base}${endpoint}`, { ...init, headers, signal: requestSignal })
  }

  const method = String(init.method || 'GET').toUpperCase()
  const canRetryTransport = method === 'GET' || (method === 'POST' && endpoint.endsWith('/preview'))
  const requestWithTransportRetry = async (requestSignal?: AbortSignal | null, accessToken?: string) => {
    try {
      return await request(requestSignal, accessToken)
    } catch (error) {
      if (!canRetryTransport || requestSignal?.aborted) throw error
      await new Promise(resolve => setTimeout(resolve, 400))
      return request(requestSignal, accessToken)
    }
  }

  let response: Response
  try {
    response = await withOptionalRequestDeadline(
      (requestSignal) => requestWithPosSession({
        auth: supabase.auth,
        request: (accessToken) => requestWithTransportRetry(requestSignal, accessToken),
        signal: requestSignal,
      }),
      { signal: init.signal, timeoutMs, message: 'The POS service took too long to respond. Try again.' },
    )
  } catch (error) {
    if (error instanceof PosSessionError && error.unrecoverable) {
      await redirectForUnrecoverableSession()
    }
    throw error
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

// Manager check ledger (active/closed/history + per-check detail). Card data is
// brand + last four only. The sole close-rescue mutation remains server-gated,
// audited, and refuses to rewrite tender history or close a non-zero balance.
export const posCheckLedgerApi = {
  list: (restaurantId: string, query: CheckLedgerQuery = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
    }
    const qs = params.toString()
    return fetchPosApi(restaurantId, `/manager/check-ledger${qs ? `?${qs}` : ''}`, {
      signal,
      timeoutMs: DEFAULT_API_TIMEOUT_MS,
    })
  },
  detail: (restaurantId: string, orderId: string, signal?: AbortSignal) =>
    fetchPosApi(restaurantId, `/manager/check-ledger/${encodeURIComponent(orderId)}`, {
      signal,
      timeoutMs: DEFAULT_API_TIMEOUT_MS,
    }),
  repairStaleSplitAndClose: (restaurantId: string, orderId: string, reason: string) =>
    fetchPosApi(restaurantId, `/manager/check-ledger/${encodeURIComponent(orderId)}/repair-stale-split`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
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
  cash_count_status?: 'counted' | 'not_counted'
  counted_cash: number | null
  confirm_uncounted_cash?: boolean
  uncounted_cash_reason?: string
  retained_bank: number
  deposit_amount: number
  variance_reason?: string
  verification_status?: 'verified' | 'mismatch' | 'unavailable' | 'not_performed'
  verification_checks?: Array<Record<string, unknown>>
  confirm_verification_exception?: boolean
  verification_reason?: string
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
  last_activity_at?: string | null
}

export interface CloseDayPreview {
  business_date: string
  active_business_date?: string
  open_checks: number
  exception_count?: number
  blocking_exception_count?: number
  exception_details_truncated?: boolean
  exceptions?: Array<Record<string, unknown>>
  overdue_close_alerts?: Array<{
    id: string
    code: 'close_day_overdue'
    business_date: string
    title: string
    message: string
    detected_at: string
  }>
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
  pending_receipt_print_jobs?: number
  pending_kitchen_print_jobs?: number
  discarded_print_jobs?: number
  paid_unsent_fulfillment_checks?: number
  paid_unsent_fulfillment_items?: number
  cash_accountability?: {
    pending_count?: number
    reconciliation_required_count?: number
    unreviewed_paid_out_count?: number
  }
  open_timeclock_entries?: OpenTimeClockEntry[]
  business_day?: {
    status: 'open' | 'closed' | 'reopened'
    closed_at?: string | null
    closed_by_name?: string | null
  }
  financial_verification?: {
    status: 'verified' | 'mismatch' | 'unavailable' | 'not_performed'
    complete: boolean
    exception_confirmed?: boolean
    reason?: string | null
    failing_check_count?: number
  }
  closeout_settings?: {
    cash_tracking_mode?: string
    require_starting_bank?: boolean
    opening_bank_source?: 'none' | 'fixed' | 'previous_retained'
    opening_bank_default?: number
    track_deposit_at_close?: boolean
    blind_drawer_close?: boolean
    cash_variance_threshold?: number
    eod_require_paid_outs_reviewed?: boolean
    show_clockout_options_at_close?: boolean
    close_day_activity_quiet_minutes?: number
  }
  close_period?: {
    id?: string
    sequence: number
    next_sequence?: number
    last_completed_sequence?: number | null
    opened_at?: string | null
    last_activity_at?: string | null
    activity_count: number
    recent_activity: boolean
    quiet_minutes: number
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
    cash_count_status?: 'counted' | 'not_counted'
    counted_cash?: number | null
    variance?: number | null
    uncounted_cash_reason?: string | null
  }
}

export interface CloseDayInput {
  business_date: string
  close_attempt_id: string
  discard_print_jobs: boolean
  confirm_auto_clock_out: boolean
  clock_out_mode?: 'all' | 'selected' | 'none'
  clock_out_entry_ids?: string[]
  confirm_recent_activity?: boolean
  opening_bank: number
  paid_in: number
  paid_out: number
  cash_refunds: number
  cash_count_status?: 'counted' | 'not_counted'
  counted_cash?: number | null
  confirm_uncounted_cash?: boolean
  uncounted_cash_reason?: string
  retained_bank: number
  deposit_amount: number
  variance_reason?: string
  verification_status?: 'verified' | 'mismatch' | 'unavailable' | 'not_performed'
  verification_checks?: Array<Record<string, unknown>>
  confirm_verification_exception?: boolean
  verification_reason?: string
}

export interface CloseDayResult {
  id: string
  close_id: string
  close_sequence: number
  opened_at: string
  business_date: string
  active_business_date: string
  closed_at: string
  totals: CloseDayPreview
  auto_clocked_out: OpenTimeClockEntry[]
  expired_print_jobs?: number
  email_delivery?: { status?: string; recipients?: string[] }
  idempotent_replay?: boolean
}

export const posCloseDayApi = {
  preview: (restaurantId: string, businessDate?: string, signal?: AbortSignal) => {
    const query = new URLSearchParams({ compact: 'true' })
    if (businessDate) query.set('business_date', businessDate)
    return fetchPosApi<CloseDayPreview>(restaurantId, `/manager/close-day/preview?${query}`, {
      signal,
      timeoutMs: 20_000,
    })
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

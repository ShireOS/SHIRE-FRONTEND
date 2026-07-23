import { useEffect, useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ReceiptText,
  Search,
} from 'lucide-react'
import { useAuth } from '../../auth'
import { useBackOfficeAccess } from '../../shared/hooks/useBackOfficeAccess'
import { posCheckLedgerApi } from '../../shared/api/posClient'
import { queryKeys } from '../../shared/query'

const LIVE_REFRESH_MS = 15000

const pad = (n) => String(n).padStart(2, '0')
const dateKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const todayKey = () => dateKeyOf(new Date())
const daysAgoKey = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateKeyOf(d)
}

const money = (value) =>
  value === null || value === undefined
    ? '—'
    : Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const shortDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const timeOnly = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const label = (value) =>
  String(value || '')
    .replaceAll('_', ' ')
    .replace(/^\w/, (c) => c.toUpperCase()) || '—'

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'closed', label: 'Closed' },
  { id: 'history', label: 'History' },
]

const HISTORY_STATUSES = [
  { id: '', label: 'Any status' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
  { id: 'voided', label: 'Voided' },
]

function statusPill(item) {
  const status = String(item.status || '').toLowerCase()
  if (status === 'voided') return { text: 'Voided', className: 'bg-red-400/10 text-red-300' }
  if (status === 'open') {
    return item.payment_status === 'paid'
      ? { text: 'Open · paid', className: 'bg-emerald-400/10 text-emerald-300' }
      : { text: 'Open', className: 'bg-shell-accent/15 text-shell-accent' }
  }
  if (item.payment_status === 'paid' || status === 'closed') {
    return { text: label(item.status || 'closed'), className: 'bg-emerald-400/10 text-emerald-300' }
  }
  return { text: label(item.status), className: 'bg-white/5 text-dash-secondary' }
}

function paymentSummary(item) {
  const cards = (item.card_summaries || [])
    .map((card) => [card.brand, card.last4 ? `••${card.last4}` : null].filter(Boolean).join(' '))
    .filter(Boolean)
  if (cards.length > 0) return cards.join(', ')
  if (item.payment_methods && item.payment_methods.length > 0) return item.payment_methods.map(label).join(', ')
  if (item.payment_method) return label(item.payment_method)
  return '—'
}

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timeout)
  }, [value, delay])
  return debounced
}

function SummaryChip({ label: chipLabel, value }) {
  return (
    <span className="flex items-baseline gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
      <span className="font-mono text-sm tabular-nums text-dash-cream">{value}</span>
      <span className="label-mono !text-[9px]">{chipLabel}</span>
    </span>
  )
}

function Metric({ title, value }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-3">
      <p className="label-mono !text-[9px]">{title}</p>
      <p className="mt-1 truncate font-mono text-sm tabular-nums text-dash-cream">{value}</p>
    </div>
  )
}

// Nested per-check view: summary, items, payments, and audit activity from
// GET /manager/check-ledger/{order_id}.
function CheckDetail({ restaurantId, orderId, onBack }) {
  const detailQuery = useQuery({
    queryKey: queryKeys.checkLedgerDetail(restaurantId, orderId),
    queryFn: ({ signal }) => posCheckLedgerApi.detail(restaurantId, orderId, signal),
    staleTime: 10000,
  })

  const detail = detailQuery.data
  const check = detail?.check || {}
  const items = check.items || []
  const payments = detail?.payments || []
  const activity = detail?.activity || []

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-dash-secondary transition hover:text-dash-cream"
        >
          <ArrowLeft size={13} aria-hidden="true" /> All checks
        </button>
        {detail?.needs_attention && (
          <span className="rounded-full bg-red-400/10 px-2.5 py-1 text-[11px] font-semibold text-red-300">
            Needs attention{detail.attention_reasons?.length ? ` · ${detail.attention_reasons.join(', ')}` : ''}
          </span>
        )}
      </div>

      {detailQuery.isPending && <p className="mt-6 text-sm text-dash-tertiary">Loading check…</p>}
      {detailQuery.isError && (
        <p className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {detailQuery.error instanceof Error ? detailQuery.error.message : 'Could not load this check.'}
        </p>
      )}

      {detail && (
        <>
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-dash-cream">
              Check {check.order_number ? `#${check.order_number}` : ''}
            </h3>
            <p className="mt-1 text-sm text-dash-secondary">
              {[
                check.table_number ? `Table ${check.table_number}` : check.guest_name || 'No table',
                check.waiter_name || 'Unassigned',
                `opened ${shortDateTime(check.created_at)}`,
                check.closed_at ? `closed ${shortDateTime(check.closed_at)}` : null,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Metric title="Status" value={label(check.status)} />
            <Metric title="Payment" value={label(check.payment_status)} />
            <Metric title="Subtotal" value={money(check.subtotal)} />
            <Metric title="Tax" value={money(check.tax_amount)} />
            <Metric title="Tip" value={money(check.tip_amount)} />
            <Metric title="Total" value={money(check.total)} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
            <div>
              <p className="label-mono">Items</p>
              {items.length === 0 ? (
                <p className="mt-2 text-sm text-dash-tertiary">No items on this check.</p>
              ) : (
                <ul className="mt-2 divide-y divide-white/5">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className={item.is_voided ? 'text-dash-tertiary line-through' : 'text-dash-secondary'}>
                          {item.quantity > 1 ? `${item.quantity} × ` : ''}{item.name}
                          {item.seat_label || item.seat_number ? (
                            <span className="ml-2 text-xs text-dash-tertiary">
                              {item.seat_label || `Seat ${item.seat_number}`}
                            </span>
                          ) : null}
                        </p>
                        {(item.modifiers || []).length > 0 && (
                          <p className="mt-0.5 truncate text-xs text-dash-tertiary">
                            {(item.modifiers || []).map((mod) => mod?.name || mod).filter(Boolean).join(', ')}
                          </p>
                        )}
                        {item.is_voided && item.void_reason && (
                          <p className="mt-0.5 text-xs text-red-300">Voided · {item.void_reason}</p>
                        )}
                      </div>
                      <span className={`shrink-0 font-mono tabular-nums ${item.is_voided ? 'text-dash-tertiary line-through' : 'text-dash-cream'}`}>
                        {money(item.total_price)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <p className="label-mono">Payments</p>
                {payments.length === 0 ? (
                  <p className="mt-2 text-sm text-dash-tertiary">No payments recorded.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {payments.map((payment) => (
                      <li key={payment.id} className="rounded-xl bg-white/[0.04] p-3 text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-dash-secondary">
                            {label(payment.payment_method)}
                            {payment.card_brand || payment.card_last4
                              ? ` · ${[payment.card_brand, payment.card_last4 ? `••${payment.card_last4}` : null].filter(Boolean).join(' ')}`
                              : ''}
                          </span>
                          <span className="shrink-0 font-mono tabular-nums text-dash-cream">{money(payment.total_charged ?? payment.amount)}</span>
                        </div>
                        <p className="mt-1 text-xs text-dash-tertiary">
                          {label(payment.status)} · {shortDateTime(payment.completed_at || payment.created_at)}
                          {Number(payment.tip_amount) > 0 ? ` · tip ${money(payment.tip_amount)}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="label-mono">Activity</p>
                {activity.length === 0 ? (
                  <p className="mt-2 text-sm text-dash-tertiary">No audit activity for this check.</p>
                ) : (
                  <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {activity.map((entry) => (
                      <li key={`${entry.source}-${entry.id}`} className="rounded-xl bg-white/[0.04] p-3 text-xs">
                        <p className="text-dash-secondary">
                          <span className="font-semibold text-dash-cream">{label(entry.action || entry.source)}</span>
                          {entry.actor_name ? ` · ${entry.actor_name}` : ''}
                        </p>
                        <p className="mt-0.5 text-dash-tertiary">
                          {shortDateTime(entry.created_at)}
                          {entry.reason ? ` · ${entry.reason}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Read-only check ledger on the store homepage: Active / Closed / History
 * tabs over the POS manager check-ledger endpoints, expandable to a
 * full-screen takeover, with drill-in to a single check's detail.
 */
export default function CheckLedgerSection({ restaurantId }) {
  const auth = useAuth()
  const access = useBackOfficeAccess(auth, restaurantId)

  const [tab, setTab] = useState('active')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput.trim())
  const [businessDate, setBusinessDate] = useState(todayKey)
  const [dateFrom, setDateFrom] = useState(() => daysAgoKey(6))
  const [dateTo, setDateTo] = useState(todayKey)
  const [historyStatus, setHistoryStatus] = useState('')
  const [page, setPage] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState(null)

  useEffect(() => {
    setPage(1)
  }, [tab, search, businessDate, dateFrom, dateTo, historyStatus])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (selectedOrderId) setSelectedOrderId(null)
      else setFullscreen(false)
    }
    if (!fullscreen) return undefined
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreen, selectedOrderId])

  const query = useMemo(() => {
    if (tab === 'history') {
      return {
        date_from: dateFrom,
        date_to: dateTo,
        status: historyStatus || undefined,
        search: search || undefined,
        page,
        page_size: 25,
      }
    }
    return {
      business_date: businessDate,
      status: tab === 'active' ? 'open' : 'closed',
      search: search || undefined,
      page,
      page_size: 25,
    }
  }, [tab, businessDate, dateFrom, dateTo, historyStatus, search, page])

  const canView = access.can('reports.view')
  const ledgerQuery = useQuery({
    queryKey: queryKeys.checkLedger(restaurantId, query),
    queryFn: ({ signal }) => posCheckLedgerApi.list(restaurantId, query, signal),
    enabled: Boolean(restaurantId) && canView,
    placeholderData: keepPreviousData,
    staleTime: 10000,
    // Open checks are live; history doesn't need polling.
    refetchInterval: tab === 'active' && !selectedOrderId ? LIVE_REFRESH_MS : false,
    retry: 1,
  })

  if (access.loading || !canView) return null

  const payload = ledgerQuery.data
  const items = payload?.items || []
  const summary = payload?.summary || {}
  const totalPages = payload?.total_pages || 1

  const body = (
    <section className={fullscreen ? '' : 'glass-card rounded-2xl p-5'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-shell-accent/10 text-shell-accent">
            <ReceiptText size={16} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <p className="label-mono">Checks</p>
            <p className="text-sm text-dash-secondary">Every check on the POS — live, closed, and full history.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFullscreen((current) => !current)}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-dash-secondary transition hover:text-dash-cream"
        >
          {fullscreen ? <Minimize2 size={13} aria-hidden="true" /> : <Maximize2 size={13} aria-hidden="true" />}
          {fullscreen ? 'Exit full screen' : 'Full screen'}
        </button>
      </div>

      {selectedOrderId ? (
        <div className="mt-5">
          <CheckDetail
            restaurantId={restaurantId}
            orderId={selectedOrderId}
            onBack={() => setSelectedOrderId(null)}
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <nav className="grid grid-cols-3 rounded-xl border border-white/10 p-1">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={[
                    'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                    tab === item.id ? 'bg-dash-gold text-black' : 'text-dash-secondary hover:text-dash-cream',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dash-tertiary" aria-hidden="true" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Table, server, check #, card…"
                className="h-9 w-56 rounded-lg border border-white/10 bg-transparent pl-8 pr-3 text-sm text-dash-cream placeholder:text-dash-tertiary focus:border-shell-accent focus:outline-none"
              />
            </div>

            {tab === 'history' ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="h-9 rounded-lg border border-white/10 bg-transparent px-2.5 text-sm text-dash-cream focus:border-shell-accent focus:outline-none"
                />
                <span className="text-xs text-dash-tertiary">to</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="h-9 rounded-lg border border-white/10 bg-transparent px-2.5 text-sm text-dash-cream focus:border-shell-accent focus:outline-none"
                />
                <select
                  value={historyStatus}
                  onChange={(event) => setHistoryStatus(event.target.value)}
                  className="h-9 rounded-lg border border-white/10 bg-transparent px-2 text-sm text-dash-cream focus:border-shell-accent focus:outline-none [&>option]:bg-neutral-900"
                >
                  {HISTORY_STATUSES.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <input
                type="date"
                value={businessDate}
                onChange={(event) => setBusinessDate(event.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-transparent px-2.5 text-sm text-dash-cream focus:border-shell-accent focus:outline-none"
              />
            )}
          </div>

          {payload && (
            <div className="mt-3 flex flex-wrap gap-2">
              <SummaryChip label="checks" value={Number(summary.checks ?? payload.total ?? 0).toLocaleString('en-US')} />
              <SummaryChip label="gross" value={money(summary.gross_total)} />
              <SummaryChip label="payments" value={money(summary.transaction_total)} />
              {Number(summary.needs_attention) > 0 && (
                <SummaryChip label="need attention" value={Number(summary.needs_attention).toLocaleString('en-US')} />
              )}
              {tab === 'active' && Number(summary.carryover_open) > 0 && (
                <SummaryChip label="carried over" value={Number(summary.carryover_open).toLocaleString('en-US')} />
              )}
            </div>
          )}

          {ledgerQuery.isError && (
            <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
              {ledgerQuery.error instanceof Error ? ledgerQuery.error.message : 'Could not load checks.'}
            </p>
          )}
          {ledgerQuery.isPending && (
            <p className="mt-4 text-sm text-dash-tertiary">Loading checks…</p>
          )}
          {!ledgerQuery.isPending && !ledgerQuery.isError && items.length === 0 && (
            <p className="mt-4 text-sm text-dash-tertiary">
              {tab === 'active' ? 'No open checks right now.' : 'No checks match these filters.'}
            </p>
          )}

          {items.length > 0 && (
            <div className={`mt-4 overflow-x-auto ${ledgerQuery.isFetching && !ledgerQuery.isPending ? 'opacity-70' : ''}`}>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="label-mono !text-[10px]">
                    <th className="px-3 py-2 font-medium">Check</th>
                    <th className="px-3 py-2 font-medium">Table / Guest</th>
                    <th className="px-3 py-2 font-medium">Server</th>
                    <th className="px-3 py-2 font-medium">Opened</th>
                    <th className="px-3 py-2 font-medium">Closed</th>
                    <th className="px-3 py-2 font-medium">Payment</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((item) => {
                    const pill = statusPill(item)
                    return (
                      <tr
                        key={item.order_id}
                        onClick={() => setSelectedOrderId(item.order_id)}
                        className="cursor-pointer transition hover:bg-white/[0.04]"
                      >
                        <td className="px-3 py-2.5 font-mono tabular-nums text-dash-cream">
                          #{item.order_number ?? '—'}
                          {item.needs_attention && <span className="ml-1.5 text-red-300" title={(item.attention_reasons || []).join(', ')}>●</span>}
                          {item.is_carryover && <span className="ml-1.5 text-[10px] text-dash-tertiary">carryover</span>}
                        </td>
                        <td className="px-3 py-2.5 text-dash-secondary">
                          {item.table_number ? `Table ${item.table_number}` : item.guest_name || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-dash-secondary">{item.waiter_name || '—'}</td>
                        <td className="px-3 py-2.5 text-dash-tertiary">{timeOnly(item.created_at)}</td>
                        <td className="px-3 py-2.5 text-dash-tertiary">{item.closed_at ? timeOnly(item.closed_at) : '—'}</td>
                        <td className="max-w-[11rem] truncate px-3 py-2.5 text-dash-secondary">{paymentSummary(item)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.className}`}>{pill.text}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-dash-cream">{money(item.total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-dash-tertiary">
              <span>
                Page {payload?.page || page} of {totalPages} · {Number(payload?.total || 0).toLocaleString('en-US')} checks
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-dash-secondary transition hover:text-dash-cream disabled:opacity-30"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-dash-secondary transition hover:text-dash-cream disabled:opacity-30"
                  aria-label="Next page"
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-dash-elevated p-4 md:p-8" role="dialog" aria-modal="true" aria-label="Check ledger">
        {body}
      </div>
    )
  }
  return body
}

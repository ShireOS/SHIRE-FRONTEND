import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  ArrowLeft,
  Ban,
  ChefHat,
  CircleDollarSign,
  Hourglass,
  Percent,
  Receipt,
  ReceiptText,
  RotateCcw,
  Search,
  Tags,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { posCheckLedgerApi } from '../../shared/api/posClient'
import { fetchWithSupabaseAuth, queryKeys, STALE_TIMES } from '../../shared/query'
import { CheckDetail } from './CheckLedgerSection'

const money = (value) =>
  value === null || value === undefined
    ? '—'
    : Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const count = (value) =>
  value === null || value === undefined ? '—' : Number(value).toLocaleString('en-US')

const pct = (value) =>
  value === null || value === undefined ? '—' : `${(Number(value) * 100).toFixed(2)}%`

const hours = (minutes) =>
  minutes === null || minutes === undefined ? '—' : `${(Number(minutes) / 60).toFixed(1)}h`

const perBucketAvg = (row) =>
  row.transactions > 0 ? Number(row.net_sales) / Number(row.transactions) : 0

const CHECK_METRIC = {
  net_sales: 'sales',
  transactions: 'transactions',
  active_checks: 'active_checks',
  discounts: 'discounts',
  refunds: 'refunds',
  voids: 'voids',
}

const ANALYSIS_METRIC = new Set(['avg_check', 'avg_cover', 'tax', 'covers'])

// Each tile: how to read its number, its chart series, and its contributors.
// `series`: (payload) => [{bucket, value}] | null. `contributors`: (payload) =>
// {title, rows: [{name, primary, secondary}]} | null. `note` shows when there
// is no contributor breakdown.
const TILES = [
  {
    id: 'net_sales', label: 'Net sales', icon: CircleDollarSign, format: money,
    value: (t) => t.net_sales,
    series: (p) => p.series.orders.map((r) => ({ bucket: r.bucket, value: Number(r.net_sales) })),
    contributors: (p) => ({
      title: 'By server',
      rows: p.contributors.servers.map((s) => ({
        name: s.name,
        primary: money(s.net_sales),
        secondary: `${count(s.transactions)} checks`,
        filter: { waiter_id: s.waiter_id },
      })),
    }),
  },
  {
    id: 'active_checks', label: 'Active checks', icon: Hourglass, format: money,
    value: (t) => t.active_check_total,
    detail: (t) => `${count(t.active_checks)} open now`,
    series: () => null,
    contributors: () => null,
    note: 'Open checks are a live number — they don’t have a time series.',
  },
  {
    id: 'avg_check', label: 'Avg check', icon: TrendingUp, format: money,
    value: (t) => t.avg_check,
    series: (p) => p.series.orders.map((r) => ({ bucket: r.bucket, value: perBucketAvg(r) })),
    contributors: () => null,
    note: 'Net sales ÷ transactions per bucket.',
  },
  {
    id: 'avg_cover', label: 'Avg cover', icon: UtensilsCrossed, format: money,
    value: (t) => t.avg_cover,
    series: (p) => p.series.covers.map((r) => {
      const orderBucket = p.series.orders.find((order) => order.bucket === r.bucket)
      const covers = Number(r.covers)
      return {
        bucket: r.bucket,
        value: covers > 0 ? Number(orderBucket?.net_sales || 0) / covers : 0,
      }
    }),
    contributors: () => null,
    note: 'Net sales ÷ covers for each period.',
  },
  {
    id: 'tax', label: 'Tax', icon: Receipt, format: money,
    value: (t) => t.tax,
    series: (p) => p.series.orders.map((r) => ({ bucket: r.bucket, value: Number(r.tax) })),
    contributors: () => null,
    note: 'Collected tax from reported checks.',
  },
  {
    id: 'transactions', label: 'Transactions', icon: ReceiptText, format: count,
    value: (t) => t.order_count,
    series: (p) => p.series.orders.map((r) => ({ bucket: r.bucket, value: Number(r.transactions) })),
    contributors: (p) => ({
      title: 'By server',
      rows: p.contributors.servers.map((s) => ({
        name: s.name,
        primary: count(s.transactions),
        secondary: money(s.net_sales),
        filter: { waiter_id: s.waiter_id },
      })),
    }),
  },
  {
    id: 'covers', label: 'Covers', icon: Users, format: count,
    value: (t) => t.covers,
    detail: (t) => `${count(t.visit_count)} visits`,
    series: (p) => p.series.covers.map((r) => ({ bucket: r.bucket, value: Number(r.covers) })),
    contributors: () => null,
    note: 'Guests seated, from host visits.',
  },
  {
    id: 'discounts', label: 'Discounts', icon: Tags, format: money,
    value: (t) => t.discounts,
    detail: (t) => `${count(t.discount_count)} applied`,
    series: (p) => p.series.orders.map((r) => ({ bucket: r.bucket, value: Number(r.discounts) })),
    contributors: (p) => ({
      title: 'By reason',
      rows: p.contributors.discount_reasons.map((d) => ({
        name: `${d.reason} · ${d.applied_by}`,
        primary: money(d.amount),
        secondary: `${count(d.count)}×`,
        filter: { reason: d.reason },
      })),
    }),
  },
  {
    id: 'refunds', label: 'Refunds', icon: RotateCcw, format: money,
    value: (t) => t.refund_amount,
    detail: (t) => `${count(t.refund_count)} refunds`,
    series: (p) => p.series.refunds.map((r) => ({ bucket: r.bucket, value: Number(r.refund_amount) })),
    contributors: (p) => ({
      title: 'By payment method',
      rows: p.contributors.refund_methods.map((r) => ({
        name: r.payment_method,
        primary: money(r.amount),
        secondary: `${count(r.count)}×`,
        filter: { payment_method: r.payment_method },
      })),
    }),
  },
  {
    id: 'voids', label: 'Voids', icon: Ban, format: money,
    value: (t) => t.void_amount,
    detail: (t) => `${count(t.void_count)} voided`,
    series: (p) => p.series.orders.map((r) => ({ bucket: r.bucket, value: Number(r.void_amount) })),
    contributors: (p) => ({
      title: 'By server',
      rows: p.contributors.servers
        .filter((s) => Number(s.voids) > 0)
        .sort((a, b) => Number(b.void_amount) - Number(a.void_amount))
        .map((s) => ({
          name: s.name,
          primary: money(s.void_amount),
          secondary: `${count(s.voids)} voided`,
          filter: { waiter_id: s.waiter_id },
        })),
    }),
  },
  {
    id: 'labor_pct', label: 'Labor', icon: ChefHat, format: pct,
    value: (t) => t.labor_pct,
    detail: (t) => (t.labor_cost != null ? money(t.labor_cost) : null),
    series: () => null,
    contributors: (p) => ({
      title: 'By staff member',
      rows: p.contributors.labor_staff.map((s) => ({ name: s.name, primary: money(s.labor_cost), secondary: hours(s.worked_minutes) })),
    }),
  },
  {
    id: 'splh', label: 'SPLH', icon: Percent, format: money,
    value: (t) => t.splh,
    series: () => null,
    contributors: (p) => ({
      title: 'By staff member',
      rows: p.contributors.labor_staff.map((s) => ({ name: s.name, primary: hours(s.worked_minutes), secondary: money(s.labor_cost) })),
    }),
    note: 'Sales per labor hour: net sales ÷ clocked hours.',
  },
]

function bucketLabel(iso, bucket, timezoneName) {
  const value = new Date(iso)
  if (Number.isNaN(value.getTime())) return ''
  const timeZone = timezoneName || undefined
  if (bucket === 'hour') return value.toLocaleTimeString('en-US', { hour: 'numeric', timeZone })
  if (bucket === 'month') return value.toLocaleDateString('en-US', { month: 'short', timeZone })
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone })
}

function BarChart({ points, bucket, format, onSelect, timezoneName, metricLabel }) {
  if (!points || points.length === 0) {
    return (
      <p className="flex h-40 items-center justify-center text-sm text-dash-tertiary">
        Nothing in this window yet.
      </p>
    )
  }
  const max = Math.max(...points.map((p) => p.value), 0)
  const labelEvery = Math.max(1, Math.ceil(points.length / 12))
  return (
    <div>
      <div className="flex h-40 items-end gap-[3px]">
        {points.map((point, index) => (
          <button
            type="button"
            key={index}
            title={`${bucketLabel(point.bucket, bucket, timezoneName)} — ${format(point.value)}`}
            aria-label={`Explore ${metricLabel} for ${bucketLabel(point.bucket, bucket, timezoneName)}`}
            onClick={() => onSelect(new Date(point.bucket).toISOString())}
            className="group flex h-full flex-1 flex-col justify-end focus:outline-none focus-visible:ring-2 focus-visible:ring-shell-accent"
          >
            <div
              className="min-h-[2px] rounded-t bg-shell-accent/75 transition-colors group-hover:bg-shell-accent"
              style={{ height: max > 0 ? `${Math.max(1.5, (point.value / max) * 100)}%` : '2px' }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {points.map((point, index) => (
          <span key={index} className="flex-1 truncate text-center font-mono text-[9px] text-dash-tertiary">
            {index % labelEvery === 0 ? bucketLabel(point.bucket, bucket, timezoneName) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function ContributorList({ breakdown, note, onSelect }) {
  if (!breakdown || breakdown.rows.length === 0) {
    return <p className="text-xs leading-5 text-dash-tertiary">{note || 'No breakdown for this window.'}</p>
  }
  return (
    <div>
      <p className="label-mono !text-[10px]">{breakdown.title}</p>
      <ul className="mt-2 space-y-1.5">
        {breakdown.rows.map((row, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => onSelect(row)}
              className="flex w-full items-baseline justify-between gap-3 rounded-lg px-1 py-0.5 text-left text-sm transition hover:bg-white/[0.04]"
            >
              <span className="min-w-0 truncate text-dash-secondary">{row.name}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="font-mono tabular-nums text-dash-cream">{row.primary}</span>
                {row.secondary && (
                  <span className="font-mono text-[10px] tabular-nums text-dash-tertiary">{row.secondary}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function addBucket(iso, bucket) {
  const value = new Date(iso)
  if (bucket === 'hour') value.setUTCHours(value.getUTCHours() + 1)
  else if (bucket === 'month') value.setUTCMonth(value.getUTCMonth() + 1)
  else value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString()
}

function bucketOptions(payload, points) {
  const start = payload.window?.start_at
  const end = payload.window?.end_at
  const bucket = payload.window?.bucket
  if (!start || !end || !bucket) {
    return (points || []).map((point) => new Date(point.bucket).toISOString())
  }

  const options = []
  let cursor = new Date(start).toISOString()
  const endMs = new Date(end).getTime()
  while (new Date(cursor).getTime() < endMs && options.length < 400) {
    options.push(cursor)
    cursor = addBucket(cursor, bucket)
  }
  return options
}

function bucketEndBoundary(selected, options, payload, bucket) {
  if (!selected) return payload.window?.end_at || undefined
  const selectedTime = new Date(selected).getTime()
  const index = options.findIndex((option) => new Date(option).getTime() === selectedTime)
  if (index >= 0 && options[index + 1]) return options[index + 1]
  if (index === options.length - 1 && payload.window?.end_at) return payload.window.end_at
  return addBucket(selected, bucket)
}

function rangeLabel(start, bucket, timezoneName) {
  const end = addBucket(start, bucket)
  if (bucket === 'hour') {
    return `${bucketLabel(start, bucket, timezoneName)}–${bucketLabel(end, bucket, timezoneName)}`
  }
  return bucketLabel(start, bucket, timezoneName)
}

function rangeWindowLabel(start, end, bucket, timezoneName) {
  if (!start) return 'All'
  if (!end || start === end) return rangeLabel(start, bucket, timezoneName)
  if (bucket === 'hour') {
    return `${bucketLabel(start, bucket, timezoneName)}–${bucketLabel(addBucket(end, bucket), bucket, timezoneName)}`
  }
  return `${bucketLabel(start, bucket, timezoneName)}–${bucketLabel(end, bucket, timezoneName)}`
}

function lifecyclePill(item) {
  if (item.needs_attention) return { text: 'Needs attention', style: 'bg-red-400/10 text-red-300' }
  if (item.status === 'voided') return { text: 'Voided', style: 'bg-red-400/10 text-red-300' }
  if (item.payment_status === 'paid' || item.status === 'closed') {
    return { text: item.payment_status === 'paid' ? 'Paid' : 'Closed', style: 'bg-emerald-400/10 text-emerald-300' }
  }
  return { text: 'Open', style: 'bg-shell-accent/15 text-shell-accent' }
}

function tenderLabel(item) {
  const cards = (item.card_summaries || [])
    .map((card) => [card.brand, card.last4 ? `••${card.last4}` : null].filter(Boolean).join(' '))
    .filter(Boolean)
  if (cards.length) return cards.join(', ')
  if (item.payment_methods?.length) return item.payment_methods.join(', ')
  return item.payment_method || '—'
}

function BucketRail({
  options,
  bucket,
  selectedStart,
  selectedEnd,
  rangePicking,
  onSelect,
  timezoneName,
}) {
  const railRef = useRef(null)

  useEffect(() => {
    const selected = railRef.current?.querySelector('[aria-current="true"]')
    selected?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [selectedStart, selectedEnd])

  return (
    <div
      ref={railRef}
      className="flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]"
      aria-label={`${bucket} check windows`}
    >
      <button
        type="button"
        aria-current={!selectedStart}
        onClick={() => onSelect(null)}
        className={[
          'shrink-0 snap-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
          !selectedStart
            ? 'border-shell-accent bg-shell-accent text-shell-cta-text'
            : 'border-white/10 text-dash-secondary hover:text-dash-cream',
        ].join(' ')}
      >
        All
      </button>
      {options.map((option) => {
        const optionTime = new Date(option).getTime()
        const startTime = selectedStart ? new Date(selectedStart).getTime() : null
        const endTime = selectedEnd ? new Date(selectedEnd).getTime() : startTime
        const low = startTime === null ? null : Math.min(startTime, endTime)
        const high = startTime === null ? null : Math.max(startTime, endTime)
        const isEndpoint = option === selectedStart || option === selectedEnd
        const isInRange = low !== null && optionTime >= low && optionTime <= high
        return (
          <button
            key={option}
            type="button"
            aria-current={isEndpoint}
            onClick={() => onSelect(option)}
            className={[
              'shrink-0 snap-center rounded-lg border px-3 py-1.5 font-mono text-xs transition',
              isEndpoint
                ? 'border-shell-accent bg-shell-accent text-shell-cta-text'
                : isInRange
                  ? 'border-shell-accent/40 bg-shell-accent/10 text-dash-cream'
                  : 'border-white/10 text-dash-secondary hover:text-dash-cream',
            ].join(' ')}
          >
            {rangeLabel(option, bucket, timezoneName)}
          </button>
        )
      })}
      {rangePicking && (
        <span className="flex shrink-0 items-center px-2 text-xs text-shell-accent">
          Choose the other end
        </span>
      )}
    </div>
  )
}

function useBucketSelection(drilldown, onBucket) {
  const [rangeMode, setRangeMode] = useState(false)
  const [rangeAnchor, setRangeAnchor] = useState(null)

  const selectBucket = (option) => {
    if (!option) {
      setRangeMode(false)
      setRangeAnchor(null)
      onBucket(null, null)
      return
    }
    if (!rangeMode) {
      onBucket(option, null)
      return
    }
    if (!rangeAnchor) {
      setRangeAnchor(option)
      onBucket(option, null)
      return
    }
    const [start, end] = new Date(rangeAnchor) <= new Date(option)
      ? [rangeAnchor, option]
      : [option, rangeAnchor]
    onBucket(start, end)
    setRangeMode(false)
    setRangeAnchor(null)
  }

  const beginRange = () => {
    if (rangeMode) {
      setRangeMode(false)
      setRangeAnchor(null)
      return
    }
    setRangeMode(true)
    setRangeAnchor(drilldown.bucket || null)
    if (drilldown.bucket_end) onBucket(drilldown.bucket, null)
  }

  return {
    rangeMode,
    selectBucket,
    beginRange,
  }
}

function rowsInBucketRange(rows, start, end) {
  if (!start) return rows || []
  const low = new Date(start).getTime()
  const high = new Date(end || start).getTime()
  return (rows || []).filter((row) => {
    const occurred = new Date(row.bucket).getTime()
    return occurred >= low && occurred <= high
  })
}

function sumRows(rows, field) {
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0)
}

function metricAnalysis(selected, payload, start, end) {
  const orders = rowsInBucketRange(payload.series.orders, start, end)
  const covers = rowsInBucketRange(payload.series.covers, start, end)
  const netSales = sumRows(orders, 'net_sales')
  const transactions = sumRows(orders, 'transactions')
  const tax = sumRows(orders, 'tax')
  const coverCount = sumRows(covers, 'covers')
  const windowValue = Number(selected.value(payload.totals) || 0)

  if (selected.id === 'avg_check') {
    const value = transactions > 0 ? netSales / transactions : 0
    return {
      value,
      explanation: 'Weighted net sales ÷ transactions for this selection.',
      cards: [
        { label: 'Average check', value: money(value) },
        { label: 'Net sales', value: money(netSales) },
        { label: 'Transactions', value: count(transactions) },
      ],
      windowValue,
    }
  }
  if (selected.id === 'avg_cover') {
    const value = coverCount > 0 ? netSales / coverCount : 0
    return {
      value,
      explanation: 'Net sales ÷ seated covers for this selection.',
      cards: [
        { label: 'Average cover', value: money(value) },
        { label: 'Net sales', value: money(netSales) },
        { label: 'Covers', value: count(coverCount) },
      ],
      windowValue,
    }
  }
  if (selected.id === 'tax') {
    return {
      value: tax,
      explanation: 'Collected tax and its relationship to activity in this selection.',
      cards: [
        { label: 'Tax collected', value: money(tax) },
        { label: 'Tax per transaction', value: money(transactions > 0 ? tax / transactions : 0) },
        { label: 'Transactions', value: count(transactions) },
      ],
      windowValue,
    }
  }
  return {
    value: coverCount,
    explanation: 'Seated guest volume from host visits in this selection.',
    cards: [
      { label: 'Covers', value: count(coverCount) },
      { label: 'Selected periods', value: count(covers.length) },
      { label: 'Window covers', value: count(payload.totals.covers) },
    ],
    windowValue,
  }
}

function MetricAnalysisView({
  selected,
  payload,
  drilldown,
  onBucket,
  onBack,
}) {
  const bucket = payload.window?.bucket || 'day'
  const timezoneName = payload.window?.timezone
  const points = selected.series(payload) || []
  const options = useMemo(() => bucketOptions(payload, points), [payload, points])
  const selectedStart = drilldown.bucket || null
  const selectedEnd = drilldown.bucket_end || null
  const { rangeMode, selectBucket, beginRange } = useBucketSelection(drilldown, onBucket)
  const analysis = metricAnalysis(selected, payload, selectedStart, selectedEnd)
  const scopeLabel = rangeWindowLabel(selectedStart, selectedEnd, bucket, timezoneName)
  const delta = analysis.windowValue
    ? ((analysis.value - analysis.windowValue) / analysis.windowValue) * 100
    : null

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-mono">
            {selected.label} <span aria-hidden="true">›</span> {scopeLabel}
          </p>
          <p className="mt-1 text-sm text-dash-secondary">{analysis.explanation}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-dash-secondary transition hover:text-dash-cream"
        >
          <ArrowLeft size={13} aria-hidden="true" /> Back to chart
        </button>
      </div>

      {options.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="label-mono !text-[9px]">
              Analyze {bucket === 'hour' ? 'hours' : bucket === 'day' ? 'days' : 'months'}
            </p>
            <button
              type="button"
              aria-pressed={rangeMode}
              onClick={beginRange}
              className={[
                'rounded-lg border px-3 py-1 text-xs font-semibold transition',
                rangeMode
                  ? 'border-shell-accent bg-shell-accent text-shell-cta-text'
                  : 'border-white/10 text-dash-secondary hover:text-dash-cream',
              ].join(' ')}
            >
              {rangeMode ? 'Cancel range' : selectedEnd ? 'Change range' : 'Select range'}
            </button>
          </div>
          <BucketRail
            options={options}
            bucket={bucket}
            selectedStart={selectedStart}
            selectedEnd={selectedEnd}
            rangePicking={rangeMode}
            onSelect={selectBucket}
            timezoneName={timezoneName}
          />
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {analysis.cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <p className="label-mono !text-[9px]">{card.label}</p>
            <p className="mt-1 font-mono text-xl tabular-nums text-dash-cream">{card.value}</p>
          </div>
        ))}
      </div>
      {delta !== null && selectedStart && (
        <p className="mt-3 text-xs text-dash-tertiary">
          {Math.abs(delta).toFixed(1)}% {delta >= 0 ? 'above' : 'below'} the full selected analytics window.
        </p>
      )}
    </div>
  )
}

function AnalyticsChecksView({
  restaurantId,
  selected,
  payload,
  drilldown,
  search,
  onSearch,
  onBucket,
  onCheck,
  onBack,
}) {
  const bucket = payload.window?.bucket || 'day'
  const timezoneName = payload.window?.timezone
  const points = selected.series(payload) || []
  const options = useMemo(() => bucketOptions(payload, points), [payload, points])
  const selectedStart = drilldown.bucket || null
  const selectedEnd = drilldown.bucket_end || null
  const { rangeMode, selectBucket, beginRange } = useBucketSelection(drilldown, onBucket)
  const occurredFrom = selectedStart || payload.window?.start_at || undefined
  const occurredTo = selectedStart
    ? bucketEndBoundary(selectedEnd || selectedStart, options, payload, bucket)
    : payload.window?.end_at || undefined
  const query = useMemo(() => ({
    date_from: occurredFrom ? new Date(occurredFrom).toISOString().slice(0, 10) : undefined,
    date_to: occurredTo
      ? new Date(new Date(occurredTo).getTime() - 1).toISOString().slice(0, 10)
      : undefined,
    occurred_from: occurredFrom,
    occurred_to: occurredTo,
    metric: drilldown.metric,
    search: search.trim() || undefined,
    ...drilldown.filter,
    page: 1,
    page_size: 100,
  }), [drilldown.filter, drilldown.metric, occurredFrom, occurredTo, search])

  const checksQuery = useQuery({
    queryKey: queryKeys.checkLedger(restaurantId, query),
    queryFn: ({ signal }) => posCheckLedgerApi.list(restaurantId, query, signal),
    enabled: Boolean(restaurantId),
    placeholderData: keepPreviousData,
    staleTime: drilldown.metric === 'active_checks' ? 5000 : 15000,
    refetchInterval: drilldown.metric === 'active_checks' ? 15000 : false,
  })

  const checks = checksQuery.data?.items || []
  const total = checksQuery.data?.total ?? checks.length
  const scopeLabel = selectedStart
    ? rangeWindowLabel(selectedStart, selectedEnd, bucket, timezoneName)
    : drilldown.label || 'All'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-mono">
            {selected.label} <span aria-hidden="true">›</span> {scopeLabel}{' '}
            <span aria-hidden="true">›</span> {count(total)} checks
          </p>
          <p className="mt-1 text-sm text-dash-secondary">
            The chart is replaced by the checks that make up this number.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-dash-secondary transition hover:text-dash-cream"
        >
          <ArrowLeft size={13} aria-hidden="true" /> Back to chart
        </button>
      </div>

      {drilldown.metric !== 'active_checks' && options.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="label-mono !text-[9px]">Move through {bucket === 'hour' ? 'hours' : bucket === 'day' ? 'days' : 'months'}</p>
            <button
              type="button"
              aria-pressed={rangeMode}
              onClick={beginRange}
              className={[
                'rounded-lg border px-3 py-1 text-xs font-semibold transition',
                rangeMode
                  ? 'border-shell-accent bg-shell-accent text-shell-cta-text'
                  : 'border-white/10 text-dash-secondary hover:text-dash-cream',
              ].join(' ')}
            >
              {rangeMode ? 'Cancel range' : selectedEnd ? 'Change range' : 'Select range'}
            </button>
          </div>
          <BucketRail
            options={options}
            bucket={bucket}
            selectedStart={selectedStart}
            selectedEnd={selectedEnd}
            rangePicking={rangeMode}
            onSelect={selectBucket}
            timezoneName={timezoneName}
          />
        </div>
      )}

      <div className="relative mt-3 w-full max-w-sm">
        <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dash-tertiary" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Check #, table, server, card…"
          className="h-9 w-full rounded-lg border border-white/10 bg-transparent pl-8 pr-3 text-sm text-dash-cream placeholder:text-dash-tertiary focus:border-shell-accent focus:outline-none"
        />
      </div>

      {checksQuery.isPending && <p className="mt-5 text-sm text-dash-tertiary">Loading matching checks…</p>}
      {checksQuery.isError && (
        <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {checksQuery.error instanceof Error ? checksQuery.error.message : 'Could not load matching checks.'}
        </p>
      )}
      {!checksQuery.isPending && !checksQuery.isError && checks.length === 0 && (
        <p className="mt-5 text-sm text-dash-tertiary">No checks match this bucket and filter.</p>
      )}

      {checks.length > 0 && (
        <div className={`mt-4 overflow-x-auto ${checksQuery.isFetching ? 'opacity-75' : ''}`}>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="label-mono !text-[10px]">
                <th className="px-3 py-2 font-medium">Check</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Server</th>
                <th className="px-3 py-2 font-medium">Table</th>
                <th className="px-3 py-2 font-medium">Lifecycle</th>
                <th className="px-3 py-2 font-medium">Tender</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {checks.map((item) => {
                const lifecycle = lifecyclePill(item)
                return (
                  <tr
                    key={item.order_id}
                    onClick={() => onCheck(item.order_id)}
                    className="cursor-pointer transition hover:bg-white/[0.04]"
                  >
                    <td className="px-3 py-2.5 font-mono text-dash-cream">
                      #{item.order_number ?? '—'}
                      {item.needs_attention && <span className="ml-1.5 text-red-300" title={(item.attention_reasons || []).join(', ')}>●</span>}
                    </td>
                    <td className="px-3 py-2.5 text-dash-tertiary">
                      {new Date(item.created_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: timezoneName,
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-dash-secondary">{item.waiter_name || '—'}</td>
                    <td className="px-3 py-2.5 text-dash-secondary">{item.table_number ? `Table ${item.table_number}` : item.guest_name || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${lifecycle.style}`}>{lifecycle.text}</span>
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2.5 text-dash-secondary">{tenderLabel(item)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-dash-cream">{money(item.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/**
 * Selectable KPI tiles (LINGA-style): click a tile to see what makes the
 * number — a bucketed chart plus a contributor breakdown. Nothing is selected
 * by default; one fetch per (store, period) powers every tile.
 */
export default function SalesTiles({ restaurantId, period }) {
  const [selectedId, setSelectedId] = useState(null)
  const [drilldown, setDrilldown] = useState(null)
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [checkSearch, setCheckSearch] = useState('')

  const metricsQuery = useQuery({
    queryKey: ['owner-metrics', restaurantId, period],
    queryFn: () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/owner-analytics/metrics?period=${period}`),
    enabled: Boolean(restaurantId),
    staleTime: STALE_TIMES.analytics,
    retry: false,
    placeholderData: keepPreviousData,
  })

  const payload = metricsQuery.data
  if (metricsQuery.isError) {
    return (
      <p className="glass-card rounded-2xl px-4 py-3 text-sm text-dash-tertiary">
        Sales tiles are waiting on the latest analytics backend — deploy the ML backend to turn them on.
      </p>
    )
  }
  const totals = payload?.totals || {}
  const selected = TILES.find((tile) => tile.id === selectedId) || null

  const resetExpandedState = () => {
    setDrilldown(null)
    setSelectedOrderId(null)
    setCheckSearch('')
  }

  const selectTile = (tile) => {
    const isSelected = selectedId === tile.id
    resetExpandedState()
    setSelectedId(isSelected ? null : tile.id)
    if (!isSelected && tile.id === 'active_checks') {
      setDrilldown({
        kind: 'checks',
        metric: CHECK_METRIC.active_checks,
        bucket: null,
        bucket_end: null,
        filter: {},
        label: 'Live',
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(168px,1fr))]">
        {TILES.map((tile) => {
          const isSelected = selectedId === tile.id
          const rawValue = payload ? tile.value(totals) : null
          const detail = payload && tile.detail ? tile.detail(totals) : null
          return (
            <button
              key={tile.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => selectTile(tile)}
              className={[
                'glass-card flex items-center gap-3 rounded-2xl p-3 text-left transition',
                isSelected
                  ? 'shadow-[inset_0_0_0_1.5px_rgb(var(--shell-accent))]'
                  : 'hover:-translate-y-[1px]',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                  isSelected ? 'bg-shell-accent text-shell-cta-text' : 'bg-shell-accent/10 text-shell-accent',
                ].join(' ')}
              >
                <tile.icon size={16} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className={`block truncate font-mono text-lg tabular-nums text-dash-cream ${metricsQuery.isPending ? 'opacity-40' : ''}`}>
                  {tile.format(rawValue)}
                </span>
                <span className="block truncate label-mono !text-[9px]">
                  {tile.label}
                  {detail ? ` · ${detail}` : ''}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {selected && payload && (
        <section className="glass-card rounded-2xl p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="label-mono">{selected.label}</p>
              <p className="mt-1 font-mono text-2xl tabular-nums text-dash-cream">
                {selected.format(selected.value(totals))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedId(null)
                resetExpandedState()
              }}
              className="text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary"
            >
              Close
            </button>
          </div>
          <div className="mt-4">
            {selectedOrderId ? (
              <CheckDetail
                restaurantId={restaurantId}
                orderId={selectedOrderId}
                backLabel="Back to filtered checks"
                onBack={() => setSelectedOrderId(null)}
              />
            ) : drilldown?.kind === 'checks' ? (
              <AnalyticsChecksView
                restaurantId={restaurantId}
                selected={selected}
                payload={payload}
                drilldown={drilldown}
                search={checkSearch}
                onSearch={setCheckSearch}
                onBucket={(bucket, bucketEnd) => setDrilldown((current) => ({
                  ...current,
                  bucket,
                  bucket_end: bucketEnd,
                }))}
                onCheck={setSelectedOrderId}
                onBack={() => {
                  setDrilldown(null)
                  setCheckSearch('')
                }}
              />
            ) : drilldown?.kind === 'analysis' ? (
              <MetricAnalysisView
                selected={selected}
                payload={payload}
                drilldown={drilldown}
                onBucket={(bucket, bucketEnd) => setDrilldown((current) => ({
                  ...current,
                  bucket,
                  bucket_end: bucketEnd,
                }))}
                onBack={() => setDrilldown(null)}
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                <div>
                  {selected.series(payload) ? (
                    <BarChart
                      points={selected.series(payload)}
                      bucket={payload.window?.bucket}
                      format={selected.format}
                      metricLabel={selected.label}
                      timezoneName={payload.window?.timezone}
                      onSelect={(bucket) => {
                        const metric = CHECK_METRIC[selected.id]
                        if (metric) {
                          setDrilldown({
                            kind: 'checks',
                            metric,
                            bucket,
                            bucket_end: null,
                            filter: {},
                            label: 'All checks',
                          })
                          return
                        }
                        if (ANALYSIS_METRIC.has(selected.id)) {
                          setDrilldown({
                            kind: 'analysis',
                            bucket,
                            bucket_end: null,
                            filter: {},
                            label: selected.label,
                          })
                        }
                      }}
                    />
                  ) : (
                    <p className="flex h-40 items-center justify-center text-sm text-dash-tertiary">
                      {selected.note || 'No time series for this metric.'}
                    </p>
                  )}
                </div>
                <ContributorList
                  breakdown={selected.contributors(payload)}
                  note={selected.note}
                  onSelect={(row) => {
                    const metric = CHECK_METRIC[selected.id]
                    if (!metric) return
                    setDrilldown({
                      kind: 'checks',
                      metric,
                      bucket: null,
                      bucket_end: null,
                      filter: row.filter || {},
                      label: row.name,
                    })
                  }}
                />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

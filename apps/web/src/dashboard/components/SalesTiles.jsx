import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Ban,
  ChefHat,
  CircleDollarSign,
  Hourglass,
  Percent,
  Receipt,
  ReceiptText,
  RotateCcw,
  Tags,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { fetchWithSupabaseAuth, STALE_TIMES } from '../../shared/query'

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
      rows: p.contributors.servers.map((s) => ({ name: s.name, primary: money(s.net_sales), secondary: `${count(s.transactions)} checks` })),
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
    series: (p) => p.series.covers.map((r) => ({ bucket: r.bucket, value: Number(r.covers) })),
    contributors: () => null,
    note: 'Net sales ÷ covers. Chart shows covers per bucket.',
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
      rows: p.contributors.servers.map((s) => ({ name: s.name, primary: count(s.transactions), secondary: money(s.net_sales) })),
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
      rows: p.contributors.discount_reasons.map((d) => ({ name: `${d.reason} · ${d.applied_by}`, primary: money(d.amount), secondary: `${count(d.count)}×` })),
    }),
  },
  {
    id: 'refunds', label: 'Refunds', icon: RotateCcw, format: money,
    value: (t) => t.refund_amount,
    detail: (t) => `${count(t.refund_count)} refunds`,
    series: (p) => p.series.refunds.map((r) => ({ bucket: r.bucket, value: Number(r.refund_amount) })),
    contributors: (p) => ({
      title: 'By payment method',
      rows: p.contributors.refund_methods.map((r) => ({ name: r.payment_method, primary: money(r.amount), secondary: `${count(r.count)}×` })),
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
        .map((s) => ({ name: s.name, primary: money(s.void_amount), secondary: `${count(s.voids)} voided` })),
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

function bucketLabel(iso, bucket) {
  const value = new Date(iso)
  if (Number.isNaN(value.getTime())) return ''
  if (bucket === 'hour') return value.toLocaleTimeString('en-US', { hour: 'numeric' })
  if (bucket === 'month') return value.toLocaleDateString('en-US', { month: 'short' })
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function BarChart({ points, bucket, format }) {
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
          <div
            key={index}
            title={`${bucketLabel(point.bucket, bucket)} — ${format(point.value)}`}
            className="group flex h-full flex-1 flex-col justify-end"
          >
            <div
              className="min-h-[2px] rounded-t bg-shell-accent/75 transition-colors group-hover:bg-shell-accent"
              style={{ height: max > 0 ? `${Math.max(1.5, (point.value / max) * 100)}%` : '2px' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {points.map((point, index) => (
          <span key={index} className="flex-1 truncate text-center font-mono text-[9px] text-dash-tertiary">
            {index % labelEvery === 0 ? bucketLabel(point.bucket, bucket) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function ContributorList({ breakdown, note }) {
  if (!breakdown || breakdown.rows.length === 0) {
    return <p className="text-xs leading-5 text-dash-tertiary">{note || 'No breakdown for this window.'}</p>
  }
  return (
    <div>
      <p className="label-mono !text-[10px]">{breakdown.title}</p>
      <ul className="mt-2 space-y-1.5">
        {breakdown.rows.map((row, index) => (
          <li key={index} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-dash-secondary">{row.name}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="font-mono tabular-nums text-dash-cream">{row.primary}</span>
              {row.secondary && (
                <span className="font-mono text-[10px] tabular-nums text-dash-tertiary">{row.secondary}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
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

  const metricsQuery = useQuery({
    queryKey: ['owner-metrics', restaurantId, period],
    queryFn: () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/owner-analytics/metrics?period=${period}`),
    enabled: Boolean(restaurantId),
    staleTime: STALE_TIMES.analytics,
    retry: false,
  })

  const payload = metricsQuery.data
  if (metricsQuery.isError) return null // older deployed backend — hide quietly
  const totals = payload?.totals || {}
  const selected = TILES.find((tile) => tile.id === selectedId) || null

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
              onClick={() => setSelectedId(isSelected ? null : tile.id)}
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
              onClick={() => setSelectedId(null)}
              className="text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary"
            >
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_280px]">
            <div>
              {selected.series(payload) ? (
                <BarChart
                  points={selected.series(payload)}
                  bucket={payload.window?.bucket}
                  format={selected.format}
                />
              ) : (
                <p className="flex h-40 items-center justify-center text-sm text-dash-tertiary">
                  {selected.note || 'No time series for this metric.'}
                </p>
              )}
            </div>
            <ContributorList breakdown={selected.contributors(payload)} note={selected.note} />
          </div>
        </section>
      )}
    </div>
  )
}

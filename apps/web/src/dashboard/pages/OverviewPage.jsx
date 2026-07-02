import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueries, keepPreviousData } from '@tanstack/react-query'
import { useAuth } from '../../auth'
import { queryKeys, fetchWithSupabaseAuth, STALE_TIMES } from '../../shared/query'
import { fetchStoreGroups } from '../data/storeGroups'
import { useAnalyticsSummary, usePersistedPeriod } from '../data/analyticsSummary'

const PERIODS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'full', label: 'Full' },
]

const money = (value) =>
  value === null || value === undefined
    ? '—'
    : Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const count = (value) =>
  value === null || value === undefined ? '—' : Number(value).toLocaleString('en-US')

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

function MetricCard({ label, value, detail }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="label-mono">{label}</p>
      <p className="mt-2 font-mono text-2xl tabular-nums text-dash-cream">{value}</p>
      {detail && <p className="mt-1 text-xs text-dash-tertiary">{detail}</p>}
    </div>
  )
}

/**
 * Enterprise rollup: aggregate profit/sales/labor across every store the
 * viewer touches (optionally one group), by period, with per-store drill-down.
 */
export default function OverviewPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [period, setPeriod] = usePersistedPeriod('shire_overview_period')
  const [groupFilter, setGroupFilter] = useState('all')
  const [groups, setGroups] = useState([])

  const allRestaurants = (auth.restaurant.restaurants || []).filter((r) => r.status !== 'draft')

  useEffect(() => {
    if (!auth.user?.id) return
    fetchStoreGroups(auth.user.id).then(setGroups).catch(() => {})
  }, [auth.user?.id])

  const restaurants = useMemo(() => {
    const group = groups.find((g) => g.id === groupFilter)
    return group ? allRestaurants.filter((r) => group.restaurantIds.has(r.id)) : allRestaurants
  }, [allRestaurants, groups, groupFilter])

  // One batched request for every store; per-store fallback only if the
  // deployed backend predates the summary endpoint.
  const summaryQuery = useAnalyticsSummary(restaurants.map((r) => r.id), period)
  const useFallback = summaryQuery.isError

  const fallbackQueries = useQueries({
    queries: useFallback
      ? restaurants.map((restaurant) => ({
          queryKey: queryKeys.ownerAnalytics(restaurant.id, period),
          queryFn: () => fetchWithSupabaseAuth(`/restaurants/${restaurant.id}/owner-analytics?period=${period}`),
          staleTime: STALE_TIMES.analytics,
          retry: false,
          placeholderData: keepPreviousData,
        }))
      : [],
  })

  const rows = restaurants.map((restaurant, index) => {
    let netSales = null
    let orders = null
    let covers = null
    let tips = null
    let laborCost = null
    let loading

    if (useFallback) {
      const payload = fallbackQueries[index]?.data
      const revenue = payload?.sections?.revenue?.data || {}
      const visits = payload?.sections?.visits?.data || {}
      const staff = payload?.sections?.staff?.data || payload?.sections?.labor?.data || {}
      loading = fallbackQueries[index]?.isPending
      netSales = revenue.net_sales ?? revenue.total_revenue ?? null
      orders = revenue.order_count ?? null
      covers = visits.covers ?? null
      tips = revenue.tips ?? null
      laborCost = staff.labor_cost ?? null
    } else {
      const summary = summaryQuery.data?.restaurants?.[restaurant.id]
      loading = summaryQuery.isPending
      if (summary) {
        netSales = summary.net_sales ?? summary.total_revenue ?? null
        orders = summary.order_count ?? null
        covers = summary.covers ?? null
        tips = summary.tips ?? null
        laborCost = summary.labor_cost ?? null
      }
    }

    return {
      restaurant,
      loading,
      netSales,
      orders,
      covers,
      tips,
      laborCost,
      margin: netSales != null && laborCost != null && num(netSales) > 0
        ? (num(netSales) - num(laborCost)) / num(netSales)
        : null,
    }
  })

  const totals = rows.reduce(
    (acc, row) => ({
      netSales: acc.netSales + num(row.netSales),
      orders: acc.orders + num(row.orders),
      covers: acc.covers + num(row.covers),
      laborCost: acc.laborCost + num(row.laborCost),
      reporting: acc.reporting + (row.netSales != null ? 1 : 0),
    }),
    { netSales: 0, orders: 0, covers: 0, laborCost: 0, reporting: 0 }
  )

  const openStore = async (restaurant) => {
    await auth.switchRestaurant(restaurant.id)
    navigate(`/restaurants/${restaurant.id}/analytics`)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono">Enterprise</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-dash-cream">Overview</h1>
          <p className="mt-2 text-sm text-dash-secondary">
            {restaurants.length} store{restaurants.length === 1 ? '' : 's'}
            {totals.reporting < restaurants.length ? ` · ${totals.reporting} reporting data` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {groups.length > 0 && (
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="min-h-[38px] rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 text-sm font-semibold text-dash-secondary outline-none"
            >
              <option value="all">All stores</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          )}
          <nav className="grid grid-cols-5 rounded-xl border border-dash-border p-1">
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={[
                  'rounded-lg px-3 py-2 text-sm font-semibold transition',
                  period === item.id
                    ? 'bg-shell-accent text-shell-cta-text'
                    : 'text-dash-secondary hover:text-dash-cream',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Net sales" value={money(totals.netSales)} detail={`across ${totals.reporting} reporting stores`} />
        <MetricCard label="Orders" value={count(totals.orders)} />
        <MetricCard label="Covers" value={count(totals.covers)} />
        <MetricCard
          label="Labor cost"
          value={money(totals.laborCost)}
          detail={totals.netSales > 0 ? `${Math.round((totals.laborCost / totals.netSales) * 100)}% of net sales` : undefined}
        />
      </div>

      <section className="glass-card overflow-hidden rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-dash-border">
              {['Store', 'Net sales', 'Orders', 'Covers', 'Tips', 'Labor', 'Margin'].map((heading) => (
                <th key={heading} className="label-mono px-4 py-3 !text-[10px] font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.restaurant.id}
                onClick={() => void openStore(row.restaurant)}
                className="cursor-pointer border-b border-dash-border transition-colors last:border-b-0 hover:bg-[var(--glass-bg-hover)]"
              >
                <td className="px-4 py-3 font-semibold text-dash-cream">
                  {row.restaurant.name || 'Untitled'}
                  {row.loading && <span className="ml-2 label-mono !text-[9px]">loading…</span>}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-dash-cream">{money(row.netSales)}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-dash-secondary">{count(row.orders)}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-dash-secondary">{count(row.covers)}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-dash-secondary">{money(row.tips)}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-dash-secondary">{money(row.laborCost)}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-dash-secondary">
                  {row.margin == null ? '—' : `${Math.round(row.margin * 100)}%`}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-dash-tertiary">
                  No stores yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

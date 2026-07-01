import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, LayoutGrid, List, Plus, Search } from 'lucide-react'
import { useAuth } from '../../auth'
import { queryKeys, fetchWithSupabaseAuth, STALE_TIMES } from '../../shared/query'

const ORDER_OPTIONS = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'newest', label: 'Newest first' },
  { value: 'status', label: 'Active first' },
]

const TYPE_LABELS = {
  fine_dining: 'Fine dining',
  casual: 'Casual',
  fast_casual: 'Fast casual',
  bar: 'Bar',
  cafe: 'Cafe',
  food_truck: 'Food truck',
}

const typeLabel = (type) => TYPE_LABELS[type] || (type ? type.replace(/_/g, ' ') : 'Restaurant')

const formatMoney = (value) =>
  value === null || value === undefined
    ? '0.00'
    : Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatCount = (value) =>
  value === null || value === undefined ? '0' : Number(value).toLocaleString('en-US')

function FilterPill({ label, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'h-9 rounded-full border px-3.5 text-sm font-medium transition-colors duration-100 active:scale-[0.98]',
        isActive
          ? 'border-shell-accent/60 bg-shell-accent/10 text-shell-accent ring-2 ring-shell-accent/15'
          : 'border-dash-border bg-[var(--glass-bg)] text-dash-secondary hover:border-dash-tertiary hover:text-dash-cream',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function StoreKpis({ restaurantId, layout = 'grid' }) {
  const kpiQuery = useQuery({
    queryKey: queryKeys.ownerAnalytics(restaurantId, 'week'),
    queryFn: () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/owner-analytics?period=week`),
    staleTime: STALE_TIMES.analytics,
    retry: false,
  })

  const revenue = kpiQuery.data?.sections?.revenue?.data || {}
  const visits = kpiQuery.data?.sections?.visits?.data || {}
  const kpis = [
    { label: 'Net sales', value: formatMoney(revenue.net_sales ?? revenue.total_revenue) },
    { label: 'Orders', value: formatCount(revenue.order_count) },
    { label: 'Covers', value: formatCount(visits.covers) },
    { label: 'Tips', value: formatMoney(revenue.tips) },
  ]

  return (
    <div
      className={[
        'grid gap-3 border-t border-dash-border pt-3',
        layout === 'grid' ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4',
      ].join(' ')}
    >
      {kpis.map((kpi) => (
        <div key={kpi.label} className="min-w-0">
          <p className="truncate label-mono !text-[10px] normal-nums">{kpi.label}</p>
          <p className={`truncate font-mono text-sm tabular-nums text-dash-cream ${kpiQuery.isPending ? 'opacity-40' : ''}`}>
            {kpi.value}
          </p>
        </div>
      ))}
    </div>
  )
}

function StoreCard({ restaurant, layout, onOpen, onFinishSetup }) {
  const location = [restaurant.city, restaurant.state].filter(Boolean).join(', ')
  const isActive = Boolean(restaurant.onboarding_completed_at)

  return (
    <div
      className={[
        'group glass-card rounded-2xl transition-transform duration-200 hover:-translate-y-[2px] hover:border-shell-accent/40',
        layout === 'list' ? 'w-full' : '',
      ].join(' ')}
    >
      <button type="button" onClick={onOpen} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-3 pb-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-dash-cream">
              {restaurant.name || 'Untitled restaurant'}
            </h2>
            <p className="mt-0.5 truncate label-mono !text-[10px] normal-nums">
              {typeLabel(restaurant.type)}
              {location ? ` · ${location}` : ''}
            </p>
          </div>
          <span
            className={[
              'shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-eyebrow',
              isActive
                ? 'bg-dash-success/10 text-dash-success'
                : 'bg-dash-warning/10 text-dash-warning',
            ].join(' ')}
          >
            {isActive ? 'Active' : 'Onboarding'}
          </span>
        </div>
        <StoreKpis restaurantId={restaurant.id} layout={layout} />
      </button>
      {!isActive && (
        <div className="border-t border-dash-border px-4 py-2.5">
          <button
            type="button"
            onClick={onFinishSetup}
            className="flex h-8 items-center gap-1.5 rounded-full border border-dash-warning/40 bg-dash-warning/10 px-3 text-xs font-semibold text-dash-warning transition hover:bg-dash-warning/20 active:scale-[0.98]"
          >
            Finish setup
          </button>
        </div>
      )}
    </div>
  )
}

export default function StoresPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const restaurants = auth.restaurant.restaurants || []

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [orderBy, setOrderBy] = useState('name')
  const [layout, setLayout] = useState('grid')

  const types = useMemo(() => {
    const found = new Set(restaurants.map((r) => r.type).filter(Boolean))
    return ['all', ...found]
  }, [restaurants])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = restaurants.filter((restaurant) => {
      if (typeFilter !== 'all' && restaurant.type !== typeFilter) return false
      if (!query) return true
      return [restaurant.name, restaurant.city, restaurant.state]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query))
    })

    return [...filtered].sort((a, b) => {
      if (orderBy === 'newest') return (b.created_at || '').localeCompare(a.created_at || '')
      if (orderBy === 'status') {
        return Boolean(b.onboarding_completed_at) - Boolean(a.onboarding_completed_at)
          || (a.name || '').localeCompare(b.name || '')
      }
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [restaurants, search, typeFilter, orderBy])

  const openStore = async (restaurant) => {
    await auth.switchRestaurant(restaurant.id)
    navigate(`/restaurants/${restaurant.id}/analytics`)
  }

  // Owners resume the onboarding flow; resellers/admins land on the store's
  // Setup page, where payout and payment details live.
  const finishSetup = async (restaurant) => {
    await auth.switchRestaurant(restaurant.id)
    if (auth.accountType === 'owner') {
      navigate('/onboarding')
    } else {
      navigate(`/restaurants/${restaurant.id}/setup`)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-mono">Enterprise</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-dash-cream">Stores</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Store groups — coming soon"
            aria-disabled="true"
            className="h-9 cursor-default rounded-full border border-dash-border px-4 font-mono text-[11px] uppercase tracking-eyebrow text-dash-tertiary opacity-70"
          >
            Store groups · soon
          </button>
          <Link
            to="/onboarding?new=1"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-shell-cta px-4 text-sm font-medium text-shell-cta-text transition hover:opacity-90 active:scale-[0.98]"
          >
            <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
            New store
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-9 min-w-[220px] items-center gap-2 rounded-full glass-panel border border-dash-border px-3 focus-within:border-shell-accent/60">
          <Search size={14} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search stores"
            className="w-full bg-transparent text-sm text-dash-cream outline-none placeholder:text-dash-tertiary"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {types.map((type) => (
            <FilterPill
              key={type}
              label={type === 'all' ? 'All' : typeLabel(type)}
              isActive={typeFilter === type}
              onClick={() => setTypeFilter(type)}
            />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="relative flex h-9 items-center rounded-full border border-dash-border bg-[var(--glass-bg)] pl-3 pr-8 text-sm text-dash-secondary">
            <span className="sr-only">Order by</span>
            <select
              value={orderBy}
              onChange={(event) => setOrderBy(event.target.value)}
              className="appearance-none bg-transparent text-sm font-medium text-dash-secondary outline-none"
            >
              {ORDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown size={14} strokeWidth={1.75} className="pointer-events-none absolute right-3 text-dash-tertiary" aria-hidden="true" />
          </label>
          <div className="flex items-center rounded-full glass-panel border border-dash-border p-0.5">
            {[
              { id: 'grid', icon: LayoutGrid, label: 'Grid view' },
              { id: 'list', icon: List, label: 'List view' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-label={mode.label}
                aria-pressed={layout === mode.id}
                onClick={() => setLayout(mode.id)}
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full transition active:scale-[0.96]',
                  layout === mode.id ? 'bg-shell-accent text-shell-cta-text' : 'text-dash-tertiary hover:text-dash-cream',
                ].join(' ')}
              >
                <mode.icon size={15} strokeWidth={1.75} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <section className="glass-card rounded-2xl p-8 text-center">
          <h2 className="text-lg font-semibold text-dash-cream">No stores match</h2>
          <p className="mt-1 text-sm text-dash-secondary">
            {restaurants.length === 0
              ? 'No restaurants are linked to this account yet.'
              : 'Try a different search or filter.'}
          </p>
          {restaurants.length === 0 && auth.accountType === 'owner' && (
            <Link
              to="/onboarding"
              className="mt-4 inline-flex h-9 items-center rounded-xl bg-shell-cta px-4 text-sm font-medium text-shell-cta-text"
            >
              Start onboarding
            </Link>
          )}
        </section>
      ) : (
        <section
          className={
            layout === 'grid'
              ? 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]'
              : 'flex flex-col gap-3'
          }
        >
          {visible.map((restaurant) => (
            <StoreCard
              key={restaurant.id}
              restaurant={restaurant}
              layout={layout}
              onOpen={() => void openStore(restaurant)}
              onFinishSetup={() => void finishSetup(restaurant)}
            />
          ))}
        </section>
      )}
    </div>
  )
}

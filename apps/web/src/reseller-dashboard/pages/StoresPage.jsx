import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Copy, FolderKanban, LayoutGrid, List, Plus, Search, Send, Store } from 'lucide-react'
import { useAuth } from '../../auth'
import { queryKeys, fetchWithSupabaseAuth, STALE_TIMES } from '../../shared/query'
import BoardRestaurantModal from './BoardRestaurantModal'
import StoreGroupsModal from './StoreGroupsModal'
import ApplyToStoresModal from './ApplyToStoresModal'
import { fetchStoreGroups } from '../data/storeGroups'
import { fetchMyInvites, revokeInvite, claimUrl } from '../data/boarding'
import { useAnalyticsSummary } from '../data/analyticsSummary'

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

function StoreKpis({ restaurantId, layout = 'grid', summary, summaryFailed }) {
  // Per-store fetch only as fallback when the batch summary is unavailable.
  const kpiQuery = useQuery({
    queryKey: queryKeys.ownerAnalytics(restaurantId, 'week'),
    queryFn: () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/owner-analytics?period=week`),
    staleTime: STALE_TIMES.analytics,
    retry: false,
    enabled: Boolean(summaryFailed),
  })

  const revenue = kpiQuery.data?.sections?.revenue?.data || {}
  const visits = kpiQuery.data?.sections?.visits?.data || {}
  const source = summary
    ? {
        net_sales: summary.net_sales ?? summary.total_revenue,
        order_count: summary.order_count,
        covers: summary.covers,
        tips: summary.tips,
      }
    : {
        net_sales: revenue.net_sales ?? revenue.total_revenue,
        order_count: revenue.order_count,
        covers: visits.covers,
        tips: revenue.tips,
      }
  const pending = summary ? false : summaryFailed ? kpiQuery.isPending : true
  const kpis = [
    { label: 'Net sales', value: formatMoney(source.net_sales) },
    { label: 'Orders', value: formatCount(source.order_count) },
    { label: 'Covers', value: formatCount(source.covers) },
    { label: 'Tips', value: formatMoney(source.tips) },
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
          <p className={`truncate font-mono text-sm tabular-nums text-dash-cream ${pending ? 'opacity-40' : ''}`}>
            {kpi.value}
          </p>
        </div>
      ))}
    </div>
  )
}

function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        } catch { /* clipboard unavailable */ }
      }}
      className="flex h-8 items-center gap-1.5 rounded-full border border-dash-border px-3 text-xs font-semibold text-dash-secondary transition hover:border-shell-accent/40 hover:text-shell-accent active:scale-[0.98]"
    >
      {copied ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : <Copy size={12} strokeWidth={1.75} aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy claim link'}
    </button>
  )
}

function StoreCard({ restaurant, layout, onOpen, onFinishSetup, claimInvite, onRevokeInvite, summary, summaryFailed }) {
  const location = [restaurant.city, restaurant.state].filter(Boolean).join(', ')
  const isDraft = restaurant.status === 'draft'
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
              isDraft
                ? 'bg-shell-accent/10 text-shell-accent'
                : isActive
                  ? 'bg-dash-success/10 text-dash-success'
                  : 'bg-dash-warning/10 text-dash-warning',
            ].join(' ')}
          >
            {isDraft ? 'Awaiting claim' : isActive ? 'Active' : 'Onboarding'}
          </span>
        </div>
        <StoreKpis restaurantId={restaurant.id} layout={layout} summary={summary} summaryFailed={summaryFailed} />
      </button>
      {isDraft ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-dash-border px-4 py-2.5">
          {claimInvite && <CopyLinkButton url={claimUrl(claimInvite.token)} />}
          {claimInvite && (
            <button
              type="button"
              onClick={() => onRevokeInvite?.(claimInvite)}
              className="text-xs font-semibold text-dash-tertiary transition hover:text-dash-danger"
            >
              Revoke
            </button>
          )}
        </div>
      ) : !isActive && (
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
  const [groupFilter, setGroupFilter] = useState('all')
  const [orderBy, setOrderBy] = useState('name')
  const [layout, setLayout] = useState('grid')
  const [groups, setGroups] = useState([])
  const [invites, setInvites] = useState([])
  const [modal, setModal] = useState(null) // 'board' | 'groups' | 'apply'

  const canBoard = auth.accountType === 'reseller' || auth.accountType === 'admin'

  const reloadGroups = useCallback(async () => {
    if (!auth.user?.id) return
    try {
      setGroups(await fetchStoreGroups(auth.user.id))
    } catch { /* migration not run yet */ }
  }, [auth.user?.id])

  const reloadInvites = useCallback(async () => {
    if (!auth.user?.id || !canBoard) return
    try {
      setInvites(await fetchMyInvites(auth.user.id))
    } catch { /* migration not run yet */ }
  }, [auth.user?.id, canBoard])

  useEffect(() => { void reloadGroups() }, [reloadGroups])
  useEffect(() => { void reloadInvites() }, [reloadInvites])

  const kpiSummary = useAnalyticsSummary(restaurants.map((r) => r.id), 'week')

  const inviteByDraftId = useMemo(() => {
    const map = {}
    for (const invite of invites) {
      if (invite.draft_restaurant_id) map[invite.draft_restaurant_id] = invite
    }
    return map
  }, [invites])

  const quickInvites = useMemo(
    () => invites.filter((invite) => invite.kind === 'quick'),
    [invites]
  )

  const handleRevoke = async (invite) => {
    try {
      await revokeInvite(invite.id)
      await reloadInvites()
    } catch { /* keep the card; next reload reflects reality */ }
  }

  const types = useMemo(() => {
    const found = new Set(restaurants.map((r) => r.type).filter(Boolean))
    return ['all', ...found]
  }, [restaurants])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    const activeGroup = groups.find((group) => group.id === groupFilter)
    const filtered = restaurants.filter((restaurant) => {
      if (typeFilter !== 'all' && restaurant.type !== typeFilter) return false
      if (activeGroup && !activeGroup.restaurantIds.has(restaurant.id)) return false
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
  }, [restaurants, search, typeFilter, orderBy, groups, groupFilter])

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
        <div className="flex flex-wrap items-center gap-2">
          {restaurants.length > 0 && (
            <button
              type="button"
              onClick={() => setModal('groups')}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-dash-border px-3.5 text-sm font-semibold text-dash-secondary transition hover:border-shell-accent/40 hover:text-dash-cream active:scale-[0.98]"
            >
              <FolderKanban size={14} strokeWidth={1.75} aria-hidden="true" />
              Store groups
            </button>
          )}
          {restaurants.length > 1 && (
            <button
              type="button"
              onClick={() => setModal('apply')}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-dash-border px-3.5 text-sm font-semibold text-dash-secondary transition hover:border-shell-accent/40 hover:text-dash-cream active:scale-[0.98]"
            >
              <Send size={14} strokeWidth={1.75} aria-hidden="true" />
              Apply to stores
            </button>
          )}
          {canBoard && (
            <button
              type="button"
              onClick={() => setModal('board')}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-shell-accent/40 bg-shell-accent/10 px-3.5 text-sm font-semibold text-shell-accent transition hover:bg-shell-accent/20 active:scale-[0.98]"
            >
              <Store size={14} strokeWidth={1.75} aria-hidden="true" />
              Board a restaurant
            </button>
          )}
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
          {groups.length > 0 && <span className="h-5 w-px bg-dash-border" aria-hidden="true" />}
          {groups.map((group) => (
            <FilterPill
              key={group.id}
              label={group.name}
              isActive={groupFilter === group.id}
              onClick={() => setGroupFilter(groupFilter === group.id ? 'all' : group.id)}
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
              claimInvite={inviteByDraftId[restaurant.id] || null}
              onRevokeInvite={(invite) => void handleRevoke(invite)}
              summary={kpiSummary.data?.restaurants?.[restaurant.id] || null}
              summaryFailed={kpiSummary.isError}
            />
          ))}
        </section>
      )}

      {quickInvites.length > 0 && (
        <section className="glass-card rounded-2xl p-4">
          <p className="label-mono">Pending quick invites</p>
          <div className="mt-2 space-y-2">
            {quickInvites.map((invite) => (
              <div key={invite.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold text-dash-cream">{invite.email || invite.restaurant_name || 'Open invite'}</span>
                <span className="label-mono !text-[9px]">expires {new Date(invite.expires_at).toLocaleDateString()}</span>
                <span className="ml-auto flex items-center gap-2">
                  <CopyLinkButton url={claimUrl(invite.token)} />
                  <button
                    type="button"
                    onClick={() => void handleRevoke(invite)}
                    className="text-xs font-semibold text-dash-tertiary transition hover:text-dash-danger"
                  >
                    Revoke
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {modal === 'board' && (
        <BoardRestaurantModal
          onClose={() => { setModal(null); void reloadInvites() }}
          onBoarded={() => void auth.refreshRestaurants()}
        />
      )}
      {modal === 'groups' && (
        <StoreGroupsModal
          groups={groups}
          restaurants={restaurants}
          onClose={() => setModal(null)}
          onChanged={reloadGroups}
        />
      )}
      {modal === 'apply' && (
        <ApplyToStoresModal
          restaurants={restaurants.filter((restaurant) => restaurant.status !== 'draft')}
          groups={groups}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

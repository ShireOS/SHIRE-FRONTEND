import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  CheckSquare,
  Filter,
  FolderPlus,
  LayoutGrid,
  ListFilter,
  LogOut,
  MoveRight,
  Settings,
  Square,
  Store,
  Utensils,
  Users,
} from 'lucide-react'
import { useAuth } from '../auth'
import { OnboardingPage } from '../onboarding'
import { fetchWithSupabaseAuth } from '../shared/query'
import { supabase } from '../shared/lib/supabase'
import {
  buildGroupCards,
  createResellerGroup,
  fetchResellerGroups,
  groupRestaurants,
  moveRestaurantsToGroup,
  UNGROUPED_ID,
} from './data/resellerPortfolio'

const GROUP_COLORS = ['#2EA6A1', '#D4A854', '#7C8CF8', '#E06B4F', '#6DAF5C', '#B66DD8']
const DETAIL_TABS = [
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'setup', label: 'Setup', icon: Settings },
  { id: 'menu', label: 'Menu', icon: Utensils },
  { id: 'team', label: 'Team', icon: Users },
]

function ResellerGate({ children }) {
  const auth = useAuth()

  if (auth.isLoading || auth.restaurant.isLoading) {
    return <LoadingScreen />
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/auth/login" replace />
  }

  if (auth.accountType !== 'reseller' && auth.accountType !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-dash-base text-dash-cream flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-dash-gold" />
    </div>
  )
}

function ResellerShell({ children }) {
  const auth = useAuth()

  return (
    <ResellerGate>
      <main className="min-h-screen bg-dash-base text-dash-cream">
        <header className="border-b border-white/10 bg-black/20 px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
            <Link to="/reseller" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Store className="h-5 w-5 text-dash-gold" />
              </span>
              <span>
                <span className="label-mono block">Reseller</span>
                <span className="text-lg font-semibold tracking-tight">Restaurant Portfolio</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-dash-secondary sm:inline">{auth.profile?.first_name || auth.user?.email}</span>
              <button
                type="button"
                onClick={() => void auth.signOut()}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold text-dash-secondary hover:bg-white/10 hover:text-dash-cream"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </main>
    </ResellerGate>
  )
}

function formatLocation(restaurant) {
  return [restaurant.city, restaurant.state].filter(Boolean).join(', ') || restaurant.address || 'Location not set'
}

function useResellerPortfolio() {
  const auth = useAuth()
  const [groups, setGroups] = useState([])
  const [memberships, setMemberships] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!auth.user?.id) return
    setIsLoading(true)
    setError('')
    try {
      const data = await fetchResellerGroups(auth.user.id)
      setGroups(data.groups)
      setMemberships(data.memberships)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reseller groups.')
    } finally {
      setIsLoading(false)
    }
  }, [auth.user?.id])

  useEffect(() => {
    void reload()
  }, [reload])

  const restaurants = useMemo(
    () => groupRestaurants(auth.restaurant.restaurants || [], groups, memberships),
    [auth.restaurant.restaurants, groups, memberships]
  )
  const groupCards = useMemo(() => buildGroupCards(restaurants, groups), [restaurants, groups])

  return { groups, memberships, restaurants, groupCards, isLoading, error, reload }
}

function PortfolioPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { groups, restaurants, groupCards, isLoading, error, reload } = useResellerPortfolio()
  const [view, setView] = useState('restaurants')
  const [groupFilter, setGroupFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const [mode, setMode] = useState('browse')
  const [modal, setModal] = useState(null)
  const [actionError, setActionError] = useState('')

  const filteredRestaurants = useMemo(() => {
    if (groupFilter === 'all') return restaurants
    return restaurants.filter((restaurant) => restaurant.reseller_group_id === groupFilter)
  }, [groupFilter, restaurants])

  const selectedCount = selectedIds.length

  const toggleSelected = (restaurantId) => {
    setSelectedIds((current) =>
      current.includes(restaurantId)
        ? current.filter((id) => id !== restaurantId)
        : [...current, restaurantId]
    )
  }

  const clearSelection = () => {
    setSelectedIds([])
    setMode('browse')
    setActionError('')
  }

  const handleCreateGroup = async ({ name, color }) => {
    setActionError('')
    try {
      const group = await createResellerGroup(auth.user.id, { name, color })
      if (selectedIds.length > 0) {
        await moveRestaurantsToGroup(auth.user.id, selectedIds, group.id)
      }
      await reload()
      setGroupFilter(group.id)
      setView('restaurants')
      clearSelection()
      setModal(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not create group.')
    }
  }

  const handleMove = async (groupId) => {
    setActionError('')
    try {
      await moveRestaurantsToGroup(auth.user.id, selectedIds, groupId)
      await reload()
      setGroupFilter(groupId)
      setView('restaurants')
      clearSelection()
      setModal(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not move restaurants.')
    }
  }

  const startSelection = (nextMode) => {
    setMode(nextMode)
    setActionError('')
    if (selectedIds.length === 0) {
      setView('restaurants')
    }
  }

  const selectable = mode !== 'browse'

  return (
    <ResellerShell>
      <section className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label-mono">Portfolio</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Restaurants under your purview</h1>
          <p className="mt-2 max-w-2xl text-sm text-dash-secondary">
            Groups organize your view only. Moving a restaurant changes no onboarding, menu, payroll, or POS settings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => startSelection('new-group')}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-black hover:bg-dash-gold"
          >
            <FolderPlus className="h-4 w-4" />
            Add group
          </button>
          <button
            type="button"
            onClick={() => startSelection('move')}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold text-dash-cream hover:bg-white/10"
          >
            <MoveRight className="h-4 w-4" />
            Move group
          </button>
        </div>
      </section>

      <section className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {[
            { id: 'restaurants', label: 'Restaurants', icon: LayoutGrid },
            { id: 'groups', label: 'Groups', icon: ListFilter },
          ].map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  view === item.id ? 'bg-white text-black' : 'text-dash-secondary hover:bg-white/10 hover:text-dash-cream'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view === 'restaurants' && (
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-dash-secondary">
              <Filter className="h-4 w-4" />
              <select
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value)}
                className="bg-transparent font-semibold text-dash-cream outline-none"
              >
                <option value="all" className="bg-black">All groups</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id} className="bg-black">{group.name}</option>
                ))}
                <option value={UNGROUPED_ID} className="bg-black">Ungrouped</option>
              </select>
            </label>
          )}
          {selectable && (
            <>
              <span className="rounded-xl border border-dash-gold/30 bg-dash-gold/10 px-3 py-2 text-sm font-semibold text-dash-gold">
                {selectedCount} selected
              </span>
              <button
                type="button"
                onClick={() => setModal(mode)}
                disabled={selectedCount === 0}
                className="h-10 rounded-xl bg-dash-gold px-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="h-10 rounded-xl border border-white/10 px-3 text-sm font-semibold text-dash-secondary hover:bg-white/10"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </section>

      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {actionError && <StatusMessage tone="error">{actionError}</StatusMessage>}

      {isLoading ? (
        <div className="mt-10 flex justify-center"><div className="h-9 w-9 animate-spin rounded-full border-b-2 border-t-2 border-dash-gold" /></div>
      ) : view === 'groups' ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groupCards.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => {
                setGroupFilter(group.id)
                setView('restaurants')
              }}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: group.color }} />
                  <span className="text-lg font-semibold">{group.name}</span>
                </span>
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold text-dash-secondary">
                  {group.restaurant_count}
                </span>
              </span>
              <span className="mt-4 block text-sm text-dash-secondary">
                {group.restaurants.map((restaurant) => restaurant.name).join(', ') || 'No restaurants'}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRestaurants.map((restaurant) => {
            const isSelected = selectedIds.includes(restaurant.id)
            return (
              <button
                key={restaurant.id}
                type="button"
                onClick={() => selectable ? toggleSelected(restaurant.id) : navigate(`/reseller/restaurants/${restaurant.id}/analytics`)}
                className={`rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 ${
                  isSelected
                    ? 'border-dash-gold/70 bg-dash-gold/10'
                    : 'border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]'
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="text-lg font-semibold">{restaurant.name || 'Unnamed restaurant'}</span>
                    <span className="mt-1 block text-sm text-dash-secondary">{formatLocation(restaurant)}</span>
                  </span>
                  {selectable ? (
                    isSelected ? <CheckSquare className="h-5 w-5 text-dash-gold" /> : <Square className="h-5 w-5 text-dash-tertiary" />
                  ) : null}
                </span>
                <span className="mt-5 flex items-center gap-2 text-sm font-semibold text-dash-secondary">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: restaurant.reseller_group_color }} />
                  {restaurant.reseller_group_name}
                </span>
              </button>
            )
          })}
          {filteredRestaurants.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-sm text-dash-secondary">
              No restaurants match this group filter.
            </div>
          )}
        </div>
      )}

      {modal === 'new-group' && (
        <GroupModal
          title="Create group"
          actionLabel="Create group"
          selectedCount={selectedCount}
          onCancel={() => setModal(null)}
          onSubmit={handleCreateGroup}
        />
      )}
      {modal === 'move' && (
        <MoveModal
          groups={groups}
          selectedCount={selectedCount}
          onCancel={() => setModal(null)}
          onSubmit={handleMove}
        />
      )}
    </ResellerShell>
  )
}

function StatusMessage({ tone = 'info', children }) {
  const cls = tone === 'error'
    ? 'border-red-400/25 bg-red-500/10 text-red-100'
    : 'border-dash-gold/25 bg-dash-gold/10 text-dash-gold'
  return <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>
}

function GroupModal({ title, actionLabel, selectedCount, onCancel, onSubmit }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(GROUP_COLORS[0])
  const canSubmit = name.trim().length > 1

  return (
    <ModalFrame title={title} onCancel={onCancel}>
      <div className="space-y-4">
        <label className="block">
          <span className="label-mono">Group name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Downtown Growth"
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-dash-gold"
          />
        </label>
        <div>
          <span className="label-mono">Color</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {GROUP_COLORS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setColor(item)}
                className={`h-9 w-9 rounded-full border-2 ${color === item ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: item }}
                aria-label={`Choose ${item}`}
              />
            ))}
          </div>
        </div>
        <p className="text-sm text-dash-secondary">
          {selectedCount > 0 ? `${selectedCount} selected restaurants will move into this group.` : 'Create the group now; restaurants can be moved into it later.'}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-dash-secondary">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit({ name, color })}
            className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </ModalFrame>
  )
}

function MoveModal({ groups, selectedCount, onCancel, onSubmit }) {
  const [targetGroupId, setTargetGroupId] = useState(groups[0]?.id || UNGROUPED_ID)

  return (
    <ModalFrame title="Move restaurants" onCancel={onCancel}>
      <div className="space-y-4">
        <label className="block">
          <span className="label-mono">Target group</span>
          <select
            value={targetGroupId}
            onChange={(event) => setTargetGroupId(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-dash-gold"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id} className="bg-black">{group.name}</option>
            ))}
            <option value={UNGROUPED_ID} className="bg-black">Ungrouped</option>
          </select>
        </label>
        <p className="text-sm text-dash-secondary">
          {selectedCount} restaurants will move groups. Their setup and POS configuration will not change.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-dash-secondary">
            Cancel
          </button>
          <button type="button" onClick={() => onSubmit(targetGroupId)} className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-black">
            Move
          </button>
        </div>
      </div>
    </ModalFrame>
  )
}

function ModalFrame({ title, onCancel, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141414] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onCancel} className="rounded-lg px-2 py-1 text-sm text-dash-secondary hover:bg-white/10">Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function RestaurantDetailPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { restaurantId, tab = 'analytics' } = useParams()
  const activeTab = DETAIL_TABS.some((item) => item.id === tab) ? tab : 'analytics'
  const restaurant = auth.restaurant.restaurants.find((item) => item.id === restaurantId) || null

  useEffect(() => {
    if (!restaurantId || !restaurant) return
    if (auth.restaurant.currentRestaurant?.id !== restaurantId) {
      void auth.switchRestaurant(restaurantId)
    }
  }, [auth, restaurant, restaurantId])

  if (!restaurantId) return <Navigate to="/reseller" replace />

  if (!restaurant) {
    return (
      <ResellerShell>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8">
          <h1 className="text-2xl font-semibold">Restaurant not found</h1>
          <p className="mt-2 text-dash-secondary">This reseller account is not assigned to that restaurant.</p>
          <Link to="/reseller" className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black">
            Back to portfolio
          </Link>
        </div>
      </ResellerShell>
    )
  }

  if (activeTab === 'setup') {
    return <Navigate to={`/reseller/restaurants/${restaurantId}/setup`} replace />
  }

  return (
    <ResellerShell>
      <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/reseller')}
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-dash-secondary hover:text-dash-cream"
          >
            <ArrowLeft className="h-4 w-4" />
            Portfolio
          </button>
          <p className="label-mono">Restaurant</p>
          <h1 className="text-3xl font-semibold tracking-tight">{restaurant.name}</h1>
          <p className="mt-1 text-sm text-dash-secondary">{formatLocation(restaurant)}</p>
        </div>
        <div className="flex overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {DETAIL_TABS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                to={`/reseller/restaurants/${restaurantId}/${item.id}`}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  activeTab === item.id ? 'bg-white text-black' : 'text-dash-secondary hover:bg-white/10 hover:text-dash-cream'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
      {activeTab === 'analytics' && <ResellerAnalytics restaurantId={restaurantId} />}
      {activeTab === 'menu' && <ResellerMenu restaurantId={restaurantId} />}
      {activeTab === 'team' && <ResellerTeam restaurantId={restaurantId} />}
    </ResellerShell>
  )
}

function ResellerSetupEditor() {
  const auth = useAuth()
  const { restaurantId } = useParams()
  const restaurant = auth.restaurant.restaurants.find((item) => item.id === restaurantId) || null
  const [isSwitching, setIsSwitching] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!restaurantId || !restaurant) {
        setIsSwitching(false)
        return
      }
      if (auth.restaurant.currentRestaurant?.id !== restaurantId) {
        await auth.switchRestaurant(restaurantId)
      }
      if (!cancelled) setIsSwitching(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [auth, restaurant, restaurantId])

  if (!restaurant) {
    return <Navigate to="/reseller" replace />
  }

  if (isSwitching || auth.restaurant.currentRestaurant?.id !== restaurantId) {
    return <LoadingScreen />
  }

  return <OnboardingPage />
}

function ResellerAnalytics({ restaurantId }) {
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/owner-analytics?period=week`)
      .then((data) => {
        if (!cancelled) setPayload(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load analytics.')
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  const sections = payload?.sections || {}
  const revenue = sections.revenue?.data || {}
  const visits = sections.visits?.data || {}
  const staff = sections.staff?.data || sections.labor?.data || {}
  const menuItems = sections.menu?.items || []

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {error && <div className="xl:col-span-3"><StatusMessage tone="error">{error}</StatusMessage></div>}
      <MetricCard label="Revenue" value={formatCurrency(revenue.revenue)} />
      <MetricCard label="Orders" value={formatNumber(revenue.orders)} />
      <MetricCard label="Covers" value={formatNumber(visits.covers)} />
      <MetricCard label="Staff worked" value={formatNumber(staff.staff_worked)} />
      <MetricCard label="Labor minutes" value={formatNumber(staff.labor_minutes)} />
      <MetricCard label="Avg order" value={formatCurrency(revenue.avg_order_value)} />
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 xl:col-span-3">
        <h2 className="text-lg font-semibold">Menu sales</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-dash-tertiary">
              <tr>
                <th className="py-2 pr-4 font-medium">Item</th>
                <th className="py-2 pr-4 font-medium">Qty</th>
                <th className="py-2 pr-4 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.slice(0, 8).map((item) => (
                <tr key={item.name} className="border-t border-white/10">
                  <td className="py-2 pr-4">{item.name}</td>
                  <td className="py-2 pr-4 text-dash-secondary">{formatNumber(item.quantity)}</td>
                  <td className="py-2 pr-4 text-dash-secondary">{formatCurrency(item.revenue)}</td>
                </tr>
              ))}
              {menuItems.length === 0 && (
                <tr><td className="py-4 text-dash-secondary" colSpan="3">No menu sales data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <p className="label-mono">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function ResellerMenu({ restaurantId }) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('menu_items')
      .select('id, name, price, is_active, menu_categories(name)')
      .eq('restaurant_id', restaurantId)
      .order('name')
      .then(({ data, error: queryError }) => {
        if (cancelled) return
        if (queryError) {
          setError(queryError.message)
        } else {
          setItems(data || [])
        }
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <h2 className="text-lg font-semibold">Menu</h2>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-dash-secondary">{item.menu_categories?.name || 'Uncategorized'}</p>
              </div>
              <p className="font-semibold">{formatCurrency(item.price)}</p>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-dash-secondary">No menu items found.</p>}
      </div>
    </section>
  )
}

function ResellerTeam({ restaurantId }) {
  const [team, setTeam] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('waiters')
      .select('id, name, role, email, phone, is_active')
      .eq('restaurant_id', restaurantId)
      .order('name')
      .then(({ data, error: queryError }) => {
        if (cancelled) return
        if (queryError) {
          setError(queryError.message)
        } else {
          setTeam(data || [])
        }
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <h2 className="text-lg font-semibold">Team</h2>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-dash-tertiary">
            <tr>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Role</th>
              <th className="py-2 pr-4 font-medium">Contact</th>
            </tr>
          </thead>
          <tbody>
            {team.map((member) => (
              <tr key={member.id} className="border-t border-white/10">
                <td className="py-2 pr-4">{member.name}</td>
                <td className="py-2 pr-4 text-dash-secondary">{member.role || 'Staff'}</td>
                <td className="py-2 pr-4 text-dash-secondary">{member.email || member.phone || 'No contact'}</td>
              </tr>
            ))}
            {team.length === 0 && (
              <tr><td className="py-4 text-dash-secondary" colSpan="3">No team members found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function formatCurrency(value) {
  const number = Number(value || 0)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number.isFinite(number) ? number : 0)
}

function formatNumber(value) {
  const number = Number(value || 0)
  return new Intl.NumberFormat('en-US').format(Number.isFinite(number) ? number : 0)
}

export default function ResellerApp() {
  return (
    <Routes>
      <Route index element={<PortfolioPage />} />
      <Route path="restaurants/:restaurantId/setup" element={<ResellerGate><ResellerSetupEditor /></ResellerGate>} />
      <Route path="restaurants/:restaurantId" element={<Navigate to="analytics" replace />} />
      <Route path="restaurants/:restaurantId/:tab" element={<RestaurantDetailPage />} />
      <Route path="*" element={<Navigate to="/reseller" replace />} />
    </Routes>
  )
}

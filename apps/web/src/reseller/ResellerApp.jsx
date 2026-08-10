import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
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
  Users,
} from 'lucide-react'
import { useAuth } from '../auth'
import { fetchWithSupabaseAuth } from '../shared/query'
import { supabase } from '../shared/lib/supabase'
import ModernRestaurantSetupPanel, {
  buildSetupWarnings,
  warningCount,
} from '../dashboard/RestaurantSetupPanel'
import {
  buildGroupCards,
  createResellerGroup,
  fetchResellerPortfolioForUser,
  moveRestaurantsToGroup,
  UNGROUPED_ID,
} from './data/resellerPortfolio'
import {
  DEFAULT_RESELLER_PERMISSIONS,
  createResellerEmployee,
  fetchResellerEmployees,
  fetchResellerProfile,
  isResellerProfileComplete,
  normalizeResellerProfile,
  saveResellerProfile,
  uploadResellerLogo,
} from './data/resellerProfile'
import DashboardShell from '../dashboard/shell/DashboardShell'
import { RestaurantWorkspace as ResellerRestaurantWorkspace } from '../dashboard/AuthenticatedDashboardApp'
import { useAllowedStoreTabs } from '../dashboard/data/resellerAccess'
import OverviewPage from '../dashboard/pages/OverviewPage'
import RatesPage from '../dashboard/pages/RatesPage'
import DevicesPage from '../dashboard/pages/DevicesPage'
import UsersPage from '../dashboard/pages/UsersPage'
import ResellerUiEditor from './ResellerUiEditor'
import { scheduleChange } from '../shared/api/scheduledChanges'
import { PublishControls } from '../shared/components/PublishControls'
import { PropagationModal } from '../shared/components/PropagationModal'
import { ScheduledChangesPanel } from '../shared/components/ScheduledChangesPanel'

const GROUP_COLORS = ['#2EA6A1', '#D4A854', '#7C8CF8', '#E06B4F', '#6DAF5C', '#B66DD8']
const RESELLER_SHELL_ROUTES = {
  brand: '/reseller',
  overview: '/reseller/overview',
  stores: '/reseller',
  rates: '/reseller/rates',
  devices: '/reseller/devices',
  users: '/reseller/users',
  settings: '/reseller/profile',
  restaurants: '/reseller/restaurants',
}
const PROFILE_TABS = [
  { id: 'portfolio', label: 'Portfolio', icon: LayoutGrid },
  { id: 'profile', label: 'Profile', icon: Settings },
]

function ResellerGate({ children }) {
  const auth = useAuth()

  if (auth.isLoading || auth.restaurant.isLoading) {
    return <LoadingScreen />
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/auth/login" replace />
  }

  if (!['reseller', 'reseller_employee', 'admin'].includes(auth.accountType)) {
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

function ResellerOnboardingShell({ children }) {
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

function ResellerShell({ children, activeItem = 'stores', breadcrumb = null }) {
  return (
    <ResellerGate>
      <DashboardShell
        context="enterprise"
        activeItem={activeItem}
        routes={RESELLER_SHELL_ROUTES}
        breadcrumb={breadcrumb || [
          { label: 'Home', to: '/reseller' },
          { label: 'Enterprise' },
          { label: activeItem === 'settings' ? 'Profile' : 'Stores' },
        ]}
      >
        {children}
      </DashboardShell>
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
  const [portfolioRestaurants, setPortfolioRestaurants] = useState([])
  const [resellerId, setResellerId] = useState(null)
  const [employee, setEmployee] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!auth.user?.id) return
    setIsLoading(true)
    setError('')
    try {
      const data = await fetchResellerPortfolioForUser({
        userId: auth.user.id,
        accountType: auth.accountType,
        restaurants: auth.restaurant.restaurants || [],
      })
      setResellerId(data.resellerId)
      setEmployee(data.employee)
      setGroups(data.groups)
      setMemberships(data.memberships)
      setPortfolioRestaurants(data.restaurants)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reseller groups.')
    } finally {
      setIsLoading(false)
    }
  }, [auth.accountType, auth.restaurant.restaurants, auth.user?.id])

  useEffect(() => {
    void reload()
  }, [reload])

  const restaurants = portfolioRestaurants
  const groupCards = useMemo(() => buildGroupCards(restaurants, groups), [restaurants, groups])

  return { resellerId, employee, groups, memberships, restaurants, groupCards, isLoading, error, reload }
}

function PortfolioPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { resellerId, employee, groups, restaurants, groupCards, isLoading, error, reload } = useResellerPortfolio()
  const [profileComplete, setProfileComplete] = useState(true)
  const [view, setView] = useState('restaurants')
  const [groupFilter, setGroupFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const [mode, setMode] = useState('browse')
  const [modal, setModal] = useState(null)
  const [actionError, setActionError] = useState('')
  const [inspectedGroupId, setInspectedGroupId] = useState(null)

  const filteredRestaurants = useMemo(() => {
    if (groupFilter === 'all') return restaurants
    return restaurants.filter((restaurant) => restaurant.reseller_group_id === groupFilter)
  }, [groupFilter, restaurants])

  const selectedCount = selectedIds.length
  const canManageGroups = ['reseller', 'admin'].includes(auth.accountType) || Boolean(employee?.permissions?.manage_groups)

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
      const group = await createResellerGroup(resellerId || auth.user.id, { name, color })
      if (selectedIds.length > 0) {
        await moveRestaurantsToGroup(resellerId || auth.user.id, selectedIds, group.id)
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
      await moveRestaurantsToGroup(resellerId || auth.user.id, selectedIds, groupId)
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

  useEffect(() => {
    if (!auth.user?.id || !['reseller', 'admin'].includes(auth.accountType)) return
    let cancelled = false
    fetchResellerProfile(auth.user.id)
      .then((profile) => {
        if (!cancelled) setProfileComplete(isResellerProfileComplete(profile))
      })
      .catch(() => {
        if (!cancelled) setProfileComplete(false)
      })
    return () => {
      cancelled = true
    }
  }, [auth.accountType, auth.user?.id])

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
          <Link
            to="/reseller/profile"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold text-dash-cream hover:bg-white/10"
          >
            <Settings className="h-4 w-4" />
            Profile {!profileComplete && <span className="text-dash-gold">!</span>}
          </Link>
          {canManageGroups && (
            <>
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
            </>
          )}
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
                onClick={() => {
                  setView(item.id)
                  if (item.id === 'restaurants') {
                    setGroupFilter('all')
                    setInspectedGroupId(null)
                  }
                }}
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
        <GroupBrowser
          groups={groupCards}
          inspectedGroupId={inspectedGroupId}
          selectable={selectable}
          selectedIds={selectedIds}
          onInspectGroup={setInspectedGroupId}
          onBackToGroups={() => setInspectedGroupId(null)}
          onRestaurantClick={(restaurantId) => selectable ? toggleSelected(restaurantId) : navigate(`/reseller/restaurants/${restaurantId}/analytics`)}
        />
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

function ResellerLandingPage() {
  const auth = useAuth()
  const [profileState, setProfileState] = useState('loading')

  useEffect(() => {
    if (auth.accountType !== 'reseller' || !auth.user?.id) {
      setProfileState('complete')
      return
    }
    let cancelled = false
    fetchResellerProfile(auth.user.id)
      .then((profile) => {
        if (!cancelled) setProfileState(isResellerProfileComplete(profile) ? 'complete' : 'incomplete')
      })
      .catch(() => {
        if (!cancelled) setProfileState('incomplete')
      })
    return () => {
      cancelled = true
    }
  }, [auth.accountType, auth.user?.id])

  if (profileState === 'loading') return <LoadingScreen />
  if (profileState === 'incomplete') return <Navigate to="/reseller/onboarding" replace />
  return <PortfolioPage />
}

function ResellerOnboardingPage() {
  return (
    <ResellerOnboardingShell>
      <ResellerProfileEditor onboarding />
    </ResellerOnboardingShell>
  )
}

function ResellerProfilePage() {
  return (
    <ResellerShell activeItem="settings">
      <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label-mono">Profile</p>
          <h1 className="text-3xl font-semibold tracking-tight">Reseller Organization</h1>
          <p className="mt-2 max-w-2xl text-sm text-dash-secondary">
            Manage reseller-only profile, branding, team access, and propagation defaults.
          </p>
        </div>
        <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {PROFILE_TABS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                to={item.id === 'portfolio' ? '/reseller' : '/reseller/profile'}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  item.id === 'profile' ? 'bg-white text-black' : 'text-dash-secondary hover:bg-white/10 hover:text-dash-cream'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
      <ResellerProfileEditor />
    </ResellerShell>
  )
}

function ResellerProfileEditor({ onboarding = false }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const { resellerId, groups, restaurants, isLoading: portfolioLoading } = useResellerPortfolio()
  const [profile, setProfile] = useState(() => normalizeResellerProfile(null))
  const [employees, setEmployees] = useState([])
  const [employeeDraft, setEmployeeDraft] = useState(() => ({
    name: '',
    email: '',
    username: '',
    password: '11111111',
    restaurant_ids: [],
    group_ids: [],
    permissions: { ...DEFAULT_RESELLER_PERMISSIONS },
  }))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canManage = ['reseller', 'admin'].includes(auth.accountType)
  const profileComplete = isResellerProfileComplete(profile)

  const load = useCallback(async () => {
    if (!resellerId) return
    setLoading(true)
    setError('')
    try {
      const [profileRow, employeeRows] = await Promise.all([
        fetchResellerProfile(resellerId),
        canManage ? fetchResellerEmployees(resellerId) : Promise.resolve([]),
      ])
      setProfile(profileRow)
      setEmployees(employeeRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reseller profile.')
    } finally {
      setLoading(false)
    }
  }, [canManage, resellerId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (onboarding && !loading && profileComplete) {
      navigate('/reseller', { replace: true })
    }
  }, [loading, navigate, onboarding, profileComplete])

  const updateProfile = (patch) => setProfile((current) => ({ ...current, ...patch }))
  const toggleDraftRestaurant = (restaurantId) => {
    setEmployeeDraft((current) => {
      const has = current.restaurant_ids.includes(restaurantId)
      return {
        ...current,
        restaurant_ids: has
          ? current.restaurant_ids.filter((id) => id !== restaurantId)
          : [...current.restaurant_ids, restaurantId],
      }
    })
  }
  const toggleAllDraftRestaurants = () => {
    setEmployeeDraft((current) => ({
      ...current,
      restaurant_ids: current.restaurant_ids.length === restaurants.length ? [] : restaurants.map((restaurant) => restaurant.id),
    }))
  }
  const toggleDraftGroup = (groupId) => {
    setEmployeeDraft((current) => {
      const has = current.group_ids.includes(groupId)
      return {
        ...current,
        group_ids: has
          ? current.group_ids.filter((id) => id !== groupId)
          : [...current.group_ids, groupId],
      }
    })
  }
  const toggleAllDraftGroups = () => {
    setEmployeeDraft((current) => ({
      ...current,
      group_ids: current.group_ids.length === groups.length ? [] : groups.map((group) => group.id),
    }))
  }

  const saveProfile = async ({ complete = false, publication = null } = {}) => {
    if (!resellerId) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      if (publication && !complete) {
        const patch = {
          organization_name: profile.organization_name?.trim() || '',
          legal_business_name: profile.legal_business_name?.trim() || null,
          business_email: profile.business_email?.trim() || null,
          phone: profile.phone?.trim() || null,
          website: profile.website?.trim() || null,
          default_general_propagation: profile.default_general_propagation || 'current_group',
          default_specified_propagation: profile.default_specified_propagation || 'current_restaurant',
        }
        const scheduled = await scheduleChange({
          label: 'Reseller organization profile',
          scheduledFor: publication.scheduledFor,
          timezone: publication.timezone,
          commands: [{ method: 'PATCH', path: '/reseller/profile', body: { patch, complete: false }, target_type: 'reseller', target_id: resellerId }],
        })
        setMessage(`Reseller profile scheduled for ${new Date(scheduled.scheduled_for).toLocaleString()}.`)
        return
      }
      const saved = await saveResellerProfile(resellerId, profile, { complete })
      setProfile(saved)
      setMessage(complete ? 'Reseller onboarding complete.' : 'Saved reseller profile.')
      if (complete) navigate('/reseller', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save reseller profile.')
    } finally {
      setSaving(false)
    }
  }

  const uploadLogo = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !resellerId) return
    setSaving(true)
    setError('')
    try {
      const logoUrl = await uploadResellerLogo(resellerId, file)
      const saved = await saveResellerProfile(resellerId, { ...profile, logo_url: logoUrl })
      setProfile(saved)
      setMessage('Logo uploaded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload logo.')
    } finally {
      setSaving(false)
      event.target.value = ''
    }
  }

  const addEmployee = async () => {
    if (!employeeDraft.name.trim()) {
      setError('Employee name is required.')
      return
    }
    if (employeeDraft.password.length < 8) {
      setError('Employee password must be at least 8 characters.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createResellerEmployee(employeeDraft)
      setEmployeeDraft({
        name: '',
        email: '',
        username: '',
        password: '11111111',
        restaurant_ids: [],
        group_ids: [],
        permissions: { ...DEFAULT_RESELLER_PERMISSIONS },
      })
      await load()
      setMessage('Reseller employee added.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add reseller employee.')
    } finally {
      setSaving(false)
    }
  }

  if (portfolioLoading || loading) return <LoadingScreen />

  return (
    <div className="space-y-5">
      {onboarding && (
        <section className="rounded-xl border border-dash-gold/30 bg-dash-gold/10 p-5">
          <p className="label-mono text-dash-gold">Enterprise Onboarding</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Set up your reseller organization</h1>
          <p className="mt-2 max-w-2xl text-sm text-dash-secondary">
            This setup belongs to your reseller organization only. Restaurant setup stays separate.
          </p>
        </section>
      )}
      {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</div>}
      {!onboarding && <ScheduledChangesPanel />}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="label-mono">Organization Profile</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Company details</h2>
          </div>
          {!profileComplete && <span className="rounded-full border border-dash-gold/40 px-3 py-1 text-xs font-semibold text-dash-gold">!</span>}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Organization Name">
            <TextInput value={profile.organization_name} onChange={event => updateProfile({ organization_name: event.target.value })} placeholder="Shire Enterprise Partners" disabled={!canManage} />
          </Field>
          <Field label="Legal Business Name">
            <TextInput value={profile.legal_business_name || ''} onChange={event => updateProfile({ legal_business_name: event.target.value })} placeholder="Legal entity" disabled={!canManage} />
          </Field>
          <Field label="Business Email">
            <TextInput value={profile.business_email || ''} onChange={event => updateProfile({ business_email: event.target.value })} placeholder="ops@example.com" disabled={!canManage} />
          </Field>
          <Field label="Phone">
            <TextInput value={profile.phone || ''} onChange={event => updateProfile({ phone: event.target.value })} placeholder="(555) 000-0000" disabled={!canManage} />
          </Field>
          <Field label="Website">
            <TextInput value={profile.website || ''} onChange={event => updateProfile({ website: event.target.value })} placeholder="https://example.com" disabled={!canManage} />
          </Field>
          <Field label="Logo">
            <div className="flex items-center gap-3">
              {profile.logo_url && <img src={profile.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />}
              <input type="file" accept="image/*" onChange={uploadLogo} disabled={!canManage || saving} className="text-sm text-dash-secondary" />
            </div>
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <p className="label-mono">Default Propagation</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Save behavior defaults</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="General Changes">
            <SelectInput value={profile.default_general_propagation} onChange={event => updateProfile({ default_general_propagation: event.target.value })} disabled={!canManage}>
              <option value="current_group">Default to current group</option>
              <option value="current_restaurant">Default to current restaurant</option>
              <option value="ask_every_time">Ask every time</option>
            </SelectInput>
          </Field>
          <Field label="Specified Changes">
            <SelectInput value={profile.default_specified_propagation} onChange={event => updateProfile({ default_specified_propagation: event.target.value })} disabled={!canManage}>
              <option value="current_restaurant">Default to current restaurant</option>
              <option value="ask_every_time">Ask every time</option>
            </SelectInput>
          </Field>
        </div>
      </section>

      {canManage && (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="label-mono">Team Access</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Reseller employees</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <Field label="Name"><TextInput value={employeeDraft.name} onChange={event => setEmployeeDraft(current => ({ ...current, name: event.target.value }))} placeholder="Jordan Lee" /></Field>
              <Field label="Email (optional)"><TextInput value={employeeDraft.email} onChange={event => setEmployeeDraft(current => ({ ...current, email: event.target.value }))} placeholder="jordan@example.com" /></Field>
              <Field label="Username (optional)"><TextInput value={employeeDraft.username} onChange={event => setEmployeeDraft(current => ({ ...current, username: event.target.value }))} placeholder="jordan_shire" /></Field>
              <Field label="Temporary Password"><TextInput value={employeeDraft.password} onChange={event => setEmployeeDraft(current => ({ ...current, password: event.target.value }))} placeholder="At least 8 characters" /></Field>
              <div className="flex flex-wrap gap-2">
                {[
                  ['edit_setup', 'Edit setup'],
                  ['propagate_changes', 'Propagate'],
                  ['manage_groups', 'Manage groups'],
                  ['close_day', 'Close day'],
                ].map(([key, label]) => (
                  <SmallButton
                    key={key}
                    variant={employeeDraft.permissions[key] ? 'primary' : 'secondary'}
                    onClick={() => setEmployeeDraft(current => ({
                      ...current,
                      permissions: { ...current.permissions, [key]: !current.permissions[key] },
                    }))}
                  >
                    {label}
                  </SmallButton>
                ))}
              </div>
              <SmallButton variant="primary" onClick={() => void addEmployee()} disabled={saving}>{saving ? 'Saving...' : 'Add employee'}</SmallButton>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Group access</p>
                  <SmallButton onClick={toggleAllDraftGroups}>{employeeDraft.group_ids.length === groups.length ? 'Clear all' : 'Choose all'}</SmallButton>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {groups.map((group) => (
                    <label key={group.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 p-3 text-sm">
                      <input type="checkbox" checked={employeeDraft.group_ids.includes(group.id)} onChange={() => toggleDraftGroup(group.id)} />
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                        <span className="truncate">{group.name}</span>
                      </span>
                    </label>
                  ))}
                  {groups.length === 0 && <p className="text-sm text-dash-secondary">Create a group first to assign group access.</p>}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Restaurant access</p>
                  <SmallButton onClick={toggleAllDraftRestaurants}>{employeeDraft.restaurant_ids.length === restaurants.length ? 'Clear all' : 'Choose all'}</SmallButton>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {restaurants.map((restaurant) => (
                    <label key={restaurant.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 p-3 text-sm">
                      <input type="checkbox" checked={employeeDraft.restaurant_ids.includes(restaurant.id)} onChange={() => toggleDraftRestaurant(restaurant.id)} />
                      <span>{restaurant.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                {employees.map((employee) => (
                  <div key={employee.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{employee.name}</p>
                        <p className="mt-1 text-xs text-dash-secondary">
                          {employee.username} · {employee.restaurant_ids.length} restaurants · {(employee.group_ids || []).length} groups
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-dash-secondary">{employee.status}</span>
                    </div>
                  </div>
                ))}
                {employees.length === 0 && <p className="text-sm text-dash-secondary">No reseller employees yet.</p>}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {!onboarding && <SmallButton onClick={() => navigate('/reseller')}>Back to portfolio</SmallButton>}
        {onboarding ? (
          <SmallButton variant="primary" onClick={() => void saveProfile({ complete: true })} disabled={saving || !profileComplete}>
            {saving ? 'Saving...' : 'Complete reseller onboarding'}
          </SmallButton>
        ) : (
          <PublishControls
            label="Save profile"
            busy={saving}
            onPublishNow={() => saveProfile()}
            onSchedule={(scheduledFor, timezone) => saveProfile({ publication: { scheduledFor, timezone } })}
          />
        )}
      </div>
    </div>
  )
}

function GroupBrowser({
  groups,
  inspectedGroupId,
  selectable,
  selectedIds,
  onInspectGroup,
  onBackToGroups,
  onRestaurantClick,
}) {
  const inspectedGroup = groups.find((group) => group.id === inspectedGroupId) || null

  if (inspectedGroup) {
    return (
      <div className="mt-6 space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: inspectedGroup.color }} />
            <div>
              <p className="label-mono">Group</p>
              <h2 className="text-2xl font-semibold tracking-tight">{inspectedGroup.name}</h2>
              <p className="mt-1 text-sm text-dash-secondary">{inspectedGroup.restaurant_count} restaurants</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBackToGroups}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 px-3 text-sm font-semibold text-dash-secondary hover:bg-white/10 hover:text-dash-cream"
          >
            All groups
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {inspectedGroup.restaurants.map((restaurant) => {
            const isSelected = selectedIds.includes(restaurant.id)
            return (
              <button
                key={restaurant.id}
                type="button"
                onClick={() => onRestaurantClick(restaurant.id)}
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
              </button>
            )
          })}
          {inspectedGroup.restaurants.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-sm text-dash-secondary">
              No restaurants are in this group yet.
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          onClick={() => onInspectGroup(group.id)}
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
  )
}

function StatusMessage({ tone = 'info', children }) {
  const cls = tone === 'error'
    ? 'border-red-400/25 bg-red-500/10 text-red-100'
    : 'border-dash-gold/25 bg-dash-gold/10 text-dash-gold'
  return <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="label-mono">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  )
}

function TextInput({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-dash-gold disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    />
  )
}

function SelectInput({ className = '', children, ...props }) {
  return (
    <select
      {...props}
      className={`h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-dash-cream outline-none focus:border-dash-gold disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </select>
  )
}

function SmallButton({ variant = 'secondary', className = '', children, ...props }) {
  const cls = variant === 'primary'
    ? 'bg-white text-black hover:bg-dash-gold disabled:bg-white/50'
    : 'border border-white/10 text-dash-secondary hover:bg-white/10 hover:text-dash-cream disabled:opacity-50'
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-sm font-semibold transition disabled:cursor-not-allowed ${cls} ${className}`}
    >
      {children}
    </button>
  )
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

function ResellerSetupEditor() {
  const auth = useAuth()
  const { restaurantId } = useParams()
  const restaurant = auth.restaurant.restaurants.find((item) => item.id === restaurantId) || null
  const allowedStoreTabs = useAllowedStoreTabs(restaurant)
  const { groups, restaurants, isLoading: isPortfolioLoading, error: portfolioError } = useResellerPortfolio()
  const [isSwitching, setIsSwitching] = useState(true)
  const [waiterCount, setWaiterCount] = useState(null)
  const [floorPlanStatus, setFloorPlanStatus] = useState(null)
  const [setupRefreshKey, setSetupRefreshKey] = useState(0)
  const [propagationRequest, setPropagationRequest] = useState(null)

  const setupWarnings = useMemo(
    () => buildSetupWarnings(restaurant || {}, waiterCount, floorPlanStatus),
    [restaurant, waiterCount, floorPlanStatus]
  )

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

  useEffect(() => {
    if (!restaurantId || !restaurant) return
    let cancelled = false
    Promise.all([
      fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=false`),
      fetchWithSupabaseAuth(`/restaurants/${restaurantId}/floor-plan`).catch(() => null),
    ])
      .then(([waiterData, floorPlan]) => {
        if (cancelled) return
        setWaiterCount(Array.isArray(waiterData) ? waiterData.length : 0)
        setFloorPlanStatus(floorPlan)
      })
      .catch(() => {
        if (!cancelled) {
          setWaiterCount(null)
          setFloorPlanStatus(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [restaurant, restaurantId, setupRefreshKey])

  const requestPropagationTargets = useCallback((descriptor) => (
    new Promise((resolve) => {
      setPropagationRequest({ descriptor, resolve })
    })
  ), [])

  const closePropagationModal = useCallback((restaurantIds = null) => {
    setPropagationRequest((current) => {
      current?.resolve(restaurantIds)
      return null
    })
  }, [])

  if (!restaurant) {
    return <Navigate to="/reseller" replace />
  }

  if (allowedStoreTabs && !allowedStoreTabs.includes('setup')) {
    return <Navigate to={`/reseller/restaurants/${restaurantId}/analytics`} replace />
  }

  if (isSwitching || isPortfolioLoading || auth.restaurant.currentRestaurant?.id !== restaurantId) {
    return <LoadingScreen />
  }

  return (
    <DashboardShell
      context="store"
      activeItem="setup"
      breadcrumb={[
        { label: 'Home', to: `/reseller/restaurants/${restaurantId}/analytics` },
        { label: 'Setup' },
      ]}
      restaurant={restaurant}
      restaurantId={restaurantId}
      setupWarningCount={warningCount(setupWarnings)}
      allowedStoreTabs={allowedStoreTabs}
      routes={RESELLER_SHELL_ROUTES}
    >
      {portfolioError && <StatusMessage tone="error">{portfolioError}</StatusMessage>}
      <ModernRestaurantSetupPanel
        restaurant={restaurant}
        restaurantId={restaurantId}
        auth={auth}
        setupWarnings={setupWarnings}
        onSetupChanged={() => setSetupRefreshKey(key => key + 1)}
        propagationContext={{
          restaurants,
          groups,
          sourceRestaurantId: restaurantId,
          requestTargets: requestPropagationTargets,
        }}
      />
      {propagationRequest && (
        <PropagationModal
          request={propagationRequest}
          restaurants={restaurants}
          groups={groups}
          sourceRestaurantId={restaurantId}
          onCancel={() => closePropagationModal(null)}
          onApply={closePropagationModal}
        />
      )}
    </DashboardShell>
  )
}

function ResellerUiEditorRoute() {
  const auth = useAuth()
  const { restaurantId } = useParams()
  const restaurant = auth.restaurant.restaurants.find((item) => item.id === restaurantId) || null
  const allowedStoreTabs = useAllowedStoreTabs(restaurant)
  const { employee, groups, restaurants, isLoading, error } = useResellerPortfolio()

  if (!restaurant) return <Navigate to="/reseller" replace />
  if (isLoading) return <LoadingScreen />
  if (allowedStoreTabs && !allowedStoreTabs.includes('ui')) {
    return <Navigate to={`/reseller/restaurants/${restaurantId}/analytics`} replace />
  }

  return (
    <DashboardShell
      context="store"
      activeItem="ui"
      breadcrumb={[
        { label: 'Home', to: `/reseller/restaurants/${restaurantId}/analytics` },
        { label: 'UI Editor' },
      ]}
      restaurant={restaurant}
      restaurantId={restaurantId}
      allowedStoreTabs={allowedStoreTabs}
      routes={RESELLER_SHELL_ROUTES}
    >
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      <ResellerUiEditor
        restaurants={restaurants}
        groups={groups}
        initialRestaurantId={restaurantId}
        canEditMenuWorkspace={['reseller', 'admin'].includes(auth.accountType) || Boolean(employee?.permissions?.edit_setup)}
      />
    </DashboardShell>
  )
}

export default function ResellerApp() {
  return (
    <Routes>
      <Route index element={<ResellerLandingPage />} />
      <Route path="onboarding" element={<ResellerOnboardingPage />} />
      <Route path="profile" element={<ResellerProfilePage />} />
      <Route path="overview" element={<ResellerShell activeItem="overview"><OverviewPage restaurantBase="/reseller/restaurants" /></ResellerShell>} />
      <Route path="rates" element={<ResellerShell activeItem="rates"><RatesPage restaurantBase="/reseller/restaurants" fallbackPath="/reseller" /></ResellerShell>} />
      <Route path="devices" element={<ResellerShell activeItem="devices"><DevicesPage /></ResellerShell>} />
      <Route path="users" element={<ResellerShell activeItem="users"><UsersPage fallbackPath="/reseller" /></ResellerShell>} />
      <Route path="restaurants/:restaurantId/setup" element={<ResellerGate><ResellerSetupEditor /></ResellerGate>} />
      <Route path="restaurants/:restaurantId/ui" element={<ResellerGate><ResellerUiEditorRoute /></ResellerGate>} />
      <Route path="restaurants/:restaurantId" element={<Navigate to="analytics" replace />} />
      <Route path="restaurants/:restaurantId/:tab" element={(
        <ResellerGate>
          <ResellerRestaurantWorkspace
            restaurantBase="/reseller/restaurants"
            restaurantListPath="/reseller"
            shellRoutes={RESELLER_SHELL_ROUTES}
          />
        </ResellerGate>
      )} />
      <Route path="*" element={<Navigate to="/reseller" replace />} />
    </Routes>
  )
}

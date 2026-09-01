import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Banknote,
  Bell,
  Building2,
  Gauge,
  CalendarClock,
  CalendarCheck,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Home,
  LayoutGrid,
  MapPin,
  Megaphone,
  MessageSquare,
  MessageSquareWarning,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Percent,
  PhoneCall,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Sun,
  Users,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react'
import { useAuth } from '../../auth'
import { queryClient, queryKeys, fetchWithSupabaseAuth, STALE_TIMES } from '../../shared/query'
import { useBackOfficeAccess } from '../../shared/hooks/useBackOfficeAccess'
import { TAB_PERMISSIONS } from '../../shared/permissions'
import { SECTION_VIEW_CAPABILITIES, TAB_VIEW_CAPABILITIES, defaultViewPolicy, normalizeViewPolicy } from '../../shared/backOfficeView'
import { backOfficeApi } from '../../shared/api/backOfficeApi'
import { fetchReservationsApi } from '../../shared/api/reservationsClient'
import { preloadWorkspaceModule } from '../workspaceModuleLoaders'
import { loadRestaurantHomepageBootstrap } from '../data/homepageBootstrap'
import { Modal, ModalFooter } from '../components/shared/Modal'
import BackOfficeViewEditor from '../components/team/BackOfficeViewEditor'

const THEME_STORAGE_KEY = 'shire_dashboard_theme'

export function useShellTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  return [theme, setTheme]
}

// Warm the cache for a store tab the moment the user shows intent (hover/focus),
// so the data is usually already there when they click.
export function prefetchWorkspaceTab(restaurantId, tabId, activeTab) {
  if (!restaurantId || tabId === activeTab) return
  preloadWorkspaceModule(tabId)
  const prefetch = (queryKey, queryFn, staleTime) =>
    void queryClient.prefetchQuery({ queryKey, queryFn, staleTime })
  const api = (path) => ({ signal }) => fetchWithSupabaseAuth(path, { signal })

  if (tabId === 'reports') {
    prefetch(queryKeys.reportPreferences(restaurantId), api(`/restaurants/${restaurantId}/reports/view-preferences`), STALE_TIMES.setup)
  } else if (tabId === 'analytics') {
    prefetch(
      queryKeys.homepageBootstrap(restaurantId),
      ({ signal }) => loadRestaurantHomepageBootstrap(fetchWithSupabaseAuth, restaurantId, signal),
      STALE_TIMES.analytics,
    )
  } else if (tabId === 'setup') {
    // The setup editor already scopes its reads to the visible section. Do not
    // turn an incidental sidebar hover into a fourteen-request workspace load.
    prefetch(queryKeys.setupStatus(restaurantId), api(`/restaurants/${restaurantId}/setup-status`), STALE_TIMES.setup)
  } else if (tabId === 'scheduling') {
    prefetch(queryKeys.staffingBlocks(restaurantId), api(`/restaurants/${restaurantId}/staffing-requirements/blocks`), STALE_TIMES.scheduling)
    prefetch(queryKeys.staffingSuggestions(restaurantId), api(`/restaurants/${restaurantId}/staffing-requirements/suggestions`), STALE_TIMES.scheduling)
    prefetch(queryKeys.schedules(restaurantId, '?limit=5'), api(`/restaurants/${restaurantId}/schedules?limit=5`), STALE_TIMES.scheduling)
    prefetch(queryKeys.waiters(restaurantId), api(`/restaurants/${restaurantId}/waiters?include_inactive=false`), STALE_TIMES.scheduling)
    prefetch(queryKeys.employeeRequestPolicy(restaurantId), api(`/restaurants/${restaurantId}/employee-request-policy`), STALE_TIMES.scheduling)
    prefetch(queryKeys.employeeRequests(restaurantId, 'all'), api(`/restaurants/${restaurantId}/employee-requests?status=all`), STALE_TIMES.scheduling)
    prefetch(queryKeys.shiftTradeRequests(restaurantId, 'all'), api(`/restaurants/${restaurantId}/shift-trade-requests?status=all`), STALE_TIMES.scheduling)
  } else if (tabId === 'messaging') {
    prefetch(queryKeys.waiters(restaurantId), api(`/restaurants/${restaurantId}/waiters?include_inactive=false`), STALE_TIMES.setup)
    prefetch(queryKeys.conversations(restaurantId), api(`/restaurants/${restaurantId}/messages/conversations`), STALE_TIMES.messaging)
    prefetch(queryKeys.announcements(restaurantId), api(`/restaurants/${restaurantId}/announcements`), STALE_TIMES.messaging)
  } else if (tabId === 'menu') {
    prefetch(queryKeys.menuItems(restaurantId), api(`/restaurants/${restaurantId}/menu/items`), STALE_TIMES.setup)
    prefetch(queryKeys.menuCategories(restaurantId), api(`/restaurants/${restaurantId}/menu/categories`), STALE_TIMES.setup)
  } else if (tabId === 'taxes') {
    prefetch(queryKeys.taxesCharges(restaurantId), api(`/restaurants/${restaurantId}/taxes-charges`), STALE_TIMES.setup)
    prefetch(queryKeys.menuCategories(restaurantId), api(`/restaurants/${restaurantId}/menu/categories`), STALE_TIMES.setup)
    prefetch(queryKeys.priceAllocations(restaurantId), api(`/restaurants/${restaurantId}/menu/price-allocations`), STALE_TIMES.setup)
  } else if (tabId === 'feedback') {
    prefetch(
      queryKeys.guestFeedback(restaurantId, 'open'),
      () => fetchReservationsApi(`/locations/${restaurantId}/guest-feedback?status=open`),
      STALE_TIMES.messaging
    )
  } else if (tabId === 'reservations') {
    prefetch(
      queryKeys.voiceProvisioning(restaurantId),
      () => fetchReservationsApi(`/locations/${restaurantId}/voice-provisioning`),
      STALE_TIMES.setup,
    )
  }
}

// Derived from actual relationships so the label can't lie: an 'owner'
// account that owns nothing but manages stores reads as Manager.
function deriveRoleLabel(auth) {
  if (auth.accountType === 'admin') return 'Admin'
  if (auth.accountType === 'reseller') return 'Reseller'
  const owned = (auth.restaurant.restaurants || []).some((r) => r.owner_id === auth.user?.id)
  return owned ? 'Owner' : 'Manager'
}

function hiddenSurfaces(auth) {
  const prefs = auth.profile?.dashboard_prefs
  const hidden = prefs && typeof prefs === 'object' ? prefs.hidden_surfaces : null
  return new Set(Array.isArray(hidden) ? hidden : [])
}

const STORE_NAV = [
  { id: 'analytics', label: 'Home', icon: Home },
  { id: 'reports', label: 'POS Reports', icon: ChartNoAxesCombined },
  { id: 'checks', label: 'Checks', icon: ReceiptText },
  { id: 'close-day', label: 'Close Day', icon: CalendarCheck },
  { id: 'setup', label: 'Setup', icon: Wrench },
  { id: 'store-information', label: 'Store Information', icon: Store },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'ui', label: 'UI Editor', icon: Palette },
  { id: 'menu-workspace', label: 'POS Menus', icon: SlidersHorizontal },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { id: 'taxes', label: 'Taxes', icon: Percent, resellerOnly: true },
  { id: 'integrations', label: 'Integrations', icon: SlidersHorizontal },
  { id: 'reservations', label: 'Reservations', icon: PhoneCall },
  { id: 'feedback', label: 'Complaints', icon: MessageSquareWarning },
  { id: 'devices', label: 'Devices', icon: Monitor },
  { id: 'device-updates', label: 'Device Updates', icon: RefreshCw },
  { id: 'pos-settings', label: 'POS Settings', icon: Settings },
  {
    id: 'printing-group',
    label: 'Printing & Routing',
    icon: Printer,
    children: [
      { id: 'printing-routing', section: 'overview', label: 'Overview', icon: LayoutGrid },
      { id: 'printing-routing', section: 'routing', label: 'Routing', icon: SlidersHorizontal },
      { id: 'printing-routing', section: 'kds', label: 'Kitchen Displays', icon: Monitor },
      { id: 'printing-routing', section: 'receipts', label: 'Receipts & Tickets', icon: Printer },
    ],
  },
  {
    id: 'team-group',
    label: 'Team',
    icon: Users,
    children: [
      { id: 'team', label: 'Members', icon: Users },
      { id: 'alerts', label: 'Alerts', icon: Bell },
      { id: 'tip-pooling', label: 'Workforce & Pay', icon: Banknote },
      { id: 'scheduling', label: 'Scheduling', icon: CalendarClock },
    ],
  },
  { id: 'messaging', label: 'Messaging', icon: MessageSquare },
  { id: 'payments', label: 'Payments / Plan', icon: CreditCard },
  { id: 'settings', label: 'Store Settings', icon: Settings },
]

// Future surfaces, visible for shape but intentionally non-functional.
const STORE_NAV_SOON = [
  { id: 'online-ordering', label: 'Online Ordering', icon: ShoppingCart },
]

function SoonChip() {
  return (
    <span className="ml-auto rounded-full border border-dash-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-dash-tertiary">
      Soon
    </span>
  )
}

function SidebarItem({ icon: Icon, label, isActive, onClick, onHover, soon = false, warning = false }) {
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      onMouseEnter={onHover}
      onFocus={onHover}
      aria-disabled={soon}
      title={soon ? `${label} — coming soon` : label}
      className={[
        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition',
        isActive
          ? 'bg-shell-accent/[0.12] text-shell-accent shadow-[inset_0_0_0_1px_var(--shell-accent-ring)]'
          : soon
            ? 'cursor-default text-dash-tertiary opacity-60'
            : 'text-dash-secondary hover:bg-[var(--glass-bg-hover)] hover:text-dash-cream',
      ].join(' ')}
    >
      <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
      <span className="truncate">{label}</span>
      {warning && (
        <span
          aria-label="Needs attention"
          className="ml-auto inline-block h-0 w-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-amber-400"
        />
      )}
      {soon && <SoonChip />}
    </button>
  )
}

// Expandable sidebar group (e.g. Team): renders its children indented, stays
// open while any child is active, and remembers manual toggling. Children may
// carry a `section` (URL hash) so several entries can point at one tab.
function SidebarGroup({ group, activeItem, activeSection, onNavigate, onHoverItem }) {
  const childActive = group.children.some((child) => child.id === activeItem)
  const [manuallyOpen, setManuallyOpen] = useState(false)
  const open = childActive || manuallyOpen
  const Icon = group.icon

  return (
    <div>
      <button
        type="button"
        onClick={() => setManuallyOpen((value) => !value)}
        title={group.label}
        className={[
          'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition',
          childActive
            ? 'text-shell-accent'
            : 'text-dash-secondary hover:bg-[var(--glass-bg-hover)] hover:text-dash-cream',
        ].join(' ')}
      >
        <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
        <span className="truncate">{group.label}</span>
        <span className="ml-auto text-dash-tertiary">
          {open
            ? <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
            : <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />}
        </span>
      </button>
      {open && (
        <div className="ml-4 border-l border-dash-border pl-1">
          {group.children.map((child) => (
            <SidebarItem
              key={child.section ? `${child.id}-${child.section}` : child.id}
              icon={child.icon}
              label={child.label}
              isActive={activeItem === child.id && (!child.section || activeSection === child.section)}
              onHover={() => onHoverItem(child.id)}
              onClick={() => onNavigate(child.id, child.section)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SectionEyebrow({ children }) {
  return <p className="label-mono truncate px-3 pb-1.5 pt-5">{children}</p>
}

function LocationSwitcher({ context, restaurantId, activeTab, restaurantBase }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const restaurants = auth.restaurant.restaurants || []
  const [switching, setSwitching] = useState(false)

  // Outside a store the switcher is an entry point, not a default —
  // it shows "Select a store" until you deliberately step into one.
  const value = context === 'store' ? (restaurantId || '') : ''

  const handleChange = async (event) => {
    const nextId = event.target.value
    if (!nextId || nextId === restaurantId) return
    setSwitching(true)
    try {
      await auth.switchRestaurant(nextId)
      navigate(`${restaurantBase}/${nextId}/${context === 'store' ? activeTab || 'analytics' : 'analytics'}`)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <label className="glass-panel relative inline-flex min-h-[38px] max-w-full items-center rounded-xl border border-dash-border text-sm font-semibold text-dash-cream transition focus-within:border-shell-accent/60 hover:border-shell-accent/40">
      <span className="pointer-events-none absolute left-3 text-dash-tertiary">
        <MapPin size={15} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="sr-only">Switch location</span>
      <select
        value={value}
        onChange={handleChange}
        disabled={switching || restaurants.length === 0}
        className="max-w-[min(60vw,260px)] appearance-none truncate rounded-xl bg-transparent py-2 pl-9 pr-9 text-sm font-semibold text-dash-cream outline-none disabled:cursor-wait disabled:opacity-70"
      >
        <option value="" disabled>
          {restaurants.length === 0 ? 'No stores yet' : 'Select a store'}
        </option>
        {restaurants.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name || 'Untitled restaurant'}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 text-dash-tertiary">
        <ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />
      </span>
    </label>
  )
}

function Breadcrumb({ trail = [] }) {
  if (trail.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      {trail.map((crumb, index) => {
        const isLast = index === trail.length - 1
        return (
          <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
            {index > 0 && <span className="text-dash-tertiary">/</span>}
            {crumb.to && !isLast ? (
              <Link to={crumb.to} className="text-dash-secondary transition-colors hover:text-shell-accent">
                {crumb.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-semibold text-dash-cream' : 'text-dash-secondary'}>
                {crumb.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

function MyBackOfficeViewModal({ restaurantId, access, onClose }) {
  const [policy, setPolicy] = useState(() => normalizeViewPolicy(access.viewPolicy))
  const [templates, setTemplates] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    backOfficeApi.listViewTemplates(restaurantId)
      .then((rows) => setTemplates(Array.isArray(rows) ? rows : []))
      .catch(() => setTemplates([]))
  }, [restaurantId])

  const saveTemplate = async (name, templatePolicy) => {
    const created = await backOfficeApi.createViewTemplate(restaurantId, {
      name,
      policy: templatePolicy,
      reusable: true,
    })
    setTemplates((current) => [...current.filter((item) => item.id !== created.id), created])
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await backOfficeApi.updateMyViewPolicy(restaurantId, policy)
      await queryClient.invalidateQueries({ queryKey: queryKeys.backOfficeAccess(restaurantId) })
      onClose()
    } catch (saveError) {
      setError(saveError?.message || 'Could not save your Back Office view.')
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={busy ? () => {} : onClose} title="My Back Office view" size="xl">
      <div className="max-h-[76vh] space-y-4 overflow-y-auto pr-1">
        <p className="text-sm leading-6 text-dash-tertiary">
          Choose how much detail you want to see. This changes presentation only; your permissions stay the same.
        </p>
        <BackOfficeViewEditor
          value={policy || defaultViewPolicy('advanced')}
          onChange={setPolicy}
          templates={templates}
          onSaveTemplate={access.can('settings.edit') ? saveTemplate : undefined}
          disabled={busy}
        />
        {error && <p className="text-sm text-dash-danger">{error}</p>}
        <ModalFooter>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-dash-border px-4 py-2 text-sm font-semibold text-dash-secondary">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={busy} className="rounded-lg bg-shell-cta px-4 py-2 text-sm font-semibold text-shell-cta-text disabled:opacity-50">
            {busy ? 'Saving...' : 'Save view'}
          </button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

export default function DashboardShell({
  context = 'enterprise', // 'enterprise' | 'store'
  activeItem = null,
  breadcrumb = [],
  restaurant = null,
  restaurantId = null,
  setupWarningCount = 0,
  showSetup = true,
  allowedStoreTabs = null, // null = all; array = owner-configured reseller visibility
  routes = {},
  children,
}) {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [theme, setTheme] = useShellTheme()
  const [viewEditorOpen, setViewEditorOpen] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname])

  // Section-scoped nav items (e.g. the Payroll & Tips entries) match on the
  // URL hash; no hash means the first section ('overview').
  const activeSection = (location.hash || '').replace('#', '') || 'overview'
  const navigation = {
    brand: '/',
    overview: '/enterprise/overview',
    stores: '/enterprise/stores',
    rates: '/enterprise/rates',
    devices: '/enterprise/devices',
    users: '/enterprise/users',
    settings: '/enterprise/settings',
    restaurants: '/restaurants',
    ...routes,
  }

  const accountType = auth.accountType
  const showRates = accountType === 'reseller' || accountType === 'admin'
  const showUsers = accountType === 'admin'
  const inStore = context === 'store' && Boolean(restaurant)
  const roleLabel = deriveRoleLabel(auth)
  const hidden = hiddenSurfaces(auth)
  const access = useBackOfficeAccess(auth, inStore ? restaurantId : null)
  const canViewManagerAlerts = Boolean(
    inStore
    && restaurantId
    && !access.loading
    && access.can('team.view')
  )
  const managerInboxCountQuery = useQuery({
    queryKey: queryKeys.managerInboxCount(restaurantId || ''),
    queryFn: () => backOfficeApi.managerInboxCount(restaurantId),
    enabled: canViewManagerAlerts,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 0,
  })
  const alertCount = managerInboxCountQuery.data?.open_count || 0
  const tabVisible = (id, section = null) => {
    if (id === 'setup' && !showSetup) return false
    if (allowedStoreTabs && !allowedStoreTabs.includes(id)) return false
    if (hidden.has(id) && id !== 'tip-pooling') return false
    // While a member's access is loading, keep nav visible (server enforces).
    if (access.loading) return true
    const required = TAB_PERMISSIONS[id]
    if (id === 'tip-pooling') {
      const payrollVisible = !hidden.has('tip-pooling') && access.can('payroll.view') && access.viewVisible('nav.tip-pooling')
      const timeClockVisible = !hidden.has('time-clock') && access.can('team.view') && access.viewVisible('nav.time-clock')
      const laborVisible = !hidden.has('labor-cost') && access.can('payroll.view') && access.viewVisible('nav.labor-cost')
      return payrollVisible || timeClockVisible || laborVisible
    }
    // Reseller visibility is already narrowed by the owner's store grant.
    // The POS backend re-resolves that same grant for every mutation, so an ML
    // member-permission response must not hide a granted reseller route.
    const resellerRouteGranted = Boolean(allowedStoreTabs?.includes(id))
    if (required && !access.can(required) && !resellerRouteGranted) return false
    if (id === 'setup') return true
    const tabCapability = TAB_VIEW_CAPABILITIES[id]
    if (tabCapability && !access.viewVisible(tabCapability)) return false
    const sectionCapability = SECTION_VIEW_CAPABILITIES[`${id}#${section}`]
    return !sectionCapability || access.viewVisible(sectionCapability)
  }
  const storeNav = STORE_NAV
    .map((item) => (
      item.children
        ? { ...item, children: item.children.filter((child) => tabVisible(child.id, child.section)) }
        : item
    ))
    .filter((item) => {
      if (item.resellerOnly && !allowedStoreTabs) return false
      return item.children ? item.children.length > 0 : tabVisible(item.id)
    })

  const storeNavPath = (item) => {
    // The UI editor is implemented by ResellerApp rather than the regular
    // RestaurantWorkspace. Admins normally enter stores through /restaurants,
    // so send this one item to the editor's canonical route.
    const base = item.id === 'ui' && accountType === 'admin'
      ? '/reseller/restaurants'
      : navigation.restaurants
    return `${base}/${restaurantId}/${item.id}${item.section ? `#${item.section}` : ''}`
  }

  const initials = useMemo(() => {
    const first = auth.profile?.first_name?.[0] || auth.user?.email?.[0] || '?'
    const last = auth.profile?.last_name?.[0] || ''
    return `${first}${last}`.toUpperCase()
  }, [auth.profile, auth.user])

  const displayName = [auth.profile?.first_name, auth.profile?.last_name].filter(Boolean).join(' ')
    || auth.user?.email
    || 'Account'

  return (
    <div className={`${theme} flex min-h-screen bg-dash-base text-dash-cream transition-colors duration-300`}>
      {sidebarOpen && (
        <aside
          className="sticky top-0 flex h-screen w-60 shrink-0 flex-col"
          style={{ background: 'var(--dash-chrome-sidebar-bg)', boxShadow: 'var(--dash-chrome-sidebar-shadow)' }}
        >
          <div className="px-5 pb-1 pt-6">
            <Link to={navigation.brand} className="font-display text-2xl tracking-tight text-dash-cream">
              SHIRE
            </Link>
            <p className="label-mono mt-0.5">
              {inStore ? 'Store console' : 'Enterprise console'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            <SectionEyebrow>Enterprise</SectionEyebrow>
            <SidebarItem
              icon={Gauge}
              label="Overview"
              isActive={activeItem === 'overview'}
              onClick={() => navigate(navigation.overview)}
            />
            <SidebarItem
              icon={Building2}
              label="Stores"
              isActive={activeItem === 'stores'}
              onClick={() => navigate(navigation.stores)}
            />
            {showRates && (
              <SidebarItem
                icon={Percent}
                label="Rates & Pricing"
                isActive={activeItem === 'rates'}
                onClick={() => navigate(navigation.rates)}
              />
            )}
            <SidebarItem
              icon={Monitor}
              label="Devices"
              isActive={activeItem === 'devices'}
              onClick={() => navigate(navigation.devices)}
            />
            {showUsers && (
              <SidebarItem
                icon={Users}
                label="Users"
                isActive={activeItem === 'users'}
                onClick={() => navigate(navigation.users)}
              />
            )}
            <SidebarItem icon={LayoutGrid} label="Enterprise Reports" soon />

            {inStore && (
              <>
                <SectionEyebrow>{restaurant?.name || 'Current store'}</SectionEyebrow>
                {storeNav.map((item) => (
                  item.children ? (
                    <SidebarGroup
                      key={item.id}
                      group={item}
                      activeItem={activeItem}
                      activeSection={activeSection}
                      onHoverItem={(childId) => prefetchWorkspaceTab(restaurantId, childId, activeItem)}
                      onNavigate={(childId, sectionId) => navigate(`${navigation.restaurants}/${restaurantId}/${childId}${sectionId ? `#${sectionId}` : ''}`)}
                    />
                  ) : (
                    <SidebarItem
                      key={item.section ? `${item.id}-${item.section}` : item.id}
                      icon={item.icon}
                      label={item.label}
                      warning={item.id === 'setup' && setupWarningCount > 0}
                      isActive={activeItem === item.id && (!item.section || activeSection === item.section)}
                      onHover={() => prefetchWorkspaceTab(restaurantId, item.id, activeItem)}
                      onClick={() => navigate(storeNavPath(item))}
                    />
                  )
                ))}
                {STORE_NAV_SOON.map((item) => (
                  <SidebarItem key={item.id} icon={item.icon} label={item.label} soon />
                ))}
              </>
            )}
          </div>

          <div className="border-t border-dash-border px-2 py-3">
            <SidebarItem
              icon={Settings}
              label="Settings"
              isActive={context !== 'store' && activeItem === 'settings'}
              onClick={() => navigate(navigation.settings)}
            />
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex min-h-[64px] items-center gap-3 px-4 backdrop-blur-xl"
          style={{ background: 'var(--dash-chrome-topbar-bg)', boxShadow: 'var(--dash-chrome-topbar-shadow)' }}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-dash-secondary transition hover:bg-[var(--glass-bg-hover)] hover:text-dash-cream"
          >
            {sidebarOpen
              ? <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden="true" />
              : <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden="true" />}
          </button>

          <LocationSwitcher
            context={context}
            restaurantId={restaurantId}
            activeTab={context === 'store' ? activeItem : null}
            restaurantBase={navigation.restaurants}
          />

          <div className="ml-auto flex items-center gap-2">
            <div
              title="Global search — coming soon"
              className="glass-panel hidden min-h-[38px] items-center gap-2 rounded-xl border border-dash-border px-3 text-sm text-dash-tertiary lg:flex"
            >
              <Search size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>Search…</span>
              <span className="label-mono !text-[9px]">Soon</span>
            </div>
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-dash-border text-dash-secondary transition hover:border-shell-accent/40 hover:text-shell-accent"
            >
              {theme === 'dark'
                ? <Sun size={16} strokeWidth={1.75} aria-hidden="true" />
                : <Moon size={16} strokeWidth={1.75} aria-hidden="true" />}
            </button>
            <button
              type="button"
              title={canViewManagerAlerts ? 'Manager alerts' : 'Manager alerts require Team access'}
              aria-label={canViewManagerAlerts && alertCount ? `Manager alerts, ${alertCount} open` : 'Manager alerts'}
              disabled={!canViewManagerAlerts}
              onClick={() => {
                if (canViewManagerAlerts) navigate(`${navigation.restaurants}/${restaurantId}/alerts`)
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-dash-border text-dash-secondary transition hover:border-shell-accent/40 hover:text-dash-cream disabled:cursor-not-allowed disabled:text-dash-tertiary"
            >
              <Bell size={16} strokeWidth={1.75} aria-hidden="true" />
              {canViewManagerAlerts && alertCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => inStore && setViewEditorOpen(true)}
              title={inStore ? 'Configure my Back Office view' : displayName}
              className="glass-panel flex items-center gap-2 rounded-xl border border-dash-border py-1 pl-1 pr-3 text-left transition hover:border-shell-accent/40"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-shell-accent text-xs font-bold text-shell-cta-text">
                {initials}
              </span>
              <span className="hidden min-w-0 flex-col leading-tight sm:flex">
                <span className="max-w-[140px] truncate text-xs font-semibold text-dash-cream">{displayName}</span>
                <span className="label-mono !text-[9px]">{roleLabel}</span>
              </span>
              {inStore && <SlidersHorizontal size={13} className="hidden text-dash-tertiary sm:block" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => void auth.signOut()}
              className="min-h-[36px] rounded-xl border border-dash-border px-3 text-xs font-semibold text-dash-secondary transition hover:border-shell-accent/40 hover:text-dash-cream"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-6 pb-16 pt-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <Breadcrumb trail={breadcrumb} />
            {children}
          </div>
        </main>
      </div>
      {viewEditorOpen && inStore && (
        <MyBackOfficeViewModal
          restaurantId={restaurantId}
          access={access}
          onClose={() => setViewEditorOpen(false)}
        />
      )}
    </div>
  )
}

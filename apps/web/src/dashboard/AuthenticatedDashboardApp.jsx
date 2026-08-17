import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  AuthProvider,
  useAuth,
  LoginPage,
  SignupPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  AuthCallbackPage,
} from '../auth'
import { OnboardingPage } from '../onboarding'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '../shared/lib/supabase'
import { API_CONFIG } from '../shared/api/config'
import { fetchReservationsApi } from '../shared/api/reservationsClient'
import { queryClient, queryKeys, fetchCached, fetchWithSupabaseAuth, STALE_TIMES } from '../shared/query'
import ModernRestaurantSetupPanel, {
  buildSetupWarnings as buildModernSetupWarnings,
  warningCount as modernWarningCount,
} from './RestaurantSetupPanel'
import { SmartTimeInput } from '../shared/components/SmartTimeInput'
import DashboardShell from './shell/DashboardShell'
import StoresPage from './pages/StoresPage'
import RatesPage from './pages/RatesPage'
import UsersPage from './pages/UsersPage'
import ResellerAccessCard from './pages/ResellerAccessCard'
import OverviewPage from './pages/OverviewPage'
import { normalizeReportingScope, WHOLE_RESTAURANT_SCOPE } from './components/homepageWidgetMath'
import SettingsPage from './pages/SettingsPage'
import PosSettingsPage from './pages/PosSettingsPage'
import PrintingRoutingPage from './pages/PrintingRoutingPage'
import TipPoolingPage from './pages/TipPoolingPage'
import LaborCostPage from './pages/LaborCostPage'
import TeamPage from './pages/TeamPage'
import TimeClockPage from './pages/TimeClockPage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import ClaimStorePage from './pages/ClaimStorePage'
import DevicesPage from './pages/DevicesPage'
import StoreDevicesPanel from './components/devices/StoreDevicesPanel'
import MenuPanel from './MenuPanel'
import { useAllowedStoreTabs } from './data/resellerAccess'
import { useBackOfficeAccess } from '../shared/hooks/useBackOfficeAccess'
import { TAB_PERMISSIONS } from '../shared/permissions'
import { PENDING_CLAIM_STORAGE_KEY } from './data/boarding'
import SalesTiles from './components/SalesTiles'
import CheckLedgerSection from './components/CheckLedgerSection'
import CloseDayReview from './components/CloseDayReview'
import HomepageWidgets from './components/HomepageWidgets'
import { usePersistedPeriod } from './data/analyticsSummary'
import ResellerApp from '../reseller/ResellerApp'
import ResellerUiEditor from '../reseller/ResellerUiEditor'
import RestaurantReportsPage from './reports/RestaurantReportsPage'
import MenuWorkspaceEditor from '../shared/components/MenuWorkspaceEditor'
import ManagerActionInboxPage from './pages/ManagerActionInboxPage'
import CloseDayPage from './pages/CloseDayPage'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-dash-base text-dash-cream flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-dash-gold" />
    </div>
  )
}

function OwnerGate() {
  const auth = useAuth()

  if (auth.isLoading || auth.restaurant.isLoading) {
    return <LoadingScreen />
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/auth/login" replace />
  }

  // A claim link survives the signup/login round-trip via localStorage.
  const pendingClaim = localStorage.getItem(PENDING_CLAIM_STORAGE_KEY)
  if (pendingClaim) {
    return <Navigate to={`/claim/${pendingClaim}`} replace />
  }

  // Resellers and admins live in the enterprise portal even with an empty
  // portfolio; only owners with no restaurants get sent to onboarding.
  if (auth.restaurant.restaurants.length === 0 && auth.accountType === 'owner') {
    return <Navigate to="/onboarding" replace />
  }

  const prefs = auth.profile?.dashboard_prefs
  const landing = prefs && typeof prefs === 'object' ? prefs.default_landing : null
  if (auth.accountType === 'reseller') {
    return <Navigate to="/reseller" replace />
  }

  if (auth.accountType === 'reseller_employee' || landing === 'reseller') {
    return <Navigate to="/reseller" replace />
  }
  return <Navigate to={landing === 'overview' ? '/enterprise/overview' : '/enterprise/stores'} replace />
}

function ProtectedRoute({ children }) {
  const auth = useAuth()

  if (auth.isLoading || auth.restaurant.isLoading) {
    return <LoadingScreen />
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/auth/login" replace />
  }

  return children
}

// Enterprise-context pages (Stores, Rates, Users) share the shell with an
// Enterprise breadcrumb, mirroring the store-context workspace below.
function EnterprisePage({ item, title, children }) {
  return (
    <ProtectedRoute>
      <DashboardShell
        context="enterprise"
        activeItem={item}
        breadcrumb={[
          { label: 'Home', to: '/' },
          { label: 'Enterprise' },
          { label: title },
        ]}
      >
        {children}
      </DashboardShell>
    </ProtectedRoute>
  )
}

const TABS = [
  { id: 'analytics', label: 'Analytics' },
  { id: 'reports', label: 'Reports' },
  { id: 'checks', label: 'Checks' },
  { id: 'close-day', label: 'Close Day' },
  { id: 'setup', label: 'Edit Setup' },
  { id: 'store-information', label: 'Store Information' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'settings', label: 'Store Settings' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'ui', label: 'UI Editor' },
  { id: 'menu', label: 'Menu' },
  { id: 'menu-workspace', label: 'POS Menus' },
  { id: 'taxes', label: 'Taxes' },
  { id: 'devices', label: 'Devices' },
  { id: 'pos-settings', label: 'POS Settings' },
  { id: 'printing-routing', label: 'Printing & Routing' },
  { id: 'tip-pooling', label: 'Payroll & Tips' },
  { id: 'labor-cost', label: 'Labor Cost' },
  { id: 'feedback', label: 'Complaints' },
  { id: 'team', label: 'Team' },
  { id: 'time-clock', label: 'Time Clock' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'payments', label: 'Payments / Plan' },
]

function WarningTriangle({ className = '' }) {
  return (
    <span
      aria-label="Needs attention"
      title="Needs attention"
      className={`inline-block h-0 w-0 border-x-[5px] border-b-[9px] border-x-transparent border-b-amber-300 ${className}`}
    />
  )
}

function buildSetupWarnings(restaurant, waiterCount = null, floorPlanStatus = null) {
  const warnings = {
    basics: [],
    hours: [],
    capacity: [],
    menu: [],
    modifiers: [],
    employees: [],
    integrations: [],
  }

  if (!restaurant.name) warnings.basics.push('Restaurant name')
  if (!restaurant.city || !restaurant.state) warnings.basics.push('Location')
  if (!restaurant.phone) warnings.basics.push('Phone')

  const floorPlanTableCount = floorPlanStatus?.total_tables || floorPlanStatus?.tables?.length || 0
  const floorPlanCapacity = floorPlanStatus?.total_capacity || 0
  if (!restaurant.seating_capacity && !floorPlanCapacity) warnings.capacity.push('Seating capacity')
  if (!restaurant.table_count && !floorPlanTableCount) warnings.capacity.push('Table count')
  if (floorPlanStatus && !floorPlanStatus.has_floor_plan) warnings.capacity.push('Floor plan')

  if (waiterCount === 0) warnings.employees.push('Employees')

  return warnings
}

function warningCount(warnings) {
  return Object.values(warnings).reduce((sum, items) => sum + items.length, 0)
}

function PlaceholderPanel({ title, eyebrow, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-8">
      <p className="label-mono">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 max-w-3xl text-dash-secondary">{children}</div>
    </section>
  )
}

function ConfigurationHub({ tabs, initialTab, children }) {
  const [active, setActive] = useState(initialTab || tabs[0]?.id)
  useEffect(() => {
    if (!tabs.some(tab => tab.id === active)) setActive(tabs[0]?.id)
  }, [active, tabs])
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-2 border-b border-white/10 pb-4" aria-label="Configuration sections">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${active === tab.id ? 'bg-dash-gold text-black' : 'border border-white/10 text-dash-secondary hover:border-white/20 hover:text-dash-cream'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {children(active)}
    </div>
  )
}

const feedbackStatusOptions = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'resolved', label: 'Resolved' },
]

const feedbackTone = {
  high: 'border-red-400/30 bg-red-500/10 text-red-200',
  medium: 'border-amber-300/30 bg-amber-400/10 text-amber-100',
  low: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100',
}

function formatFeedbackCategory(value) {
  return String(value || 'other').replace(/_/g, ' ')
}

function GuestFeedbackPanel({ restaurantId }) {
  const [status, setStatus] = useState('open')
  const [updatingId, setUpdatingId] = useState(null)
  const feedbackQuery = useQuery({
    queryKey: queryKeys.guestFeedback(restaurantId, status),
    queryFn: () => fetchReservationsApi(`/locations/${restaurantId}/guest-feedback?status=${encodeURIComponent(status)}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIMES.messaging,
  })
  const feedback = feedbackQuery.data?.feedback || []

  const setFeedbackStatus = async (feedbackId, nextStatus) => {
    setUpdatingId(feedbackId)
    try {
      await fetchReservationsApi(`/locations/${restaurantId}/guest-feedback/${feedbackId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })
      await queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId, 'guest-feedback'] })
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <p className="label-mono">Guest feedback</p>
          <h1 className="text-3xl font-semibold tracking-tight">Complaints</h1>
        </div>
        <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {feedbackStatusOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setStatus(option.id)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                status === option.id
                  ? 'bg-white text-black'
                  : 'text-dash-secondary hover:bg-white/10 hover:text-dash-cream'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {feedbackQuery.isLoading && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-dash-secondary">
          Loading feedback...
        </div>
      )}
      {feedbackQuery.error && (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-5 text-red-200">
          {feedbackQuery.error.message || 'Could not load feedback.'}
        </div>
      )}
      {!feedbackQuery.isLoading && !feedbackQuery.error && feedback.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-dash-secondary">
          No guest feedback in this view.
        </div>
      )}

      <div className="grid gap-3">
        {feedback.map((item) => (
          <article key={item.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${feedbackTone[item.severity] || feedbackTone.medium}`}>
                    {item.severity}
                  </span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold capitalize text-dash-secondary">
                    {formatFeedbackCategory(item.category)}
                  </span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold capitalize text-dash-secondary">
                    {item.status}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-semibold text-dash-cream">{item.summary}</h2>
                {item.details && <p className="mt-2 max-w-3xl text-sm leading-6 text-dash-secondary">{item.details}</p>}
                <p className="mt-3 text-xs text-dash-tertiary">
                  {[item.guestName, item.guestPhone, item.source, item.createdAt ? new Date(item.createdAt).toLocaleString() : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {item.status === 'open' && (
                  <button
                    type="button"
                    disabled={updatingId === item.id}
                    onClick={() => setFeedbackStatus(item.id, 'reviewed')}
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-dash-secondary transition hover:border-shell-accent/40 hover:text-dash-cream disabled:opacity-50"
                  >
                    Review
                  </button>
                )}
                {item.status !== 'resolved' && (
                  <button
                    type="button"
                    disabled={updatingId === item.id}
                    onClick={() => setFeedbackStatus(item.id, 'resolved')}
                    className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-shell-accent disabled:opacity-50"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

const ANALYTICS_PERIODS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'full', label: 'All' },
]

function analyticsDateKey(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

// Mirrors the backend homepage window semantics (period_window): week starts
// Monday, month on the 1st, year on Jan 1, full since 2000 — through today.
function analyticsPeriodRange(preset) {
  const end = new Date()
  const start = new Date(end)
  if (preset === 'week') start.setDate(end.getDate() - ((end.getDay() + 6) % 7))
  else if (preset === 'month') start.setDate(1)
  else if (preset === 'year') { start.setMonth(0); start.setDate(1) }
  else if (preset === 'full') start.setFullYear(2000, 0, 1)
  return { start: analyticsDateKey(start), end: analyticsDateKey(end) }
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    .format(Number(value || 0))

const formatNumber = (value, digits = 0) =>
  value === null || value === undefined
    ? 'DNE'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(Number(value || 0))

const formatMinutes = (value) =>
  value === null || value === undefined ? 'DNE' : `${formatNumber(value, 1)} min`

const firstPresent = (...values) => values.find(value => value !== null && value !== undefined)

const laborHours = (minutes) => {
  const number = Number(minutes || 0)
  return Number.isFinite(number) && number > 0 ? number / 60 : 0
}

const renderNumber = (value) => formatNumber(value)
const renderCurrency = (value) => formatCurrency(value)

function MetricCard({ label, value, detail, muted = false }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm text-dash-tertiary">{label}</p>
      <p className={`mt-3 text-3xl font-semibold ${muted ? 'text-dash-secondary' : ''}`}>{value}</p>
      {detail && <p className="mt-2 text-sm leading-5 text-dash-secondary">{detail}</p>}
    </div>
  )
}

function EmptyNotice({ message }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-dash-secondary">
      {message}
    </div>
  )
}

function AnalyticsSection({ title, source, sampleSize, status, children, emptyMessage }) {
  const empty = status === 'empty'
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-dash-secondary">Source: {source}</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-dash-secondary">
          n={sampleSize ?? 0}
        </span>
      </div>
      {empty ? <EmptyNotice message={emptyMessage} /> : children}
    </section>
  )
}

function MiniTable({ columns, rows }) {
  if (!rows?.length) return <EmptyNotice message="No rows for this range." />
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.04] text-dash-tertiary">
          <tr>
            {columns.map(column => (
              <th key={column.key} className="px-4 py-3 font-medium">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row, index) => (
            <tr key={`${row.name || row.status || row.state || row.bucket || index}-${index}`}>
              {columns.map(column => (
                <td key={column.key} className="px-4 py-3 text-dash-secondary">
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AnalyticsDashboard({ restaurant }) {
  const [periodPreset, setPeriodPreset] = useState('week')
  const [dates, setDates] = useState(() => analyticsPeriodRange('week'))
  const [reportingScope, setReportingScope] = useState(() => ({ ...WHOLE_RESTAURANT_SCOPE }))
  const [viewHydrated, setViewHydrated] = useState(false)
  const [viewPersistenceReady, setViewPersistenceReady] = useState(false)
  const selectPeriod = (preset) => {
    setPeriodPreset(preset)
    setDates(analyticsPeriodRange(preset))
  }
  const setCustomDate = (field, value) => {
    if (!value) return
    const range = { start: dates.start, end: dates.end, [field]: value }
    if (field === 'start' && value > range.end) range.end = value
    if (field === 'end' && value < range.start) range.start = value
    setPeriodPreset('custom')
    setDates(range)
  }
  useEffect(() => {
    if (!restaurant?.id) return
    let cancelled = false
    setViewHydrated(false)
    setViewPersistenceReady(false)
    setReportingScope({ ...WHOLE_RESTAURANT_SCOPE })
    fetchWithSupabaseAuth(`/restaurants/${restaurant.id}/reports/view-preferences`)
      .then((payload) => {
        if (!cancelled) {
          const saved = payload.settings?.homepage
          const preset = saved?.period || 'week'
          if (preset === 'custom' && saved?.custom_start_date && saved?.custom_end_date) {
            setPeriodPreset('custom')
            setDates({ start: saved.custom_start_date, end: saved.custom_end_date })
          } else {
            const resolved = preset === 'custom' ? 'week' : preset
            setPeriodPreset(resolved)
            setDates(analyticsPeriodRange(resolved))
          }
          setReportingScope(normalizeReportingScope(saved))
          setViewPersistenceReady(true)
        }
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setViewHydrated(true) })
    return () => { cancelled = true }
  }, [restaurant?.id])
  useEffect(() => {
    if (!restaurant?.id || !viewHydrated || !viewPersistenceReady) return
    const timeout = window.setTimeout(() => {
      fetchWithSupabaseAuth(`/restaurants/${restaurant.id}/reports/view-preferences/homepage`, {
        method: 'PUT',
        body: JSON.stringify({ settings: {
          period: periodPreset,
          anchor_date: null,
          custom_start_date: periodPreset === 'custom' ? dates.start : null,
          custom_end_date: periodPreset === 'custom' ? dates.end : null,
          ...reportingScope,
        } }),
      }).catch(() => undefined)
    }, 450)
    return () => window.clearTimeout(timeout)
  }, [restaurant?.id, viewHydrated, viewPersistenceReady, periodPreset, dates, reportingScope])
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label-mono">Back office</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{restaurant?.name || 'Restaurant'}</h1>
          <p className="mt-2 text-sm text-dash-secondary">Live restaurant performance and operational reporting.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <nav className="grid grid-cols-5 self-start rounded-xl border border-white/10 p-1 sm:self-auto">
            {ANALYTICS_PERIODS.map((item) => (
              <button key={item.id} type="button" onClick={() => selectPeriod(item.id)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${periodPreset === item.id ? 'bg-dash-gold text-black' : 'text-dash-secondary hover:text-dash-cream'}`}>{item.label}</button>
            ))}
          </nav>
          <div className="flex items-end gap-2">
            <label className="block text-sm text-dash-secondary">
              <span className="mb-1 block text-xs font-semibold uppercase text-dash-tertiary">From</span>
              <input type="date" value={dates.start} max={dates.end} onChange={(event) => setCustomDate('start', event.target.value)} className="h-10 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm [color-scheme:dark]" />
            </label>
            <label className="block text-sm text-dash-secondary">
              <span className="mb-1 block text-xs font-semibold uppercase text-dash-tertiary">Through</span>
              <input type="date" value={dates.end} min={dates.start} onChange={(event) => setCustomDate('end', event.target.value)} className="h-10 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm [color-scheme:dark]" />
            </label>
          </div>
        </div>
      </header>
      {viewHydrated && <HomepageWidgets scope="restaurant" restaurantId={restaurant?.id} period={periodPreset} dateRange={dates} dashboardScope={reportingScope} onDashboardScopeChange={setReportingScope} />}
      {viewHydrated && <CheckLedgerSection restaurantId={restaurant?.id} />}
    </div>
  )
}

const RESTAURANT_HOMEPAGE_WIDGETS = [
  { id: 'sales', label: 'Sales overview', description: 'Net sales, checks, guests, discounts, and average check.' },
  { id: 'revenue', label: 'Revenue details', description: 'Average order, tips, and paid versus closed checks.' },
  { id: 'menu', label: 'Menu sales', description: 'Top-selling items and categories.' },
  { id: 'visits', label: 'Visits and turn time', description: 'Completed turns, covers, and service timing.' },
  { id: 'reservations', label: 'Reservations', description: 'Party size and reservation status activity.' },
  { id: 'turn_times', label: 'Turn-time detail', description: 'Turn percentiles, first-order timing, and server detail.' },
  { id: 'floor', label: 'Current floor', description: 'Active tables, capacity, and occupancy.' },
  { id: 'staff', label: 'Staff and labor', description: 'Shifts, labor cost, hours, and sales per labor hour.' },
  { id: 'state_events', label: 'State events', description: 'POS, host, and ML state-event activity.' },
  { id: 'trend', label: 'Revenue trend', description: 'Recent revenue buckets for the selected period.' },
]
const DEFAULT_RESTAURANT_HOMEPAGE_WIDGETS = RESTAURANT_HOMEPAGE_WIDGETS.map((widget) => widget.id)

function RestaurantHomepageConfigureModal({ visible, saving, onClose, onSave }) {
  const [draft, setDraft] = useState(() => new Set(visible))
  const toggle = (id) => setDraft((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="restaurant-homepage-configure-title">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-dash-border bg-dash-elevated shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-dash-border bg-dash-elevated px-5 py-4">
          <h2 id="restaurant-homepage-configure-title" className="text-lg font-semibold text-dash-cream">Configure homepage</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-md text-xl text-dash-secondary hover:bg-white/5">×</button>
        </header>
        <div className="p-5">
          <p className="label-mono">Available widgets</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {RESTAURANT_HOMEPAGE_WIDGETS.map((widget) => (
              <button key={widget.id} type="button" onClick={() => toggle(widget.id)} className={`flex min-h-20 items-start justify-between gap-3 rounded-lg border p-3 text-left ${draft.has(widget.id) ? 'border-shell-accent bg-shell-accent/10' : 'border-dash-border'}`}>
                <span><span className="block text-sm font-semibold text-dash-cream">{widget.label}</span><span className="mt-1 block text-xs leading-5 text-dash-tertiary">{widget.description}</span></span>
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-xs ${draft.has(widget.id) ? 'border-shell-accent bg-shell-accent text-shell-cta-text' : 'border-dash-border'}`}>{draft.has(widget.id) ? '✓' : ''}</span>
              </button>
            ))}
          </div>
        </div>
        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-dash-border bg-dash-elevated p-5">
          <button type="button" onClick={onClose} className="h-10 rounded-md border border-dash-border px-4 text-sm">Cancel</button>
          <button type="button" disabled={saving || draft.size === 0} onClick={() => onSave([...draft])} className="h-10 rounded-md bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text disabled:opacity-40">{saving ? 'Saving...' : 'Save homepage'}</button>
        </footer>
      </div>
    </div>
  )
}

function LegacyAnalyticsDashboard({ restaurant }) {
  const auth = useAuth()
  const [period, setPeriod] = usePersistedPeriod('shire_home_period')
  const restaurantId = restaurant?.id
  const access = useBackOfficeAccess(auth, restaurantId)
  const [visibleWidgets, setVisibleWidgets] = useState(DEFAULT_RESTAURANT_HOMEPAGE_WIDGETS)
  const [configureOpen, setConfigureOpen] = useState(false)
  const [closeDayOpen, setCloseDayOpen] = useState(false)
  const [savingHomepage, setSavingHomepage] = useState(false)
  const [preferencesReady, setPreferencesReady] = useState(false)

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    setPreferencesReady(false)
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/view-preferences`)
      .then((payload) => {
        if (cancelled) return
        const homepage = payload.settings?.homepage || {}
        if (homepage.period) setPeriod(homepage.period)
        if (Array.isArray(homepage.visible_widgets) && homepage.visible_widgets.length) {
          const supported = homepage.visible_widgets.filter((id) => DEFAULT_RESTAURANT_HOMEPAGE_WIDGETS.includes(id))
          if (supported.length) setVisibleWidgets(supported)
        }
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setPreferencesReady(true) })
    return () => { cancelled = true }
  }, [restaurantId, setPeriod])

  useEffect(() => {
    if (!restaurantId || !preferencesReady) return
    const timeout = window.setTimeout(() => {
      fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/view-preferences/homepage`, {
        method: 'PUT',
        body: JSON.stringify({ settings: { period, anchor_date: null, visible_widgets: visibleWidgets } }),
      }).catch(() => undefined)
    }, 450)
    return () => window.clearTimeout(timeout)
  }, [restaurantId, preferencesReady, period, visibleWidgets])

  const saveHomepage = async (nextVisible) => {
    setSavingHomepage(true)
    try {
      await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/view-preferences/homepage`, {
        method: 'PUT',
        body: JSON.stringify({ settings: { period, anchor_date: null, visible_widgets: nextVisible } }),
      })
      setVisibleWidgets(nextVisible)
      setConfigureOpen(false)
    } finally {
      setSavingHomepage(false)
    }
  }
  const widgetVisible = (id) => visibleWidgets.includes(id)

  // Cached per restaurant + period; keepPreviousData keeps the current numbers
  // on screen while a new period loads instead of flashing a spinner.
  const analyticsQuery = useQuery({
    queryKey: queryKeys.ownerAnalytics(restaurantId, period),
    queryFn: () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/owner-analytics?period=${period}`),
    enabled: Boolean(restaurantId),
    staleTime: STALE_TIMES.analytics,
    placeholderData: keepPreviousData,
  })
  const payload = analyticsQuery.data ?? null
  const isLoading = analyticsQuery.isPending
  const error = analyticsQuery.error
    ? (analyticsQuery.error instanceof Error ? analyticsQuery.error.message : 'Could not load analytics')
    : ''

  const sections = payload?.sections || {}
  const revenue = sections.revenue || {}
  const revenueData = revenue.data || {}
  const visits = sections.visits || {}
  const visitData = visits.data || {}
  const turnTimes = sections.turn_times || {}
  const turnTimeData = turnTimes.data || {}
  const reservations = sections.reservations || {}
  const reservationData = reservations.data || {}
  const floor = sections.floor || {}
  const floorData = floor.data || {}
  const staff = sections.staff || {}
  const staffData = staff.data || {}
  const labor = sections.labor || payload?.labor || {}
  const laborData = labor.data || labor.totals || {}
  const laborCost = firstPresent(staffData.labor_cost, laborData.labor_cost)
  const laborMinutes = firstPresent(staffData.worked_minutes, laborData.worked_minutes)
  const salesPerLaborHour = laborHours(laborMinutes) > 0
    ? Number(revenueData.sales_excluding_tax_tip || revenueData.net_sales || revenueData.total_revenue || 0) / laborHours(laborMinutes)
    : null
  const missingLaborRate = Boolean(staffData.has_missing_labor_rate || laborData.has_missing_labor_rate)
  const stateEvents = sections.state_events || {}
  const stateData = stateEvents.data || {}
  const menu = sections.menu || {}
  const timeSeries = sections.time_series || {}

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="label-mono">Owner Analytics</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{restaurant?.name || 'Restaurant'}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-dash-secondary">
              Phase 1 analytics from live POS, reservation, host visit, table, shift, and state-event data.
            </p>
          </div>
          <nav className="grid grid-cols-5 rounded-xl border border-white/10 p-1">
            {ANALYTICS_PERIODS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={[
                  'rounded-lg px-3 py-2 text-sm font-semibold transition',
                  period === item.id ? 'bg-dash-gold text-black' : 'text-dash-secondary hover:text-dash-cream',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="flex flex-wrap gap-2">
            {access.can('operations.close_day') && (
              <button
                type="button"
                onClick={() => setCloseDayOpen(true)}
                className="h-10 rounded-xl bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text"
              >
                Review Close Day
              </button>
            )}
            <button type="button" onClick={() => setConfigureOpen(true)} className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-dash-secondary hover:text-dash-cream">Configure homepage</button>
          </div>
        </div>
        {payload?.window && (
          <p className="mt-4 text-xs text-dash-tertiary">
            {payload.window.is_full_history
              ? 'Showing all available history.'
              : `Window: ${payload.window.start_at?.slice(0, 10)} to ${payload.window.end_at?.slice(0, 10)}`}
          </p>
        )}
      </section>

      {closeDayOpen ? (
        <CloseDayReview restaurantId={restaurantId} onBack={() => setCloseDayOpen(false)} />
      ) : (
        <>
      {isLoading && <LoadingScreen />}
      {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}

      {!isLoading && !error && payload && (
        <>
          {widgetVisible('sales') && <SalesTiles restaurantId={restaurantId} period={period} />}

          {widgetVisible('revenue') && (
          <AnalyticsSection
            title="Revenue"
            source="pos_orders"
            status={revenue.status}
            sampleSize={revenue.sample_size}
            emptyMessage={revenue.empty_message}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Avg Order" value={formatCurrency(revenueData.avg_order_value)} />
              <MetricCard label="Tips" value={formatCurrency(revenueData.tips)} />
              <MetricCard label="Paid / Closed" value={`${formatNumber(revenueData.paid_orders)} / ${formatNumber(revenueData.closed_orders)}`} />
            </div>
          </AnalyticsSection>
          )}

          {widgetVisible('menu') && (
          <AnalyticsSection
            title="Menu Sales"
            source="pos_order_items + pos_orders"
            status={menu.status}
            sampleSize={menu.sample_size}
            emptyMessage={menu.empty_message}
          >
            <MiniTable
              rows={menu.items}
              columns={[
                { key: 'name', label: 'Item' },
                { key: 'category', label: 'Category' },
                { key: 'quantity', label: 'Qty', render: renderNumber },
                { key: 'revenue', label: 'Revenue', render: renderCurrency },
              ]}
            />
          </AnalyticsSection>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            {widgetVisible('visits') && (
            <AnalyticsSection
              title="Visits & Turn Time"
              source="visits"
              status={visits.status}
              sampleSize={visits.sample_size}
              emptyMessage={visits.empty_message}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <MetricCard label="Completed Turns" value={formatNumber(visitData.completed_turns)} detail="Requires seated_at and cleared_at." />
                <MetricCard label="Payment → Clear" value={formatMinutes(visitData.avg_payment_to_clear_minutes)} />
                <MetricCard label="Seated → Payment" value={formatMinutes(visitData.avg_seated_to_payment_minutes)} />
                <MetricCard label="Covers" value={formatNumber(visitData.covers)} />
              </div>
            </AnalyticsSection>
            )}

            {widgetVisible('reservations') && (
            <AnalyticsSection
              title="Reservations"
              source="reservations"
              status={reservations.status}
              sampleSize={reservations.sample_size}
              emptyMessage={reservations.empty_message}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <MetricCard label="Avg Party" value={formatNumber(reservationData.avg_party_size, 1)} />
                <MetricCard label="Seated / Canceled" value={`${formatNumber(reservationData.seated)} / ${formatNumber(reservationData.canceled)}`} />
              </div>
              <div className="mt-4">
                <MiniTable
                  rows={reservations.status_breakdown}
                  columns={[
                    { key: 'status', label: 'Status' },
                    { key: 'count', label: 'Count', render: renderNumber },
                  ]}
                />
              </div>
            </AnalyticsSection>
            )}
          </div>

          {widgetVisible('turn_times') && (
          <AnalyticsSection
            title="Turn Times"
            source="pos_orders + visits"
            status={turnTimes.status}
            sampleSize={turnTimes.sample_size}
            emptyMessage={turnTimes.empty_message}
          >
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                label="Median Turn"
                value={formatMinutes(turnTimeData.median_turn_minutes)}
                detail={`${formatNumber(turnTimeData.turn_count)} turns`}
              />
              <MetricCard label="P75 Turn" value={formatMinutes(turnTimeData.p75_turn_minutes)} />
              <MetricCard
                label="Time to First Order"
                value={formatMinutes(turnTimeData.median_first_order_minutes)}
                detail={`${formatNumber(turnTimeData.first_order_sample)} host-seated turns`}
              />
              <MetricCard
                label="Host-Matched"
                value={`${formatNumber(turnTimeData.turns_with_host_visit)} / ${formatNumber(turnTimeData.turn_count)}`}
                detail="Turns with a host seating"
              />
            </div>
            {turnTimes.by_waiter?.length > 0 && (
              <div className="mt-4">
                <MiniTable
                  rows={turnTimes.by_waiter}
                  columns={[
                    { key: 'name', label: 'Waiter' },
                    { key: 'turns', label: 'Turns', render: renderNumber },
                    { key: 'median_turn_minutes', label: 'Median Turn', render: (v) => formatMinutes(v) },
                    { key: 'median_first_order_minutes', label: 'First Order', render: (v) => formatMinutes(v) },
                    { key: 'avg_checks_per_turn', label: 'Checks/Turn', render: (v) => formatNumber(v, 1) },
                  ]}
                />
              </div>
            )}
            {turnTimes.quality?.message && (
              <p className="mt-3 text-xs text-dash-tertiary">{turnTimes.quality.message}</p>
            )}
          </AnalyticsSection>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            {widgetVisible('floor') && (
            <AnalyticsSection
              title="Current Floor"
              source="tables"
              status={floor.status}
              sampleSize={floor.sample_size}
              emptyMessage={floor.empty_message}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Active Tables" value={formatNumber(floorData.active_tables)} />
                <MetricCard label="Capacity" value={formatNumber(floorData.active_capacity)} />
                <MetricCard label="Occupied" value={formatNumber(floorData.occupied)} />
              </div>
              <div className="mt-4">
                <MiniTable
                  rows={floor.state_breakdown}
                  columns={[
                    { key: 'state', label: 'State' },
                    { key: 'count', label: 'Tables', render: renderNumber },
                  ]}
                />
              </div>
            </AnalyticsSection>
            )}

            {widgetVisible('staff') && (
            <AnalyticsSection
              title="Staff"
              source="POS time clock + closed checks"
              status={staff.status}
              sampleSize={staff.sample_size}
              emptyMessage={staff.empty_message}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Shifts" value={formatNumber(staffData.shift_count)} />
                <MetricCard label="Staff Worked" value={formatNumber(staffData.staff_worked)} />
                <MetricCard label="Labor Cost" value={laborCost == null ? 'DNE' : formatCurrency(laborCost)} detail={missingLaborRate ? 'Missing role rates' : `${formatNumber(laborHours(laborMinutes), 1)} labor hrs`} muted={laborCost == null} />
                <MetricCard label="SPLH" value={salesPerLaborHour == null ? 'DNE' : formatCurrency(salesPerLaborHour)} />
              </div>
              <div className="mt-4">
                <MiniTable
                  rows={staff.top_staff}
                  columns={[
                    { key: 'name', label: 'Staff' },
                    { key: 'shifts', label: 'Shifts', render: renderNumber },
                    { key: 'covers', label: 'Covers', render: renderNumber },
                    { key: 'sales', label: 'Sales', render: renderCurrency },
                  ]}
                />
              </div>
            </AnalyticsSection>
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {widgetVisible('state_events') && (
            <AnalyticsSection
              title="State Machine Events"
              source="table_state_events"
              status={stateEvents.status}
              sampleSize={stateEvents.sample_size}
              emptyMessage={stateEvents.empty_message}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Events" value={formatNumber(stateData.event_count)} />
                <MetricCard label="Avg Confidence" value={stateData.avg_confidence === null || stateData.avg_confidence === undefined ? 'DNE' : `${formatNumber(Number(stateData.avg_confidence) * 100, 1)}%`} />
                <MetricCard label="POS / Host / ML" value={`${formatNumber(stateData.pos_events)} / ${formatNumber(stateData.host_events)} / ${formatNumber(stateData.ml_events)}`} />
              </div>
              <div className="mt-4">
                <MiniTable
                  rows={stateEvents.breakdown}
                  columns={[
                    { key: 'event', label: 'Event' },
                    { key: 'count', label: 'Count', render: renderNumber },
                  ]}
                />
              </div>
            </AnalyticsSection>
            )}

            {widgetVisible('trend') && (
            <AnalyticsSection
              title="Trend"
              source="pos_orders + visits"
              status={timeSeries.status}
              sampleSize={timeSeries.sample_size}
              emptyMessage={timeSeries.empty_message}
            >
              <MiniTable
                rows={(timeSeries.revenue || []).slice(-8)}
                columns={[
                  { key: 'bucket', label: 'Bucket', render: value => String(value).slice(0, 10) },
                  { key: 'orders', label: 'Orders', render: renderNumber },
                  { key: 'revenue', label: 'Revenue', render: renderCurrency },
                ]}
              />
            </AnalyticsSection>
            )}
          </div>
        </>
      )}

      {/* The full check ledger lives on its own Checks tab now — this is
          just the pointer so Home stays scannable. */}
      <Link
        to="../checks"
        relative="path"
        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-dash-gold/40 hover:bg-white/[0.05]"
      >
        <div>
          <p className="text-sm font-semibold text-dash-cream">Check ledger</p>
          <p className="mt-0.5 text-xs text-dash-tertiary">Active and closed checks, receipts, and per-check activity logs.</p>
        </div>
        <span className="text-dash-gold">→</span>
      </Link>
        </>
      )}

      {configureOpen && <RestaurantHomepageConfigureModal visible={visibleWidgets} saving={savingHomepage} onClose={() => setConfigureOpen(false)} onSave={saveHomepage} />}
    </div>
  )
}

const SCHEDULING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const COVERAGE_ROLES = ['manager', 'server', 'host', 'bartender', 'busser', 'runner', 'chef']
const ROLE_LABELS = {
  manager: 'Managers',
  server: 'Servers',
  host: 'Hosts',
  bartender: 'Bartenders',
  busser: 'Bussers',
  runner: 'Runners',
  chef: 'Kitchen',
}

const COVERAGE_TIME_AXIS_WIDTH = 72
const COVERAGE_PIXELS_PER_HOUR = 44
const SCHEDULE_DAY_AXIS_WIDTH = 76
const SCHEDULE_TIMELINE_PIXELS_PER_HOUR = 112
const SCHEDULE_LANE_HEIGHT = 54
const COVERAGE_SLOT_MINUTES = 15
const DEFAULT_CALENDAR_START = 0
const DEFAULT_CALENDAR_END = 24 * 60
const DEFAULT_COVERAGE_THRESHOLD = 0.7
const DEFAULT_OPTIMIZATION_WEIGHTS = {
  coverage: 1,
  weekly_hours: 1,
  preferences: 1,
  requests: 1,
  fairness: 1,
  prime_balance: 1,
}
const DEFAULT_SHIFT_TRADE_POLICY = {
  enabled: true,
  require_manager_approval: true,
  allow_employee_to_employee_trades: true,
  notify_managers_in_chat: false,
}
const OPTIMIZATION_WEIGHT_FIELDS = [
  ['coverage', 'Coverage'],
  ['weekly_hours', 'Target hours'],
  ['preferences', 'Employee preferences'],
  ['requests', 'Requests'],
  ['fairness', 'Fairness'],
  ['prime_balance', 'Prime shifts'],
]
const ROLE_SHORT_LABELS = {
  manager: 'Mgr',
  server: 'Server',
  waiter: 'Server',
  host: 'Host',
  bartender: 'Bar',
  busser: 'Busser',
  runner: 'Runner',
  chef: 'Kitchen',
}

const emptyCoverageBlockForm = {
  key: null,
  is_suggested: false,
  day_of_week: 0,
  start_time: '',
  end_time: '',
  is_prime_shift: true,
  notes: '',
  original_day_of_week: null,
  original_start_time: null,
  original_end_time: null,
  roles: COVERAGE_ROLES.reduce((acc, role) => ({ ...acc, [role]: '' }), {}),
}

function timeToMinutes(value, fallback = null) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/)
  if (!match) return fallback
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback
  return (hours * 60) + minutes
}

function minutesToTime(value) {
  const bounded = Math.max(0, Math.min(23 * 60 + 59, Number(value) || 0))
  const hours = Math.floor(bounded / 60)
  const minutes = bounded % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatDisplayTime(value) {
  const minutesValue = typeof value === 'number' ? value : timeToMinutes(value, 0)
  const bounded = Math.max(0, Math.min(24 * 60, Number(minutesValue) || 0))
  const hours24 = Math.floor(bounded / 60) % 24
  const minutes = bounded % 60
  const suffix = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 || 12
  return minutes ? `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}` : `${hours12} ${suffix}`
}

function roundMinutes(value, slot = COVERAGE_SLOT_MINUTES) {
  return Math.round(value / slot) * slot
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizeRoleCounts(roles = {}) {
  return COVERAGE_ROLES.reduce((acc, role) => {
    const value = roles[role]
    const count = typeof value === 'object' ? value?.min_staff : value
    acc[role] = count === '' || count === null || count === undefined ? 0 : Number(count || 0)
    return acc
  }, {})
}

function shiftToForm(item) {
  if (!item) return null
  return {
    waiter_id: item.waiter_id,
    role: item.role,
    shift_date: item.shift_date,
    shift_start: String(item.shift_start).slice(0, 5),
    shift_end: String(item.shift_end).slice(0, 5),
    is_locked: Boolean(item.is_locked),
    notes: item.notes || '',
  }
}

function blockDurationMinutes(block) {
  const start = timeToMinutes(block?.start_time, 0)
  const end = timeToMinutes(block?.end_time, start)
  return Math.max(0, end - start)
}

function blockOverlapMinutes(a, b) {
  if (Number(a?.day_of_week) !== Number(b?.day_of_week)) return 0
  const start = Math.max(timeToMinutes(a?.start_time, 0), timeToMinutes(b?.start_time, 0))
  const end = Math.min(timeToMinutes(a?.end_time, 0), timeToMinutes(b?.end_time, 0))
  return Math.max(0, end - start)
}

function blockHasCoreCoverage(block) {
  const roles = block?.roles || {}
  return ["server", "host", "bartender", "busser", "runner", "chef"].some(role => {
    const value = roles[role]
    const count = typeof value === 'object' ? value?.min_staff : value
    return Number(count || 0) > 0
  })
}

function hasMeaningfulOverlap(block, blocks, ratio = 0.5) {
  const duration = Math.max(1, blockDurationMinutes(block))
  return blocks.some(existing => blockHasCoreCoverage(existing) && blockOverlapMinutes(block, existing) / duration >= ratio)
}

function mergeCoverageBlocks(savedBlocks, suggestedBlocks) {
  const saved = Array.isArray(savedBlocks) ? savedBlocks : []
  const suggestions = Array.isArray(suggestedBlocks) ? suggestedBlocks : []
  const missingSuggestions = suggestions.filter(block => !hasMeaningfulOverlap(block, saved))
  return [...saved, ...missingSuggestions]
}

function coverageRatio(savedBlocks, suggestedBlocks) {
  const suggestions = Array.isArray(suggestedBlocks) ? suggestedBlocks : []
  const totalSuggestedMinutes = suggestions.reduce((sum, block) => sum + blockDurationMinutes(block), 0)
  if (!totalSuggestedMinutes) return 1
  const coveredMinutes = suggestions.reduce((sum, suggestion) => {
    const suggestionDuration = blockDurationMinutes(suggestion)
    const covered = (Array.isArray(savedBlocks) ? savedBlocks : []).filter(blockHasCoreCoverage).reduce(
      (overlap, saved) => overlap + blockOverlapMinutes(suggestion, saved),
      0,
    )
    return sum + Math.min(suggestionDuration, covered)
  }, 0)
  return coveredMinutes / totalSuggestedMinutes
}

function roleSummary(roles = {}) {
  const parts = COVERAGE_ROLES
    .map(role => {
      const value = roles[role]
      const count = typeof value === 'object' ? value?.min_staff : value
      return Number(count || 0) > 0 ? `${ROLE_LABELS[role] || role}: ${count}` : null
    })
    .filter(Boolean)
  return parts.length ? parts.join(' · ') : 'No role counts set'
}

function blockToForm(block) {
  const roles = COVERAGE_ROLES.reduce((acc, role) => {
    const value = block?.roles?.[role]
    const count = typeof value === 'object' ? value?.min_staff : value
    acc[role] = count ?? ''
    return acc
  }, {})
  return {
    ...emptyCoverageBlockForm,
    key: block?.key || null,
    is_suggested: Boolean(block?.is_suggested),
    day_of_week: Number(block?.day_of_week ?? 0),
    start_time: String(block?.start_time || '').slice(0, 5),
    end_time: String(block?.end_time || '').slice(0, 5),
    is_prime_shift: Boolean(block?.is_prime_shift),
    notes: block?.notes || '',
    original_day_of_week: block?.is_suggested ? null : Number(block?.day_of_week ?? 0),
    original_start_time: block?.is_suggested ? null : String(block?.start_time || '').slice(0, 5),
    original_end_time: block?.is_suggested ? null : String(block?.end_time || '').slice(0, 5),
    roles,
  }
}

function layoutOverlappingScheduleItems(items = []) {
  const sorted = [...items].sort((a, b) => {
    const startDiff = timeToMinutes(a.shift_start, 0) - timeToMinutes(b.shift_start, 0)
    if (startDiff !== 0) return startDiff
    return timeToMinutes(a.shift_end, 0) - timeToMinutes(b.shift_end, 0)
  })
  const groups = []
  sorted.forEach(item => {
    const start = timeToMinutes(item.shift_start, 0)
    const end = timeToMinutes(item.shift_end, start)
    const lastGroup = groups[groups.length - 1]
    if (!lastGroup || start >= lastGroup.end) {
      groups.push({ end, items: [{ item, start, end }] })
    } else {
      lastGroup.items.push({ item, start, end })
      lastGroup.end = Math.max(lastGroup.end, end)
    }
  })

  return groups.flatMap(group => {
    const columnEnds = []
    const positioned = group.items.map(entry => {
      let column = columnEnds.findIndex(end => end <= entry.start)
      if (column === -1) {
        column = columnEnds.length
        columnEnds.push(entry.end)
      } else {
        columnEnds[column] = entry.end
      }
      return { ...entry, column }
    })
    const columns = Math.max(1, columnEnds.length)
    return positioned.map(entry => ({
      ...entry.item,
      layout_start: entry.start,
      layout_end: entry.end,
      layout_column: entry.column,
      layout_columns: columns,
    }))
  })
}

function isUpcomingApprovedShiftTrade(request) {
  if (request?.status !== 'approved' || !request?.shift_date) return false
  if (typeof request.is_future === 'boolean') return request.is_future
  const time = String(request.shift_start || '00:00').slice(0, 8)
  const startsAt = new Date(`${String(request.shift_date).slice(0, 10)}T${time}`)
  return Number.isFinite(startsAt.getTime()) && startsAt.getTime() > Date.now()
}

function SchedulingPanel({ restaurantId }) {
  const [activeSchedulingTab, setActiveSchedulingTab] = useState('schedule')
  const [weekStart, setWeekStart] = useState('')
  const [coverageBlocks, setCoverageBlocks] = useState([])
  const [suggestedBlocks, setSuggestedBlocks] = useState([])
  const [schedules, setSchedules] = useState([])
  const [staff, setStaff] = useState([])
  const [employeeRequests, setEmployeeRequests] = useState([])
  const [shiftTradeRequests, setShiftTradeRequests] = useState([])
  const [shiftTradeView, setShiftTradeView] = useState('pending')
  const [requestPolicy, setRequestPolicy] = useState(null)
  const [savedRequestPolicy, setSavedRequestPolicy] = useState(null)
  const [optimizationWeights, setOptimizationWeights] = useState(DEFAULT_OPTIMIZATION_WEIGHTS)
  const [scheduleRoleFilter, setScheduleRoleFilter] = useState('all')
  const [scheduleEmployeeFilter, setScheduleEmployeeFilter] = useState('all')
  const [jobCodeRates, setJobCodeRates] = useState({})
  const [coverageForm, setCoverageForm] = useState(emptyCoverageBlockForm)
  const [selectedShift, setSelectedShift] = useState(null)
  const [selectedDiagnostic, setSelectedDiagnostic] = useState(null)
  const [shiftForm, setShiftForm] = useState(null)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const [noteStatus, setNoteStatus] = useState('')
  const [noteStatusKind, setNoteStatusKind] = useState('neutral')
  const [calendarDrag, setCalendarDrag] = useState(null)
  const [draftBlock, setDraftBlock] = useState(null)
  const [coverageMenu, setCoverageMenu] = useState(null)
  const scheduleCalendarRef = useRef(null)
  const coverageCalendarRef = useRef(null)
  const autoGeneratedCoverageRef = useRef('')
  const autoScrolledCoverageRef = useRef('')
  const autoScrolledScheduleRef = useRef('')
  const draftBlockRef = useRef(null)

  // Reads are cached in the shared query cache so tab switches don't re-hit
  // the API; pass force=true after a write to refresh from the server.
  const schedulingRead = (key, fn, force) => fetchCached(key, fn, force ? 0 : STALE_TIMES.scheduling)

  const loadCoverageBlocks = async (force = false) => {
    const data = await schedulingRead(
      queryKeys.staffingBlocks(restaurantId),
      () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/staffing-requirements/blocks`),
      force,
    )
    setCoverageBlocks(Array.isArray(data) ? data : [])
    return data
  }

  const loadSuggestedBlocks = async (force = false) => {
    const data = await schedulingRead(
      queryKeys.staffingSuggestions(restaurantId),
      () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/staffing-requirements/suggestions`),
      force,
    )
    setSuggestedBlocks(Array.isArray(data) ? data : [])
    return data
  }

  const loadSchedules = async (targetWeekStart = weekStart, force = false) => {
    const query = targetWeekStart ? `?week_start=${targetWeekStart}&limit=5` : '?limit=5'
    const data = await schedulingRead(
      queryKeys.schedules(restaurantId, query),
      () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/schedules${query}`),
      force,
    )
    setSchedules(Array.isArray(data) ? data : [])
    return data
  }

  const loadStaff = async (force = false) => {
    const data = await schedulingRead(
      queryKeys.waiters(restaurantId),
      () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=false`),
      force,
    )
    setStaff(Array.isArray(data) ? data : [])
    return data
  }

  const loadRequestPolicy = async (force = false) => {
    const data = await schedulingRead(
      queryKeys.employeeRequestPolicy(restaurantId),
      () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/employee-request-policy`),
      force,
    )
    setRequestPolicy(data)
    setSavedRequestPolicy(structuredClone(data))
    setOptimizationWeights({
      ...DEFAULT_OPTIMIZATION_WEIGHTS,
      ...(data?.manager_settings?.optimization_weights || {}),
    })
    return data
  }

  const loadEmployeeRequests = async (force = false) => {
    const data = await schedulingRead(
      queryKeys.employeeRequests(restaurantId, 'all'),
      () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/employee-requests?status=all`),
      force,
    )
    setEmployeeRequests(Array.isArray(data) ? data : [])
    return data
  }

  const loadShiftTradeRequests = async (force = false) => {
    const data = await schedulingRead(
      queryKeys.shiftTradeRequests(restaurantId, 'all'),
      () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/shift-trade-requests?status=all`),
      force,
    )
    setShiftTradeRequests(Array.isArray(data) ? data : [])
    return data
  }

  const saveCoverageBlockPayload = async (form, options = {}) => {
    if (!form.start_time || !form.end_time) {
      setStatus('Coverage block needs both a start time and an end time.')
      return null
    }
    if (!/^\d{2}:\d{2}$/.test(form.start_time) || !/^\d{2}:\d{2}$/.test(form.end_time)) {
      setStatus('Use HH:MM format for both coverage times.')
      return null
    }
    if (timeToMinutes(form.end_time, 0) <= timeToMinutes(form.start_time, 0)) {
      setStatus('Coverage block end time must be after the start time.')
      return null
    }
    if (!options.silent) setStatus(options.pendingMessage || 'Saving coverage block...')
    const rolePayload = normalizeRoleCounts(form.roles)
    await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/staffing-requirements/blocks`, {
      method: 'POST',
      body: JSON.stringify({
        day_of_week: Number(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
        roles: rolePayload,
        is_prime_shift: Boolean(form.is_prime_shift),
        notes: form.notes || null,
        infer_support_roles: true,
        original_day_of_week: form.original_day_of_week,
        original_start_time: form.original_start_time,
        original_end_time: form.original_end_time,
      }),
    })
    const updated = await loadCoverageBlocks(true)
    if (options.keepEditor) {
      setCoverageForm({
        ...form,
        is_suggested: false,
        original_day_of_week: Number(form.day_of_week),
        original_start_time: form.start_time,
        original_end_time: form.end_time,
      })
    } else {
      setCoverageForm(emptyCoverageBlockForm)
    }
    if (!options.silent) setStatus(options.successMessage || 'Coverage block saved.')
    return updated
  }

  const ensureCoverageDefaults = async (savedBlocks, suggestions) => {
    const saved = Array.isArray(savedBlocks) ? savedBlocks : []
    const suggested = Array.isArray(suggestions) ? suggestions : []
    if (!suggested.length || autoGeneratedCoverageRef.current === restaurantId) return
    autoGeneratedCoverageRef.current = restaurantId
    if (coverageRatio(saved, suggested) >= DEFAULT_COVERAGE_THRESHOLD) return

    const missingBlocks = suggested.filter(block => !hasMeaningfulOverlap(block, saved))
    if (!missingBlocks.length) return

    setStatus('Filling missing default coverage blocks...')
    try {
      for (const block of missingBlocks) {
        await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/staffing-requirements/blocks`, {
          method: 'POST',
          body: JSON.stringify({
            day_of_week: Number(block.day_of_week),
            start_time: String(block.start_time || '').slice(0, 5),
            end_time: String(block.end_time || '').slice(0, 5),
            roles: normalizeRoleCounts(block.roles),
            is_prime_shift: Boolean(block.is_prime_shift),
            notes: block.notes || 'Auto-generated default coverage',
            infer_support_roles: true,
            original_day_of_week: null,
            original_start_time: null,
            original_end_time: null,
          }),
        })
      }
      await loadCoverageBlocks(true)
      setStatus(`Generated ${missingBlocks.length} default coverage block${missingBlocks.length === 1 ? '' : 's'}.`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not generate default coverage blocks')
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([loadCoverageBlocks(), loadSuggestedBlocks(), loadSchedules(), loadStaff(), loadRequestPolicy(), loadEmployeeRequests(), loadShiftTradeRequests()])
      .then(([saved, suggestions]) => {
        if (!cancelled) void ensureCoverageDefaults(saved, suggestions)
      })
      .catch(err => {
        if (!cancelled) setStatus(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadShiftTradeRequests(true).catch(() => undefined)
    }, 30000)
    return () => window.clearInterval(interval)
  }, [restaurantId])

  useEffect(() => {
    draftBlockRef.current = draftBlock
  }, [draftBlock])

  const activeSchedule = schedules[0] || null
  const scheduleItems = activeSchedule?.items || []
  const scheduleDiagnostics = useMemo(() => (
    Array.isArray(activeSchedule?.run_coverage_gaps) ? activeSchedule.run_coverage_gaps : []
  ), [activeSchedule])
  const scheduleRoles = useMemo(() => (
    [...new Set(scheduleItems.map(item => String(item.role || '').toLowerCase()).filter(Boolean))].sort()
  ), [scheduleItems])
  const schedulePeople = useMemo(() => {
    const seen = new Set()
    return scheduleItems
      .map(item => ({
        id: item.waiter_id,
        name: item.waiter_name || staff.find(person => person.id === item.waiter_id)?.name || 'Assigned staff',
      }))
      .filter(person => {
        if (!person.id || seen.has(person.id)) return false
        seen.add(person.id)
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [scheduleItems, staff])
  const filteredScheduleItems = useMemo(() => (
    scheduleItems.filter(item => {
      if (scheduleRoleFilter !== 'all' && String(item.role || '').toLowerCase() !== scheduleRoleFilter) return false
      if (scheduleEmployeeFilter !== 'all' && String(item.waiter_id) !== scheduleEmployeeFilter) return false
      return true
    })
  ), [scheduleItems, scheduleRoleFilter, scheduleEmployeeFilter])
  const filteredScheduleDiagnostics = useMemo(() => (
    scheduleDiagnostics.filter(item => {
      if (scheduleEmployeeFilter !== 'all') return false
      if (scheduleRoleFilter !== 'all' && String(item.role || '').toLowerCase() !== scheduleRoleFilter) return false
      return true
    })
  ), [scheduleDiagnostics, scheduleRoleFilter, scheduleEmployeeFilter])
  const displayedBlocks = useMemo(
    () => mergeCoverageBlocks(coverageBlocks, suggestedBlocks),
    [coverageBlocks, suggestedBlocks],
  )

  const calendarBounds = useMemo(() => ({ start: DEFAULT_CALENDAR_START, end: DEFAULT_CALENDAR_END }), [])

  const calendarHeight = ((calendarBounds.end - calendarBounds.start) / 60) * COVERAGE_PIXELS_PER_HOUR
  const shiftTradePolicy = {
    ...DEFAULT_SHIFT_TRADE_POLICY,
    ...(requestPolicy?.manager_settings?.shift_trades || {}),
  }
  const pendingShiftTradeCount = shiftTradeRequests.filter(request => request.status === 'pending_manager').length
  const visibleShiftTradeRequests = shiftTradeRequests.filter(request => {
    const upcoming = isUpcomingApprovedShiftTrade(request)
    if (shiftTradeView === 'pending') return request.status === 'pending_manager'
    if (shiftTradeView === 'upcoming') return upcoming
    return !['pending_target', 'pending_manager'].includes(String(request.status)) && !upcoming
  })
  const timelineHours = useMemo(() => {
    const hours = []
    for (let minute = calendarBounds.start; minute <= calendarBounds.end; minute += 60) hours.push(minute)
    return hours
  }, [calendarBounds])

  useEffect(() => {
    if (activeSchedulingTab !== 'config' || !displayedBlocks.length) return undefined
    const scrollKey = String(restaurantId)
    if (autoScrolledCoverageRef.current === scrollKey) return undefined
    autoScrolledCoverageRef.current = scrollKey

    const frame = window.requestAnimationFrame(() => {
      const node = coverageCalendarRef.current
      if (!node) return
      const blockCenters = displayedBlocks
        .map(block => {
          const start = timeToMinutes(block.start_time, null)
          const end = timeToMinutes(block.end_time, null)
          if (start === null || end === null || end <= start) return null
          return (start + end) / 2
        })
        .filter(value => value !== null)
      if (!blockCenters.length) return

      const averageMinute = blockCenters.reduce((sum, value) => sum + value, 0) / blockCenters.length
      const averageTop = ((averageMinute - calendarBounds.start) / 60) * COVERAGE_PIXELS_PER_HOUR
      const targetTop = clamp(averageTop - (node.clientHeight / 2), 0, Math.max(0, node.scrollHeight - node.clientHeight))
      node.scrollTop = targetTop
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeSchedulingTab, calendarBounds.start, displayedBlocks, restaurantId])

  useEffect(() => {
    if (activeSchedulingTab !== 'schedule' || !filteredScheduleItems.length) return undefined
    const scrollKey = String(restaurantId)
    if (autoScrolledScheduleRef.current === scrollKey) return undefined
    autoScrolledScheduleRef.current = scrollKey

    const frame = window.requestAnimationFrame(() => {
      const node = scheduleCalendarRef.current
      if (!node) return
      const shiftCenters = filteredScheduleItems
        .map(item => {
          const start = timeToMinutes(item.shift_start, null)
          const end = timeToMinutes(item.shift_end, null)
          if (start === null || end === null || end <= start) return null
          return (start + end) / 2
        })
        .filter(value => value !== null)
      if (!shiftCenters.length) return

      const averageMinute = shiftCenters.reduce((sum, value) => sum + value, 0) / shiftCenters.length
      const averageLeft = ((averageMinute - calendarBounds.start) / 60) * SCHEDULE_TIMELINE_PIXELS_PER_HOUR
      const targetLeft = clamp(averageLeft - (node.clientWidth / 2), 0, Math.max(0, node.scrollWidth - node.clientWidth))
      node.scrollLeft = targetLeft
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeSchedulingTab, calendarBounds.start, filteredScheduleItems, restaurantId])

  const renderedBlocksForDay = (dayIndex) => {
    const movedBlocks = displayedBlocks.map(block => (
      draftBlock && calendarDrag?.type !== 'create' && block.key === calendarDrag?.block?.key ? draftBlock : block
    ))
    const withDraft = draftBlock?.is_draft ? [...movedBlocks, draftBlock] : movedBlocks
    return withDraft.filter(block => Number(block.day_of_week) === dayIndex)
  }

  const itemsForDay = (dayIndex) => {
    if (!activeSchedule?.week_start_date) return []
    const start = new Date(`${activeSchedule.week_start_date}T12:00:00`)
    start.setDate(start.getDate() + dayIndex)
    const target = start.toISOString().slice(0, 10)
    return layoutOverlappingScheduleItems(filteredScheduleItems.filter(item => item.shift_date === target))
  }

  const diagnosticsForDay = (dayIndex) => {
    if (!activeSchedule?.week_start_date) return []
    const start = new Date(`${activeSchedule.week_start_date}T12:00:00`)
    start.setDate(start.getDate() + dayIndex)
    const target = start.toISOString().slice(0, 10)
    return filteredScheduleDiagnostics.filter(item => String(item.shift_date).slice(0, 10) === target || Number(item.day_of_week) === dayIndex)
  }

  const staffHourRows = useMemo(() => {
    const assigned = scheduleItems.reduce((acc, item) => {
      const start = timeToMinutes(item.shift_start, 0)
      const end = timeToMinutes(item.shift_end, start)
      const hours = Math.max(0, end - start) / 60
      acc[item.waiter_id] = (acc[item.waiter_id] || 0) + hours
      return acc
    }, {})
    return staff.map(person => {
      const target = Number(person.suggested_weekly_hours ?? 0) || null
      const hours = Number((assigned[person.id] || 0).toFixed(2))
      return {
        ...person,
        assigned_hours: hours,
        target_hours: target,
        delta_hours: target === null ? null : Number((hours - target).toFixed(2)),
      }
    })
  }, [scheduleItems, staff])

  // Role hourly rates for the read-only labor-cost projection (Payroll & Tips
  // owns pay; this only forecasts what the current schedule will cost).
  useEffect(() => {
    if (!restaurantId) return undefined
    let cancelled = false
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes`)
      .then(rows => {
        if (cancelled) return
        const map = {}
        ;(Array.isArray(rows) ? rows : []).forEach(row => {
          const code = String(row?.code || '').trim().toLowerCase()
          if (code) map[code] = Number(row?.default_hourly_rate) || 0
        })
        setJobCodeRates(map)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [restaurantId])

  const scheduledLabor = useMemo(() => {
    let minutes = 0
    let cost = 0
    let missingRate = false
    scheduleItems.forEach(item => {
      const start = timeToMinutes(item.shift_start, 0)
      const end = timeToMinutes(item.shift_end, start)
      const mins = Math.max(0, end - start)
      minutes += mins
      const roleKey = String(item.role || '').toLowerCase()
      if (!(roleKey in jobCodeRates)) missingRate = true
      cost += (mins / 60) * (jobCodeRates[roleKey] || 0)
    })
    return { hours: minutes / 60, cost, missingRate, shifts: scheduleItems.length }
  }, [scheduleItems, jobCodeRates])

  const createManualRun = async () => {
    setStatus('Generating draft schedule...')
    try {
      const body = weekStart ? { week_start_date: weekStart } : {}
      const run = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/schedules/run?run_engine=true&force_regenerate=true`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      await loadSchedules(weekStart || run.week_start_date, true)
      setWeekStart(weekStart || run.week_start_date)
      setActiveSchedulingTab('schedule')
      setStatus(run.run_status === 'completed' ? 'Draft schedule generated.' : `Schedule run ${run.run_status}.`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not create run')
    }
  }

  const regenerateCoverageDefaults = async () => {
    setStatus('Recalculating coverage suggestions...')
    try {
      const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/staffing-requirements/regenerate-defaults`, {
        method: 'POST',
      })
      setCoverageBlocks(Array.isArray(data) ? data : [])
      await loadSuggestedBlocks(true)
      setCoverageForm(emptyCoverageBlockForm)
      setStatus('Coverage suggestions recalculated.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not recalculate coverage suggestions')
    }
  }

  const reviewEmployeeRequest = async (requestId, nextStatus) => {
    setStatus(nextStatus === 'approved' ? 'Approving request...' : 'Updating request...')
    try {
      await fetchWithSupabaseAuth(`/employee-requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })
      await Promise.all([loadEmployeeRequests(true), loadStaff(true)])
      setStatus(nextStatus === 'approved' ? 'Request approved.' : 'Request updated.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not update request')
    }
  }

  const reviewShiftTradeRequest = async (requestId, nextStatus) => {
    setStatus(nextStatus === 'approved' ? 'Approving shift transfer...' : 'Updating shift transfer...')
    try {
      await fetchWithSupabaseAuth(`/shift-trade-requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })
      await Promise.all([loadShiftTradeRequests(true), loadSchedules(activeSchedule?.week_start_date || weekStart, true), loadStaff(true)])
      setStatus(nextStatus === 'approved' ? 'Shift transfer approved and schedule updated.' : 'Shift transfer updated.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not update shift transfer')
    }
  }

  const selectShift = (item) => {
    setSelectedShift(item)
    setSelectedDiagnostic(null)
    setShiftForm(shiftToForm(item))
  }

  const selectDiagnostic = (item) => {
    setSelectedDiagnostic(item)
    setSelectedShift(null)
    setShiftForm(null)
  }

  const saveSelectedShift = async () => {
    if (!selectedShift || !shiftForm) return
    setStatus('Saving shift...')
    try {
      await fetchWithSupabaseAuth(`/schedule-items/${selectedShift.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          waiter_id: shiftForm.waiter_id,
          role: shiftForm.role,
          shift_date: shiftForm.shift_date,
          shift_start: shiftForm.shift_start,
          shift_end: shiftForm.shift_end,
          is_locked: Boolean(shiftForm.is_locked),
          is_manual_override: true,
          notes: shiftForm.notes || null,
        }),
      })
      await loadSchedules(activeSchedule?.week_start_date || weekStart, true)
      setSelectedShift(null)
      setShiftForm(null)
      setStatus('Shift saved.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save shift')
    }
  }

  const deleteSelectedShift = async () => {
    if (!selectedShift) return
    setStatus('Removing shift...')
    try {
      await fetchWithSupabaseAuth(`/schedule-items/${selectedShift.id}`, { method: 'DELETE' })
      await loadSchedules(activeSchedule?.week_start_date || weekStart, true)
      setSelectedShift(null)
      setShiftForm(null)
      setStatus('Shift removed.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not remove shift')
    }
  }

  const startNewBlock = (dayIndex = 0) => {
    setCoverageForm({
      ...emptyCoverageBlockForm,
      day_of_week: dayIndex,
      start_time: '17:00',
      end_time: '18:30',
      is_prime_shift: true,
      roles: { ...emptyCoverageBlockForm.roles, server: 3 },
    })
  }

  const saveCoverageBlock = async () => {
    try {
      await saveCoverageBlockPayload(coverageForm)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save coverage block')
    }
  }

  const deleteCoverageBlock = async () => {
    if (!coverageForm.original_start_time || coverageForm.is_suggested) return
    setStatus('Removing coverage block...')
    try {
      await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/staffing-requirements/blocks`, {
        method: 'DELETE',
        body: JSON.stringify({
          day_of_week: Number(coverageForm.original_day_of_week),
          start_time: coverageForm.original_start_time,
          end_time: coverageForm.original_end_time,
        }),
      })
      await loadCoverageBlocks(true)
      setCoverageForm(emptyCoverageBlockForm)
      setStatus('Coverage block removed.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not remove coverage block')
    }
  }

  const deleteCoverageBlockByForm = async (form) => {
    if (!form?.original_start_time || form.is_suggested) return
    setStatus('Removing coverage block...')
    try {
      await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/staffing-requirements/blocks`, {
        method: 'DELETE',
        body: JSON.stringify({
          day_of_week: Number(form.original_day_of_week),
          start_time: form.original_start_time,
          end_time: form.original_end_time,
        }),
      })
      await loadCoverageBlocks(true)
      if (coverageForm.key === form.key) setCoverageForm(emptyCoverageBlockForm)
      setCoverageMenu(null)
      setStatus('Coverage block removed.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not remove coverage block')
    }
  }

  const getCalendarPoint = (event) => {
    const node = coverageCalendarRef.current
    if (!node) return null
    const rect = node.getBoundingClientRect()
    const dayWidth = (node.scrollWidth - COVERAGE_TIME_AXIS_WIDTH) / SCHEDULING_DAYS.length
    const x = event.clientX - rect.left - COVERAGE_TIME_AXIS_WIDTH + node.scrollLeft
    const y = event.clientY - rect.top + node.scrollTop
    const day = clamp(Math.floor(x / dayWidth), 0, SCHEDULING_DAYS.length - 1)
    const rawMinute = calendarBounds.start + ((y / COVERAGE_PIXELS_PER_HOUR) * 60)
    const minute = clamp(roundMinutes(rawMinute), calendarBounds.start, calendarBounds.end)
    return { day, minute }
  }

  const buildDraggedBlockForm = (sourceBlock, day, startMinute, endMinute) => {
    const start = clamp(startMinute, calendarBounds.start, calendarBounds.end - COVERAGE_SLOT_MINUTES)
    const end = clamp(Math.max(endMinute, start + COVERAGE_SLOT_MINUTES), start + COVERAGE_SLOT_MINUTES, calendarBounds.end)
    return {
      ...blockToForm(sourceBlock),
      day_of_week: day,
      start_time: minutesToTime(start),
      end_time: minutesToTime(end),
      roles: {
        ...emptyCoverageBlockForm.roles,
        ...blockToForm(sourceBlock).roles,
      },
    }
  }

  const startCreateCoverageDrag = (event, dayIndex) => {
    if (event.button !== 0) return
    setCoverageMenu(null)
    const point = getCalendarPoint(event)
    if (!point) return
    const start = point.minute
    const end = Math.min(calendarBounds.end, start + COVERAGE_SLOT_MINUTES)
    const nextDraft = {
      key: 'draft-coverage-block',
      is_draft: true,
      is_suggested: true,
      day_of_week: dayIndex,
      start_time: minutesToTime(start),
      end_time: minutesToTime(end),
      roles: { server: 3 },
      is_prime_shift: true,
      notes: '',
    }
    setDraftBlock(nextDraft)
    draftBlockRef.current = nextDraft
    setCalendarDrag({ type: 'create', day: dayIndex, anchorMinute: start })
  }

  const startMoveCoverageDrag = (event, block) => {
    if (event.button !== 0) return
    setCoverageMenu(null)
    event.preventDefault()
    event.stopPropagation()
    const point = getCalendarPoint(event)
    if (!point) return
    const start = timeToMinutes(block.start_time, calendarBounds.start)
    const end = timeToMinutes(block.end_time, start + 60)
    setDraftBlock(block)
    draftBlockRef.current = block
    setCalendarDrag({
      type: 'move',
      block,
      pointerOffset: point.minute - start,
      duration: Math.max(COVERAGE_SLOT_MINUTES, end - start),
    })
  }

  const startResizeCoverageDrag = (event, block) => {
    if (event.button !== 0) return
    setCoverageMenu(null)
    event.preventDefault()
    event.stopPropagation()
    const start = timeToMinutes(block.start_time, calendarBounds.start)
    setDraftBlock(block)
    draftBlockRef.current = block
    setCalendarDrag({ type: 'resize', block, startMinute: start })
  }

  useEffect(() => {
    if (!calendarDrag) return undefined

    const handlePointerMove = (event) => {
      const point = getCalendarPoint(event)
      if (!point) return

      if (calendarDrag.type === 'create') {
        const start = Math.min(calendarDrag.anchorMinute, point.minute)
        const end = Math.max(calendarDrag.anchorMinute + COVERAGE_SLOT_MINUTES, point.minute)
        setDraftBlock(prev => {
          const next = {
            ...(prev || {}),
            key: 'draft-coverage-block',
            is_draft: true,
            is_suggested: true,
            day_of_week: point.day,
            start_time: minutesToTime(clamp(start, calendarBounds.start, calendarBounds.end - COVERAGE_SLOT_MINUTES)),
            end_time: minutesToTime(clamp(end, calendarBounds.start + COVERAGE_SLOT_MINUTES, calendarBounds.end)),
            roles: prev?.roles || { server: 3 },
            is_prime_shift: true,
          }
          draftBlockRef.current = next
          return next
        })
        return
      }

      if (calendarDrag.type === 'move') {
        const start = clamp(point.minute - calendarDrag.pointerOffset, calendarBounds.start, calendarBounds.end - calendarDrag.duration)
        const end = start + calendarDrag.duration
        const next = {
          ...calendarDrag.block,
          day_of_week: point.day,
          start_time: minutesToTime(start),
          end_time: minutesToTime(end),
        }
        draftBlockRef.current = next
        setDraftBlock(next)
        return
      }

      if (calendarDrag.type === 'resize') {
        const end = clamp(point.minute, calendarDrag.startMinute + COVERAGE_SLOT_MINUTES, calendarBounds.end)
        const next = {
          ...calendarDrag.block,
          end_time: minutesToTime(end),
        }
        draftBlockRef.current = next
        setDraftBlock(next)
      }
    }

    const handlePointerUp = () => {
      const finalDraft = draftBlockRef.current
      setCalendarDrag(null)
      setDraftBlock(null)
      draftBlockRef.current = null
      if (!finalDraft) return

      const finalForm = calendarDrag.type === 'create'
        ? {
            ...emptyCoverageBlockForm,
            day_of_week: Number(finalDraft.day_of_week),
            start_time: String(finalDraft.start_time).slice(0, 5),
            end_time: String(finalDraft.end_time).slice(0, 5),
            is_prime_shift: true,
            roles: { ...emptyCoverageBlockForm.roles, server: 3 },
          }
        : buildDraggedBlockForm(
            calendarDrag.block,
            Number(finalDraft.day_of_week),
            timeToMinutes(finalDraft.start_time, calendarBounds.start),
            timeToMinutes(finalDraft.end_time, calendarBounds.start + 60),
          )

      setCoverageForm(finalForm)
      if (calendarDrag.type === 'create') {
        void saveCoverageBlockPayload(finalForm, {
          keepEditor: true,
          successMessage: 'Coverage block created.',
        }).catch(err => {
          setStatus(err instanceof Error ? err.message : 'Could not create coverage block')
        })
      } else {
        void saveCoverageBlockPayload(finalForm, {
          keepEditor: true,
          successMessage: 'Coverage block updated.',
        }).catch(err => {
          setStatus(err instanceof Error ? err.message : 'Could not update coverage block')
        })
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [calendarDrag, draftBlock, calendarBounds])

  useEffect(() => {
    if (!coverageMenu) return undefined
    const closeMenu = () => setCoverageMenu(null)
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [coverageMenu])

  const saveManagerNote = async () => {
    if (!note.trim()) return
    setNoteStatus('Parsing note...')
    setNoteStatusKind('neutral')
    try {
      const result = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/schedule-constraint-notes`, {
        method: 'POST',
        body: JSON.stringify({
          raw_text: note.trim(),
          week_start_date: weekStart || null,
          use_llm: true,
        }),
      })
      setNote('')
      if (result?.applied_coverage_block || result?.applied_coverage_closure) await loadCoverageBlocks(true)
      if (result?.applied_request_id) await loadEmployeeRequests(true)
      if (result?.applied_message) {
        setNoteStatus(result.applied_message)
        setNoteStatusKind('success')
      } else {
        setNoteStatus('Parsed and saved for the schedule engine. No direct coverage or employee request edit was applied.')
        setNoteStatusKind('neutral')
      }
    } catch (err) {
      setNoteStatus(err instanceof Error ? err.message : 'Could not save note')
      setNoteStatusKind('error')
    }
  }

  const saveRequestPolicy = async () => {
    if (!requestPolicy) return
    setStatus('Saving request limits...')
    try {
      const managerSettings = {
        ...(requestPolicy.manager_settings || {}),
        optimization_weights: optimizationWeights,
        shift_trades: {
          ...shiftTradePolicy,
          require_manager_approval: true,
          notify_managers_in_chat: false,
        },
      }
      const saved = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/employee-request-policy`, {
        method: 'PUT',
        body: JSON.stringify({
          policy_year: requestPolicy.policy_year,
          critical_priority_limit: requestPolicy.critical_priority_limit,
          high_priority_limit: requestPolicy.high_priority_limit,
          normal_priority_limit: requestPolicy.normal_priority_limit,
          low_priority_limit: requestPolicy.low_priority_limit,
          manager_settings: managerSettings,
        }),
      })
      setRequestPolicy(saved)
      setSavedRequestPolicy(structuredClone(saved))
      setOptimizationWeights({
        ...DEFAULT_OPTIMIZATION_WEIGHTS,
        ...(saved?.manager_settings?.optimization_weights || {}),
      })
      setStatus('Request limits saved.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save request limits')
    }
  }

  const discardRequestPolicy = () => {
    if (!savedRequestPolicy) return
    const restored = structuredClone(savedRequestPolicy)
    setRequestPolicy(restored)
    setOptimizationWeights({
      ...DEFAULT_OPTIMIZATION_WEIGHTS,
      ...(restored?.manager_settings?.optimization_weights || {}),
    })
    setStatus('Changes discarded.')
  }

  const scheduleTimelineWidth = ((calendarBounds.end - calendarBounds.start) / 60) * SCHEDULE_TIMELINE_PIXELS_PER_HOUR

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="label-mono">Scheduling</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Calendar Builder</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-dash-secondary">
              Coverage blocks, employee inputs, manager notes, and draft schedule editing.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="date"
              value={weekStart}
              onChange={event => setWeekStart(event.target.value)}
              className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-dash-cream outline-none focus:border-dash-gold/70"
            />
            <button
              type="button"
              onClick={() => void createManualRun()}
              className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Generate draft
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ['schedule', 'Schedule'],
            ['config', 'Calendar Config'],
            ['requests', 'Requests'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSchedulingTab(id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeSchedulingTab === id
                  ? 'bg-white text-black'
                  : 'border border-white/10 text-dash-secondary hover:border-dash-gold/60 hover:text-dash-cream'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {status && <p className="mt-4 text-sm text-dash-secondary">{status}</p>}
      </section>

      {activeSchedulingTab === 'schedule' && (
        <div className="space-y-4">
        <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
            <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Weekly Schedule</h3>
                <p className="mt-1 text-xs text-dash-tertiary">
                  {filteredScheduleItems.length} visible shift{filteredScheduleItems.length === 1 ? '' : 's'} of {scheduleItems.length}.
                </p>
                {scheduleItems.length ? (
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs">
                    <span className="text-dash-tertiary">Projected labor</span>
                    <span className="font-semibold text-dash-cream">{formatCurrency(scheduledLabor.cost)}</span>
                    <span className="text-dash-tertiary">· {scheduledLabor.hours.toFixed(1)} hrs (wages only)</span>
                    {scheduledLabor.missingRate ? (
                      <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-amber-200">Some roles missing a rate</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs text-dash-tertiary">Type</span>
                  <select
                    value={scheduleRoleFilter}
                    onChange={event => setScheduleRoleFilter(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none"
                  >
                    <option value="all">All types</option>
                    {scheduleRoles.map(role => (
                      <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-dash-tertiary">Employee</span>
                  <select
                    value={scheduleEmployeeFilter}
                    onChange={event => setScheduleEmployeeFilter(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none"
                  >
                    <option value="all">All employees</option>
                    {schedulePeople.map(person => (
                      <option key={person.id} value={person.id}>{person.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div ref={scheduleCalendarRef} className="relative max-h-[620px] overflow-auto">
              <div
                className="relative"
                style={{
                  minWidth: SCHEDULE_DAY_AXIS_WIDTH + scheduleTimelineWidth,
                }}
              >
                <div
                  className="sticky top-0 z-20 grid border-b border-white/10 bg-[#12110f]"
                  style={{ gridTemplateColumns: `${SCHEDULE_DAY_AXIS_WIDTH}px ${scheduleTimelineWidth}px` }}
                >
                  <div className="border-r border-white/10 px-3 py-3 text-xs font-semibold text-dash-tertiary">Day</div>
                  <div className="relative h-11">
                    {timelineHours.map(minute => (
                      <div
                        key={minute}
                        className="absolute top-0 h-full border-l border-white/[0.08] pl-2 pt-3 font-mono text-[11px] text-dash-tertiary"
                        style={{ left: ((minute - calendarBounds.start) / 60) * SCHEDULE_TIMELINE_PIXELS_PER_HOUR }}
                      >
                        {formatDisplayTime(minute)}
                      </div>
                    ))}
                  </div>
                </div>
                {SCHEDULING_DAYS.map((day, dayIndex) => {
                  const dayItems = itemsForDay(dayIndex)
                  const dayDiagnostics = diagnosticsForDay(dayIndex)
                  const shiftLanes = Math.max(1, ...dayItems.map(item => item.layout_columns || 1))
                  const rowHeight = Math.max(80, 16 + ((shiftLanes + dayDiagnostics.length) * SCHEDULE_LANE_HEIGHT))
                  return (
                    <div
                      key={day}
                      className="grid border-b border-white/[0.08] last:border-b-0"
                      style={{ gridTemplateColumns: `${SCHEDULE_DAY_AXIS_WIDTH}px ${scheduleTimelineWidth}px` }}
                    >
                      <div className="sticky left-0 z-10 flex items-center border-r border-white/10 bg-[#12110f] px-3 text-sm font-semibold text-dash-secondary" style={{ height: rowHeight }}>
                        {day}
                      </div>
                      <div className="relative" style={{ height: rowHeight }}>
                        {timelineHours.map(minute => (
                          <div
                            key={minute}
                            className="pointer-events-none absolute bottom-0 top-0 border-l border-white/[0.055]"
                            style={{ left: ((minute - calendarBounds.start) / 60) * SCHEDULE_TIMELINE_PIXELS_PER_HOUR }}
                          />
                        ))}
                        {dayItems.map(item => {
                          const start = item.layout_start ?? timeToMinutes(item.shift_start, calendarBounds.start)
                          const end = item.layout_end ?? timeToMinutes(item.shift_end, start + 60)
                          const left = ((start - calendarBounds.start) / 60) * SCHEDULE_TIMELINE_PIXELS_PER_HOUR
                          const width = Math.max(86, ((end - start) / 60) * SCHEDULE_TIMELINE_PIXELS_PER_HOUR - 8)
                          const lane = item.layout_column || 0
                          const isSelected = selectedShift?.id === item.id
                          const personName = item.waiter_name || staff.find(person => person.id === item.waiter_id)?.name || 'Assigned staff'
                          const roleKey = String(item.role || '').toLowerCase()
                          const roleLabel = ROLE_SHORT_LABELS[roleKey] || item.role || 'Staff'
                          const timeLabel = `${formatDisplayTime(item.shift_start)}-${formatDisplayTime(item.shift_end)}`
                          return (
                            <button
                              type="button"
                              key={item.id}
                              title={`${personName} · ${roleLabel} · ${timeLabel}`}
                              onClick={() => selectShift(item)}
                              className={`absolute overflow-hidden rounded-lg border px-3 py-2 text-left text-[11px] shadow-lg transition ${
                                isSelected
                                  ? 'border-dash-gold bg-dash-gold/25'
                                  : 'border-dash-gold/30 bg-dash-gold/10 hover:border-dash-gold/70 hover:bg-dash-gold/15'
                              }`}
                              style={{
                                left,
                                top: 8 + (lane * SCHEDULE_LANE_HEIGHT),
                                width,
                                height: 46,
                              }}
                            >
                              <span className="block truncate font-semibold text-dash-cream">{personName}</span>
                              <span className="mt-0.5 flex min-w-0 items-center gap-2 whitespace-nowrap text-dash-secondary">
                                <span className="truncate">{roleLabel}</span>
                                <span className="font-mono text-dash-tertiary">{timeLabel}</span>
                              </span>
                            </button>
                          )
                        })}
                        {dayDiagnostics.map((diagnostic, diagnosticIndex) => {
                          const start = timeToMinutes(diagnostic.start_time, calendarBounds.start)
                          const end = timeToMinutes(diagnostic.end_time, start + 60)
                          const left = ((start - calendarBounds.start) / 60) * SCHEDULE_TIMELINE_PIXELS_PER_HOUR
                          const width = Math.max(86, ((end - start) / 60) * SCHEDULE_TIMELINE_PIXELS_PER_HOUR - 8)
                          const timeLabel = `${formatDisplayTime(diagnostic.start_time)}-${formatDisplayTime(diagnostic.end_time)}`
                          const severity = diagnostic.severity || 'medium'
                          const isSelected = selectedDiagnostic === diagnostic
                          return (
                            <button
                              type="button"
                              key={`${diagnostic.role}-${diagnostic.shift_date || dayIndex}-${diagnostic.start_time}-${diagnosticIndex}`}
                              title={`${diagnostic.role || 'Coverage'} gap · ${timeLabel}`}
                              onClick={() => selectDiagnostic(diagnostic)}
                              className={`absolute z-10 overflow-hidden rounded-lg border px-3 py-2 text-left text-[11px] shadow-lg transition ${
                                isSelected
                                  ? 'border-red-200 bg-red-300/25'
                                  : severity === 'high'
                                    ? 'border-red-300/45 bg-red-300/15 hover:border-red-200/80'
                                    : 'border-amber-300/45 bg-amber-300/15 hover:border-amber-200/80'
                              }`}
                              style={{
                                left,
                                top: 8 + ((shiftLanes + diagnosticIndex) * SCHEDULE_LANE_HEIGHT),
                                width,
                                height: 46,
                              }}
                            >
                              <span className="block truncate font-semibold text-red-50">{diagnostic.role || 'Gap'} gap</span>
                              <span className="mt-0.5 block truncate font-mono text-red-100/75">{timeLabel}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {filteredScheduleItems.length === 0 && (
                  <div className="absolute inset-x-20 top-16 rounded-xl border border-dashed border-white/15 bg-black/20 p-5 text-sm text-dash-secondary">
                    No shifts match the current filters.
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h3 className="text-lg font-semibold">{selectedDiagnostic ? 'Schedule Diagnostic' : 'Shift Editor'}</h3>
            {selectedDiagnostic ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-red-300/25 bg-red-300/10 p-4">
                  <p className="text-sm font-semibold capitalize text-red-50">{selectedDiagnostic.role || 'Coverage'} gap</p>
                  <p className="mt-2 text-sm leading-6 text-red-100/80">
                    {selectedDiagnostic.diagnostic || selectedDiagnostic.reason || 'This coverage requirement could not be assigned.'}
                  </p>
                  <p className="mt-2 font-mono text-xs text-red-100/70">
                    {String(selectedDiagnostic.shift_date || '').slice(0, 10)} · {formatDisplayTime(selectedDiagnostic.start_time)}-{formatDisplayTime(selectedDiagnostic.end_time)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDiagnostic(null)}
                  className="w-full rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-white/20 hover:text-dash-cream"
                >
                  Clear diagnostic
                </button>
              </div>
            ) : !shiftForm ? (
              <p className="mt-3 text-sm leading-6 text-dash-secondary">Select a generated shift to assign a different employee, change the role, or lock it as a manual edit.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {selectedShift?.reasoning && (
                  <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                    <p className="text-sm font-semibold text-emerald-50">Why this assignment</p>
                    <ul className="mt-3 space-y-2 text-sm leading-5 text-emerald-100/85">
                      {(selectedShift.reasoning.reasons || []).map((reason, index) => (
                        <li key={`${reason}-${index}`}>- {reason}</li>
                      ))}
                    </ul>
                    {selectedShift.reasoning.score_breakdown && (
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        {[
                          ['Solver', selectedShift.reasoning.score_breakdown.solver || 'engine'],
                          ['Target', selectedShift.reasoning.score_breakdown.target_weekly_hours != null ? `${selectedShift.reasoning.score_breakdown.target_weekly_hours}h` : 'n/a'],
                          ['Projected', selectedShift.reasoning.score_breakdown.projected_weekly_hours != null ? `${selectedShift.reasoning.score_breakdown.projected_weekly_hours}h` : 'n/a'],
                          ['Confidence', selectedShift.reasoning.confidence_score != null ? `${Math.round(selectedShift.reasoning.confidence_score * 100)}%` : 'n/a'],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg border border-white/10 bg-black/15 p-2">
                            <p className="text-dash-tertiary">{label}</p>
                            <p className="mt-1 font-semibold text-dash-cream">{value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <select
                  value={shiftForm.waiter_id}
                  onChange={event => setShiftForm(prev => ({ ...prev, waiter_id: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none"
                >
                  {staff.map(person => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}
                </select>
                <select
                  value={shiftForm.role}
                  onChange={event => setShiftForm(prev => ({ ...prev, role: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none"
                >
                  {COVERAGE_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                </select>
                <input
                  type="date"
                  value={shiftForm.shift_date}
                  onChange={event => setShiftForm(prev => ({ ...prev, shift_date: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <SmartTimeInput value={shiftForm.shift_start} onChange={value => setShiftForm(prev => ({ ...prev, shift_start: value }))} ariaLabel="Shift start" />
                  <SmartTimeInput value={shiftForm.shift_end} onChange={value => setShiftForm(prev => ({ ...prev, shift_end: value }))} ariaLabel="Shift end" />
                </div>
                <label className="flex items-center gap-2 text-sm text-dash-secondary">
                  <input type="checkbox" checked={shiftForm.is_locked} onChange={event => setShiftForm(prev => ({ ...prev, is_locked: event.target.checked }))} />
                  Lock this manual edit
                </label>
                <textarea
                  rows={3}
                  value={shiftForm.notes}
                  onChange={event => setShiftForm(prev => ({ ...prev, notes: event.target.value }))}
                  placeholder="Notes optional"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary"
                />
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => void saveSelectedShift()} className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90">Save</button>
                  <button type="button" onClick={() => setShiftForm(shiftToForm(selectedShift))} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream">Cancel</button>
                  <button type="button" onClick={() => void deleteSelectedShift()} className="rounded-xl border border-red-400/30 px-4 py-2 text-sm font-semibold text-red-100 transition hover:border-red-300/70">Remove</button>
                </div>
              </div>
            )}
          </aside>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Target Hours</h3>
              <p className="mt-1 text-sm text-dash-secondary">Generated assignments compared with each employee's suggested weekly hours.</p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            {staffHourRows.length === 0 ? (
              <p className="p-4 text-sm text-dash-secondary">No employees loaded.</p>
            ) : (
              staffHourRows.map(row => (
                <div key={row.id} className="grid gap-2 border-b border-white/10 p-3 text-sm last:border-b-0 md:grid-cols-[1fr_120px_120px_120px]">
                  <span className="font-semibold text-dash-cream">{row.name}</span>
                  <span className="capitalize text-dash-secondary">{row.role || 'staff'}</span>
                  <span className="text-dash-secondary">{row.assigned_hours} assigned</span>
                  <span className={row.delta_hours === null ? 'text-dash-tertiary' : row.delta_hours > 2 ? 'text-amber-200' : row.delta_hours < -2 ? 'text-red-200' : 'text-emerald-200'}>
                    {row.target_hours === null ? 'No target' : `${row.target_hours} target (${row.delta_hours > 0 ? '+' : ''}${row.delta_hours})`}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
        </div>
      )}

      {activeSchedulingTab === 'requests' && (
        <div className="space-y-4">
        <section className="rounded-2xl border border-dash-gold/25 bg-dash-gold/10 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Approvals</h3>
              <p className="mt-1 text-sm text-dash-secondary">Approve shift transfers after both employees agree, then retain the complete audit history.</p>
            </div>
            <button type="button" onClick={() => void loadShiftTradeRequests(true)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream">Refresh</button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-black/10 p-1">
            {[
              ['pending', `Pending${pendingShiftTradeCount ? ` (${pendingShiftTradeCount})` : ''}`],
              ['upcoming', 'Approved Upcoming'],
              ['history', 'History'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setShiftTradeView(id)}
                className={`min-h-10 rounded-lg px-3 py-2 text-sm font-semibold transition ${shiftTradeView === id ? 'bg-dash-gold text-black' : 'text-dash-secondary hover:bg-white/[0.05] hover:text-dash-cream'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {visibleShiftTradeRequests.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-dash-secondary">No shift transfers in this view.</p>
            ) : (
              visibleShiftTradeRequests.map(request => (
                <div key={request.id} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 lg:grid-cols-[1fr_180px_210px] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-dash-cream">{request.requesting_waiter_name || 'Employee'} {'->'} {request.target_waiter_name || 'Coworker'}</h4>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs capitalize text-dash-secondary">{String(request.status || '').replaceAll('_', ' ')}</span>
                    </div>
                    <p className="mt-2 text-sm text-dash-secondary">{request.reason || 'Shift transfer request'}</p>
                    <p className="mt-1 text-xs text-dash-tertiary">
                      {[request.shift_date, request.shift_start ? formatDisplayTime(request.shift_start) : null, request.shift_end ? formatDisplayTime(request.shift_end) : null].filter(Boolean).join(' · ') || 'No shift time attached'}
                    </p>
                  </div>
                  <div className="text-sm text-dash-secondary">
                    <p className="capitalize">{request.role || 'staff'}</p>
                    <p className="mt-1 text-dash-tertiary">
                      {request.status === 'pending_manager'
                        ? 'Both employees approved'
                        : request.reviewed_by_name
                          ? `Reviewed by ${request.reviewed_by_name}`
                          : 'Audit record retained'}
                    </p>
                  </div>
                  {request.status === 'pending_manager' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void reviewShiftTradeRequest(request.id, 'approved')}
                        className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void reviewShiftTradeRequest(request.id, 'denied')}
                        className="rounded-xl border border-red-400/30 px-4 py-2 text-sm font-semibold text-red-100 transition hover:border-red-300/70"
                      >
                        Deny
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 px-4 py-2 text-center text-sm capitalize text-dash-secondary">
                      {String(request.status || 'closed').replaceAll('_', ' ')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Employee Requests</h3>
              <p className="mt-1 text-sm text-dash-secondary">Review time off, preferred shifts, availability exceptions, and requested weekly-hour changes.</p>
            </div>
            <button type="button" onClick={() => void loadEmployeeRequests(true)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream">Refresh</button>
          </div>

          <div className="mt-5 space-y-3">
            {employeeRequests.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-dash-secondary">No employee requests yet.</p>
            ) : (
              employeeRequests.map(request => {
                const payload = typeof request.structured_payload === 'object' && request.structured_payload ? request.structured_payload : {}
                const weeklyTarget = payload.requested_weekly_hours || payload.target_hours || payload.weekly_hours
                return (
                  <div key={request.id} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 lg:grid-cols-[1fr_170px_210px] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-dash-cream">{request.waiter_name || 'Employee'}</h4>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs capitalize text-dash-secondary">{String(request.request_type || '').replaceAll('_', ' ')}</span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs capitalize text-dash-secondary">{request.priority || 'normal'}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${request.status === 'pending' ? 'bg-amber-300/15 text-amber-100' : request.status === 'approved' ? 'bg-emerald-300/15 text-emerald-100' : 'bg-white/[0.06] text-dash-secondary'}`}>{request.status || 'pending'}</span>
                      </div>
                      <p className="mt-2 text-sm text-dash-secondary">
                        {request.title || request.notes || 'Scheduling request'}
                        {weeklyTarget ? ` · Requested ${weeklyTarget} hrs/week` : ''}
                      </p>
                      <p className="mt-1 text-xs text-dash-tertiary">
                        {[request.start_date, request.end_date && request.end_date !== request.start_date ? request.end_date : null].filter(Boolean).join(' to ') || 'No date'}
                        {request.start_time ? ` · ${formatDisplayTime(request.start_time)}-${formatDisplayTime(request.end_time)}` : ''}
                      </p>
                    </div>
                    <div className="text-sm text-dash-secondary">
                      <p>{request.waiter_role || 'staff'}</p>
                      <p className="mt-1 text-dash-tertiary">Current target: {request.current_suggested_weekly_hours ?? 'unset'} hrs</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void reviewEmployeeRequest(request.id, 'approved')}
                        disabled={request.status === 'approved'}
                        className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void reviewEmployeeRequest(request.id, 'denied')}
                        disabled={request.status === 'denied'}
                        className="rounded-xl border border-red-400/30 px-4 py-2 text-sm font-semibold text-red-100 transition hover:border-red-300/70 disabled:opacity-40"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
        </div>
      )}

      {activeSchedulingTab === 'config' && (
        <div className="space-y-4">
        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <h3 className="text-lg font-semibold">Coverage Blocks</h3>
                <p className="mt-1 text-xs text-dash-tertiary">
                  {coverageBlocks.length
                    ? `${coverageBlocks.length} saved block${coverageBlocks.length === 1 ? '' : 's'}. Drag blocks to move them or pull the bottom edge to resize.`
                    : 'Default coverage will be generated from restaurant hours, then saved here.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void regenerateCoverageDefaults()} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream">Re-calculate suggestions</button>
                <button type="button" onClick={() => startNewBlock()} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream">New block</button>
              </div>
            </div>
            <div className="grid border-b border-white/10" style={{ gridTemplateColumns: `${COVERAGE_TIME_AXIS_WIDTH}px repeat(7, minmax(92px, 1fr))` }}>
              <div className="border-r border-white/10 px-3 py-3 text-xs font-semibold text-dash-tertiary">Time</div>
              {SCHEDULING_DAYS.map(day => <div key={day} className="border-r border-white/10 px-3 py-3 text-sm font-semibold text-dash-secondary last:border-r-0">{day}</div>)}
            </div>
            <div
              ref={coverageCalendarRef}
              className="relative max-h-[620px] overflow-auto"
              style={{ minHeight: Math.min(calendarHeight, 620) }}
            >
              <div
                className="relative min-w-[760px]"
                style={{
                  height: calendarHeight,
                  display: 'grid',
                  gridTemplateColumns: `${COVERAGE_TIME_AXIS_WIDTH}px repeat(7, minmax(92px, 1fr))`,
                }}
              >
                <div className="relative border-r border-white/10 bg-black/10">
                  {timelineHours.map(minute => (
                    <div
                      key={minute}
                      className="absolute left-0 right-0 -translate-y-2 px-3 text-right font-mono text-[11px] text-dash-tertiary"
                      style={{ top: ((minute - calendarBounds.start) / 60) * COVERAGE_PIXELS_PER_HOUR }}
                    >
                      {formatDisplayTime(minute)}
                    </div>
                  ))}
                </div>
                {SCHEDULING_DAYS.map((day, dayIndex) => (
                  <div
                    key={day}
                    role="presentation"
                    onPointerDown={event => startCreateCoverageDrag(event, dayIndex)}
                    className="relative border-r border-white/10 last:border-r-0"
                  >
                    {timelineHours.map(minute => (
                      <div
                        key={minute}
                        className="pointer-events-none absolute left-0 right-0 border-t border-white/[0.055]"
                        style={{ top: ((minute - calendarBounds.start) / 60) * COVERAGE_PIXELS_PER_HOUR }}
                      />
                    ))}
                    {renderedBlocksForDay(dayIndex).map(block => {
                      const start = timeToMinutes(block.start_time, calendarBounds.start)
                      const end = timeToMinutes(block.end_time, start + 60)
                      const top = ((start - calendarBounds.start) / 60) * COVERAGE_PIXELS_PER_HOUR
                      const height = Math.max(28, ((end - start) / 60) * COVERAGE_PIXELS_PER_HOUR)
                      const isDraft = block.is_draft
                      const isSelected = coverageForm.key && block.key === coverageForm.key
                      return (
                        <div
                          key={block.key || `${dayIndex}-${block.start_time}-${block.end_time}`}
                          role="button"
                          tabIndex={0}
                          onPointerDown={event => startMoveCoverageDrag(event, block)}
                          onContextMenu={event => {
                            event.preventDefault()
                            event.stopPropagation()
                            if (!block.is_suggested && !block.is_draft) {
                              setCoverageMenu({
                                x: event.clientX,
                                y: event.clientY,
                                form: blockToForm(block),
                              })
                            }
                          }}
                          onClick={event => {
                            event.stopPropagation()
                            setCoverageForm(blockToForm(block))
                          }}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') setCoverageForm(blockToForm(block))
                          }}
                          className={`absolute left-2 right-2 cursor-grab overflow-hidden rounded-xl border px-3 py-2 text-left text-xs shadow-lg transition active:cursor-grabbing ${
                            isDraft
                              ? 'border-dashed border-dash-gold bg-dash-gold/15'
                              : block.is_suggested
                                ? 'border-dashed border-white/25 bg-white/[0.045] hover:border-dash-gold/60'
                                : isSelected
                                  ? 'border-dash-gold bg-dash-gold/20'
                                  : 'border-emerald-300/30 bg-emerald-300/12 hover:border-emerald-200/70'
                          }`}
                          style={{ top, height }}
                        >
                          <p className="font-semibold text-dash-cream">{formatDisplayTime(block.start_time)}-{formatDisplayTime(block.end_time)}</p>
                          <p className="mt-1 truncate text-dash-secondary">{roleSummary(block.roles)}</p>
                          <p className="mt-1 text-dash-tertiary">{isDraft ? 'New block' : block.is_suggested ? 'Suggested default' : block.is_prime_shift ? 'High demand' : 'Standard'}</p>
                          {!isDraft && (
                            <span
                              role="presentation"
                              onPointerDown={event => startResizeCoverageDrag(event, block)}
                              className="absolute inset-x-2 bottom-1 h-3 cursor-ns-resize rounded-full border-t border-white/25"
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
              {coverageMenu && (
                <div
                  className="fixed z-50 w-32 overflow-hidden rounded-xl border border-white/10 bg-[#151412] p-1 shadow-2xl"
                  style={{ left: coverageMenu.x, top: coverageMenu.y }}
                  onClick={event => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => void deleteCoverageBlockByForm(coverageMenu.form)}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-100 transition hover:bg-red-400/15"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <h3 className="text-lg font-semibold">{coverageForm.key ? 'Edit Coverage Block' : 'New Coverage Block'}</h3>
              <div className="mt-4 space-y-3">
                <select
                  value={coverageForm.day_of_week}
                  onChange={event => setCoverageForm(prev => ({ ...prev, day_of_week: Number(event.target.value) }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none"
                >
                  {SCHEDULING_DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <SmartTimeInput value={coverageForm.start_time} onChange={value => setCoverageForm(prev => ({ ...prev, start_time: value }))} ariaLabel="Coverage start" />
                  <SmartTimeInput value={coverageForm.end_time} onChange={value => setCoverageForm(prev => ({ ...prev, end_time: value }))} ariaLabel="Coverage end" />
                </div>
                <label className="flex items-center gap-2 text-sm text-dash-secondary">
                  <input type="checkbox" checked={coverageForm.is_prime_shift} onChange={event => setCoverageForm(prev => ({ ...prev, is_prime_shift: event.target.checked }))} />
                  High-demand block
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {COVERAGE_ROLES.map(role => (
                    <label key={role} className="space-y-1">
                      <span className="text-xs text-dash-tertiary">{ROLE_LABELS[role]}</span>
                      <input
                        type="number"
                        min="0"
                        value={coverageForm.roles[role] ?? ''}
                        onChange={event => setCoverageForm(prev => ({
                          ...prev,
                          roles: { ...prev.roles, [role]: event.target.value },
                        }))}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary"
                      />
                    </label>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={coverageForm.notes}
                  onChange={event => setCoverageForm(prev => ({ ...prev, notes: event.target.value }))}
                  placeholder="Notes optional"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary"
                />
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => void saveCoverageBlock()} className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90">Save block</button>
                  <button
                    type="button"
                    onClick={() => {
                      const savedBlock = displayedBlocks.find(block => block.key === coverageForm.key)
                      setCoverageForm(savedBlock ? blockToForm(savedBlock) : emptyCoverageBlockForm)
                      setStatus('Changes discarded.')
                    }}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteCoverageBlock()}
                    disabled={!coverageForm.original_start_time || coverageForm.is_suggested}
                    className="rounded-xl border border-red-400/30 px-4 py-2 text-sm font-semibold text-red-100 transition hover:border-red-300/70 disabled:opacity-35"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <h3 className="text-lg font-semibold">Manager LLM Input</h3>
              <textarea
                value={note}
                onChange={event => setNote(event.target.value)}
                rows={5}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-dash-gold/70"
                placeholder="Friday dinner needs 5 servers and 2 hosts. Cameron cannot work Saturday close."
              />
              <button
                type="button"
                onClick={() => void saveManagerNote()}
                disabled={!note.trim()}
                className="mt-3 w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
              >
                Parse note
              </button>
              {noteStatus && (
                <p
                  className={`mt-2 rounded-xl border px-3 py-2 text-xs leading-5 ${
                    noteStatusKind === 'success'
                      ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                      : noteStatusKind === 'error'
                        ? 'border-red-300/25 bg-red-300/10 text-red-100'
                        : 'border-white/10 bg-white/[0.025] text-dash-tertiary'
                  }`}
                >
                  {noteStatus}
                </p>
              )}
            </div>

            {requestPolicy && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h3 className="text-lg font-semibold">Request Limits</h3>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    ['critical_priority_limit', 'Critical'],
                    ['high_priority_limit', 'High'],
                    ['normal_priority_limit', 'Normal'],
                    ['low_priority_limit', 'Low'],
                  ].map(([field, label]) => (
                    <label key={field} className="space-y-1">
                      <span className="text-xs text-dash-tertiary">{label}</span>
                      <input
                        type="number"
                        min="0"
                        value={requestPolicy[field] ?? ''}
                        onChange={event => setRequestPolicy(prev => ({
                          ...prev,
                          [field]: event.target.value === '' ? null : Number(event.target.value),
                        }))}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-dash-cream">Shift Transfers</h4>
                    <p className="mt-1 text-xs leading-5 text-dash-tertiary">Controls employee-to-employee full-shift transfer requests.</p>
                  </div>
                  {[
                    ['enabled', 'Allow shift trade requests'],
                    ['allow_employee_to_employee_trades', 'Employees can choose coworkers'],
                  ].map(([field, label]) => (
                    <label key={field} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-sm text-dash-secondary">
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(shiftTradePolicy[field])}
                        onChange={event => setRequestPolicy(prev => ({
                          ...prev,
                          manager_settings: {
                            ...(prev?.manager_settings || {}),
                            shift_trades: {
                              ...DEFAULT_SHIFT_TRADE_POLICY,
                              ...(prev?.manager_settings?.shift_trades || {}),
                              [field]: event.target.checked,
                            },
                          },
                        }))}
                      />
                    </label>
                  ))}
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-sm text-dash-secondary">
                    <span>Manager final approval</span>
                    <span className="font-semibold text-emerald-200">Required</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={discardRequestPolicy} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream">Cancel</button>
                  <button type="button" onClick={() => void saveRequestPolicy()} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream">Save limits</button>
                </div>
              </div>
            )}
          </aside>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Optimization Weights</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-dash-secondary">
                Tune how strongly the draft scheduler balances coverage, target hours, requests, preferences, fairness, and prime-shift spread.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={discardRequestPolicy} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream">Cancel</button>
              <button type="button" onClick={() => void saveRequestPolicy()} className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90">Save weights</button>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {OPTIMIZATION_WEIGHT_FIELDS.map(([field, label]) => (
              <label key={field} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-dash-cream">{label}</span>
                  <span className="font-mono text-sm text-dash-secondary">{Number(optimizationWeights[field] ?? 1).toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={optimizationWeights[field] ?? 1}
                  onChange={event => setOptimizationWeights(prev => ({ ...prev, [field]: Number(event.target.value) }))}
                  className="mt-4 w-full accent-[rgb(var(--gold))]"
                />
              </label>
            ))}
          </div>
        </section>
        </div>
      )}
    </div>
  )
}

const EMPLOYEE_PORTAL_TABS = [
  { id: 'home', label: 'Home' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'more', label: 'More' },
]

const EMPLOYEE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const EMPLOYEE_DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const EMPLOYEE_REASON_OPTIONS = [
  'School',
  'Family',
  'Second job',
  'Commute',
  'Health',
  'Preferred routine',
]

const emptyEmployeeAvailabilityForm = {
  day_of_week: 0,
  recurrence: 'recurring',
  date: '',
  start_time: '10:00',
  end_time: '17:00',
  availability_type: 'available',
  reason: '',
  note: '',
}

const emptyEmployeeTimeOffForm = {
  start_date: '',
  end_date: '',
  priority: 'normal',
  title: 'Time off',
  notes: '',
}

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00`)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return date
}

function addDays(value, count) {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + count)
  return date
}

function formatEmployeeTime(value) {
  if (!value) return ''
  const [hourPart, minutePart = '00'] = String(value).slice(0, 5).split(':')
  const hour = Number(hourPart)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const twelve = hour % 12 || 12
  return `${twelve}:${minutePart} ${suffix}`
}

function shiftDurationHours(shift) {
  if (!shift?.shift_start || !shift?.shift_end) return 0
  const [startHour, startMinute] = String(shift.shift_start).slice(0, 5).split(':').map(Number)
  const [endHour, endMinute] = String(shift.shift_end).slice(0, 5).split(':').map(Number)
  let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute)
  if (minutes < 0) minutes += 24 * 60
  return minutes / 60
}

function groupShiftsByDate(shifts) {
  return shifts.reduce((acc, shift) => {
    const key = String(shift.shift_date)
    acc[key] = [...(acc[key] || []), shift]
    return acc
  }, {})
}

function greetingForNow() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function contactName(contact) {
  return [contact?.name, contact?.role ? `(${contact.role})` : ''].filter(Boolean).join(' ')
}

function conversationDisplayName(conversation, profile) {
  if (conversation?.title) return conversation.title
  const members = Array.isArray(conversation?.members) ? conversation.members : []
  const others = members.filter(member => String(member.id) !== String(profile?.waiter_id))
  if (others.length === 0) return 'Staff chat'
  return others.map(member => member.name).join(', ')
}

function EmployeePortal() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('shire_employee_profile') || 'null')
    } catch {
      return null
    }
  })
  const [weekSchedule, setWeekSchedule] = useState({ mine: [], all: [] })
  const [tradeRequests, setTradeRequests] = useState([])
  const [tradeView, setTradeView] = useState('needs_you')
  const [selectedTradeShift, setSelectedTradeShift] = useState(null)
  const [targetWaiterId, setTargetWaiterId] = useState('')
  const [tradeReason, setTradeReason] = useState('')
  const [requests, setRequests] = useState([])
  const [availability, setAvailability] = useState([])
  const [contacts, setContacts] = useState([])
  const [earnings, setEarnings] = useState(null)
  const [conversations, setConversations] = useState([])
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [conversationMessages, setConversationMessages] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [activeEmployeeTab, setActiveEmployeeTab] = useState('home')
  const [scheduleScope, setScheduleScope] = useState('mine')
  const [messageSubtab, setMessageSubtab] = useState('messages')
  const [morePage, setMorePage] = useState('')
  const [weekStart, setWeekStart] = useState(() => toDateKey(startOfWeek()))
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const [touchStartX, setTouchStartX] = useState(null)
  const scheduleListRef = useRef(null)
  const scheduleDayRefs = useRef({})
  const [availabilityForm, setAvailabilityForm] = useState(emptyEmployeeAvailabilityForm)
  const [timeOffForm, setTimeOffForm] = useState(emptyEmployeeTimeOffForm)
  const [messageText, setMessageText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const token = localStorage.getItem('shire_employee_token')

  const employeeFetch = async (endpoint, options = {}) => {
    const headers = new Headers(options.headers || {})
    headers.set('Content-Type', 'application/json')
    headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, { ...options, headers })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.detail || body.message || `Request failed (${response.status})`)
    }
    return response.json()
  }

  useEffect(() => {
    if (!token) return
    let cancelled = false
    Promise.all([
      employeeFetch('/employee/me'),
      employeeFetch('/employee/requests'),
      employeeFetch('/employee/availability'),
      employeeFetch('/employee/contacts'),
      employeeFetch('/employee/earnings/biweekly'),
      employeeFetch('/employee/messages/conversations'),
      employeeFetch('/employee/announcements'),
      employeeFetch('/employee/shift-trades?scope=all'),
    ])
      .then(([me, requestData, availabilityData, contactData, earningsData, conversationData, announcementData, tradeData]) => {
        if (cancelled) return
        setProfile(me)
        setRequests(requestData)
        setAvailability(availabilityData)
        setContacts(contactData)
        setEarnings(earningsData)
        setConversations(conversationData)
        setAnnouncements(announcementData)
        setTradeRequests(Array.isArray(tradeData) ? tradeData : [])
        if (conversationData[0]?.id) setSelectedConversationId(String(conversationData[0].id))
      })
      .catch(err => {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Could not load employee portal')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    Promise.all([
      employeeFetch(`/employee/schedule/week?week_start=${weekStart}&scope=mine`),
      employeeFetch(`/employee/schedule/week?week_start=${weekStart}&scope=all`),
    ])
      .then(([mine, all]) => {
        if (cancelled) return
        setWeekSchedule({ mine: mine.items || [], all: all.items || [] })
      })
      .catch(err => {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Could not load schedule')
      })
    return () => {
      cancelled = true
    }
  }, [token, weekStart])

  useEffect(() => {
    if (!token || !selectedConversationId) {
      setConversationMessages([])
      return
    }
    let cancelled = false
    employeeFetch(`/employee/messages/conversations/${selectedConversationId}/messages`)
      .then(data => {
        if (!cancelled) setConversationMessages(Array.isArray(data) ? data : [])
      })
      .catch(err => {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Could not load messages')
      })
    return () => {
      cancelled = true
    }
  }, [token, selectedConversationId])

  useEffect(() => {
    if (activeEmployeeTab !== 'schedule') return
    const frame = requestAnimationFrame(() => {
      scheduleDayRefs.current[selectedDate]?.scrollIntoView({
        block: 'start',
        behavior: 'smooth',
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [activeEmployeeTab, scheduleScope, selectedDate, weekStart])

  useEffect(() => {
    if (!token || activeEmployeeTab !== 'schedule') return
    const interval = window.setInterval(() => {
      Promise.all([
        employeeFetch(`/employee/schedule/week?week_start=${weekStart}&scope=mine`),
        employeeFetch(`/employee/schedule/week?week_start=${weekStart}&scope=all`),
        employeeFetch('/employee/shift-trades?scope=all'),
      ])
        .then(([mine, all, tradeData]) => {
          setWeekSchedule({ mine: mine.items || [], all: all.items || [] })
          setTradeRequests(Array.isArray(tradeData) ? tradeData : [])
        })
        .catch(() => undefined)
    }, 15_000)
    return () => window.clearInterval(interval)
  }, [activeEmployeeTab, token, weekStart])

  if (!token) {
    return <Navigate to="/auth/login" replace />
  }

  const signOut = () => {
    localStorage.removeItem('shire_employee_token')
    localStorage.removeItem('shire_employee_profile')
    navigate('/auth/login', { replace: true })
  }

  const refreshEmployeeData = async () => {
    const [requestData, availabilityData, contactData, earningsData, conversationData, announcementData, tradeData] = await Promise.all([
      employeeFetch('/employee/requests'),
      employeeFetch('/employee/availability'),
      employeeFetch('/employee/contacts'),
      employeeFetch('/employee/earnings/biweekly'),
      employeeFetch('/employee/messages/conversations'),
      employeeFetch('/employee/announcements'),
      employeeFetch('/employee/shift-trades?scope=all'),
    ])
    setRequests(requestData)
    setAvailability(availabilityData)
    setContacts(contactData)
    setEarnings(earningsData)
    setConversations(conversationData)
    setAnnouncements(announcementData)
    setTradeRequests(Array.isArray(tradeData) ? tradeData : [])
  }

  const saveAvailability = async (nextAvailability = availability) => {
    setIsSaving(true)
    setMessage('')
    try {
      const saved = await employeeFetch('/employee/availability', {
        method: 'PUT',
        body: JSON.stringify(nextAvailability.map(entry => ({
          day_of_week: Number(entry.day_of_week),
          start_time: String(entry.start_time).slice(0, 5),
          end_time: String(entry.end_time).slice(0, 5),
          availability_type: entry.availability_type,
          effective_from: entry.effective_from || null,
          effective_until: entry.effective_until || null,
          notes: entry.notes || null,
        }))),
      })
      setAvailability(saved)
      setMessage('Availability saved.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save availability')
    } finally {
      setIsSaving(false)
    }
  }

  const submitAvailability = async () => {
    const note = availabilityForm.note.trim()
    const reason = availabilityForm.reason.trim()
    if (!reason && !note) {
      setMessage('Choose a reason or add a note before saving availability.')
      return
    }
    const nextEntry = {
      day_of_week: Number(availabilityForm.day_of_week),
      start_time: availabilityForm.start_time,
      end_time: availabilityForm.end_time,
      availability_type: availabilityForm.availability_type === 'not_available' ? 'unavailable' : 'available',
      effective_from: availabilityForm.recurrence === 'one_time' ? availabilityForm.date || null : null,
      effective_until: availabilityForm.recurrence === 'one_time' ? availabilityForm.date || null : null,
      notes: [reason, note].filter(Boolean).join(' · '),
    }
    const nextAvailability = [...availability, nextEntry]
    await saveAvailability(nextAvailability)
    if (note) {
      try {
        const created = await employeeFetch('/employee/requests/parse', {
          method: 'POST',
          body: JSON.stringify({ raw_text: note }),
        })
        setRequests(prev => [created, ...prev])
      } catch {
        await createRequest({
          request_type: 'availability_exception',
          priority: 'normal',
          start_date: nextEntry.effective_from,
          end_date: nextEntry.effective_until,
          day_of_week: nextEntry.day_of_week,
          start_time: nextEntry.start_time,
          end_time: nextEntry.end_time,
          title: 'Availability note',
          notes: note,
          structured_payload: { source: 'employee_availability_note' },
        })
      }
    }
    setAvailabilityForm(emptyEmployeeAvailabilityForm)
  }

  const removeAvailability = async (index) => {
    const nextAvailability = availability.filter((_, itemIndex) => itemIndex !== index)
    setAvailability(nextAvailability)
    await saveAvailability(nextAvailability)
  }

  const createRequest = async (payload) => {
    setIsSaving(true)
    setMessage('')
    try {
      const created = await employeeFetch('/employee/requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setRequests(prev => [created, ...prev])
      setMessage('Request submitted.')
      return created
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not submit request')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const submitTimeOff = async () => {
    const created = await createRequest({
      request_type: 'time_off',
      priority: timeOffForm.priority,
      start_date: timeOffForm.start_date || null,
      end_date: timeOffForm.end_date || timeOffForm.start_date || null,
      title: timeOffForm.title || 'Time off',
      notes: timeOffForm.notes || null,
      structured_payload: { source: 'employee_time_off_page' },
    })
    if (created) setTimeOffForm(emptyEmployeeTimeOffForm)
  }

  const sendMessage = async () => {
    if (!selectedConversationId || !messageText.trim()) return
    const body = messageText.trim()
    setMessageText('')
    try {
      const sent = await employeeFetch(`/employee/messages/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      setConversationMessages(prev => [...prev, sent])
      const nextConversations = await employeeFetch('/employee/messages/conversations')
      setConversations(nextConversations)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not send message')
    }
  }

  const refreshEmployeeSchedule = async () => {
    const [mine, all, tradeData] = await Promise.all([
      employeeFetch(`/employee/schedule/week?week_start=${weekStart}&scope=mine`),
      employeeFetch(`/employee/schedule/week?week_start=${weekStart}&scope=all`),
      employeeFetch('/employee/shift-trades?scope=all'),
    ])
    setWeekSchedule({ mine: mine.items || [], all: all.items || [] })
    setTradeRequests(Array.isArray(tradeData) ? tradeData : [])
  }

  const openTradeModal = (shift) => {
    const firstTarget = contacts.find(contact => !contact.is_me)
    setSelectedTradeShift(shift)
    setTargetWaiterId(firstTarget ? String(firstTarget.id) : '')
    setTradeReason('')
    setMessage('')
  }

  const submitTradeRequest = async () => {
    if (!selectedTradeShift || !targetWaiterId) {
      setMessage('Choose a coworker before sending the transfer.')
      return
    }
    setIsSaving(true)
    setMessage('')
    try {
      const created = await employeeFetch('/employee/shift-trades', {
        method: 'POST',
        body: JSON.stringify({
          schedule_item_id: selectedTradeShift.id,
          target_waiter_id: targetWaiterId,
          reason: tradeReason.trim() || null,
        }),
      })
      setTradeRequests(prev => [created, ...prev])
      setTradeView('in_progress')
      setSelectedTradeShift(null)
      setMessage('Shift transfer sent. Your coworker must accept it before a manager can approve it.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not send shift transfer')
    } finally {
      setIsSaving(false)
    }
  }

  const respondToTrade = async (trade, status) => {
    setIsSaving(true)
    setMessage('')
    try {
      const updated = await employeeFetch(`/employee/shift-trades/${trade.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setTradeRequests(prev => prev.map(item => String(item.id) === String(updated.id) ? updated : item))
      if (status === 'approved') {
        setTradeView('in_progress')
        setMessage('Accepted. This transfer is now waiting for manager approval.')
      } else {
        setTradeView('history')
        setMessage(status === 'cancelled' ? 'Shift transfer cancelled.' : 'Shift transfer denied.')
      }
      await refreshEmployeeSchedule()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not update shift transfer')
      await employeeFetch('/employee/shift-trades?scope=all')
        .then(data => setTradeRequests(Array.isArray(data) ? data : []))
        .catch(() => undefined)
    } finally {
      setIsSaving(false)
    }
  }

  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const todayKey = toDateKey(new Date())
  const scopedShifts = scheduleScope === 'mine' ? weekSchedule.mine : weekSchedule.all
  const shiftsByDate = groupShiftsByDate(scopedShifts)
  const todayShifts = weekSchedule.mine.filter(shift => String(shift.shift_date) === todayKey)
  const upcomingMine = weekSchedule.mine
    .filter(shift => String(shift.shift_date) >= todayKey)
    .slice(0, 5)
  const totalWeekHours = weekSchedule.mine.reduce((sum, shift) => sum + shiftDurationHours(shift), 0)
  const employeeLaborCost = firstPresent(earnings?.actual_labor_cost, earnings?.labor_cost, earnings?.estimated_wages)
  const selectedConversation = conversations.find(item => String(item.id) === String(selectedConversationId))
  const currentWaiterId = String(profile?.waiter_id || profile?.id || '')
  const eligibleTradeTargets = contacts.filter(contact => !contact.is_me && String(contact.id) !== currentWaiterId)
  const isActiveTrade = trade => ['pending_target', 'pending_manager'].includes(String(trade.status))
  const activeTradeShiftIds = new Set(
    tradeRequests.filter(isActiveTrade).map(trade => String(trade.schedule_item_id))
  )
  const needsTradeApprovalCount = tradeRequests.filter(trade => (
    trade.status === 'pending_target' && String(trade.target_waiter_id) === currentWaiterId
  )).length
  const inProgressTradeCount = tradeRequests.filter(trade => (
    isActiveTrade(trade)
    && !(trade.status === 'pending_target' && String(trade.target_waiter_id) === currentWaiterId)
  )).length
  const visibleTradeRequests = tradeRequests.filter(trade => {
    if (tradeView === 'needs_you') {
      return trade.status === 'pending_target' && String(trade.target_waiter_id) === currentWaiterId
    }
    if (tradeView === 'in_progress') {
      return isActiveTrade(trade)
        && !(trade.status === 'pending_target' && String(trade.target_waiter_id) === currentWaiterId)
    }
    return !isActiveTrade(trade)
  })

  const canTransferShift = (shift) => {
    if (scheduleScope !== 'mine' || shift.schedule_status !== 'published') return false
    const startsAt = new Date(`${shift.shift_date}T${String(shift.shift_start).slice(0, 8)}`)
    return startsAt > new Date()
  }

  const moveWeek = (direction) => {
    const nextWeekStart = toDateKey(addDays(weekStart, direction * 7))
    setWeekStart(nextWeekStart)
    setSelectedDate(nextWeekStart)
  }

  const handleScheduleTouchEnd = (event) => {
    if (touchStartX === null) return
    const delta = event.changedTouches[0].clientX - touchStartX
    if (Math.abs(delta) > 60) moveWeek(delta < 0 ? 1 : -1)
    setTouchStartX(null)
  }

  return (
    <main className="min-h-screen bg-dash-base px-4 py-6 text-dash-cream md:px-6">
      <div className="mx-auto max-w-4xl space-y-5 pb-24">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="label-mono">Employee Portal</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{greetingForNow()}, {profile?.name || 'there'}</h1>
            <p className="mt-2 text-dash-secondary">
              {todayShifts.length === 0
                ? 'You have the day off, enjoy!'
                : `You have work from ${formatEmployeeTime(todayShifts[0].shift_start)} to ${formatEmployeeTime(todayShifts[todayShifts.length - 1].shift_end)}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-dash-secondary transition hover:border-white/20 hover:text-dash-cream"
          >
            Sign out
          </button>
        </header>

        {message && <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm text-dash-secondary">{message}</div>}

        {activeEmployeeTab === 'home' && (
          <div className="space-y-5">
            <section className="rounded-2xl border border-dash-gold/30 bg-dash-gold/10 p-5">
              <p className="label-mono">Today</p>
              <h2 className="mt-2 text-2xl font-semibold">
                {todayShifts.length === 0 ? 'Day off' : `${formatEmployeeTime(todayShifts[0].shift_start)} - ${formatEmployeeTime(todayShifts[todayShifts.length - 1].shift_end)}`}
              </h2>
              <p className="mt-2 text-sm text-dash-secondary">
                {todayShifts.length === 0
                  ? 'No shift is assigned to you today.'
                  : todayShifts.map(shift => `${shift.role || shift.waiter_role || 'Staff'} ${formatEmployeeTime(shift.shift_start)}-${formatEmployeeTime(shift.shift_end)}`).join(' · ')}
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Your upcoming shifts</h2>
                <button type="button" onClick={() => setActiveEmployeeTab('schedule')} className="text-sm font-semibold text-dash-gold">View all</button>
              </div>
              {upcomingMine.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-white/15 p-4 text-sm text-dash-secondary">Nobody here!</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {upcomingMine.map(shift => (
                    <div key={shift.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm">
                      <p className="font-semibold">{new Date(`${shift.shift_date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                      <p className="mt-1 text-dash-secondary">{formatEmployeeTime(shift.shift_start)} - {formatEmployeeTime(shift.shift_end)} · {shift.role || shift.waiter_role || 'Staff'}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:grid-cols-3">
              <div>
                <p className="label-mono">Biweekly wages</p>
                <p className="mt-2 text-2xl font-semibold">{employeeLaborCost == null ? 'Unset' : `$${Number(employeeLaborCost).toFixed(2)}`}</p>
                <p className="mt-1 text-xs text-dash-tertiary">
                  {earnings?.actual?.open_punches
                    ? earnings.wage_status
                    : earnings?.has_missing_labor_rate
                      ? 'Some role rates are missing.'
                      : earnings?.wage_status || 'Using clocked time and role rates when configured.'}
                </p>
              </div>
              <div>
                <p className="label-mono">Shifts</p>
                <p className="mt-2 text-2xl font-semibold">{earnings?.shift_count ?? 0}</p>
                <p className="mt-1 text-xs text-dash-tertiary">{earnings?.actual?.punch_count != null ? `${earnings.actual.punch_count} clocked` : ''}</p>
              </div>
              <div>
                <p className="label-mono">Hours</p>
                <p className="mt-2 text-2xl font-semibold">{Number(earnings?.hours ?? totalWeekHours).toFixed(1)}</p>
                <p className="mt-1 text-xs text-dash-tertiary">{earnings?.actual?.hours != null ? `${Number(earnings.actual.hours).toFixed(1)} clocked` : ''}</p>
              </div>
            </section>
          </div>
        )}

        {activeEmployeeTab === 'schedule' && (
          <section
            className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4"
            onTouchStart={event => setTouchStartX(event.touches[0].clientX)}
            onTouchEnd={handleScheduleTouchEnd}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {[
                  ['mine', 'My shifts'],
                  ['all', 'Schedule'],
                ].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setScheduleScope(id)} className={['rounded-xl px-4 py-2 text-sm font-semibold transition', scheduleScope === id ? 'bg-white text-black' : 'border border-white/10 text-dash-secondary'].join(' ')}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => moveWeek(-1)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-dash-secondary">Prev</button>
                <button type="button" onClick={() => moveWeek(1)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-dash-secondary">Next</button>
              </div>
            </div>
            <div className="space-y-3 border-y border-white/10 py-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="label-mono">Shift transfers</p>
                  <h2 className="mt-1 text-lg font-semibold">Requests inbox</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshEmployeeSchedule()}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-dash-secondary transition hover:border-white/20 hover:text-dash-cream"
                >
                  Refresh
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['needs_you', `Needs you${needsTradeApprovalCount ? ` (${needsTradeApprovalCount})` : ''}`],
                  ['in_progress', `In progress${inProgressTradeCount ? ` (${inProgressTradeCount})` : ''}`],
                  ['history', 'History'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTradeView(id)}
                    className={[
                      'min-w-0 rounded-xl px-2 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm',
                      tradeView === id ? 'bg-white text-black' : 'border border-white/10 text-dash-secondary',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {visibleTradeRequests.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-dash-secondary">
                  No shift transfers in this view.
                </p>
              ) : (
                <div className="space-y-2">
                  {visibleTradeRequests.map(trade => {
                    const needsMyApproval = trade.status === 'pending_target' && String(trade.target_waiter_id) === currentWaiterId
                    const canCancel = isActiveTrade(trade) && String(trade.requesting_waiter_id) === currentWaiterId
                    return (
                      <article key={trade.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {trade.requesting_waiter_name || 'Coworker'} to {trade.target_waiter_name || 'coworker'}
                            </p>
                            <p className="mt-1 text-dash-secondary">
                              {new Date(`${trade.shift_date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              {' · '}{formatEmployeeTime(trade.shift_start)}-{formatEmployeeTime(trade.shift_end)}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-xs capitalize text-dash-tertiary">
                            {String(trade.status).replaceAll('_', ' ')}
                          </span>
                        </div>
                        {trade.reason && <p className="mt-2 text-dash-tertiary">{trade.reason}</p>}
                        {(needsMyApproval || canCancel) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {needsMyApproval && (
                              <>
                                <button type="button" disabled={isSaving} onClick={() => void respondToTrade(trade, 'approved')} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">Accept</button>
                                <button type="button" disabled={isSaving} onClick={() => void respondToTrade(trade, 'denied')} className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-dash-secondary disabled:opacity-50">Deny</button>
                              </>
                            )}
                            {canCancel && (
                              <button type="button" disabled={isSaving} onClick={() => void respondToTrade(trade, 'cancelled')} className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-dash-secondary disabled:opacity-50">Cancel request</button>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((day, index) => {
                const key = toDateKey(day)
                return (
                  <button key={key} type="button" onClick={() => setSelectedDate(key)} className={['rounded-xl border px-2 py-3 text-center text-xs font-semibold transition', key === selectedDate ? 'border-dash-gold bg-dash-gold text-black' : key === todayKey ? 'border-dash-gold/60 text-dash-gold' : 'border-white/10 text-dash-secondary'].join(' ')}>
                    <span className="block">{EMPLOYEE_DAYS_SHORT[index]}</span>
                    <span className="mt-1 block text-base">{day.getDate()}</span>
                  </button>
                )
              })}
            </div>
            <div ref={scheduleListRef} className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
              {weekDates.map(day => {
                const key = toDateKey(day)
                const dayShifts = shiftsByDate[key] || []
                return (
                  <article
                    key={key}
                    ref={element => {
                      if (element) scheduleDayRefs.current[key] = element
                    }}
                    className={['rounded-2xl border p-4', key === selectedDate ? 'border-dash-gold/50 bg-dash-gold/5' : 'border-white/10 bg-white/[0.025]'].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">{day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
                      <span className="text-xs text-dash-tertiary">{dayShifts.length} shift{dayShifts.length === 1 ? '' : 's'}</span>
                    </div>
                    {dayShifts.length === 0 ? (
                      <p className="mt-4 rounded-xl border border-dashed border-white/15 p-4 text-sm text-dash-secondary">Nobody here!</p>
                    ) : (
                      <div className="mt-4 space-y-2">
                        {dayShifts.map(shift => (
                          <div key={shift.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm">
                            <div>
                              <p className="font-semibold">{shift.waiter_name || profile?.name || 'Staff'}</p>
                              <p className="capitalize text-dash-tertiary">{shift.role || shift.waiter_role || 'Staff'}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="text-right text-dash-secondary">{formatEmployeeTime(shift.shift_start)}<br />{formatEmployeeTime(shift.shift_end)}</p>
                              {canTransferShift(shift) && (
                                <button
                                  type="button"
                                  disabled={activeTradeShiftIds.has(String(shift.id))}
                                  onClick={() => openTradeModal(shift)}
                                  className="rounded-xl border border-dash-gold/40 px-3 py-2 text-xs font-semibold text-dash-gold transition hover:bg-dash-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {activeTradeShiftIds.has(String(shift.id)) ? 'Pending' : 'Transfer'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {activeEmployeeTab === 'messaging' && (
          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="flex gap-2">
              {[
                ['messages', 'Messages'],
                ['announcements', 'Announcements'],
              ].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setMessageSubtab(id)} className={['rounded-xl px-4 py-2 text-sm font-semibold transition', messageSubtab === id ? 'bg-white text-black' : 'border border-white/10 text-dash-secondary'].join(' ')}>
                  {label}
                </button>
              ))}
            </div>
            {messageSubtab === 'messages' ? (
              <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                <div className="space-y-3">
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-dash-secondary">
                    Managers add employees to chats. Your active conversations show below.
                  </p>
                  <div className="space-y-2">
                    {conversations.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-dash-secondary">No messages yet.</p>
                    ) : conversations.map(conversation => (
                      <button key={conversation.id} type="button" onClick={() => setSelectedConversationId(String(conversation.id))} className={['w-full rounded-xl border p-3 text-left text-sm transition', String(selectedConversationId) === String(conversation.id) ? 'border-dash-gold/60 bg-dash-gold/10' : 'border-white/10 bg-white/[0.025]'].join(' ')}>
                        <p className="font-semibold">{conversationDisplayName(conversation, profile)}</p>
                        <p className="mt-1 truncate text-xs text-dash-tertiary">{conversation.last_message_preview || 'No messages yet'}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex min-h-[420px] flex-col rounded-xl border border-white/10 bg-white/[0.025]">
                  <div className="border-b border-white/10 p-4">
                    <h2 className="font-semibold">{selectedConversation ? conversationDisplayName(selectedConversation, profile) : 'Select a chat'}</h2>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {conversationMessages.length === 0 ? (
                      <p className="text-sm text-dash-secondary">No messages here yet.</p>
                    ) : conversationMessages.map(item => (
                      <div key={item.id} className={['max-w-[82%] rounded-2xl border p-3 text-sm', item.sender_waiter_id && String(item.sender_waiter_id) === String(profile?.waiter_id) ? 'ml-auto border-dash-gold/40 bg-dash-gold/10' : 'border-white/10 bg-white/[0.035]'].join(' ')}>
                        <p className="text-xs font-semibold text-dash-tertiary">{item.sender_name || 'Manager'}</p>
                        <p className="mt-1">{item.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 border-t border-white/10 p-3">
                    <input value={messageText} onChange={event => setMessageText(event.target.value)} placeholder="Message" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary" />
                    <button type="button" onClick={() => void sendMessage()} disabled={!selectedConversationId || !messageText.trim()} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">Send</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-dash-secondary">No announcements yet.</p>
                ) : announcements.map(item => (
                  <article key={item.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm text-dash-secondary">{item.body}</p>
                    <p className="mt-3 text-xs text-dash-tertiary">{new Date(item.created_at).toLocaleString()}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeEmployeeTab === 'more' && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            {!morePage ? (
              <div className="grid gap-3">
                {[
                  ['availability', 'Availability', 'Set recurring or one-time availability.'],
                  ['time_off', 'Time off', 'Request vacation or unexcused days off.'],
                  ['contacts', 'Contacts', 'View everyone at this restaurant.'],
                ].map(([id, title, subtitle]) => (
                  <button key={id} type="button" onClick={() => setMorePage(id)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left transition hover:border-dash-gold/50">
                    <h2 className="text-xl font-semibold">{title}</h2>
                    <p className="mt-1 text-sm text-dash-secondary">{subtitle}</p>
                  </button>
                ))}
              </div>
            ) : (
            <div className="space-y-6">
              <button type="button" onClick={() => setMorePage('')} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-dash-secondary">Back</button>
              {morePage === 'availability' && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-semibold">Availability</h2>
                  <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <p className="label-mono mb-2">Day</p>
                      <div className="grid grid-cols-7 gap-2">
                        {EMPLOYEE_DAYS.map((day, index) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setAvailabilityForm(prev => ({ ...prev, day_of_week: index }))}
                            className={[
                              'rounded-xl border px-2 py-3 text-center text-xs font-semibold transition',
                              Number(availabilityForm.day_of_week) === index
                                ? 'border-dash-gold bg-dash-gold text-black'
                                : 'border-white/10 text-dash-secondary hover:border-dash-gold/50 hover:text-dash-cream',
                            ].join(' ')}
                          >
                            <span className="block sm:hidden">{EMPLOYEE_DAYS_SHORT[index]}</span>
                            <span className="hidden sm:block">{day}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <select value={availabilityForm.recurrence} onChange={event => setAvailabilityForm(prev => ({ ...prev, recurrence: event.target.value }))} className="rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none">
                      <option value="recurring">Recurring</option>
                      <option value="one_time">One time</option>
                    </select>
                    {availabilityForm.recurrence === 'one_time' && <input type="date" value={availabilityForm.date} onChange={event => setAvailabilityForm(prev => ({ ...prev, date: event.target.value }))} className="rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none" />}
                    <select value={availabilityForm.availability_type} onChange={event => setAvailabilityForm(prev => ({ ...prev, availability_type: event.target.value }))} className="rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none">
                      <option value="available">Available</option>
                      <option value="not_available">Not available</option>
                    </select>
                    <SmartTimeInput value={availabilityForm.start_time} onChange={value => setAvailabilityForm(prev => ({ ...prev, start_time: value }))} ariaLabel="Availability start" />
                    <SmartTimeInput value={availabilityForm.end_time} onChange={value => setAvailabilityForm(prev => ({ ...prev, end_time: value }))} ariaLabel="Availability end" />
                    <select value={availabilityForm.reason} onChange={event => setAvailabilityForm(prev => ({ ...prev, reason: event.target.value }))} className="rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none">
                      <option value="">Reason dropdown</option>
                      {EMPLOYEE_REASON_OPTIONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                    </select>
                    <textarea value={availabilityForm.note} onChange={event => setAvailabilityForm(prev => ({ ...prev, note: event.target.value }))} rows={3} placeholder="Or describe it naturally" className="rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary md:col-span-2" />
                    <button type="button" onClick={() => void submitAvailability()} disabled={isSaving} className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Save availability</button>
                  </div>
                  <div className="space-y-2">
                    {availability.map((entry, index) => (
                      <div key={entry.id || `${entry.day_of_week}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm">
                        <span>{EMPLOYEE_DAYS[Number(entry.day_of_week)]} · {formatDisplayTime(entry.start_time)}-{formatDisplayTime(entry.end_time)} · {entry.availability_type}</span>
                        <button type="button" onClick={() => void removeAvailability(index)} className="text-red-200">Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {morePage === 'time_off' && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-semibold">Time off</h2>
                  <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-2">
                    <input type="date" value={timeOffForm.start_date} onChange={event => setTimeOffForm(prev => ({ ...prev, start_date: event.target.value }))} className="rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none" />
                    <input type="date" value={timeOffForm.end_date} onChange={event => setTimeOffForm(prev => ({ ...prev, end_date: event.target.value }))} className="rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none" />
                    <select value={timeOffForm.priority} onChange={event => setTimeOffForm(prev => ({ ...prev, priority: event.target.value }))} className="rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none">
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    <input value={timeOffForm.title} onChange={event => setTimeOffForm(prev => ({ ...prev, title: event.target.value }))} className="rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none" />
                    <textarea value={timeOffForm.notes} onChange={event => setTimeOffForm(prev => ({ ...prev, notes: event.target.value }))} rows={3} placeholder="Optional note" className="rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary md:col-span-2" />
                    <button type="button" onClick={() => void submitTimeOff()} disabled={isSaving || !timeOffForm.start_date} className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Submit request</button>
                  </div>
                  <div className="space-y-2">
                    {requests.map(request => (
                      <div key={request.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm">
                        <p className="capitalize font-semibold">{String(request.request_type || '').replaceAll('_', ' ')} · {request.status || 'pending'}</p>
                        <p className="mt-1 text-dash-secondary">{request.title || request.notes || 'Request'} {request.start_date ? `· ${request.start_date}` : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {morePage === 'contacts' && (
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold">Contacts</h2>
                  {contacts.map(contact => (
                    <div key={contact.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm">
                      <p className="font-semibold">{contact.name}{contact.is_me ? ' · You' : ''}</p>
                      <p className="mt-1 capitalize text-dash-secondary">{contact.role || 'Staff'}</p>
                      <p className="mt-1 text-dash-tertiary">{[contact.email, contact.phone].filter(Boolean).join(' · ') || 'No contact detail saved'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </section>
        )}

        {selectedTradeShift && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="shift-transfer-title">
            <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-dash-base p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="label-mono">Shift transfer</p>
                  <h2 id="shift-transfer-title" className="mt-1 text-xl font-semibold">
                    {new Date(`${selectedTradeShift.shift_date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </h2>
                  <p className="mt-1 text-sm text-dash-secondary">
                    {formatEmployeeTime(selectedTradeShift.shift_start)}-{formatEmployeeTime(selectedTradeShift.shift_end)}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedTradeShift(null)} className="h-9 w-9 rounded-full border border-white/10 text-lg text-dash-secondary" aria-label="Close shift transfer">×</button>
              </div>
              <p className="mt-4 text-sm text-dash-secondary">
                Choose one coworker. They must accept the full shift, then a manager gives final approval.
              </p>
              <label className="mt-4 block text-sm font-semibold" htmlFor="shift-transfer-target">Coworker</label>
              <select
                id="shift-transfer-target"
                value={targetWaiterId}
                onChange={event => setTargetWaiterId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-dash-base px-3 py-3 text-sm text-dash-cream outline-none focus:border-dash-gold"
              >
                <option value="">Select a coworker</option>
                {eligibleTradeTargets.map(contact => (
                  <option key={contact.id} value={contact.id}>{contactName(contact)}</option>
                ))}
              </select>
              <label className="mt-4 block text-sm font-semibold" htmlFor="shift-transfer-reason">Reason <span className="font-normal text-dash-tertiary">optional</span></label>
              <textarea
                id="shift-transfer-reason"
                value={tradeReason}
                onChange={event => setTradeReason(event.target.value.slice(0, 500))}
                rows={3}
                placeholder="Add context for your coworker and manager"
                className="mt-2 w-full resize-none rounded-xl border border-white/15 bg-white/[0.035] px-3 py-3 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-dash-gold"
              />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setSelectedTradeShift(null)} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-dash-secondary">Cancel</button>
                <button type="button" disabled={isSaving || !targetWaiterId} onClick={() => void submitTradeRequest()} className="rounded-xl bg-dash-gold px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">
                  {isSaving ? 'Sending...' : 'Send transfer'}
                </button>
              </div>
            </div>
          </div>
        )}

        <nav className="fixed inset-x-4 bottom-4 z-20 mx-auto grid max-w-2xl grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-black/85 p-2 shadow-2xl backdrop-blur">
          {EMPLOYEE_PORTAL_TABS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveEmployeeTab(item.id)
                if (item.id !== 'more') setMorePage('')
              }}
              className={[
                'rounded-xl px-2 py-3 text-xs font-semibold transition sm:text-sm',
                activeEmployeeTab === item.id
                  ? 'bg-dash-gold text-black'
                  : 'text-dash-secondary hover:bg-white/[0.05] hover:text-dash-cream',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </nav>
              </div>
    </main>
  )
}

function ManagerMessagingPanel({ restaurantId }) {
  const [contacts, setContacts] = useState([])
  const [conversations, setConversations] = useState([])
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [conversationMessages, setConversationMessages] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [activeSubtab, setActiveSubtab] = useState('messages')
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  const [selectedNewChatMemberIds, setSelectedNewChatMemberIds] = useState([])
  const [newChatTitle, setNewChatTitle] = useState('')
  const [messageText, setMessageText] = useState('')
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '' })
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const loadMessaging = async () => {
    const [staffRows, conversationRows, announcementRows] = await Promise.all([
      fetchCached(
        queryKeys.waiters(restaurantId),
        () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=false`),
        STALE_TIMES.setup,
      ),
      fetchCached(
        queryKeys.conversations(restaurantId),
        () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/messages/conversations`),
        STALE_TIMES.messaging,
      ),
      fetchCached(
        queryKeys.announcements(restaurantId),
        () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/announcements`),
        STALE_TIMES.messaging,
      ),
    ])
    setContacts(Array.isArray(staffRows) ? staffRows : [])
    setConversations(Array.isArray(conversationRows) ? conversationRows : [])
    setAnnouncements(Array.isArray(announcementRows) ? announcementRows : [])
    if (!selectedConversationId && conversationRows[0]?.id) setSelectedConversationId(String(conversationRows[0].id))
  }

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    loadMessaging().catch(err => {
      if (!cancelled) setStatus(err instanceof Error ? err.message : 'Could not load messaging')
    })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId || !selectedConversationId) {
      setConversationMessages([])
      return
    }
    let cancelled = false
    fetchCached(
      queryKeys.conversationMessages(restaurantId, selectedConversationId),
      () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/messages/conversations/${selectedConversationId}/messages`),
      STALE_TIMES.messaging,
    )
      .then(data => {
        if (!cancelled) setConversationMessages(Array.isArray(data) ? data : [])
      })
      .catch(err => {
        if (!cancelled) setStatus(err instanceof Error ? err.message : 'Could not load messages')
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId, selectedConversationId])

  const selectedConversation = conversations.find(item => String(item.id) === String(selectedConversationId))

  const toggleNewChatMember = (memberId) => {
    setSelectedNewChatMemberIds(prev => (
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    ))
  }

  const resetNewChatForm = () => {
    setIsNewChatOpen(false)
    setSelectedNewChatMemberIds([])
    setNewChatTitle('')
  }

  const createConversation = async () => {
    if (selectedNewChatMemberIds.length === 0) {
      setStatus('Choose at least one employee for the chat.')
      return
    }
    setIsSaving(true)
    setStatus('')
    try {
      const selectedContacts = contacts.filter(item => selectedNewChatMemberIds.includes(String(item.id)))
      const isGroup = selectedNewChatMemberIds.length > 1
      const conversation = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/messages/conversations`, {
        method: 'POST',
        body: JSON.stringify({
          member_ids: selectedNewChatMemberIds,
          conversation_type: isGroup ? 'group' : 'dm',
          title: isGroup
            ? (newChatTitle.trim() || selectedContacts.map(contact => contact.name).join(', '))
            : null,
        }),
      })
      const nextConversations = await fetchCached(
        queryKeys.conversations(restaurantId),
        () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/messages/conversations`),
        0,
      )
      setConversations(nextConversations)
      setSelectedConversationId(String(conversation.id))
      resetNewChatForm()
      setActiveSubtab('messages')
      setStatus(`${isGroup ? 'Group chat' : 'DM'} opened.`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not start message')
    } finally {
      setIsSaving(false)
    }
  }

  const sendMessage = async () => {
    if (!selectedConversationId || !messageText.trim()) return
    const body = messageText.trim()
    setMessageText('')
    try {
      const sent = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/messages/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      setConversationMessages(prev => [...prev, sent])
      queryClient.setQueryData(
        queryKeys.conversationMessages(restaurantId, selectedConversationId),
        prev => Array.isArray(prev) ? [...prev, sent] : prev,
      )
      const nextConversations = await fetchCached(
        queryKeys.conversations(restaurantId),
        () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/messages/conversations`),
        0,
      )
      setConversations(nextConversations)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not send message')
    }
  }

  const createAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.body.trim()) {
      setStatus('Announcement needs a title and message.')
      return
    }
    setIsSaving(true)
    setStatus('')
    try {
      await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/announcements`, {
        method: 'POST',
        body: JSON.stringify({
          title: announcementForm.title.trim(),
          body: announcementForm.body.trim(),
          audience: 'all',
        }),
      })
      const nextAnnouncements = await fetchCached(
        queryKeys.announcements(restaurantId),
        () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/announcements`),
        0,
      )
      setAnnouncements(nextAnnouncements)
      setAnnouncementForm({ title: '', body: '' })
      setStatus('Announcement posted.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not post announcement')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
    <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.025] p-6">
      <div>
        <p className="label-mono">Staff Messaging</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Messages</h2>
        <p className="mt-2 text-sm text-dash-secondary">Direct messages, group chats, and restaurant announcements.</p>
      </div>
      {status && <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-dash-secondary">{status}</div>}
      <div className="flex gap-2">
        {[
          ['messages', 'Messages'],
          ['announcements', 'Announcements'],
        ].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setActiveSubtab(id)} className={['rounded-xl px-4 py-2 text-sm font-semibold transition', activeSubtab === id ? 'bg-white text-black' : 'border border-white/10 text-dash-secondary'].join(' ')}>
            {label}
          </button>
        ))}
      </div>

      {activeSubtab === 'messages' ? (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setSelectedNewChatMemberIds([])
                setNewChatTitle('')
                setIsNewChatOpen(true)
              }}
              className="w-full rounded-xl bg-dash-gold px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Start new chat
            </button>
            <div className="space-y-2">
              {conversations.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-dash-secondary">No staff chats yet.</p>
              ) : conversations.map(conversation => (
                <button key={conversation.id} type="button" onClick={() => setSelectedConversationId(String(conversation.id))} className={['w-full rounded-xl border p-3 text-left text-sm transition', String(selectedConversationId) === String(conversation.id) ? 'border-dash-gold/60 bg-dash-gold/10' : 'border-white/10 bg-white/[0.025]'].join(' ')}>
                  <p className="font-semibold">{conversationDisplayName(conversation, null)}</p>
                  <p className="mt-1 truncate text-xs text-dash-tertiary">{conversation.last_message_preview || 'No messages yet'}</p>
                </button>
              ))}
            </div>
          </aside>
          <div className="flex min-h-[520px] flex-col rounded-xl border border-white/10 bg-white/[0.025]">
            <div className="border-b border-white/10 p-4">
              <h3 className="font-semibold">{selectedConversation ? conversationDisplayName(selectedConversation, null) : 'Select a chat'}</h3>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {conversationMessages.length === 0 ? (
                <p className="text-sm text-dash-secondary">No messages here yet.</p>
              ) : conversationMessages.map(item => (
                <div key={item.id} className={['max-w-[82%] rounded-2xl border p-3 text-sm', item.sender_user_id ? 'ml-auto border-dash-gold/40 bg-dash-gold/10' : 'border-white/10 bg-white/[0.035]'].join(' ')}>
                  <p className="text-xs font-semibold text-dash-tertiary">{item.sender_name || 'Manager'}</p>
                  <p className="mt-1">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 border-t border-white/10 p-3">
              <input value={messageText} onChange={event => setMessageText(event.target.value)} placeholder="Message" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary" />
              <button type="button" onClick={() => void sendMessage()} disabled={!selectedConversationId || !messageText.trim()} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">Send</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <input value={announcementForm.title} onChange={event => setAnnouncementForm(prev => ({ ...prev, title: event.target.value }))} placeholder="Announcement title" className="w-full rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary" />
            <textarea value={announcementForm.body} onChange={event => setAnnouncementForm(prev => ({ ...prev, body: event.target.value }))} rows={5} placeholder="Message to staff" className="w-full rounded-xl border border-white/10 bg-dash-base px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary" />
            <button type="button" onClick={() => void createAnnouncement()} disabled={isSaving || !announcementForm.title.trim() || !announcementForm.body.trim()} className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Post announcement</button>
          </div>
          <div className="space-y-3">
            {announcements.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-dash-secondary">No announcements yet.</p>
            ) : announcements.map(item => (
              <article key={item.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-dash-secondary">{item.body}</p>
                <p className="mt-3 text-xs text-dash-tertiary">{new Date(item.created_at).toLocaleString()}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
    {isNewChatOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
        <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-dash-base shadow-2xl">
          <div className="border-b border-white/10 p-5">
            <p className="label-mono">New Chat</p>
            <h3 className="mt-2 text-2xl font-semibold">Choose employees</h3>
            <p className="mt-2 text-sm text-dash-secondary">
              Select one employee for a DM, or multiple employees for a group chat.
            </p>
          </div>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto p-5">
            {selectedNewChatMemberIds.length > 1 && (
              <input
                value={newChatTitle}
                onChange={event => setNewChatTitle(event.target.value)}
                placeholder="Group chat name optional"
                className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-dash-gold/70"
              />
            )}
            {contacts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-dash-secondary">No employees found.</p>
            ) : contacts.map(contact => {
              const selected = selectedNewChatMemberIds.includes(String(contact.id))
              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => toggleNewChatMember(String(contact.id))}
                  className={[
                    'flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left text-sm transition',
                    selected ? 'border-dash-gold/70 bg-dash-gold/10' : 'border-white/10 bg-white/[0.025] hover:border-dash-gold/50',
                  ].join(' ')}
                >
                  <span>
                    <span className="block font-semibold">{contact.name}</span>
                    <span className="block capitalize text-dash-tertiary">{contact.role || 'Staff'}{contact.email ? ` · ${contact.email}` : ''}</span>
                  </span>
                  <span className={['flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold', selected ? 'border-dash-gold bg-dash-gold text-black' : 'border-white/20 text-transparent'].join(' ')}>
                    ✓
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-col gap-2 border-t border-white/10 p-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetNewChatForm}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-white/20 hover:text-dash-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createConversation()}
              disabled={isSaving || selectedNewChatMemberIds.length === 0}
              className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {selectedNewChatMemberIds.length > 1 ? 'Create group chat' : 'Create DM'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

const SETUP_TABS = [
  { id: 'basics', label: 'Basics' },
  { id: 'hours', label: 'Hours' },
  { id: 'capacity', label: 'Capacity / Floor Plan' },
  { id: 'menu', label: 'Menu' },
  { id: 'modifiers', label: 'Modifiers' },
  { id: 'employees', label: 'Employees' },
  { id: 'integrations', label: 'Integrations' },
]

const RESTAURANT_TYPES = [
  { value: 'fine_dining', label: 'Fine Dining' },
  { value: 'casual', label: 'Casual Dining' },
  { value: 'fast_casual', label: 'Fast Casual' },
  { value: 'bar', label: 'Bar / Pub' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'food_truck', label: 'Food Truck' },
]

const CUISINE_TYPES = [
  'American', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai',
  'Indian', 'Mediterranean', 'French', 'Korean', 'Vietnamese', 'Greek',
  'Spanish', 'Middle Eastern', 'Caribbean', 'Southern', 'Seafood', 'Steakhouse',
  'Pizza', 'Burgers', 'Sushi', 'BBQ', 'Vegan', 'Farm-to-Table',
]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DEFAULT_HOURS = DAYS.map((_, day_of_week) => ({
  day_of_week,
  open_time: '09:00',
  close_time: '22:00',
  is_closed: false,
}))

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  )
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-dash-cream outline-none transition placeholder:text-dash-tertiary focus:border-dash-gold/70"
    />
  )
}

function SetupPlaceholder({ title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-dash-secondary">{children}</p>
    </div>
  )
}

function SmallButton({ children, onClick, variant = 'secondary', disabled = false }) {
  const classes = variant === 'primary'
    ? 'bg-dash-gold text-black hover:opacity-90'
    : variant === 'danger'
      ? 'border border-red-400/30 text-red-200 hover:border-red-300/60'
      : 'border border-white/10 text-dash-secondary hover:border-dash-gold/60 hover:text-dash-cream'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${classes}`}
    >
      {children}
    </button>
  )
}

function SetupEmptyState({ title, children, actionLabel, onAction }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-dash-secondary">{children}</p>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
        >
          + {actionLabel}
        </button>
      )}
    </div>
  )
}

function defaultEmployeeId(value) {
  return value.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9_]+/g, '') || ''
}

function normalizeSectionNames(values) {
  const seen = new Set()
  const out = []
  ;['Table', ...(Array.isArray(values) ? values : [])].forEach(raw => {
    const name = String(raw || '').trim().replace(/\s+/g, ' ')
    if (!name) return
    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(key === 'table' ? 'Table' : name)
  })
  return out.length > 0 ? out : ['Table']
}

function RestaurantSetupPanel({ restaurant, restaurantId, auth, setupWarnings, onSetupChanged }) {
  const [activeSetupTab, setActiveSetupTab] = useState('profile')
  const [activeSubTab, setActiveSubTab] = useState('Basics')
  const [profile, setProfile] = useState(() => ({
    name: restaurant.name || '',
    address: restaurant.address || '',
    city: restaurant.city || '',
    state: restaurant.state || '',
    postal_code: restaurant.postal_code || '',
    phone: restaurant.phone || '',
    type: restaurant.type || 'casual',
    seating_capacity: restaurant.seating_capacity || '',
    table_count: restaurant.table_count || '',
  }))
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [waiters, setWaiters] = useState([])
  const [tables, setTables] = useState([])
  const [sections, setSections] = useState(['Table'])
  const [sectionRecords, setSectionRecords] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [setupError, setSetupError] = useState('')
  const [staffForm, setStaffForm] = useState({ name: '', email: '', role: 'server', pin: '1111', employee_login_id: '' })
  const [tableForm, setTableForm] = useState({ table_number: '', capacity: '2', table_type: 'standard', location: 'inside', section_id: '' })
  const [menuForm, setMenuForm] = useState({ name: '', category: '', price: '', cost: '', description: '' })

  useEffect(() => {
    setProfile({
      name: restaurant.name || '',
      address: restaurant.address || '',
      city: restaurant.city || '',
      state: restaurant.state || '',
      postal_code: restaurant.postal_code || '',
      phone: restaurant.phone || '',
      type: restaurant.type || 'casual',
      seating_capacity: restaurant.seating_capacity || '',
      table_count: restaurant.table_count || '',
    })
    setSaveMessage('')
  }, [restaurant.id, restaurant.updated_at])

  const subTabs = useMemo(() => {
    if (activeSetupTab === 'profile') return ['Basics', 'Location', 'Brand']
    if (activeSetupTab === 'operations') return ['Hours', 'Capacity', 'Sections']
    if (activeSetupTab === 'menu') return ['Items', 'Modifiers', 'Imports']
    if (activeSetupTab === 'team') return ['Staff', 'Roles', 'Invites']
    return ['POS', 'Scheduling', 'Reservations']
  }, [activeSetupTab])

  useEffect(() => {
    setActiveSubTab(subTabs[0])
  }, [subTabs])

  const loadSetupData = async () => {
    if (!restaurantId) return
    setSetupError('')
    try {
      const [staffRows, tableRows, sectionRows, menuRows] = await Promise.all([
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=false`),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tables?include_inactive=false`),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/sections`).catch(() => []),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/items`),
      ])
      setWaiters(Array.isArray(staffRows) ? staffRows : [])
      setTables(Array.isArray(tableRows) ? tableRows : [])
      const normalizedSectionRows = Array.isArray(sectionRows) ? sectionRows : []
      setSectionRecords(normalizedSectionRows)
      setSections(normalizeSectionNames(normalizedSectionRows.map(section => section.name)))
      setMenuItems(Array.isArray(menuRows) ? menuRows : [])
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not load setup data.')
    }
  }

  useEffect(() => {
    void loadSetupData()
  }, [restaurantId])

  const saveProfile = async () => {
    setIsSaving(true)
    setSaveMessage('')

    const { data: updatedRestaurant, error } = await supabase
      .from('restaurants')
      .update({
        name: profile.name.trim(),
        address: profile.address.trim() || null,
        city: profile.city.trim() || null,
        state: profile.state.trim() || null,
        postal_code: profile.postal_code.trim() || null,
        phone: profile.phone.trim() || null,
        type: profile.type || 'casual',
        seating_capacity: profile.seating_capacity === '' ? null : Number(profile.seating_capacity),
        table_count: profile.table_count === '' ? null : Number(profile.table_count),
      })
      .eq('id', restaurantId)
      .select()
      .single()

    setIsSaving(false)

    if (error) {
      setSaveMessage(error.message || 'Could not save setup.')
      return
    }

    auth.seedCurrentRestaurant(updatedRestaurant)
    onSetupChanged?.()
    setSaveMessage('Saved.')
  }

  const addStaff = async () => {
    if (!staffForm.name.trim()) {
      setSetupError('Employee name is required.')
      return
    }
    setSetupError('')
    const created = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters`, {
      method: 'POST',
      body: JSON.stringify({
        name: staffForm.name.trim(),
        email: staffForm.email.trim() || null,
        role: staffForm.role,
        pin: staffForm.pin,
        employee_login_id: staffForm.employee_login_id.trim() || defaultEmployeeId(staffForm.name),
      }),
    })
    setWaiters(prev => [...prev, created])
    setStaffForm({ name: '', email: '', role: 'server', pin: '1111', employee_login_id: '' })
    onSetupChanged?.()
  }

  const updateStaff = async (waiterId, updates) => {
    const updated = await fetchWithSupabaseAuth(`/waiters/${waiterId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    setWaiters(prev => prev.map(item => item.id === waiterId ? updated : item))
  }

  const removeStaff = async (waiterId) => {
    await fetchWithSupabaseAuth(`/waiters/${waiterId}`, { method: 'DELETE' })
    setWaiters(prev => prev.filter(item => item.id !== waiterId))
    onSetupChanged?.()
  }

  const addTable = async () => {
    if (!tableForm.table_number.trim()) {
      setSetupError('Table number is required.')
      return
    }
    setSetupError('')
    const created = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tables`, {
      method: 'POST',
      body: JSON.stringify({
        table_number: tableForm.table_number.trim(),
        capacity: Number(tableForm.capacity || 2),
        table_type: tableForm.table_type,
        location: tableForm.location,
        section_id: tableForm.section_id || null,
      }),
    })
    setTables(prev => [...prev, created])
    setTableForm({ table_number: '', capacity: '2', table_type: 'standard', location: 'inside', section_id: tableForm.section_id })
    onSetupChanged?.()
  }

  const saveSections = async () => {
    setIsSaving(true)
    setSetupError('')
    try {
      const saved = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/sections`, {
        method: 'PUT',
        body: JSON.stringify({ sections: normalizeSectionNames(sections) }),
      })
      const savedRows = Array.isArray(saved) ? saved : []
      setSectionRecords(savedRows)
      setSections(normalizeSectionNames(savedRows.map(section => section.name)))
      setSaveMessage('Saved sections.')
      onSetupChanged?.()
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not save sections.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateTable = async (tableId, updates) => {
    const updated = await fetchWithSupabaseAuth(`/tables/${tableId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    setTables(prev => prev.map(item => item.id === tableId ? updated : item))
  }

  const removeTable = async (tableId) => {
    await fetchWithSupabaseAuth(`/tables/${tableId}`, { method: 'DELETE' })
    setTables(prev => prev.filter(item => item.id !== tableId))
    onSetupChanged?.()
  }

  const addMenuItem = async () => {
    if (!menuForm.name.trim()) {
      setSetupError('Menu item name is required.')
      return
    }
    setSetupError('')
    const payload = {
      restaurant_id: restaurantId,
      name: menuForm.name.trim(),
      category: menuForm.category.trim() || null,
      price: menuForm.price === '' ? null : Number(menuForm.price),
      cost: menuForm.cost === '' ? null : Number(menuForm.cost),
      description: menuForm.description.trim() || null,
    }
    const created = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/items/single`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setMenuItems(prev => [...prev, created])
    setMenuForm({ name: '', category: '', price: '', cost: '', description: '' })
    onSetupChanged?.()
  }

  const updateMenuItem = async (itemId, updates) => {
    const updated = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    setMenuItems(prev => prev.map(item => item.id === itemId ? updated : item))
  }

  const removeMenuItem = async (itemId) => {
    await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/items/${itemId}`, { method: 'DELETE' })
    setMenuItems(prev => prev.filter(item => item.id !== itemId))
    onSetupChanged?.()
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="label-mono">Restaurant Setup</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{restaurant.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-dash-secondary">
              Edit the live restaurant configuration directly. New restaurants still use the guided onboarding flow.
            </p>
          </div>
          <Link
            to="/onboarding?new=1"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream"
          >
            Add restaurant
          </Link>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          {SETUP_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSetupTab(item.id)}
              className={[
                'rounded-xl px-4 py-2 text-sm font-semibold transition',
                activeSetupTab === item.id
                  ? 'bg-dash-gold text-black'
                  : 'border border-white/10 text-dash-secondary hover:border-white/20 hover:text-dash-cream',
              ].join(' ')}
            >
              {item.label}
              {setupWarnings[item.id]?.length > 0 && <WarningTriangle className="ml-2 align-middle" />}
            </button>
          ))}
        </nav>
      </section>

      <section className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
          {subTabs.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setActiveSubTab(label)}
              className={[
                'block w-full rounded-lg px-3 py-2 text-left text-sm transition',
                activeSubTab === label
                  ? 'bg-white/[0.07] text-dash-cream'
                  : 'text-dash-secondary hover:bg-white/[0.04] hover:text-dash-cream',
              ].join(' ')}
            >
              {label}
              {activeSetupTab === 'team' && label === 'Staff' && setupWarnings.team.length > 0 && (
                <WarningTriangle className="ml-2 align-middle" />
              )}
              {activeSetupTab === 'operations' && index === 0 && setupWarnings.operations.length > 0 && (
                <WarningTriangle className="ml-2 align-middle" />
              )}
              {activeSetupTab === 'profile' && index === 0 && setupWarnings.profile.length > 0 && (
                <WarningTriangle className="ml-2 align-middle" />
              )}
            </button>
          ))}
        </aside>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          {setupError && (
            <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
              {setupError}
            </div>
          )}

          {activeSetupTab === 'profile' && activeSubTab === 'Basics' && (
            <div className="space-y-5">
              {setupWarnings.profile.length > 0 && (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                  Missing: {setupWarnings.profile.join(', ')}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Restaurant Name">
                  <TextInput
                    value={profile.name}
                    onChange={(event) => setProfile(prev => ({ ...prev, name: event.target.value }))}
                  />
                </Field>
                <Field label="Restaurant Type">
                  <select
                    value={profile.type}
                    onChange={(event) => setProfile(prev => ({ ...prev, type: event.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-dash-cream outline-none transition focus:border-dash-gold/70"
                  >
                    <option value="casual">Casual Dining</option>
                    <option value="fine_dining">Fine Dining</option>
                    <option value="fast_casual">Fast Casual</option>
                    <option value="bar">Bar / Pub</option>
                    <option value="cafe">Cafe</option>
                    <option value="food_truck">Food Truck</option>
                  </select>
                </Field>
                <Field label="Address">
                  <TextInput
                    value={profile.address}
                    onChange={(event) => setProfile(prev => ({ ...prev, address: event.target.value }))}
                  />
                </Field>
                <Field label="Phone">
                  <TextInput
                    value={profile.phone}
                    onChange={(event) => setProfile(prev => ({ ...prev, phone: event.target.value }))}
                  />
                </Field>
                <Field label="City">
                  <TextInput
                    value={profile.city}
                    onChange={(event) => setProfile(prev => ({ ...prev, city: event.target.value }))}
                  />
                </Field>
                <Field label="State">
                  <TextInput
                    value={profile.state}
                    onChange={(event) => setProfile(prev => ({ ...prev, state: event.target.value }))}
                  />
                </Field>
                <Field label="Postal Code">
                  <TextInput
                    value={profile.postal_code}
                    onChange={(event) => setProfile(prev => ({ ...prev, postal_code: event.target.value }))}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void saveProfile()}
                  disabled={isSaving}
                  className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save profile'}
                </button>
                {saveMessage && <p className="text-sm text-dash-secondary">{saveMessage}</p>}
              </div>
            </div>
          )}

          {activeSetupTab === 'profile' && activeSubTab !== 'Basics' && (
            <SetupPlaceholder title={activeSubTab}>
              {activeSubTab === 'Location'
                ? 'Location fields are editable in Basics for now: address, city, state, and postal code.'
                : 'Logo, cover image, and brand styling controls will live here.'}
            </SetupPlaceholder>
          )}

          {activeSetupTab === 'operations' && activeSubTab === 'Hours' && (
            <div className="space-y-4">
              {setupWarnings.operations.length > 0 && (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                  Missing: {setupWarnings.operations.join(', ')}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Seating Capacity">
                  <TextInput
                    type="number"
                    min="0"
                    value={profile.seating_capacity}
                    onChange={(event) => setProfile(prev => ({ ...prev, seating_capacity: event.target.value }))}
                  />
                </Field>
                <Field label="Table Count">
                  <TextInput
                    type="number"
                    min="0"
                    value={profile.table_count}
                    onChange={(event) => setProfile(prev => ({ ...prev, table_count: event.target.value }))}
                  />
                </Field>
                <SetupPlaceholder title="Operating Hours">
                  Edit service days, open/close windows, and holiday exceptions here.
                </SetupPlaceholder>
                <SetupPlaceholder title="Capacity">
                  Manage table count, seating capacity, and named floor sections.
                </SetupPlaceholder>
              </div>
              <SmallButton variant="primary" onClick={() => void saveProfile()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save operations'}
              </SmallButton>
            </div>
          )}

          {activeSetupTab === 'operations' && activeSubTab === 'Capacity' && (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-[1fr_120px_140px_150px_auto]">
                <TextInput placeholder="Table #" value={tableForm.table_number} onChange={event => setTableForm(prev => ({ ...prev, table_number: event.target.value }))} />
                <TextInput type="number" min="1" placeholder="Capacity" value={tableForm.capacity} onChange={event => setTableForm(prev => ({ ...prev, capacity: event.target.value }))} />
                <select value={tableForm.table_type} onChange={event => setTableForm(prev => ({ ...prev, table_type: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-dash-cream outline-none focus:border-dash-gold/70">
                  <option value="standard">Standard</option>
                  <option value="bar">Bar</option>
                  <option value="booth">Booth</option>
                  <option value="patio">Patio</option>
                </select>
                <select value={tableForm.section_id} onChange={event => setTableForm(prev => ({ ...prev, section_id: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-dash-cream outline-none focus:border-dash-gold/70">
                  <option value="">Table</option>
                  {sectionRecords.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}
                </select>
                <SmallButton variant="primary" onClick={() => void addTable()}>Add table</SmallButton>
              </div>
              {tables.length === 0 ? (
                <SetupEmptyState title="No tables yet" actionLabel="Add table" onAction={() => void addTable()}>
                  Add tables here so floor state and table-volume analytics have real table records.
                </SetupEmptyState>
              ) : (
                <div className="space-y-2">
                  {tables.map(table => (
                    <div key={table.id} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 md:grid-cols-[1fr_110px_140px_160px_auto]">
                      <TextInput defaultValue={table.table_number || ''} onBlur={event => void updateTable(table.id, { table_number: event.target.value })} />
                      <TextInput type="number" min="1" defaultValue={table.capacity || ''} onBlur={event => void updateTable(table.id, { capacity: Number(event.target.value || 0) })} />
                      <span className="px-3 py-3 text-sm capitalize text-dash-secondary">{table.table_type || 'standard'}</span>
                      <select defaultValue={table.section_id || ''} onChange={event => void updateTable(table.id, { section_id: event.target.value || null })} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none focus:border-dash-gold/70">
                        <option value="">Table</option>
                        {sectionRecords.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}
                      </select>
                      <SmallButton variant="danger" onClick={() => void removeTable(table.id)}>Remove</SmallButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSetupTab === 'operations' && activeSubTab === 'Sections' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <h3 className="text-lg font-semibold">Restaurant sections</h3>
                <p className="mt-2 text-sm leading-6 text-dash-secondary">
                  Sections are areas such as Bar, Patio, Outdoor, or Main Dining. Tables in the floor plan use these categories, and unassigned tables default to Table.
                </p>
              </div>
              {normalizeSectionNames(sections).map((section, index) => (
                <div key={`${index}:${index === 0 ? 'default' : section}`} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <TextInput
                    value={section}
                    disabled={index === 0}
                    placeholder="Bar, Patio, Outdoor..."
                    onChange={event => {
                      const next = normalizeSectionNames(sections)
                      next[index] = index === 0 ? 'Table' : event.target.value
                      setSections(next)
                    }}
                  />
                  <SmallButton
                    variant={index === 0 ? 'secondary' : 'danger'}
                    disabled={index === 0}
                    onClick={() => setSections(prev => normalizeSectionNames(prev).filter((_, currentIndex) => currentIndex !== index))}
                  >
                    Remove
                  </SmallButton>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <SmallButton onClick={() => setSections(prev => {
                  const current = normalizeSectionNames(prev)
                  return [...current, `New Section ${current.length}`]
                })}>Add section</SmallButton>
                <SmallButton variant="primary" onClick={() => void saveSections()} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save sections'}
                </SmallButton>
              </div>
            </div>
          )}

          {activeSetupTab === 'menu' && activeSubTab === 'Items' && (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-[1fr_140px_120px_120px_auto]">
                <TextInput placeholder="Item name" value={menuForm.name} onChange={event => setMenuForm(prev => ({ ...prev, name: event.target.value }))} />
                <TextInput placeholder="Category" value={menuForm.category} onChange={event => setMenuForm(prev => ({ ...prev, category: event.target.value }))} />
                <TextInput type="number" min="0" step="0.01" placeholder="Price" value={menuForm.price} onChange={event => setMenuForm(prev => ({ ...prev, price: event.target.value }))} />
                <TextInput type="number" min="0" step="0.01" placeholder="Cost" value={menuForm.cost} onChange={event => setMenuForm(prev => ({ ...prev, cost: event.target.value }))} />
                <SmallButton variant="primary" onClick={() => void addMenuItem()}>Add item</SmallButton>
              </div>
              {menuItems.length === 0 ? (
                <SetupEmptyState title="No menu items yet" actionLabel="Add menu item" onAction={() => void addMenuItem()}>
                  Add menu items manually here, or import/extract them later from the menu workflow.
                </SetupEmptyState>
              ) : (
                <div className="space-y-2">
                  {menuItems.map(item => (
                    <div key={item.id} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 md:grid-cols-[1fr_140px_110px_110px_auto]">
                      <TextInput defaultValue={item.name || ''} onBlur={event => void updateMenuItem(item.id, { name: event.target.value })} />
                      <TextInput defaultValue={item.category || ''} onBlur={event => void updateMenuItem(item.id, { category: event.target.value || null })} />
                      <TextInput type="number" min="0" step="0.01" defaultValue={item.price ?? ''} onBlur={event => void updateMenuItem(item.id, { price: event.target.value === '' ? null : Number(event.target.value) })} />
                      <TextInput type="number" min="0" step="0.01" defaultValue={item.cost ?? ''} onBlur={event => void updateMenuItem(item.id, { cost: event.target.value === '' ? null : Number(event.target.value) })} />
                      <SmallButton variant="danger" onClick={() => void removeMenuItem(item.id)}>Remove</SmallButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSetupTab === 'menu' && activeSubTab !== 'Items' && (
            <div className="grid gap-4 md:grid-cols-2">
              <SetupPlaceholder title={activeSubTab}>
                {activeSubTab === 'Modifiers'
                  ? 'Modifier groups and add-on pricing remain in the dedicated modifier editor.'
                  : 'Menu import/extraction controls will live here.'}
              </SetupPlaceholder>
            </div>
          )}

          {activeSetupTab === 'team' && activeSubTab === 'Staff' && (
            <div className="space-y-4">
              {setupWarnings.team.length > 0 && (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                  Missing: {setupWarnings.team.join(', ')}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px_110px_120px_auto]">
                <TextInput placeholder="Name" value={staffForm.name} onChange={event => setStaffForm(prev => ({ ...prev, name: event.target.value, employee_login_id: prev.employee_login_id || defaultEmployeeId(event.target.value) }))} />
                <TextInput placeholder="Email optional" value={staffForm.email} onChange={event => setStaffForm(prev => ({ ...prev, email: event.target.value }))} />
                <select value={staffForm.role} onChange={event => setStaffForm(prev => ({ ...prev, role: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-sm text-dash-cream outline-none focus:border-dash-gold/70">
                  <option value="server">Server</option>
                  <option value="bartender">Bartender</option>
                  <option value="host">Host</option>
                  <option value="manager">Manager</option>
                </select>
                <TextInput placeholder="PIN" value={staffForm.pin} onChange={event => setStaffForm(prev => ({ ...prev, pin: event.target.value.replace(/\D/g, '').slice(0, 8) }))} />
                <TextInput placeholder="ID" value={staffForm.employee_login_id} onChange={event => setStaffForm(prev => ({ ...prev, employee_login_id: event.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '') }))} />
                <SmallButton variant="primary" onClick={() => void addStaff()}>Add</SmallButton>
              </div>
              {waiters.length === 0 ? (
                <SetupEmptyState title="No employees yet" actionLabel="Add employee" onAction={() => void addStaff()}>
                  Add employees so the employee login, scheduling, and staff analytics have real people attached.
                </SetupEmptyState>
              ) : (
                <div className="space-y-2">
                  {waiters.map(waiter => (
                    <div key={waiter.id} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 md:grid-cols-[1fr_1fr_120px_120px_auto]">
                      <TextInput defaultValue={waiter.name || ''} onBlur={event => void updateStaff(waiter.id, { name: event.target.value })} />
                      <TextInput defaultValue={waiter.email || ''} placeholder="Email" onBlur={event => void updateStaff(waiter.id, { email: event.target.value || null })} />
                      <span className="px-3 py-3 text-sm capitalize text-dash-secondary">{waiter.role || 'server'}</span>
                      <span className="px-3 py-3 font-mono text-sm text-dash-secondary">{waiter.employee_login_id || 'auto'}</span>
                      <SmallButton variant="danger" onClick={() => void removeStaff(waiter.id)}>Remove</SmallButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSetupTab === 'team' && activeSubTab !== 'Staff' && (
            <SetupPlaceholder title={activeSubTab}>
              {activeSubTab === 'Roles'
                ? 'Role permissions will be managed here. Staff records are editable in Staff.'
                : 'Manager and employee invite flows will live here.'}
            </SetupPlaceholder>
          )}

          {activeSetupTab === 'integrations' && (
            <div className="grid gap-4 md:grid-cols-3">
              <SetupPlaceholder title="POS">
                Toast, Square, Clover, or manual imports.
              </SetupPlaceholder>
              <SetupPlaceholder title="Scheduling">
                7shifts, Homebase, or SHIRE native scheduling.
              </SetupPlaceholder>
              <SetupPlaceholder title="Reservations">
                Booking links, reservation providers, and sync settings.
              </SetupPlaceholder>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export function RestaurantWorkspace({
  restaurantBase = '/restaurants',
  restaurantListPath = '/restaurants',
  shellRoutes = {},
}) {
  const auth = useAuth()
  const navigate = useNavigate()
  const { restaurantId, tab = 'analytics' } = useParams()
  const restaurant = auth.restaurant.restaurants.find((item) => item.id === restaurantId) ?? null
  const activeTab = TABS.some((item) => item.id === tab) ? tab : 'analytics'
  const [waiterCount, setWaiterCount] = useState(null)
  const [floorPlanStatus, setFloorPlanStatus] = useState(null)
  const [jobCodeCount, setJobCodeCount] = useState(null)
  const [setupRefreshKey, setSetupRefreshKey] = useState(0)
  const allowedStoreTabs = useAllowedStoreTabs(restaurant)
  const backOfficeAccess = useBackOfficeAccess(auth, restaurantId)
  const setupWarnings = useMemo(
    () => buildModernSetupWarnings(restaurant || {}, waiterCount, floorPlanStatus, jobCodeCount),
    [restaurant, waiterCount, floorPlanStatus, jobCodeCount]
  )
  const setupStatusQuery = useQuery({
    queryKey: queryKeys.setupStatus(restaurantId || ''),
    queryFn: () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/setup-status`),
    enabled: Boolean(restaurantId && restaurant && (backOfficeAccess.loading || backOfficeAccess.can('settings.edit'))),
    staleTime: STALE_TIMES.setup,
    refetchInterval: query => query.state.data?.complete ? false : 15_000,
  })
  const showSetup = setupStatusQuery.isLoading || Boolean(setupStatusQuery.error) || setupStatusQuery.data?.complete !== true
  const setupWarningCount = setupStatusQuery.data?.missing_count ?? modernWarningCount(setupWarnings || {})

  const handleSetupChanged = () => {
    setSetupRefreshKey(key => key + 1)
    void queryClient.invalidateQueries({ queryKey: queryKeys.setupStatus(restaurantId) })
  }

  useEffect(() => {
    if (!restaurantId || !restaurant) return
    if (auth.restaurant.currentRestaurant?.id !== restaurantId) {
      void auth.switchRestaurant(restaurantId)
    }
  }, [auth.restaurant.currentRestaurant?.id, auth.switchRestaurant, restaurant, restaurantId])

  useEffect(() => {
    if (!restaurantId || !restaurant) return
    let cancelled = false
    // setupRefreshKey bumps after setup edits; force a fresh read then.
    const staleTime = setupRefreshKey > 0 ? 0 : STALE_TIMES.setup
    Promise.all([
      fetchCached(
        queryKeys.waiters(restaurantId),
        () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=false`),
        staleTime,
      ),
      fetchCached(
        queryKeys.floorPlan(restaurantId),
        () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/floor-plan`),
        staleTime,
      ).catch(() => null),
      fetchCached(
        queryKeys.jobCodes(restaurantId),
        () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes`),
        staleTime,
      ).catch(() => null),
    ])
      .then(([waiterData, floorPlan, jobCodeData]) => {
        if (cancelled) return
        setWaiterCount(Array.isArray(waiterData) ? waiterData.length : 0)
        setFloorPlanStatus(floorPlan)
        setJobCodeCount(Array.isArray(jobCodeData) ? jobCodeData.filter((code) => code?.is_active !== false).length : null)
      })
      .catch(() => {
        if (!cancelled) {
          setWaiterCount(null)
          setFloorPlanStatus(null)
          setJobCodeCount(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [restaurant, restaurantId, setupRefreshKey])

  if (!restaurantId) {
    return <Navigate to={restaurantListPath} replace />
  }

  if (!restaurant) {
    return (
      <ProtectedRoute>
        <main className="min-h-screen bg-dash-base text-dash-cream px-6 py-8">
          <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-white/[0.035] p-8">
            <h1 className="text-2xl font-semibold">Restaurant not found</h1>
            <p className="mt-2 text-dash-secondary">This account is not tied to that restaurant.</p>
            <Link to={restaurantListPath} className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black">
              Back to restaurants
            </Link>
          </div>
        </main>
      </ProtectedRoute>
    )
  }

  // Resellers only reach owner-permitted tabs; deep links bounce to Home.
  if (allowedStoreTabs && !allowedStoreTabs.includes(activeTab)) {
    return <Navigate to={`${restaurantBase}/${restaurantId}/analytics`} replace />
  }

  if (activeTab === 'setup' && !setupStatusQuery.isLoading && !setupStatusQuery.error && setupStatusQuery.data?.complete) {
    return <Navigate to={`${restaurantBase}/${restaurantId}/store-information`} replace />
  }

  // Back-office members only reach permitted tabs (owners bypass; server
  // guards remain the real enforcement).
  const requiredPermission = TAB_PERMISSIONS[activeTab]
  if (!backOfficeAccess.loading && requiredPermission && !backOfficeAccess.can(requiredPermission)) {
    return <Navigate to={`${restaurantBase}/${restaurantId}/analytics`} replace />
  }

  const breadcrumb = [
    { label: 'Home', to: `${restaurantBase}/${restaurantId}/analytics` },
    { label: WORKSPACE_BREADCRUMB_LABELS[activeTab] || 'Overview' },
  ]

  if (activeTab === 'setup') {
    if (auth.restaurant.currentRestaurant?.id !== restaurantId) {
      return (
        <ProtectedRoute>
          <LoadingScreen />
        </ProtectedRoute>
      )
    }

    return (
      <ProtectedRoute>
        <DashboardShell
          context="store"
          activeItem={activeTab}
          breadcrumb={breadcrumb}
          restaurant={restaurant}
          restaurantId={restaurantId}
          setupWarningCount={setupWarningCount}
          showSetup={showSetup}
          allowedStoreTabs={allowedStoreTabs}
          routes={shellRoutes}
        >
          <ModernRestaurantSetupPanel
            restaurant={restaurant}
            restaurantId={restaurantId}
            auth={auth}
            setupWarnings={setupWarnings}
            onSetupChanged={handleSetupChanged}
          />
        </DashboardShell>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardShell
        context="store"
        activeItem={activeTab}
        breadcrumb={breadcrumb}
        restaurant={restaurant}
        restaurantId={restaurantId}
        setupWarningCount={setupWarningCount}
        showSetup={showSetup}
        allowedStoreTabs={allowedStoreTabs}
        routes={shellRoutes}
      >
        {activeTab === 'analytics' && (
          <>
            <ResellerAccessCard restaurant={restaurant} />
            <AnalyticsDashboard restaurant={restaurant} />
          </>
        )}
        {activeTab === 'checks' && <CheckLedgerSection restaurantId={restaurantId} />}
        {activeTab === 'reports' && <RestaurantReportsPage restaurantId={restaurantId} restaurantName={restaurant?.name} canConfigureServerReceipt={backOfficeAccess.can('settings.edit')} />}
        {activeTab === 'close-day' && <CloseDayPage restaurantId={restaurantId} restaurantName={restaurant?.name} />}
        {activeTab === 'store-information' && (
          <ModernRestaurantSetupPanel restaurant={restaurant} restaurantId={restaurantId} auth={auth} setupWarnings={setupWarnings} onSetupChanged={handleSetupChanged} allowedTabs={['basics', 'goals']} showHeader={false} />
        )}
        {activeTab === 'marketing' && (
          <ModernRestaurantSetupPanel restaurant={restaurant} restaurantId={restaurantId} auth={auth} setupWarnings={setupWarnings} onSetupChanged={handleSetupChanged} allowedTabs={['branding']} showHeader={false} />
        )}
        {activeTab === 'settings' && (
          <ModernRestaurantSetupPanel restaurant={restaurant} restaurantId={restaurantId} auth={auth} setupWarnings={setupWarnings} onSetupChanged={handleSetupChanged} allowedTabs={['legal', 'payments', 'closeout', 'check_workflow', 'hours']} showHeader={false} />
        )}
        {activeTab === 'integrations' && (
          <ModernRestaurantSetupPanel restaurant={restaurant} restaurantId={restaurantId} auth={auth} setupWarnings={setupWarnings} onSetupChanged={handleSetupChanged} allowedTabs={['service_model', 'reservation_timing', 'integrations']} showHeader={false} />
        )}
        {activeTab === 'ui' && (
          <ConfigurationHub tabs={[{ id: 'appearance', label: 'Appearance' }, { id: 'sections', label: 'Sections' }, { id: 'floor-plan', label: 'Floor Plan' }]} initialTab="appearance">
            {(section) => section === 'appearance' ? (
              <ResellerUiEditor
                restaurants={restaurant ? [{
                  ...restaurant,
                  reseller_group_id: 'ungrouped',
                  reseller_group_name: 'Current store',
                  reseller_group_color: '#9CA3AF',
                }] : []}
                groups={[]}
                initialRestaurantId={restaurantId}
              />
            ) : (
              <ModernRestaurantSetupPanel restaurant={restaurant} restaurantId={restaurantId} auth={auth} setupWarnings={setupWarnings} onSetupChanged={handleSetupChanged} allowedTabs={[section === 'sections' ? 'sections' : 'capacity']} showHeader={false} />
            )}
          </ConfigurationHub>
        )}
        {activeTab === 'menu' && (
          <ConfigurationHub tabs={[
            { id: 'menu', label: 'Menu' },
            ...(backOfficeAccess.can('menu.edit_items') ? [{ id: 'discounts', label: 'Discounts' }] : []),
            ...(backOfficeAccess.can('settings.edit') ? [{ id: 'routing', label: 'Kitchen Routing' }] : []),
            ...(auth.accountType === 'admin' ? [{ id: 'taxes', label: 'Taxes & Charges' }] : []),
          ]} initialTab="menu">
            {(section) => section === 'menu' ? (
              <MenuPanel restaurantId={restaurantId} canEditPrices={backOfficeAccess.can('menu.edit_prices')} />
            ) : (
              <ModernRestaurantSetupPanel restaurant={restaurant} restaurantId={restaurantId} auth={auth} setupWarnings={setupWarnings} onSetupChanged={handleSetupChanged} allowedTabs={[section === 'taxes' ? 'taxes_charges' : section]} showHeader={false} />
            )}
          </ConfigurationHub>
        )}
        {activeTab === 'menu-workspace' && (
          <MenuWorkspaceEditor
            restaurantId={restaurantId}
            canEdit={backOfficeAccess.can('menu.edit_items')}
          />
        )}
        {activeTab === 'taxes' && <Navigate to={`${restaurantBase}/${restaurantId}/menu`} replace />}
        {activeTab === 'feedback' && <GuestFeedbackPanel restaurantId={restaurantId} />}
        {activeTab === 'team' && (
          <ConfigurationHub tabs={[
            { id: 'members', label: 'Members & Roles' },
            ...(backOfficeAccess.can('settings.edit') ? [{ id: 'manager-controls', label: 'Manager Controls' }] : []),
          ]} initialTab="members">
            {(section) => section === 'members' ? <TeamPage restaurantId={restaurantId} /> : <ModernRestaurantSetupPanel restaurant={restaurant} restaurantId={restaurantId} auth={auth} setupWarnings={setupWarnings} onSetupChanged={handleSetupChanged} allowedTabs={['manager_controls']} showHeader={false} />}
          </ConfigurationHub>
        )}
        {activeTab === 'time-clock' && <TimeClockPage restaurantId={restaurantId} />}
        {activeTab === 'labor-cost' && <LaborCostPage restaurantId={restaurantId} />}
        {activeTab === 'devices' && <StoreDevicesPanel restaurantId={restaurantId} />}
        {activeTab === 'pos-settings' && <PosSettingsPage restaurantId={restaurantId} />}
        {activeTab === 'printing-routing' && <PrintingRoutingPage restaurantId={restaurantId} />}
        {activeTab === 'tip-pooling' && <TipPoolingPage restaurantId={restaurantId} />}
        {activeTab === 'scheduling' && <SchedulingPanel restaurantId={restaurantId} />}
        {activeTab === 'alerts' && <ManagerActionInboxPage restaurantId={restaurantId} />}
        {activeTab === 'messaging' && <ManagerMessagingPanel restaurantId={restaurantId} />}
        {activeTab === 'payments' && (
          <PlaceholderPanel title="Payments / Plan" eyebrow="Placeholder">
            <p>Plan management, billing status, payment method, and subscription controls will live here.</p>
          </PlaceholderPanel>
        )}
      </DashboardShell>
    </ProtectedRoute>
  )
}

const WORKSPACE_BREADCRUMB_LABELS = {
  analytics: 'Overview',
  reports: 'Reports',
  checks: 'Checks',
  'close-day': 'Close Day',
  setup: 'Setup',
  'store-information': 'Store Information',
  marketing: 'Marketing',
  settings: 'Store Settings',
  integrations: 'Integrations',
  'menu-workspace': 'POS Menus',
  ui: 'UI Editor',
  menu: 'Menu',
  taxes: 'Taxes',
  feedback: 'Complaints',
  team: 'Team',
  'time-clock': 'Time Clock',
  'labor-cost': 'Labor Cost',
  devices: 'Devices',
  'pos-settings': 'POS Settings',
  'printing-routing': 'Printing & Routing',
  'tip-pooling': 'Payroll & Tips',
  scheduling: 'Scheduling',
  alerts: 'Alerts',
  messaging: 'Messaging',
  payments: 'Payments / Plan',
}

export default function AuthenticatedDashboardApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="auth/login" element={<LoginPage />} />
        <Route path="auth/signup" element={<SignupPage />} />
        <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />
        <Route path="employee" element={<EmployeePortal />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="reseller/*" element={<ResellerApp />} />
        <Route path="claim/:token" element={<ClaimStorePage />} />
        <Route path="invite" element={<AcceptInvitePage />} />
        <Route path="enterprise" element={<Navigate to="/enterprise/stores" replace />} />
        <Route
          path="enterprise/overview"
          element={<EnterprisePage item="overview" title="Overview"><OverviewPage /></EnterprisePage>}
        />
        <Route
          path="enterprise/stores"
          element={<EnterprisePage item="stores" title="Stores"><StoresPage /></EnterprisePage>}
        />
        <Route
          path="enterprise/settings"
          element={<EnterprisePage item="settings" title="Settings"><SettingsPage /></EnterprisePage>}
        />
        <Route
          path="enterprise/rates"
          element={<EnterprisePage item="rates" title="Rates & Pricing"><RatesPage /></EnterprisePage>}
        />
        <Route
          path="enterprise/devices"
          element={<EnterprisePage item="devices" title="Devices"><DevicesPage /></EnterprisePage>}
        />
        <Route
          path="enterprise/users"
          element={<EnterprisePage item="users" title="Users"><UsersPage /></EnterprisePage>}
        />
        <Route path="restaurants" element={<Navigate to="/enterprise/stores" replace />} />
        <Route path="restaurants/:restaurantId" element={<Navigate to="analytics" replace />} />
        <Route path="restaurants/:restaurantId/:tab" element={<RestaurantWorkspace />} />
        <Route index element={<OwnerGate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

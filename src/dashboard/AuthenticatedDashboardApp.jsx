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
import { supabase } from '../shared/lib/supabase'
import { API_CONFIG } from '../shared/api/config'
import ModernRestaurantSetupPanel, {
  buildSetupWarnings as buildModernSetupWarnings,
  warningCount as modernWarningCount,
} from './RestaurantSetupPanel'

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

  if (auth.restaurant.restaurants.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  return <Navigate to="/restaurants" replace />
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

function RestaurantSelector() {
  const auth = useAuth()
  const navigate = useNavigate()
  const restaurants = auth.restaurant.restaurants

  const openRestaurant = async (restaurantId) => {
    await auth.switchRestaurant(restaurantId)
    navigate(`/restaurants/${restaurantId}/analytics`)
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-dash-base text-dash-cream px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="label-mono">Owner Console</p>
              <h1 className="text-4xl font-semibold tracking-tight">Restaurants</h1>
              <p className="mt-2 max-w-2xl text-dash-secondary">
                Choose a restaurant to view analytics, update setup, manage schedules, and review plan details.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/onboarding?new=1"
                className="inline-flex items-center justify-center rounded-xl bg-dash-gold px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Add restaurant
              </Link>
              <button
                type="button"
                onClick={() => void auth.signOut()}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-dash-secondary transition hover:border-white/20 hover:text-dash-cream"
              >
                Sign out
              </button>
            </div>
          </header>

          {restaurants.length === 0 ? (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
              <h2 className="text-2xl font-semibold">No restaurants yet</h2>
              <p className="mt-2 text-dash-secondary">Start onboarding to create your first restaurant workspace.</p>
              <Link
                to="/onboarding"
                className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
              >
                Start onboarding
              </Link>
            </section>
          ) : (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {restaurants.map((restaurant) => (
                <button
                  key={restaurant.id}
                  type="button"
                  onClick={() => void openRestaurant(restaurant.id)}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left transition hover:border-dash-gold/70 hover:bg-white/[0.055]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">{restaurant.name || 'Untitled restaurant'}</h2>
                      <p className="mt-1 text-sm text-dash-secondary">
                        {[restaurant.city, restaurant.state].filter(Boolean).join(', ') || 'Location not set'}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-dash-secondary">
                      {restaurant.onboarding_completed_at ? 'Active' : 'Onboarding'}
                    </span>
                  </div>
                  <p className="mt-6 text-sm text-dash-tertiary">Open workspace</p>
                </button>
              ))}
            </section>
          )}
        </div>
      </main>
    </ProtectedRoute>
  )
}

const TABS = [
  { id: 'analytics', label: 'Analytics' },
  { id: 'setup', label: 'Edit Setup' },
  { id: 'scheduling', label: 'Scheduling' },
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

const ANALYTICS_PERIODS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'full', label: 'Full' },
]

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    .format(Number(value || 0))

const formatNumber = (value, digits = 0) =>
  value === null || value === undefined
    ? 'DNE'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(Number(value || 0))

const formatMinutes = (value) =>
  value === null || value === undefined ? 'DNE' : `${formatNumber(value, 1)} min`

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
  const [period, setPeriod] = useState('week')
  const [payload, setPayload] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!restaurant?.id) return
    let cancelled = false
    setIsLoading(true)
    setError('')
    fetchWithSupabaseAuth(`/restaurants/${restaurant.id}/owner-analytics?period=${period}`)
      .then(data => {
        if (!cancelled) setPayload(data)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load analytics')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [restaurant?.id, period])

  const sections = payload?.sections || {}
  const revenue = sections.revenue || {}
  const revenueData = revenue.data || {}
  const visits = sections.visits || {}
  const visitData = visits.data || {}
  const reservations = sections.reservations || {}
  const reservationData = reservations.data || {}
  const floor = sections.floor || {}
  const floorData = floor.data || {}
  const staff = sections.staff || {}
  const staffData = staff.data || {}
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
        </div>
        {payload?.window && (
          <p className="mt-4 text-xs text-dash-tertiary">
            {payload.window.is_full_history
              ? 'Showing all available history.'
              : `Window: ${payload.window.start_at?.slice(0, 10)} to ${payload.window.end_at?.slice(0, 10)}`}
          </p>
        )}
      </section>

      {isLoading && <LoadingScreen />}
      {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}

      {!isLoading && !error && payload && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Revenue" value={formatCurrency(revenueData.total_revenue)} detail={`${formatNumber(revenueData.order_count)} POS orders`} />
            <MetricCard label="Covers" value={formatNumber(visitData.covers)} detail={`${formatNumber(visitData.visit_count)} host visits`} />
            <MetricCard label="Avg Turn Time" value={formatMinutes(visitData.avg_turn_minutes)} detail={visits.quality?.message} muted={!visits.quality?.turn_time_available} />
            <MetricCard label="Reservations" value={formatNumber(reservationData.reservation_count)} detail={`${formatNumber(reservationData.booked_covers)} booked covers`} />
          </div>

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

          <div className="grid gap-6 xl:grid-cols-2">
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
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
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

            <AnalyticsSection
              title="Staff"
              source="shifts + waiters"
              status={staff.status}
              sampleSize={staff.sample_size}
              emptyMessage={staff.empty_message}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Shifts" value={formatNumber(staffData.shift_count)} />
                <MetricCard label="Staff Worked" value={formatNumber(staffData.staff_worked)} />
                <MetricCard label="Shift Sales" value={formatCurrency(staffData.sales)} />
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
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
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
          </div>
        </>
      )}
    </div>
  )
}

async function fetchWithSupabaseAuth(endpoint, options = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
    ...options,
    headers,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body.detail || body.message
    const message = typeof detail === 'string'
      ? detail
      : detail
        ? JSON.stringify(detail)
        : `Request failed (${response.status})`
    throw new Error(message)
  }
  if (response.status === 204) return null
  return response.json()
}

function formatTimeEntry(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4)
  if (digits.length === 1 && !['0', '1'].includes(digits)) return `0${digits}:`
  if (digits.length < 2) return digits
  if (digits.length === 2) return `${digits}:`
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

function TimeEntry({ value, onChange, placeholder = '17:00', ariaLabel }) {
  const safeValue = value || ''
  const remainder = safeValue.length < placeholder.length ? placeholder.slice(safeValue.length) : ''

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 flex items-center rounded-xl px-3 py-2 font-mono text-sm">
        <span className="text-dash-cream">{safeValue}</span>
        <span className="text-dash-tertiary/30">{remainder}</span>
      </div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={safeValue}
        onChange={event => onChange(formatTimeEntry(event.target.value))}
        placeholder={placeholder}
        maxLength={5}
        className="relative z-10 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 font-mono text-sm text-transparent caret-white outline-none placeholder:text-transparent focus:border-dash-gold/70"
      />
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
const SCHEDULE_PIXELS_PER_HOUR = 46
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

function SchedulingPanel({ restaurantId }) {
  const [activeSchedulingTab, setActiveSchedulingTab] = useState('schedule')
  const [weekStart, setWeekStart] = useState('')
  const [coverageBlocks, setCoverageBlocks] = useState([])
  const [suggestedBlocks, setSuggestedBlocks] = useState([])
  const [schedules, setSchedules] = useState([])
  const [staff, setStaff] = useState([])
  const [employeeRequests, setEmployeeRequests] = useState([])
  const [requestPolicy, setRequestPolicy] = useState(null)
  const [optimizationWeights, setOptimizationWeights] = useState(DEFAULT_OPTIMIZATION_WEIGHTS)
  const [scheduleRoleFilter, setScheduleRoleFilter] = useState('all')
  const [scheduleEmployeeFilter, setScheduleEmployeeFilter] = useState('all')
  const [coverageForm, setCoverageForm] = useState(emptyCoverageBlockForm)
  const [selectedShift, setSelectedShift] = useState(null)
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

  const loadCoverageBlocks = async () => {
    const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/staffing-requirements/blocks`)
    setCoverageBlocks(Array.isArray(data) ? data : [])
    return data
  }

  const loadSuggestedBlocks = async () => {
    const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/staffing-requirements/suggestions`)
    setSuggestedBlocks(Array.isArray(data) ? data : [])
    return data
  }

  const loadSchedules = async (targetWeekStart = weekStart) => {
    const query = targetWeekStart ? `?week_start=${targetWeekStart}&limit=5` : '?limit=5'
    const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/schedules${query}`)
    setSchedules(Array.isArray(data) ? data : [])
    return data
  }

  const loadStaff = async () => {
    const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=false`)
    setStaff(Array.isArray(data) ? data : [])
    return data
  }

  const loadRequestPolicy = async () => {
    const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/employee-request-policy`)
    setRequestPolicy(data)
    setOptimizationWeights({
      ...DEFAULT_OPTIMIZATION_WEIGHTS,
      ...(data?.manager_settings?.optimization_weights || {}),
    })
    return data
  }

  const loadEmployeeRequests = async () => {
    const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/employee-requests?status=all`)
    setEmployeeRequests(Array.isArray(data) ? data : [])
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
    const updated = await loadCoverageBlocks()
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
      await loadCoverageBlocks()
      setStatus(`Generated ${missingBlocks.length} default coverage block${missingBlocks.length === 1 ? '' : 's'}.`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not generate default coverage blocks')
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([loadCoverageBlocks(), loadSuggestedBlocks(), loadSchedules(), loadStaff(), loadRequestPolicy(), loadEmployeeRequests()])
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
    draftBlockRef.current = draftBlock
  }, [draftBlock])

  const activeSchedule = schedules[0] || null
  const scheduleItems = activeSchedule?.items || []
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
  const displayedBlocks = useMemo(
    () => mergeCoverageBlocks(coverageBlocks, suggestedBlocks),
    [coverageBlocks, suggestedBlocks],
  )

  const calendarBounds = useMemo(() => ({ start: DEFAULT_CALENDAR_START, end: DEFAULT_CALENDAR_END }), [])

  const calendarHeight = ((calendarBounds.end - calendarBounds.start) / 60) * COVERAGE_PIXELS_PER_HOUR
  const scheduleCalendarHeight = ((calendarBounds.end - calendarBounds.start) / 60) * SCHEDULE_PIXELS_PER_HOUR
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
      const averageTop = ((averageMinute - calendarBounds.start) / 60) * SCHEDULE_PIXELS_PER_HOUR
      const targetTop = clamp(averageTop - (node.clientHeight / 2), 0, Math.max(0, node.scrollHeight - node.clientHeight))
      node.scrollTop = targetTop
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

  const createManualRun = async () => {
    setStatus('Generating draft schedule...')
    try {
      const body = weekStart ? { week_start_date: weekStart } : {}
      const run = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/schedules/run?run_engine=true&force_regenerate=true`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      await loadSchedules(weekStart || run.week_start_date)
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
      await loadSuggestedBlocks()
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
      await Promise.all([loadEmployeeRequests(), loadStaff()])
      setStatus(nextStatus === 'approved' ? 'Request approved.' : 'Request updated.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not update request')
    }
  }

  const selectShift = (item) => {
    setSelectedShift(item)
    setShiftForm({
      waiter_id: item.waiter_id,
      role: item.role,
      shift_date: item.shift_date,
      shift_start: String(item.shift_start).slice(0, 5),
      shift_end: String(item.shift_end).slice(0, 5),
      is_locked: Boolean(item.is_locked),
      notes: item.notes || '',
    })
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
      await loadSchedules(activeSchedule?.week_start_date || weekStart)
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
      await loadSchedules(activeSchedule?.week_start_date || weekStart)
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
      await loadCoverageBlocks()
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
      await loadCoverageBlocks()
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
      if (result?.applied_coverage_block || result?.applied_coverage_closure) await loadCoverageBlocks()
      if (result?.applied_request_id) await loadEmployeeRequests()
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
      setOptimizationWeights({
        ...DEFAULT_OPTIMIZATION_WEIGHTS,
        ...(saved?.manager_settings?.optimization_weights || {}),
      })
      setStatus('Request limits saved.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save request limits')
    }
  }

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
            <div className="grid border-b border-white/10" style={{ gridTemplateColumns: `${COVERAGE_TIME_AXIS_WIDTH}px repeat(7, minmax(104px, 1fr))` }}>
              <div className="border-r border-white/10 px-3 py-3 text-xs font-semibold text-dash-tertiary">Time</div>
              {SCHEDULING_DAYS.map(day => (
                <div key={day} className="border-r border-white/10 px-3 py-3 text-sm font-semibold text-dash-secondary last:border-r-0">{day}</div>
              ))}
            </div>
            <div ref={scheduleCalendarRef} className="relative max-h-[620px] overflow-auto" style={{ minHeight: Math.min(scheduleCalendarHeight, 620) }}>
              <div
                className="relative min-w-[840px]"
                style={{
                  height: scheduleCalendarHeight,
                  display: 'grid',
                  gridTemplateColumns: `${COVERAGE_TIME_AXIS_WIDTH}px repeat(7, minmax(104px, 1fr))`,
                }}
              >
                <div className="relative border-r border-white/10 bg-black/10">
                  {timelineHours.map(minute => (
                    <div
                      key={minute}
                      className="absolute left-0 right-0 -translate-y-2 px-3 text-right font-mono text-[11px] text-dash-tertiary"
                      style={{ top: ((minute - calendarBounds.start) / 60) * SCHEDULE_PIXELS_PER_HOUR }}
                    >
                      {formatDisplayTime(minute)}
                    </div>
                  ))}
                </div>
                {SCHEDULING_DAYS.map((day, dayIndex) => {
                  const dayItems = itemsForDay(dayIndex)
                  return (
                    <div key={day} className="relative border-r border-white/10 last:border-r-0">
                      {timelineHours.map(minute => (
                        <div
                          key={minute}
                          className="pointer-events-none absolute left-0 right-0 border-t border-white/[0.055]"
                          style={{ top: ((minute - calendarBounds.start) / 60) * SCHEDULE_PIXELS_PER_HOUR }}
                        />
                      ))}
                      {dayItems.map(item => {
                        const start = item.layout_start ?? timeToMinutes(item.shift_start, calendarBounds.start)
                        const end = item.layout_end ?? timeToMinutes(item.shift_end, start + 60)
                        const top = ((start - calendarBounds.start) / 60) * SCHEDULE_PIXELS_PER_HOUR
                        const height = Math.max(34, ((end - start) / 60) * SCHEDULE_PIXELS_PER_HOUR)
                        const columns = item.layout_columns || 1
                        const column = item.layout_column || 0
                        const widthPercent = 100 / columns
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
                            className={`absolute overflow-hidden rounded-lg border px-1 py-2 text-[11px] shadow-lg transition ${
                              isSelected
                                ? 'border-dash-gold bg-dash-gold/25'
                                : 'border-dash-gold/30 bg-dash-gold/10 hover:border-dash-gold/70 hover:bg-dash-gold/15'
                            }`}
                            style={{
                              top,
                              height,
                              left: `calc(${column * widthPercent}% + 3px)`,
                              width: `calc(${widthPercent}% - 6px)`,
                            }}
                          >
                            <span
                              className="mx-auto flex h-full max-h-full items-center gap-2 whitespace-nowrap text-left font-semibold text-dash-cream"
                              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                            >
                              <span>{personName}</span>
                              <span className="font-normal text-dash-secondary">{roleLabel}</span>
                              <span className="font-mono font-normal text-dash-tertiary">{timeLabel}</span>
                            </span>
                          </button>
                        )
                      })}
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
            <h3 className="text-lg font-semibold">Shift Editor</h3>
            {!shiftForm ? (
              <p className="mt-3 text-sm leading-6 text-dash-secondary">Select a generated shift to assign a different employee, change the role, or lock it as a manual edit.</p>
            ) : (
              <div className="mt-4 space-y-3">
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
                  <TimeEntry value={shiftForm.shift_start} onChange={value => setShiftForm(prev => ({ ...prev, shift_start: value }))} placeholder="17:00" ariaLabel="Shift start" />
                  <TimeEntry value={shiftForm.shift_end} onChange={value => setShiftForm(prev => ({ ...prev, shift_end: value }))} placeholder="22:00" ariaLabel="Shift end" />
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
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void saveSelectedShift()} className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90">Save</button>
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
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Employee Requests</h3>
              <p className="mt-1 text-sm text-dash-secondary">Review time off, preferred shifts, availability exceptions, and requested weekly-hour changes.</p>
            </div>
            <button type="button" onClick={() => void loadEmployeeRequests()} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream">Refresh</button>
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
                  <TimeEntry value={coverageForm.start_time} onChange={value => setCoverageForm(prev => ({ ...prev, start_time: value }))} placeholder="17:00" ariaLabel="Coverage start" />
                  <TimeEntry value={coverageForm.end_time} onChange={value => setCoverageForm(prev => ({ ...prev, end_time: value }))} placeholder="22:00" ariaLabel="Coverage end" />
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
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void saveCoverageBlock()} className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90">Save block</button>
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
                <button type="button" onClick={() => void saveRequestPolicy()} className="mt-3 w-full rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream">Save limits</button>
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
            <button type="button" onClick={() => void saveRequestPolicy()} className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90">Save weights</button>
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
  { id: 'schedule', label: 'Schedule' },
  { id: 'availability', label: 'Availability' },
  { id: 'requests', label: 'Requests' },
  { id: 'preferences', label: 'Preferences' },
]

const EMPLOYEE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const EMPLOYEE_SHIFT_TYPES = ['breakfast', 'lunch', 'dinner', 'close', 'weekend']

const emptyAvailabilityForm = {
  day_of_week: 1,
  start_time: '17:00',
  end_time: '22:00',
  availability_type: 'preferred',
  notes: '',
}

const emptyRequestForm = {
  request_type: 'time_off',
  priority: 'normal',
  start_date: '',
  end_date: '',
  day_of_week: '',
  start_time: '',
  end_time: '',
  requested_weekly_hours: '',
  title: '',
  notes: '',
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
  const [schedule, setSchedule] = useState([])
  const [requests, setRequests] = useState([])
  const [availability, setAvailability] = useState([])
  const [preferences, setPreferences] = useState(null)
  const [activeEmployeeTab, setActiveEmployeeTab] = useState('schedule')
  const [availabilityForm, setAvailabilityForm] = useState(emptyAvailabilityForm)
  const [requestForm, setRequestForm] = useState(emptyRequestForm)
  const [employeeNote, setEmployeeNote] = useState('')
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
      employeeFetch('/employee/schedule'),
      employeeFetch('/employee/requests'),
      employeeFetch('/employee/availability'),
      employeeFetch('/employee/preferences'),
    ])
      .then(([me, shiftData, requestData, availabilityData, preferenceData]) => {
        if (cancelled) return
        setProfile(me)
        setSchedule(shiftData)
        setRequests(requestData)
        setAvailability(availabilityData)
        setPreferences(preferenceData || {
          preferred_roles: [],
          preferred_shift_types: [],
          preferred_sections: [],
          max_shifts_per_week: '',
          max_hours_per_week: '',
          min_hours_per_week: '',
          avoid_clopening: true,
          notes: '',
        })
      })
      .catch(err => {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Could not load employee portal')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (!token) {
    return <Navigate to="/auth/login" replace />
  }

  const signOut = () => {
    localStorage.removeItem('shire_employee_token')
    localStorage.removeItem('shire_employee_profile')
    navigate('/auth/login', { replace: true })
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

  const addAvailability = async () => {
    const nextAvailability = [...availability, availabilityForm]
    setAvailability(nextAvailability)
    setAvailabilityForm(emptyAvailabilityForm)
    await saveAvailability(nextAvailability)
  }

  const removeAvailability = async (index) => {
    const nextAvailability = availability.filter((_, itemIndex) => itemIndex !== index)
    setAvailability(nextAvailability)
    await saveAvailability(nextAvailability)
  }

  const savePreferences = async () => {
    setIsSaving(true)
    setMessage('')
    try {
      const saved = await employeeFetch('/employee/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          preferred_roles: preferences?.preferred_roles || [],
          preferred_shift_types: preferences?.preferred_shift_types || [],
          preferred_sections: preferences?.preferred_sections || [],
          max_shifts_per_week: preferences?.max_shifts_per_week === '' ? null : Number(preferences?.max_shifts_per_week),
          max_hours_per_week: preferences?.max_hours_per_week === '' ? null : Number(preferences?.max_hours_per_week),
          min_hours_per_week: preferences?.min_hours_per_week === '' ? null : Number(preferences?.min_hours_per_week),
          avoid_clopening: preferences?.avoid_clopening ?? true,
          notes: preferences?.notes || null,
        }),
      })
      setPreferences(saved)
      setMessage('Preferences saved.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save preferences')
    } finally {
      setIsSaving(false)
    }
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

  const submitRequestForm = async () => {
    const created = await createRequest({
      request_type: requestForm.request_type,
      priority: requestForm.priority,
      start_date: requestForm.start_date || null,
      end_date: requestForm.end_date || requestForm.start_date || null,
      day_of_week: requestForm.day_of_week === '' ? null : Number(requestForm.day_of_week),
      start_time: requestForm.start_time || null,
      end_time: requestForm.end_time || null,
      title: requestForm.title || null,
      notes: requestForm.notes || null,
      structured_payload: {
        source: 'employee_form',
        requested_weekly_hours: requestForm.requested_weekly_hours === '' ? null : Number(requestForm.requested_weekly_hours),
      },
    })
    if (created) setRequestForm(emptyRequestForm)
  }

  const submitEmployeeNote = async () => {
    if (!employeeNote.trim()) return
    setIsSaving(true)
    setMessage('')
    try {
      const created = await employeeFetch('/employee/requests/parse', {
        method: 'POST',
        body: JSON.stringify({ raw_text: employeeNote.trim() }),
      })
      setRequests(prev => [created, ...prev])
      setEmployeeNote('')
      setMessage('Scheduling note parsed and submitted.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not parse note')
    } finally {
      setIsSaving(false)
    }
  }

  const togglePreferredShiftType = (shiftType) => {
    setPreferences(prev => {
      const current = prev?.preferred_shift_types || []
      return {
        ...(prev || {}),
        preferred_shift_types: current.includes(shiftType)
          ? current.filter(item => item !== shiftType)
          : [...current, shiftType],
      }
    })
  }

  return (
    <main className="min-h-screen bg-dash-base px-6 py-8 text-dash-cream">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="label-mono">Employee Portal</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">{profile?.name || 'Employee'}</h1>
            <p className="mt-2 text-dash-secondary">Schedule, availability, ideal times, and requests.</p>
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

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-xl font-semibold">My Schedule</h2>
            <p className="mt-2 text-sm text-dash-secondary">{schedule.length} upcoming published shifts.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-xl font-semibold">Ideal Times</h2>
            <p className="mt-2 text-sm text-dash-secondary">Preferred shift windows and recurring availability live here.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-xl font-semibold">Requests</h2>
            <p className="mt-2 text-sm text-dash-secondary">{requests.length} submitted request{requests.length === 1 ? '' : 's'}.</p>
          </div>
        </section>

        <nav className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-2">
          {EMPLOYEE_PORTAL_TABS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveEmployeeTab(item.id)}
              className={[
                'rounded-xl px-4 py-2 text-sm font-semibold transition',
                activeEmployeeTab === item.id
                  ? 'bg-dash-gold text-black'
                  : 'text-dash-secondary hover:bg-white/[0.05] hover:text-dash-cream',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          {activeEmployeeTab === 'schedule' && (
            <div>
              <h2 className="text-2xl font-semibold">My Schedule</h2>
              {schedule.length === 0 ? (
                <p className="mt-4 text-sm text-dash-secondary">No published shifts are assigned yet.</p>
              ) : (
                <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
                  {schedule.map(shift => (
                    <div key={shift.id} className="grid gap-2 p-4 text-sm md:grid-cols-[1fr_1fr_1fr]">
                      <span className="font-semibold">{shift.shift_date}</span>
                      <span className="text-dash-secondary">{String(shift.shift_start).slice(0, 5)} - {String(shift.shift_end).slice(0, 5)}</span>
                      <span className="capitalize text-dash-tertiary">{shift.role || shift.schedule_status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeEmployeeTab === 'availability' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">Availability</h2>
                <p className="mt-2 text-sm text-dash-secondary">
                  Add preferred or unavailable windows. These feed the schedule optimizer.
                </p>
              </div>

              <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[150px_150px_120px_120px_1fr_auto]">
                <select value={availabilityForm.availability_type} onChange={event => setAvailabilityForm(prev => ({ ...prev, availability_type: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none">
                  <option value="preferred">Preferred</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="available">Available</option>
                </select>
                <select value={availabilityForm.day_of_week} onChange={event => setAvailabilityForm(prev => ({ ...prev, day_of_week: Number(event.target.value) }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none">
                  {EMPLOYEE_DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
                </select>
                <input type="time" value={availabilityForm.start_time} onChange={event => setAvailabilityForm(prev => ({ ...prev, start_time: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none" />
                <input type="time" value={availabilityForm.end_time} onChange={event => setAvailabilityForm(prev => ({ ...prev, end_time: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none" />
                <input value={availabilityForm.notes} onChange={event => setAvailabilityForm(prev => ({ ...prev, notes: event.target.value }))} placeholder="Notes optional" className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary" />
                <button type="button" onClick={() => void addAvailability()} disabled={isSaving} className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
                  Add
                </button>
              </div>

              {availability.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-dash-secondary">No availability windows saved yet.</p>
              ) : (
                <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
                  {availability.map((entry, index) => (
                    <div key={entry.id || `${entry.day_of_week}-${entry.start_time}-${index}`} className="grid gap-2 p-4 text-sm md:grid-cols-[130px_130px_1fr_auto] md:items-center">
                      <span className="capitalize font-semibold">{entry.availability_type}</span>
                      <span>{EMPLOYEE_DAYS[Number(entry.day_of_week)]}</span>
                      <span className="text-dash-secondary">{String(entry.start_time).slice(0, 5)} - {String(entry.end_time).slice(0, 5)}{entry.notes ? ` · ${entry.notes}` : ''}</span>
                      <button type="button" onClick={() => void removeAvailability(index)} className="rounded-xl border border-red-400/30 px-3 py-2 text-sm text-red-200 hover:border-red-300/60">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="font-semibold">Natural-language note</h3>
                <textarea value={employeeNote} onChange={event => setEmployeeNote(event.target.value)} rows={3} placeholder="I prefer Tuesday dinner but cannot close Friday this month." className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary" />
                <button type="button" onClick={() => void submitEmployeeNote()} disabled={!employeeNote.trim() || isSaving} className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">
                  Submit note
                </button>
                <p className="mt-2 text-xs text-dash-tertiary">Saved as a scheduling request when the parser can structure it; otherwise it remains a manager-visible note.</p>
              </div>
            </div>
          )}

          {activeEmployeeTab === 'requests' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">Requests</h2>
                <p className="mt-2 text-sm text-dash-secondary">Submit time off, shift preferences, or one-off availability exceptions.</p>
              </div>
              <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-2 lg:grid-cols-4">
                <select value={requestForm.request_type} onChange={event => setRequestForm(prev => ({ ...prev, request_type: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none">
                  <option value="time_off">Time off</option>
                  <option value="prefer_shift">Prefer shift</option>
                  <option value="avoid_shift">Avoid shift</option>
                  <option value="availability_exception">Availability exception</option>
                  <option value="weekly_hours">Weekly hours</option>
                </select>
                <select value={requestForm.priority} onChange={event => setRequestForm(prev => ({ ...prev, priority: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <input type="date" value={requestForm.start_date} onChange={event => setRequestForm(prev => ({ ...prev, start_date: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none" />
                <input type="date" value={requestForm.end_date} onChange={event => setRequestForm(prev => ({ ...prev, end_date: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none" />
                <select value={requestForm.day_of_week} onChange={event => setRequestForm(prev => ({ ...prev, day_of_week: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none">
                  <option value="">Any day</option>
                  {EMPLOYEE_DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
                </select>
                <input type="time" value={requestForm.start_time} onChange={event => setRequestForm(prev => ({ ...prev, start_time: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none" />
                <input type="time" value={requestForm.end_time} onChange={event => setRequestForm(prev => ({ ...prev, end_time: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none" />
                {requestForm.request_type === 'weekly_hours' && (
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="1"
                    value={requestForm.requested_weekly_hours}
                    onChange={event => setRequestForm(prev => ({ ...prev, requested_weekly_hours: event.target.value }))}
                    placeholder="Requested hrs/week"
                    className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary"
                  />
                )}
                <input value={requestForm.title} onChange={event => setRequestForm(prev => ({ ...prev, title: event.target.value }))} placeholder="Title optional" className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary" />
                <textarea value={requestForm.notes} onChange={event => setRequestForm(prev => ({ ...prev, notes: event.target.value }))} placeholder="Details" rows={3} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary lg:col-span-3" />
                <button type="button" onClick={() => void submitRequestForm()} disabled={isSaving} className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
                  Submit
                </button>
              </div>
              {requests.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-dash-secondary">No requests submitted yet.</p>
              ) : (
                <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
                  {requests.map(request => (
                    <div key={request.id} className="grid gap-2 p-4 text-sm md:grid-cols-[150px_120px_1fr]">
                      <span className="capitalize font-semibold">{String(request.request_type || '').replaceAll('_', ' ')}</span>
                      <span className="capitalize text-dash-secondary">{request.status || 'pending'}</span>
                      <span className="text-dash-tertiary">{request.title || request.notes || 'Request'} {request.start_date ? `· ${request.start_date}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeEmployeeTab === 'preferences' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">Preferences</h2>
                <p className="mt-2 text-sm text-dash-secondary">Standing preferences the scheduler can consider after coverage requirements.</p>
              </div>
              <div>
                <p className="label-mono mb-3">Preferred shift types</p>
                <div className="flex flex-wrap gap-2">
                  {EMPLOYEE_SHIFT_TYPES.map(shiftType => (
                    <button
                      key={shiftType}
                      type="button"
                      onClick={() => togglePreferredShiftType(shiftType)}
                      className={[
                        'rounded-full px-3 py-1.5 text-sm font-semibold capitalize transition',
                        preferences?.preferred_shift_types?.includes(shiftType)
                          ? 'bg-white text-black'
                          : 'bg-white/[0.05] text-dash-tertiary hover:bg-white/[0.1]',
                      ].join(' ')}
                    >
                      {shiftType}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <input type="number" min="0" max="7" value={preferences?.min_hours_per_week ?? ''} onChange={event => setPreferences(prev => ({ ...(prev || {}), min_hours_per_week: event.target.value }))} placeholder="Min hours/week" className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary" />
                <input type="number" min="1" max="60" value={preferences?.max_hours_per_week ?? ''} onChange={event => setPreferences(prev => ({ ...(prev || {}), max_hours_per_week: event.target.value }))} placeholder="Max hours/week" className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary" />
                <input type="number" min="1" max="7" value={preferences?.max_shifts_per_week ?? ''} onChange={event => setPreferences(prev => ({ ...(prev || {}), max_shifts_per_week: event.target.value }))} placeholder="Max shifts/week" className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary" />
              </div>
              <label className="flex items-center gap-3 text-sm text-dash-secondary">
                <input type="checkbox" checked={preferences?.avoid_clopening ?? true} onChange={event => setPreferences(prev => ({ ...(prev || {}), avoid_clopening: event.target.checked }))} />
                Avoid close/open back-to-back when possible
              </label>
              <textarea value={preferences?.notes || ''} onChange={event => setPreferences(prev => ({ ...(prev || {}), notes: event.target.value }))} rows={4} placeholder="Anything else managers should know." className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary" />
              <button type="button" onClick={() => void savePreferences()} disabled={isSaving} className="rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
                Save preferences
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
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

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2)
  const minutes = i % 2 === 0 ? '00' : '30'
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return {
    value: `${hours.toString().padStart(2, '0')}:${minutes}`,
    label: `${displayHours}:${minutes} ${period}`,
  }
})

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
  const [menuItems, setMenuItems] = useState([])
  const [setupError, setSetupError] = useState('')
  const [staffForm, setStaffForm] = useState({ name: '', email: '', role: 'server', pin: '1111', employee_login_id: '' })
  const [tableForm, setTableForm] = useState({ table_number: '', capacity: '2', table_type: 'standard', location: 'inside' })
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
      const [staffRows, tableRows, menuRows] = await Promise.all([
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=false`),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tables?include_inactive=false`),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/items`),
      ])
      setWaiters(Array.isArray(staffRows) ? staffRows : [])
      setTables(Array.isArray(tableRows) ? tableRows : [])
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
      }),
    })
    setTables(prev => [...prev, created])
    setTableForm({ table_number: '', capacity: '2', table_type: 'standard', location: 'inside' })
    onSetupChanged?.()
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
              <div className="grid gap-3 md:grid-cols-4">
                <TextInput placeholder="Table #" value={tableForm.table_number} onChange={event => setTableForm(prev => ({ ...prev, table_number: event.target.value }))} />
                <TextInput type="number" min="1" placeholder="Capacity" value={tableForm.capacity} onChange={event => setTableForm(prev => ({ ...prev, capacity: event.target.value }))} />
                <select value={tableForm.table_type} onChange={event => setTableForm(prev => ({ ...prev, table_type: event.target.value }))} className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-dash-cream outline-none focus:border-dash-gold/70">
                  <option value="standard">Standard</option>
                  <option value="bar">Bar</option>
                  <option value="booth">Booth</option>
                  <option value="patio">Patio</option>
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
                    <div key={table.id} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 md:grid-cols-[1fr_110px_140px_auto]">
                      <TextInput defaultValue={table.table_number || ''} onBlur={event => void updateTable(table.id, { table_number: event.target.value })} />
                      <TextInput type="number" min="1" defaultValue={table.capacity || ''} onBlur={event => void updateTable(table.id, { capacity: Number(event.target.value || 0) })} />
                      <span className="px-3 py-3 text-sm capitalize text-dash-secondary">{table.table_type || 'standard'}</span>
                      <SmallButton variant="danger" onClick={() => void removeTable(table.id)}>Remove</SmallButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSetupTab === 'operations' && activeSubTab === 'Sections' && (
            <SetupPlaceholder title="Sections">
              Section editing will connect to the floor-plan section records. Tables are editable in Capacity right now.
            </SetupPlaceholder>
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

function RestaurantWorkspace() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { restaurantId, tab = 'analytics' } = useParams()
  const restaurant = auth.restaurant.restaurants.find((item) => item.id === restaurantId) ?? null
  const activeTab = TABS.some((item) => item.id === tab) ? tab : 'analytics'
  const [waiterCount, setWaiterCount] = useState(null)
  const [floorPlanStatus, setFloorPlanStatus] = useState(null)
  const [setupRefreshKey, setSetupRefreshKey] = useState(0)

  const setupWarnings = useMemo(
    () => buildModernSetupWarnings(restaurant || {}, waiterCount, floorPlanStatus),
    [restaurant, waiterCount, floorPlanStatus]
  )

  useEffect(() => {
    if (!restaurantId || !restaurant) return
    if (auth.restaurant.currentRestaurant?.id !== restaurantId) {
      void auth.switchRestaurant(restaurantId)
    }
  }, [auth.restaurant.currentRestaurant?.id, auth.switchRestaurant, restaurant, restaurantId])

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

  if (!restaurantId) {
    return <Navigate to="/restaurants" replace />
  }

  if (!restaurant) {
    return (
      <ProtectedRoute>
        <main className="min-h-screen bg-dash-base text-dash-cream px-6 py-8">
          <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-white/[0.035] p-8">
            <h1 className="text-2xl font-semibold">Restaurant not found</h1>
            <p className="mt-2 text-dash-secondary">This account is not tied to that restaurant.</p>
            <Link to="/restaurants" className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black">
              Back to restaurants
            </Link>
          </div>
        </main>
      </ProtectedRoute>
    )
  }

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
        <main className="min-h-screen bg-dash-base text-dash-cream px-6 py-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <RestaurantWorkspaceHeader
              restaurant={restaurant}
              restaurantId={restaurantId}
              activeTab={activeTab}
              auth={auth}
              navigate={navigate}
              setupWarnings={setupWarnings}
            />
            <ModernRestaurantSetupPanel
              restaurant={restaurant}
              restaurantId={restaurantId}
              auth={auth}
              setupWarnings={setupWarnings}
              onSetupChanged={() => setSetupRefreshKey(key => key + 1)}
            />
          </div>
        </main>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-dash-base text-dash-cream px-6 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <RestaurantWorkspaceHeader
            restaurant={restaurant}
            restaurantId={restaurantId}
            activeTab={activeTab}
            auth={auth}
            navigate={navigate}
            setupWarnings={setupWarnings}
          />

          {activeTab === 'analytics' && <AnalyticsDashboard restaurant={restaurant} />}
          {activeTab === 'scheduling' && <SchedulingPanel restaurantId={restaurantId} />}
          {activeTab === 'payments' && (
            <PlaceholderPanel title="Payments / Plan" eyebrow="Placeholder">
              <p>Plan management, billing status, payment method, and subscription controls will live here.</p>
            </PlaceholderPanel>
          )}
        </div>
      </main>
    </ProtectedRoute>
  )
}

function RestaurantWorkspaceHeader({ restaurant, restaurantId, activeTab, auth, navigate, setupWarnings }) {
  const needsSetupAttention = modernWarningCount(setupWarnings || {}) > 0
  return (
    <header className="space-y-5 border-b border-white/10 pb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link
            to="/restaurants"
            className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream"
          >
            All restaurants
          </Link>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{restaurant.name}</h1>
          <p className="mt-2 text-dash-secondary">
            {[restaurant.city, restaurant.state].filter(Boolean).join(', ') || 'Restaurant workspace'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void auth.signOut()}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-dash-secondary transition hover:border-white/20 hover:text-dash-cream"
        >
          Sign out
        </button>
      </div>
      <nav className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(`/restaurants/${restaurantId}/${item.id}`)}
            className={[
              'rounded-xl px-4 py-2 text-sm font-semibold transition',
              activeTab === item.id
                ? 'bg-dash-gold text-black'
                : 'border border-white/10 text-dash-secondary hover:border-white/20 hover:text-dash-cream',
            ].join(' ')}
          >
            {item.label}
            {item.id === 'setup' && needsSetupAttention && <WarningTriangle className="ml-2 align-middle" />}
          </button>
        ))}
      </nav>
    </header>
  )
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
        <Route path="restaurants" element={<RestaurantSelector />} />
        <Route path="restaurants/:restaurantId" element={<Navigate to="analytics" replace />} />
        <Route path="restaurants/:restaurantId/:tab" element={<RestaurantWorkspace />} />
        <Route index element={<OwnerGate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

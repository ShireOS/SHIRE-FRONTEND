import { useEffect, useMemo, useState } from 'react'
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

function buildSetupWarnings(restaurant, waiterCount = null) {
  const warnings = {
    profile: [],
    operations: [],
    team: [],
    integrations: [],
  }

  if (!restaurant.name) warnings.profile.push('Restaurant name')
  if (!restaurant.city || !restaurant.state) warnings.profile.push('Location')
  if (!restaurant.phone) warnings.profile.push('Phone')

  if (!restaurant.seating_capacity) warnings.operations.push('Seating capacity')
  if (!restaurant.table_count) warnings.operations.push('Table count')
  if (!restaurant.floor_plan_data && !restaurant.floor_plan_image_url) warnings.operations.push('Floor plan')

  if (waiterCount === 0) warnings.team.push('Employees')

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

function AnalyticsPlaceholder({ restaurant }) {
  return (
    <div className="space-y-5">
      <PlaceholderPanel title="Analytics" eyebrow="Coming online">
        <p>
          Placeholder analytics workspace for {restaurant?.name || 'this restaurant'}. This will house revenue,
          covers, table turns, staff efficiency, menu performance, and operational insights.
        </p>
      </PlaceholderPanel>
      <div className="grid gap-4 md:grid-cols-3">
        {['Revenue', 'Covers', 'Table Turns'].map((label) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-dash-tertiary">{label}</p>
            <p className="mt-3 text-3xl font-semibold">--</p>
            <p className="mt-2 text-sm text-dash-secondary">Waiting for live analytics data.</p>
          </div>
        ))}
      </div>
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
    throw new Error(body.detail || body.message || `Request failed (${response.status})`)
  }
  if (response.status === 204) return null
  return response.json()
}

function SchedulingPanel({ restaurantId }) {
  const [weekStart, setWeekStart] = useState('')
  const [requirements, setRequirements] = useState([])
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/staffing-requirements`)
      .then(data => {
        if (!cancelled) setRequirements(data)
      })
      .catch(err => {
        if (!cancelled) setStatus(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  const createManualRun = async () => {
    setStatus('Creating schedule run...')
    try {
      const body = weekStart ? { week_start_date: weekStart } : {}
      await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/schedules/run?run_engine=false`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setStatus('Draft run created. Engine generation comes next.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not create run')
    }
  }

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="label-mono">Scheduling</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Calendar Builder</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-dash-secondary">
              Coverage requirements, employee availability, requests, and manager notes feed the schedule draft.
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
        {status && <p className="mt-4 text-sm text-dash-secondary">{status}</p>}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="grid grid-cols-7 border-b border-white/10">
            {days.map(day => (
              <div key={day} className="px-4 py-3 text-sm font-semibold text-dash-secondary">
                {day}
              </div>
            ))}
          </div>
          <div className="grid min-h-[420px] grid-cols-7">
            {days.map(day => (
              <div key={day} className="border-r border-white/10 p-3 last:border-r-0">
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-dash-tertiary">
                  Shifts
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h3 className="text-lg font-semibold">Coverage Rules</h3>
            <p className="mt-2 text-sm text-dash-secondary">
              {requirements.length} active staffing requirement{requirements.length === 1 ? '' : 's'}.
            </p>
            <button className="mt-4 w-full rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream">
              Edit coverage
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h3 className="text-lg font-semibold">Manager Notes</h3>
            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              rows={5}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-dash-gold/70"
              placeholder="Ryan prefers Tuesday dinner. Jamie cannot close Friday."
            />
            <button
              type="button"
              disabled={!note.trim()}
              className="mt-3 w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
            >
              Parse note
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h3 className="text-lg font-semibold">Request Inbox</h3>
            <p className="mt-2 text-sm text-dash-secondary">
              Employee availability, ideal times, and time-off requests will queue here for approval.
            </p>
          </div>
        </aside>
      </section>
    </div>
  )
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
    ])
      .then(([me, shiftData, requestData]) => {
        if (cancelled) return
        setProfile(me)
        setSchedule(shiftData)
        setRequests(requestData)
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

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <h2 className="text-2xl font-semibold">Availability</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {['Preferred shifts', 'Unavailable windows', 'Time off', 'Profile'].map(label => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="font-semibold">{label}</h3>
                <p className="mt-2 text-sm text-dash-secondary">Editable workflow placeholder.</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

const SETUP_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'operations', label: 'Operations' },
  { id: 'menu', label: 'Menu' },
  { id: 'team', label: 'Team' },
  { id: 'integrations', label: 'Integrations' },
]

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

function RestaurantSetupPanel({ restaurant, restaurantId, auth, setupWarnings }) {
  const [activeSetupTab, setActiveSetupTab] = useState('profile')
  const [profile, setProfile] = useState(() => ({
    name: restaurant.name || '',
    address: restaurant.address || '',
    city: restaurant.city || '',
    state: restaurant.state || '',
    postal_code: restaurant.postal_code || '',
    phone: restaurant.phone || '',
    type: restaurant.type || 'casual',
  }))
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    setProfile({
      name: restaurant.name || '',
      address: restaurant.address || '',
      city: restaurant.city || '',
      state: restaurant.state || '',
      postal_code: restaurant.postal_code || '',
      phone: restaurant.phone || '',
      type: restaurant.type || 'casual',
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
    setSaveMessage('Saved.')
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
              className={[
                'block w-full rounded-lg px-3 py-2 text-left text-sm transition',
                index === 0
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
          {activeSetupTab === 'profile' && (
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

          {activeSetupTab === 'operations' && (
            <div className="space-y-4">
              {setupWarnings.operations.length > 0 && (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                  Missing: {setupWarnings.operations.join(', ')}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <SetupPlaceholder title="Operating Hours">
                  Edit service days, open/close windows, and holiday exceptions here.
                </SetupPlaceholder>
                <SetupPlaceholder title="Capacity">
                  Manage table count, seating capacity, and named floor sections.
                </SetupPlaceholder>
              </div>
            </div>
          )}

          {activeSetupTab === 'menu' && (
            <div className="grid gap-4 md:grid-cols-2">
              <SetupPlaceholder title="Menu Items">
                Menu item editor and import status will live here.
              </SetupPlaceholder>
              <SetupPlaceholder title="Modifiers">
                Modifier groups, required choices, and add-on pricing will live here.
              </SetupPlaceholder>
            </div>
          )}

          {activeSetupTab === 'team' && (
            <div className="space-y-4">
              {setupWarnings.team.length > 0 && (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                  Missing: {setupWarnings.team.join(', ')}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <SetupPlaceholder title="Staff Directory">
                  Owners, managers, employees, roles, and invites will live here.
                </SetupPlaceholder>
                <SetupPlaceholder title="Permissions">
                  Role-level access to analytics, scheduling, setup, and billing will live here.
                </SetupPlaceholder>
              </div>
            </div>
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

  const setupWarnings = useMemo(
    () => buildSetupWarnings(restaurant || {}, waiterCount),
    [restaurant, waiterCount]
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
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=true`)
      .then(data => {
        if (!cancelled) setWaiterCount(Array.isArray(data) ? data.length : 0)
      })
      .catch(() => {
        if (!cancelled) setWaiterCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [restaurant, restaurantId])

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
            <RestaurantSetupPanel
              restaurant={restaurant}
              restaurantId={restaurantId}
              auth={auth}
              setupWarnings={setupWarnings}
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

          {activeTab === 'analytics' && <AnalyticsPlaceholder restaurant={restaurant} />}
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
  const needsSetupAttention = warningCount(setupWarnings || {}) > 0
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

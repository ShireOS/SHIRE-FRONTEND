import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import { API_CONFIG } from '../shared/api/config'
import { FloorPlanEditor } from '../onboarding/components/FloorPlanEditor'
import { normalizeFloorPlanTablesForEditor } from '../onboarding/components/FloorPlanCanvas'
import { MenuEditor } from '../onboarding/components/MenuEditor'
import { ModifierEditor } from '../onboarding/components/ModifierEditor'

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

const CAPACITY_OPTIONS = [
  { value: 20, label: 'Small', description: 'Under 30 seats' },
  { value: 50, label: 'Medium', description: '30-60 seats' },
  { value: 80, label: 'Large', description: '60-100 seats' },
  { value: 150, label: 'Very Large', description: '100+ seats' },
]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DEFAULT_HOURS = [
  { day_of_week: 0, open_time: '11:00', close_time: '22:00', is_closed: true },
  { day_of_week: 1, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 2, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 3, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 4, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 5, open_time: '11:00', close_time: '23:00', is_closed: false },
  { day_of_week: 6, open_time: '11:00', close_time: '23:00', is_closed: false },
]

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

const ROLE_OPTIONS = ['server', 'bartender', 'host', 'manager', 'busser', 'runner']

function WarningTriangle({ className = '' }) {
  return (
    <span
      aria-label="Needs attention"
      title="Needs attention"
      className={`inline-block h-0 w-0 border-x-[5px] border-b-[9px] border-x-transparent border-b-amber-300 ${className}`}
    />
  )
}

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
      className={[
        'w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-dash-cream outline-none transition placeholder:text-dash-tertiary focus:border-dash-gold/70',
        props.className || '',
      ].join(' ')}
    />
  )
}

function SelectInput(props) {
  return (
    <select
      {...props}
      className={[
        'w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-dash-cream outline-none transition focus:border-dash-gold/70',
        props.className || '',
      ].join(' ')}
    />
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

function OptionCard({ title, description, onClick, disabled = false, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative rounded-xl border p-4 text-left transition',
        disabled
          ? 'cursor-not-allowed border-white/5 bg-white/[0.01] opacity-50'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.055]',
      ].join(' ')}
    >
      {badge && (
        <span className="absolute right-3 top-3 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-dash-tertiary">
          {badge}
        </span>
      )}
      <h3 className="text-sm font-semibold text-dash-cream">{title}</h3>
      <p className="mt-2 text-sm leading-5 text-dash-tertiary">{description}</p>
    </button>
  )
}

function SectionShell({ title, description, children, actions }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
          {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-dash-secondary">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function defaultEmployeeId(value) {
  return value.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9_]+/g, '') || ''
}

function normalizeHours(rows) {
  const byDay = new Map((rows || []).map(row => [Number(row.day_of_week), row]))
  return DEFAULT_HOURS.map(fallback => {
    const row = byDay.get(fallback.day_of_week)
    return {
      day_of_week: fallback.day_of_week,
      open_time: row?.open_time?.slice(0, 5) || fallback.open_time,
      close_time: row?.close_time?.slice(0, 5) || fallback.close_time,
      is_closed: row?.is_closed ?? fallback.is_closed,
    }
  })
}

function deriveSameHours(hours) {
  const openDays = hours.filter(day => !day.is_closed)
  if (openDays.length <= 1) return true
  const first = openDays[0]
  return openDays.every(day => day.open_time === first.open_time && day.close_time === first.close_time)
}

function mapFloorPlanTables(fp) {
  if (!fp?.has_floor_plan || !Array.isArray(fp.tables)) return []
  return normalizeFloorPlanTablesForEditor(fp.tables.map(table => ({
    id: table.id || crypto.randomUUID(),
    center_x: table.position?.center_x ?? 50,
    center_y: table.position?.center_y ?? 50,
    width: table.position?.width ?? 12,
    height: table.position?.height ?? 10,
    capacity: table.capacity ?? 4,
    shape: table.shape || 'rectangular',
    confidence: table.confidence,
    notes: table.notes,
  })))
}

function mapMenuItems(items) {
  return (Array.isArray(items) ? items : []).map(item => ({
    id: item.id ?? crypto.randomUUID(),
    name: item.name ?? '',
    category: item.category ?? '',
    price: item.price != null ? String(item.price) : '',
    description: item.description ?? '',
  }))
}

async function fetchWithSupabaseAuth(endpoint, options = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  const headers = new Headers(options.headers || {})
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
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

export function buildSetupWarnings(restaurant, waiterCount = null, floorPlanStatus = null) {
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

export function warningCount(warnings) {
  return Object.values(warnings || {}).reduce((sum, items) => sum + items.length, 0)
}

export default function RestaurantSetupPanel({ restaurant, restaurantId, auth, setupWarnings = {}, onSetupChanged }) {
  const [activeSetupTab, setActiveSetupTab] = useState('basics')
  const [profile, setProfile] = useState(() => ({
    name: restaurant.name || '',
    address: restaurant.address || '',
    city: restaurant.city || '',
    state: restaurant.state || '',
    postal_code: restaurant.postal_code || '',
    phone: restaurant.phone || '',
    type: restaurant.type || 'casual',
    cuisine_types: Array.isArray(restaurant.cuisine_types) ? restaurant.cuisine_types : [],
    seating_capacity: restaurant.seating_capacity || '',
    table_count: restaurant.table_count || '',
  }))
  const [hours, setHours] = useState(DEFAULT_HOURS)
  const [sameHours, setSameHours] = useState(true)
  const [floorTables, setFloorTables] = useState([])
  const [floorPlanMode, setFloorPlanMode] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [menuMode, setMenuMode] = useState(null)
  const [waiters, setWaiters] = useState([])
  const [staffForm, setStaffForm] = useState({ name: '', email: '', role: 'server', pin: '1111', employee_login_id: '', suggested_weekly_hours: '' })
  const [pinEdits, setPinEdits] = useState({})
  const [pinSaving, setPinSaving] = useState({})
  const [pinSaved, setPinSaved] = useState({})
  const [setupError, setSetupError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setProfile({
      name: restaurant.name || '',
      address: restaurant.address || '',
      city: restaurant.city || '',
      state: restaurant.state || '',
      postal_code: restaurant.postal_code || '',
      phone: restaurant.phone || '',
      type: restaurant.type || 'casual',
      cuisine_types: Array.isArray(restaurant.cuisine_types) ? restaurant.cuisine_types : [],
      seating_capacity: restaurant.seating_capacity || '',
      table_count: restaurant.table_count || '',
    })
    setSaveMessage('')
  }, [restaurant])

  const loadMenuItems = async () => {
    const rows = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/items`)
    setMenuItems(mapMenuItems(rows))
  }

  const loadSetupData = async () => {
    if (!restaurantId) return
    setSetupError('')
    try {
      const [staffRows, menuRows, hoursResult, floorPlan] = await Promise.all([
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=false`),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/items`),
        supabase
          .from('operating_hours')
          .select('day_of_week, open_time, close_time, is_closed')
          .eq('restaurant_id', restaurantId)
          .order('day_of_week'),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/floor-plan`).catch(() => null),
      ])

      if (hoursResult.error) throw hoursResult.error
      const normalized = normalizeHours(hoursResult.data)
      setHours(normalized)
      setSameHours(deriveSameHours(normalized))
      setWaiters(Array.isArray(staffRows) ? staffRows : [])
      setMenuItems(mapMenuItems(menuRows))
      setFloorTables(mapFloorPlanTables(floorPlan))
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not load setup data.')
    }
  }

  useEffect(() => {
    void loadSetupData()
  }, [restaurantId])

  const referenceHours = useMemo(() => hours.find(day => !day.is_closed) || hours[1] || DEFAULT_HOURS[1], [hours])

  const updateDayHours = (dayIndex, field, value) => {
    setHours(prev => {
      const next = prev.map(day => ({ ...day }))
      next[dayIndex] = { ...next[dayIndex], [field]: value }
      if (sameHours && field !== 'is_closed') {
        next.forEach((day, index) => {
          if (!day.is_closed) next[index] = { ...day, [field]: value }
        })
      }
      return next
    })
  }

  const toggleSameHours = (same) => {
    setSameHours(same)
    if (!same) return
    setHours(prev => {
      const firstOpen = prev.find(day => !day.is_closed)
      if (!firstOpen) return prev
      return prev.map(day => day.is_closed ? day : {
        ...day,
        open_time: firstOpen.open_time,
        close_time: firstOpen.close_time,
      })
    })
  }

  const saveBasics = async () => {
    setIsSaving(true)
    setSaveMessage('')
    setSetupError('')
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
        cuisine_types: profile.cuisine_types,
      })
      .eq('id', restaurantId)
      .select()
      .single()
    setIsSaving(false)
    if (error) {
      setSetupError(error.message || 'Could not save basics.')
      return
    }
    auth.seedCurrentRestaurant(updatedRestaurant)
    onSetupChanged?.()
    setSaveMessage('Saved basics.')
  }

  const saveHours = async () => {
    setIsSaving(true)
    setSaveMessage('')
    setSetupError('')
    const { error: deleteError } = await supabase
      .from('operating_hours')
      .delete()
      .eq('restaurant_id', restaurantId)
    if (deleteError) {
      setIsSaving(false)
      setSetupError(deleteError.message || 'Could not save hours.')
      return
    }
    const { error: insertError } = await supabase
      .from('operating_hours')
      .insert(hours.map(day => ({
        restaurant_id: restaurantId,
        day_of_week: day.day_of_week,
        open_time: day.open_time,
        close_time: day.close_time,
        is_closed: day.is_closed,
      })))
    setIsSaving(false)
    if (insertError) {
      setSetupError(insertError.message || 'Could not save hours.')
      return
    }
    setSaveMessage('Saved hours.')
  }

  const saveCapacity = async (patch = {}) => {
    setIsSaving(true)
    setSaveMessage('')
    setSetupError('')
    const nextCapacity = patch.seating_capacity ?? profile.seating_capacity
    const nextCount = patch.table_count ?? profile.table_count
    const { data: updatedRestaurant, error } = await supabase
      .from('restaurants')
      .update({
        seating_capacity: nextCapacity === '' ? null : Number(nextCapacity),
        table_count: nextCount === '' ? null : Number(nextCount),
      })
      .eq('id', restaurantId)
      .select()
      .single()
    setIsSaving(false)
    if (error) {
      setSetupError(error.message || 'Could not save capacity.')
      return
    }
    setProfile(prev => ({ ...prev, seating_capacity: nextCapacity, table_count: nextCount }))
    auth.seedCurrentRestaurant(updatedRestaurant)
    onSetupChanged?.()
    setSaveMessage('Saved capacity.')
  }

  const toggleCuisine = (cuisine) => {
    setProfile(prev => ({
      ...prev,
      cuisine_types: prev.cuisine_types.includes(cuisine)
        ? prev.cuisine_types.filter(item => item !== cuisine)
        : [...prev.cuisine_types, cuisine],
    }))
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
        suggested_weekly_hours: staffForm.suggested_weekly_hours === '' ? null : Number(staffForm.suggested_weekly_hours),
      }),
    })
    setWaiters(prev => [...prev, created])
    setStaffForm({ name: '', email: '', role: 'server', pin: '1111', employee_login_id: '', suggested_weekly_hours: '' })
    onSetupChanged?.()
  }

  const updateStaff = async (waiterId, updates) => {
    setSetupError('')
    const updated = await fetchWithSupabaseAuth(`/waiters/${waiterId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    setWaiters(prev => prev.map(item => item.id === waiterId ? updated : item))
    onSetupChanged?.()
  }

  const removeStaff = async (waiterId) => {
    await fetchWithSupabaseAuth(`/waiters/${waiterId}`, { method: 'DELETE' })
    setWaiters(prev => prev.filter(item => item.id !== waiterId))
    onSetupChanged?.()
  }

  const saveEditedPin = async (waiterId) => {
    const pin = pinEdits[waiterId]?.trim()
    if (!pin) {
      setSetupError('Enter a new PIN before saving.')
      return
    }
    setPinSaving(prev => ({ ...prev, [waiterId]: true }))
    setPinSaved(prev => ({ ...prev, [waiterId]: false }))
    try {
      await updateStaff(waiterId, { pin })
      setPinEdits(prev => ({ ...prev, [waiterId]: '' }))
      setPinSaved(prev => ({ ...prev, [waiterId]: true }))
      setSaveMessage('Saved PIN.')
      window.setTimeout(() => {
        setPinSaved(prev => ({ ...prev, [waiterId]: false }))
      }, 2500)
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not save PIN.')
    } finally {
      setPinSaving(prev => ({ ...prev, [waiterId]: false }))
    }
  }

  if (floorPlanMode) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <FloorPlanEditor
          restaurantId={restaurantId}
          mode={floorPlanMode}
          initialTables={floorTables}
          onBack={() => setFloorPlanMode(null)}
          onSave={(tables) => {
            setFloorTables(tables)
            setFloorPlanMode(null)
            setProfile(prev => ({ ...prev, table_count: tables.length }))
            void saveCapacity({ table_count: tables.length })
            onSetupChanged?.()
          }}
        />
      </section>
    )
  }

  if (menuMode) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <MenuEditor
          restaurantId={restaurantId}
          mode={menuMode}
          initialItems={menuItems}
          onBack={() => setMenuMode(null)}
          onSave={(items) => {
            setMenuItems(items)
            setMenuMode(null)
            onSetupChanged?.()
          }}
        />
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="label-mono">Restaurant Setup</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{restaurant.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-dash-secondary">
              Edit the same setup areas from onboarding without walking step-by-step through the full flow.
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
          {SETUP_TABS.map(item => (
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

      {setupError && (
        <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
          {setupError}
        </div>
      )}
      {saveMessage && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
          {saveMessage}
        </div>
      )}

      {activeSetupTab === 'basics' && (
        <SectionShell
          title="Basics"
          description="Restaurant name, location, type, phone, and cuisine tags from the original onboarding basics step."
          actions={<SmallButton variant="primary" onClick={() => void saveBasics()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save basics'}</SmallButton>}
        >
          {setupWarnings.basics?.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              Missing: {setupWarnings.basics.join(', ')}
            </div>
          )}
          <div className="space-y-6">
            <Field label="Restaurant Name">
              <TextInput value={profile.name} onChange={event => setProfile(prev => ({ ...prev, name: event.target.value }))} />
            </Field>
            <div className="space-y-4">
              <span className="label-mono block">Location</span>
              <TextInput placeholder="123 Main Street" value={profile.address} onChange={event => setProfile(prev => ({ ...prev, address: event.target.value }))} />
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput placeholder="City" value={profile.city} onChange={event => setProfile(prev => ({ ...prev, city: event.target.value }))} />
                <TextInput placeholder="State" value={profile.state} onChange={event => setProfile(prev => ({ ...prev, state: event.target.value }))} />
                <TextInput placeholder="Zip Code" value={profile.postal_code} onChange={event => setProfile(prev => ({ ...prev, postal_code: event.target.value }))} />
                <TextInput placeholder="Phone" value={profile.phone} onChange={event => setProfile(prev => ({ ...prev, phone: event.target.value }))} />
              </div>
            </div>
            <Field label="Restaurant Type">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {RESTAURANT_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setProfile(prev => ({ ...prev, type: type.value }))}
                    className={[
                      'rounded-xl border p-4 text-left text-sm font-semibold transition',
                      profile.type === type.value
                        ? 'border-dash-gold bg-dash-gold/10 text-dash-cream'
                        : 'border-white/10 bg-white/[0.03] text-dash-secondary hover:border-white/20 hover:text-dash-cream',
                    ].join(' ')}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Cuisine Type(s)">
              <div className="flex flex-wrap gap-2">
                {CUISINE_TYPES.map(cuisine => (
                  <button
                    key={cuisine}
                    type="button"
                    onClick={() => toggleCuisine(cuisine)}
                    className={[
                      'rounded-full px-3 py-1.5 text-sm font-medium transition',
                      profile.cuisine_types.includes(cuisine)
                        ? 'bg-white text-black'
                        : 'bg-white/[0.05] text-dash-tertiary hover:bg-white/[0.1]',
                    ].join(' ')}
                  >
                    {cuisine}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'hours' && (
        <SectionShell
          title="Hours"
          description="Actual operating hours, matching the original onboarding hours editor."
          actions={<SmallButton variant="primary" onClick={() => void saveHours()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save hours'}</SmallButton>}
        >
          <div className="mb-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <span className="text-sm text-dash-secondary">Same hours every day?</span>
            <div className="flex gap-2">
              <SmallButton variant={sameHours ? 'primary' : 'secondary'} onClick={() => toggleSameHours(true)}>Yes</SmallButton>
              <SmallButton variant={!sameHours ? 'primary' : 'secondary'} onClick={() => toggleSameHours(false)}>No, different</SmallButton>
            </div>
          </div>

          {sameHours ? (
            <div className="space-y-5 rounded-xl border border-white/10 bg-white/[0.025] p-5">
              <h4 className="text-sm font-semibold">Opening Hours</h4>
              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
                <Field label="Opens">
                  <SelectInput value={referenceHours.open_time} onChange={event => updateDayHours(1, 'open_time', event.target.value)}>
                    {TIME_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectInput>
                </Field>
                <span className="pb-3 text-sm text-dash-tertiary">to</span>
                <Field label="Closes">
                  <SelectInput value={referenceHours.close_time} onChange={event => updateDayHours(1, 'close_time', event.target.value)}>
                    {TIME_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectInput>
                </Field>
              </div>
              <div className="border-t border-white/10 pt-4">
                <p className="label-mono mb-3 text-dash-tertiary">Closed days</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day, index) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => updateDayHours(index, 'is_closed', !hours[index].is_closed)}
                      className={[
                        'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                        hours[index].is_closed
                          ? 'border border-red-500/20 bg-red-500/10 text-red-300'
                          : 'bg-white/[0.05] text-dash-tertiary hover:bg-white/[0.1]',
                      ].join(' ')}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {DAYS.map((day, index) => {
                const dayHours = hours[index]
                return (
                  <div key={day} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 md:grid-cols-[180px_1fr_1fr] md:items-center">
                    <label className="flex items-center gap-3 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={!dayHours.is_closed}
                        onChange={event => updateDayHours(index, 'is_closed', !event.target.checked)}
                      />
                      <span className={dayHours.is_closed ? 'text-dash-tertiary' : 'text-dash-cream'}>{day}</span>
                    </label>
                    {dayHours.is_closed ? (
                      <span className="md:col-span-2 text-sm text-dash-tertiary">Closed</span>
                    ) : (
                      <>
                        <SelectInput value={dayHours.open_time} onChange={event => updateDayHours(index, 'open_time', event.target.value)}>
                          {TIME_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </SelectInput>
                        <SelectInput value={dayHours.close_time} onChange={event => updateDayHours(index, 'close_time', event.target.value)}>
                          {TIME_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </SelectInput>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </SectionShell>
      )}

      {activeSetupTab === 'capacity' && (
        <SectionShell
          title="Capacity / Floor Plan"
          description="Seating capacity plus the visual table editor from onboarding. Use this to add, move, resize, and edit table seats."
          actions={<SmallButton variant="primary" onClick={() => void saveCapacity()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save capacity'}</SmallButton>}
        >
          {setupWarnings.capacity?.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              Missing: {setupWarnings.capacity.join(', ')}
            </div>
          )}
          <div className="space-y-6">
            <div>
              <span className="label-mono mb-3 block">Approximate Seating Capacity</span>
              <div className="grid grid-cols-2 gap-3">
                {CAPACITY_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setProfile(prev => ({ ...prev, seating_capacity: option.value }))}
                    className={[
                      'rounded-xl border p-4 text-left transition',
                      Number(profile.seating_capacity) === option.value
                        ? 'border-dash-gold bg-dash-gold/10'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20',
                    ].join(' ')}
                  >
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-1 block text-sm text-dash-tertiary">{option.description}</span>
                  </button>
                ))}
              </div>
              <TextInput
                type="number"
                min="0"
                className="mt-3"
                value={profile.seating_capacity}
                onChange={event => setProfile(prev => ({ ...prev, seating_capacity: event.target.value }))}
                placeholder="Or enter exact number..."
              />
            </div>

            <div>
              <span className="label-mono mb-3 block">Floor Plan</span>
              {floorTables.length > 0 ? (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                  Floor plan saved · {floorTables.length} table{floorTables.length !== 1 ? 's' : ''}
                  <button
                    type="button"
                    onClick={() => setFloorPlanMode('manual')}
                    className="ml-auto text-xs font-semibold text-dash-gold hover:opacity-80"
                  >
                    Edit visual layout
                  </button>
                </div>
              ) : (
                <SetupEmptyState title="No floor plan yet" actionLabel="Draw floor plan" onAction={() => setFloorPlanMode('manual')}>
                  Use the visual editor to create table records and positions. Upload mode can detect tables from a floor-plan image.
                </SetupEmptyState>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <OptionCard title="Upload Image" description="Upload a floor plan image and let AI detect tables." onClick={() => setFloorPlanMode('upload')} />
                <OptionCard title="Draw Manually" description="Open the visual table editor and place tables yourself." onClick={() => setFloorPlanMode('manual')} />
              </div>
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'menu' && (
        <SectionShell
          title="Menu"
          description="Use the original menu editor to upload, extract, add, edit, and save menu items."
        >
          {menuItems.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
              Menu saved · {menuItems.length} item{menuItems.length !== 1 ? 's' : ''}
              <button
                type="button"
                onClick={() => setMenuMode('manual')}
                className="ml-auto text-xs font-semibold text-dash-gold hover:opacity-80"
              >
                Edit menu
              </button>
            </div>
          ) : (
            <SetupEmptyState title="No menu items yet" actionLabel="Add menu manually" onAction={() => setMenuMode('manual')}>
              Add menu items manually or upload a menu image for extraction.
            </SetupEmptyState>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <OptionCard title="Upload Menu" description="Upload an image of your menu. AI extracts items automatically." onClick={() => setMenuMode('upload')} badge="Recommended" />
            <OptionCard title="Add Manually" description="Open the menu table editor and enter items one by one." onClick={() => setMenuMode('manual')} />
            <OptionCard title="Import from Toast" description="Connect POS menu import later." disabled badge="Coming soon" />
            <OptionCard title="Import from Website" description="Extract menu data from a website later." disabled badge="Coming soon" />
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'modifiers' && (
        <SectionShell
          title="Modifiers"
          description="Modifier groups and add-on pricing from the original onboarding modifier editor."
        >
          <ModifierEditor
            restaurantId={restaurantId}
            menuItems={menuItems}
            onBack={() => setActiveSetupTab('menu')}
            onDone={() => {
              setSaveMessage('Saved modifiers.')
              void loadMenuItems()
            }}
          />
        </SectionShell>
      )}

      {activeSetupTab === 'employees' && (
        <SectionShell
          title="Employees"
          description="Employee records, roles, login IDs, emails, and PIN updates. This replaces the old separate Roles tab."
        >
          {setupWarnings.employees?.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              Missing: {setupWarnings.employees.join(', ')}
            </div>
          )}
          <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 lg:grid-cols-[1fr_1fr_140px_110px_120px_130px_auto]">
            <TextInput placeholder="Name" value={staffForm.name} onChange={event => setStaffForm(prev => ({ ...prev, name: event.target.value, employee_login_id: prev.employee_login_id || defaultEmployeeId(event.target.value) }))} />
            <TextInput placeholder="Email optional" value={staffForm.email} onChange={event => setStaffForm(prev => ({ ...prev, email: event.target.value }))} />
            <SelectInput value={staffForm.role} onChange={event => setStaffForm(prev => ({ ...prev, role: event.target.value }))}>
              {ROLE_OPTIONS.map(role => <option key={role} value={role}>{role}</option>)}
            </SelectInput>
            <TextInput placeholder="Hrs/week" value={staffForm.suggested_weekly_hours} onChange={event => setStaffForm(prev => ({ ...prev, suggested_weekly_hours: event.target.value.replace(/[^\d.]/g, '').slice(0, 5) }))} />
            <TextInput placeholder="PIN" value={staffForm.pin} onChange={event => setStaffForm(prev => ({ ...prev, pin: event.target.value.replace(/\D/g, '').slice(0, 8) }))} />
            <TextInput placeholder="ID" value={staffForm.employee_login_id} onChange={event => setStaffForm(prev => ({ ...prev, employee_login_id: event.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '') }))} />
            <SmallButton variant="primary" onClick={() => void addStaff()}>Add</SmallButton>
          </div>

          <div className="mt-5 space-y-3">
            {waiters.length === 0 ? (
              <SetupEmptyState title="No employees yet" actionLabel="Add employee" onAction={() => void addStaff()}>
                Fill the row above and add employees for employee login, scheduling, and staff analytics.
              </SetupEmptyState>
            ) : (
              waiters.map(waiter => (
                <div key={waiter.id} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 xl:grid-cols-[1fr_1fr_130px_120px_150px_170px_100px_auto]">
                  <TextInput defaultValue={waiter.name || ''} onBlur={event => void updateStaff(waiter.id, { name: event.target.value })} />
                  <TextInput defaultValue={waiter.email || ''} placeholder="Email" onBlur={event => void updateStaff(waiter.id, { email: event.target.value || null })} />
                  <SelectInput defaultValue={waiter.role || 'server'} onChange={event => void updateStaff(waiter.id, { role: event.target.value })}>
                    {ROLE_OPTIONS.map(role => <option key={role} value={role}>{role}</option>)}
                  </SelectInput>
                  <TextInput defaultValue={waiter.suggested_weekly_hours ?? ''} placeholder="Hrs/week" onBlur={event => void updateStaff(waiter.id, { suggested_weekly_hours: event.target.value === '' ? null : Number(event.target.value) })} />
                  <TextInput defaultValue={waiter.employee_login_id || defaultEmployeeId(waiter.name || '')} placeholder="Login ID" onBlur={event => void updateStaff(waiter.id, { employee_login_id: event.target.value || defaultEmployeeId(waiter.name || '') })} />
                  <TextInput
                    placeholder="New PIN"
                    value={pinEdits[waiter.id] || ''}
                    onChange={event => {
                      setPinSaved(prev => ({ ...prev, [waiter.id]: false }))
                      setPinEdits(prev => ({ ...prev, [waiter.id]: event.target.value.replace(/\D/g, '').slice(0, 8) }))
                    }}
                  />
                  <SmallButton
                    variant={pinEdits[waiter.id] ? 'primary' : 'secondary'}
                    onClick={() => void saveEditedPin(waiter.id)}
                    disabled={!pinEdits[waiter.id] || pinSaving[waiter.id]}
                  >
                    {pinSaving[waiter.id] ? 'Saving...' : pinSaved[waiter.id] ? 'Saved' : 'Save PIN'}
                  </SmallButton>
                  <SmallButton variant="danger" onClick={() => void removeStaff(waiter.id)}>Remove</SmallButton>
                </div>
              ))
            )}
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'integrations' && (
        <SectionShell title="Integrations" description="Connections used by the live deployment. These controls are still placeholders.">
          <div className="grid gap-4 md:grid-cols-3">
            <OptionCard title="POS" description="Toast, Square, Clover, or manual imports." disabled />
            <OptionCard title="Scheduling" description="7shifts, Homebase, or SHIRE native scheduling." disabled />
            <OptionCard title="Reservations" description="Booking links, reservation providers, and sync settings." disabled />
          </div>
        </SectionShell>
      )}
    </div>
  )
}

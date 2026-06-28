import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import { API_CONFIG } from '../shared/api/config'
import { FloorPlanEditor } from '../onboarding/components/FloorPlanEditor'
import { normalizeFloorPlanTablesForEditor } from '../onboarding/components/FloorPlanCanvas'
import { MenuEditor } from '../onboarding/components/MenuEditor'
import { ModifierEditor } from '../onboarding/components/ModifierEditor'

const SETUP_TABS = [
  { id: 'basics', label: 'Basics' },
  { id: 'legal', label: 'Legal' },
  { id: 'payments', label: 'Payments' },
  { id: 'taxes_charges', label: 'Taxes & Charges' },
  { id: 'discounts', label: 'Discounts' },
  { id: 'sections', label: 'Sections' },
  { id: 'hours', label: 'Hours' },
  { id: 'capacity', label: 'Capacity / Floor Plan' },
  { id: 'menu', label: 'Menu' },
  { id: 'modifiers', label: 'Modifiers' },
  { id: 'routing', label: 'Kitchen Routing' },
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

const SERVICE_MODE_OPTIONS = [
  { id: 'dine_in', label: 'Dine-in' },
  { id: 'bar', label: 'Bar service' },
  { id: 'counter_service', label: 'Counter service' },
  { id: 'takeout', label: 'Takeout' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'catering', label: 'Catering' },
]

const GUEST_FLOW_OPTIONS = [
  { id: 'seat_first', label: 'Seat first' },
  { id: 'order_first', label: 'Order first' },
  { id: 'tab_first', label: 'Tab first' },
  { id: 'counter_pay', label: 'Counter pay' },
]

const TAX_APPLIES_TO_OPTIONS = [
  { value: 'all', label: 'All sales' },
  { value: 'food', label: 'Food' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'non_alcohol', label: 'Non-alcohol' },
  { value: 'merchandise', label: 'Merchandise' },
]

const CHARGE_APPLIES_TO_OPTIONS = [
  { value: 'all', label: 'All orders' },
  { value: 'dine_in', label: 'Dine-in' },
  { value: 'bar', label: 'Bar' },
  { value: 'takeout', label: 'Takeout' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'catering', label: 'Catering' },
  { value: 'large_party', label: 'Large party' },
]

const DISCOUNT_TYPE_OPTIONS = [
  { value: 'discount', label: 'Discount' },
  { value: 'comp', label: 'Comp' },
  { value: 'promo', label: 'Promo' },
  { value: 'employee_meal', label: 'Employee meal' },
  { value: 'service_recovery', label: 'Service recovery' },
]

const DISCOUNT_APPLIES_TO_OPTIONS = [
  { value: 'item', label: 'Item' },
  { value: 'check', label: 'Check' },
  { value: 'both', label: 'Both' },
]

const DISCOUNT_VALUE_TYPE_OPTIONS = [
  { value: 'percent', label: 'Percent' },
  { value: 'fixed', label: 'Fixed $' },
  { value: 'open', label: 'Open' },
]

const DISCOUNT_TAX_BEHAVIOR_OPTIONS = [
  { value: 'reduce_taxable_amount', label: 'Reduce taxable amount' },
  { value: 'apply_after_tax', label: 'Apply after tax' },
  { value: 'no_tax_impact', label: 'No tax impact' },
]

const DISCOUNT_ROLE_OPTIONS = ['owner', 'manager', 'server', 'bartender', 'cashier', 'host', 'runner', 'busser']
const DISCOUNT_SERVICE_MODE_OPTIONS = [
  { value: 'dine_in', label: 'Dine-in' },
  { value: 'bar', label: 'Bar' },
  { value: 'counter_service', label: 'Counter' },
  { value: 'takeout', label: 'Takeout' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'catering', label: 'Catering' },
]

const initialLegal = (restaurant) => {
  const config = restaurant.config && typeof restaurant.config === 'object' ? restaurant.config : {}
  return {
    legal_business_name: config.legal_business_name || '',
    dba_name: config.dba_name || '',
    ein: config.ein || '',
    legal_contact_name: config.legal_contact_name || '',
    legal_contact_title: config.legal_contact_title || '',
    legal_contact_email: config.legal_contact_email || '',
    legal_contact_phone: config.legal_contact_phone || '',
    tos_signature_data_url: config.tos_signature_data_url || '',
    tos_signed_at: config.tos_signed_at || '',
  }
}

const initialPayments = (restaurant) => {
  const config = restaurant.config && typeof restaurant.config === 'object' ? restaurant.config : {}
  return {
    bank_account_holder: config.bank_account_holder || '',
    bank_name: config.bank_name || '',
    bank_routing_number: config.bank_routing_number || '',
    bank_account_number: config.bank_account_number || '',
    payout_schedule: config.payout_schedule || 'daily',
    refund_funding_source: config.refund_funding_source || 'processor_balance',
    batch_close_mode: config.batch_close_mode || 'automatic',
    batch_close_time: config.batch_close_time || '04:00',
    credit_card_tip_payout: config.credit_card_tip_payout || 'payroll',
    refund_approval_threshold: config.refund_approval_threshold || '',
  }
}

const initialServiceModel = (restaurant) => {
  const config = restaurant.config && typeof restaurant.config === 'object' ? restaurant.config : {}
  return {
    service_modes: Array.isArray(config.service_modes) && config.service_modes.length > 0 ? config.service_modes : ['dine_in'],
    default_guest_flow: config.default_guest_flow || 'seat_first',
  }
}

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

function SignaturePad({ value, signedAt, onChange }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scale = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(rect.width * scale))
    canvas.height = Math.max(1, Math.floor(rect.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(scale, scale)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#f4f1e8'
    if (value) {
      const image = new Image()
      image.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height)
        ctx.drawImage(image, 0, 0, rect.width, rect.height)
      }
      image.src = value
    }
  }, [value])

  const getPoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const begin = (event) => {
    const ctx = event.currentTarget.getContext('2d')
    if (!ctx) return
    const point = getPoint(event)
    drawingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  const draw = (event) => {
    if (!drawingRef.current) return
    const ctx = event.currentTarget.getContext('2d')
    if (!ctx) return
    const point = getPoint(event)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }

  const end = (event) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
    onChange({
      tos_signature_data_url: event.currentTarget.toDataURL('image/png'),
      tos_signed_at: new Date().toISOString(),
    })
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    onChange({ tos_signature_data_url: '', tos_signed_at: '' })
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={begin}
        onPointerMove={draw}
        onPointerUp={end}
        onPointerCancel={end}
        className="h-36 w-full touch-none rounded-xl border border-dashed border-white/20 bg-black/25"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-dash-tertiary">
          {signedAt ? `Signed ${new Date(signedAt).toLocaleString()}` : 'Draw signature above.'}
        </p>
        <SmallButton onClick={clear}>Clear signature</SmallButton>
      </div>
    </div>
  )
}

function KitchenRoutingSetup({ restaurantId }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stationName, setStationName] = useState('')
  const [targetName, setTargetName] = useState('Kitchen Printer')
  const [targetHost, setTargetHost] = useState('')
  const [selectedStationId, setSelectedStationId] = useState('')

  const stations = config?.stations || []
  const targets = config?.targets || []
  const categories = useMemo(() => {
    return Array.from(new Set((config?.menu_items || []).map(item => item.category || 'Other'))).sort()
  }, [config])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const next = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/kitchen-routing`)
      setConfig(next)
      setSelectedStationId(current => current || next.stations?.[0]?.id || '')
    } catch {
      setError('Could not load kitchen routing.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [restaurantId])

  const createStation = async () => {
    if (!stationName.trim()) return
    await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/kitchen-routing/stations`, {
      method: 'POST',
      body: JSON.stringify({ name: stationName.trim(), is_active: true }),
    })
    setStationName('')
    await load()
  }

  const createTarget = async () => {
    await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/kitchen-routing/targets`, {
      method: 'POST',
      body: JSON.stringify({
        name: targetName.trim() || 'Kitchen Printer',
        target_type: 'printer',
        connection_type: targetHost.trim() ? 'network' : 'dummy',
        config: targetHost.trim() ? { host: targetHost.trim(), port: 9100, profile: 'TM-T88V' } : {},
        is_active: true,
      }),
    })
    setTargetHost('')
    await load()
  }

  const assignTarget = async (stationId, targetId) => {
    await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/kitchen-routing/station-targets`, {
      method: 'POST',
      body: JSON.stringify({ station_id: stationId, target_id: targetId, priority: 0, is_active: true }),
    })
    await load()
  }

  const setFallback = async (stationId) => {
    try {
      await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/kitchen-routing/fallback`, {
        method: 'PUT',
        body: JSON.stringify({ station_id: stationId }),
      })
      await load()
    } catch {
      setError('Fallback station needs an active output target first.')
    }
  }

  const routeCategory = async (category) => {
    if (!selectedStationId) return
    await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/kitchen-routing/rules`, {
      method: 'POST',
      body: JSON.stringify({ source_type: 'category', category, station_id: selectedStationId, target_types: ['printer', 'display'] }),
    })
    await load()
  }

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
      {loading && <div className="text-sm text-dash-tertiary">Loading routing...</div>}

      <div className={`rounded-xl border p-4 ${config?.fallback?.ok ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-red-400/20 bg-red-400/10'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label-mono">Required Fallback</p>
            <p className="mt-1 text-sm text-dash-secondary">{config?.fallback?.ok ? 'Fallback station has an active target.' : config?.fallback?.reason || 'Kitchen send is blocked until fallback is configured.'}</p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-dash-cream">{config?.fallback?.ok ? 'Ready' : 'Blocked'}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <h4 className="text-sm font-semibold">Stations</h4>
          <div className="mt-3 flex gap-2">
            <TextInput value={stationName} onChange={event => setStationName(event.target.value)} placeholder="Expo, Grill, Bar" />
            <SmallButton variant="primary" onClick={() => void createStation()}>Add</SmallButton>
          </div>
          <div className="mt-4 space-y-2">
            {stations.map(station => (
              <div key={station.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm">
                <span>{station.name}</span>
                <SmallButton onClick={() => void setFallback(station.id)}>{station.is_fallback ? 'Fallback' : 'Use fallback'}</SmallButton>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <h4 className="text-sm font-semibold">Targets</h4>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <TextInput value={targetName} onChange={event => setTargetName(event.target.value)} placeholder="Target name" />
            <TextInput value={targetHost} onChange={event => setTargetHost(event.target.value)} placeholder="Host/IP or blank dummy" />
            <SmallButton variant="primary" onClick={() => void createTarget()}>Add</SmallButton>
          </div>
          <div className="mt-4 space-y-2">
            {targets.map(target => (
              <div key={target.id} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm md:grid-cols-[1fr_auto]">
                <span>{target.name} · {target.connection_type}</span>
                {stations[0] && <SmallButton onClick={() => void assignTarget(stations[0].id, target.id)}>Assign first station</SmallButton>}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-sm font-semibold">Category Defaults</h4>
          <SelectInput value={selectedStationId} onChange={event => setSelectedStationId(event.target.value)}>
            {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
          </SelectInput>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map(category => (
            <SmallButton key={category} onClick={() => void routeCategory(category)}>{category}</SmallButton>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
        <h4 className="text-sm font-semibold">Item Coverage</h4>
        <div className="mt-3 space-y-2">
          {(config?.menu_items || []).map(item => (
            <div key={item.id} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm md:grid-cols-[1fr_auto]">
              <span>{item.name}</span>
              <span className={item.routing_publishable ? 'text-emerald-200' : 'text-amber-200'}>
                {item.routing_publishable ? 'Confirmed' : 'Needs confirmation'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
        <h4 className="text-sm font-semibold">Audit</h4>
        <div className="mt-3 space-y-2 text-sm text-dash-tertiary">
          {(config?.audit_events || []).slice(0, 20).map(event => (
            <div key={event.id} className="rounded-lg border border-white/10 px-3 py-2">{event.action} · {new Date(event.created_at).toLocaleString()}</div>
          ))}
        </div>
      </section>
    </div>
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
    section_id: table.section_id ?? null,
    section_name: table.section_name ?? null,
    confidence: table.confidence,
    notes: table.notes,
  })))
}

function normalizeSectionNames(sections) {
  const seen = new Set()
  const out = []
  ;['Table', ...(Array.isArray(sections) ? sections : [])].forEach(raw => {
    const name = String(raw || '').trim().replace(/\s+/g, ' ')
    if (!name) return
    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(key === 'table' ? 'Table' : name)
  })
  return out.length > 0 ? out : ['Table']
}

function sanitizeNumber(value) {
  return String(value ?? '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 10)
}

function defaultTaxRate() {
  return {
    name: 'Sales Tax',
    rate: '',
    applies_to: 'all',
    is_default: true,
    is_inclusive: false,
    is_active: true,
  }
}

function defaultServiceCharge(index = 0) {
  return {
    name: index === 0 ? 'Service Charge' : `Service Charge ${index + 1}`,
    charge_type: 'percentage',
    amount: '',
    applies_to: 'all',
    taxable: true,
    auto_apply: false,
    is_tip: false,
    is_active: true,
  }
}

function defaultDiscountRule(index = 0) {
  return {
    name: index === 0 ? 'Manager Comp' : `Discount ${index + 1}`,
    discount_type: 'discount',
    applies_to: 'check',
    value_type: 'percent',
    default_value: '',
    editable_by_employee: false,
    min_value: '',
    max_value: '',
    allowed_roles: ['owner', 'manager'],
    requires_manager_approval: false,
    tax_behavior: 'reduce_taxable_amount',
    reason_required: false,
    service_modes: [],
    days_of_week: [],
    is_active: true,
  }
}

function normalizeTaxRates(rows) {
  const normalized = (Array.isArray(rows) ? rows : [])
    .map(row => ({
      id: row?.id || null,
      name: String(row?.name || '').trim(),
      rate: row?.rate == null ? '' : sanitizeNumber(row.rate),
      applies_to: TAX_APPLIES_TO_OPTIONS.some(option => option.value === row?.applies_to) ? row.applies_to : 'all',
      is_default: Boolean(row?.is_default),
      is_inclusive: Boolean(row?.is_inclusive),
      is_active: row?.is_active !== false,
    }))
    .filter(row => row.name && row.is_active)
  if (normalized.length === 0) return [defaultTaxRate()]
  const hasDefault = normalized.some(row => row.is_default)
  return normalized.map((row, index) => ({ ...row, is_default: row.is_default || (!hasDefault && index === 0) }))
}

function normalizeServiceCharges(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => ({
      id: row?.id || null,
      name: String(row?.name || '').trim(),
      charge_type: row?.charge_type === 'fixed' ? 'fixed' : 'percentage',
      amount: row?.amount == null ? '' : sanitizeNumber(row.amount),
      applies_to: CHARGE_APPLIES_TO_OPTIONS.some(option => option.value === row?.applies_to) ? row.applies_to : 'all',
      taxable: row?.taxable !== false,
      auto_apply: Boolean(row?.auto_apply),
      is_tip: Boolean(row?.is_tip),
      is_active: row?.is_active !== false,
    }))
    .filter(row => row.name && row.is_active)
}

function normalizeDiscountRules(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => ({
      id: row?.id || null,
      name: String(row?.name || '').trim(),
      discount_type: DISCOUNT_TYPE_OPTIONS.some(option => option.value === row?.discount_type) ? row.discount_type : 'discount',
      applies_to: DISCOUNT_APPLIES_TO_OPTIONS.some(option => option.value === row?.applies_to) ? row.applies_to : 'check',
      value_type: DISCOUNT_VALUE_TYPE_OPTIONS.some(option => option.value === row?.value_type) ? row.value_type : 'percent',
      default_value: row?.default_value == null ? '' : sanitizeNumber(row.default_value),
      editable_by_employee: Boolean(row?.editable_by_employee),
      min_value: row?.min_value == null ? '' : sanitizeNumber(row.min_value),
      max_value: row?.max_value == null ? '' : sanitizeNumber(row.max_value),
      allowed_roles: Array.from(new Set((Array.isArray(row?.allowed_roles) ? row.allowed_roles : ['owner', 'manager']).map(String).filter(role => DISCOUNT_ROLE_OPTIONS.includes(role)))),
      requires_manager_approval: Boolean(row?.requires_manager_approval),
      tax_behavior: DISCOUNT_TAX_BEHAVIOR_OPTIONS.some(option => option.value === row?.tax_behavior) ? row.tax_behavior : 'reduce_taxable_amount',
      reason_required: Boolean(row?.reason_required),
      service_modes: Array.from(new Set((Array.isArray(row?.service_modes) ? row.service_modes : []).map(String).filter(mode => DISCOUNT_SERVICE_MODE_OPTIONS.some(option => option.value === mode)))),
      days_of_week: Array.from(new Set((Array.isArray(row?.days_of_week) ? row.days_of_week : []).map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a, b) => a - b),
      is_active: row?.is_active !== false,
    }))
    .map(row => ({ ...row, allowed_roles: row.allowed_roles.length > 0 ? row.allowed_roles : ['owner', 'manager'] }))
    .filter(row => row.name && row.is_active)
}

function taxesChargesPayload(taxRates, serviceCharges) {
  return {
    tax_rates: normalizeTaxRates(taxRates).map(row => ({
      id: row.id || undefined,
      name: row.name,
      rate: row.rate === '' ? 0 : Number(row.rate),
      applies_to: row.applies_to,
      is_default: row.is_default,
      is_inclusive: row.is_inclusive,
      is_active: true,
    })),
    service_charges: normalizeServiceCharges(serviceCharges).map(row => ({
      id: row.id || undefined,
      name: row.name,
      charge_type: row.charge_type,
      amount: row.amount === '' ? 0 : Number(row.amount),
      applies_to: row.applies_to,
      taxable: row.taxable,
      auto_apply: row.auto_apply,
      is_tip: row.is_tip,
      is_active: true,
    })),
  }
}

function discountRulesPayload(discountRules) {
  return {
    discount_rules: normalizeDiscountRules(discountRules).map(row => ({
      id: row.id || undefined,
      name: row.name,
      discount_type: row.discount_type,
      applies_to: row.applies_to,
      value_type: row.value_type,
      default_value: row.default_value === '' ? null : Number(row.default_value),
      editable_by_employee: row.editable_by_employee,
      min_value: row.editable_by_employee && row.min_value !== '' ? Number(row.min_value) : null,
      max_value: row.editable_by_employee && row.max_value !== '' ? Number(row.max_value) : null,
      allowed_roles: row.allowed_roles,
      requires_manager_approval: row.requires_manager_approval,
      tax_behavior: row.tax_behavior,
      reason_required: row.reason_required,
      service_modes: row.service_modes,
      days_of_week: row.days_of_week,
      is_active: true,
    })),
  }
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
    legal: [],
    payments: [],
    taxes_charges: [],
    discounts: [],
    sections: [],
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
  const config = restaurant.config && typeof restaurant.config === 'object' ? restaurant.config : {}
  if (!config.legal_business_name) warnings.legal.push('Legal business name')
  if (!config.legal_contact_name) warnings.legal.push('Authorized signer')
  if (!config.tos_signature_data_url) warnings.legal.push('Signed terms')
  if (!config.bank_account_holder) warnings.payments.push('Account holder')
  if (!config.bank_name) warnings.payments.push('Bank name')
  if (!config.bank_routing_number) warnings.payments.push('Routing number')
  if (!config.bank_account_number) warnings.payments.push('Account number')
  // Missing service_modes means the saved setup should use the onboarding default.
  // Do not show an unfinished badge just because the owner accepted that default.
  warnings.taxes_charges = []

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
  const [legal, setLegal] = useState(() => initialLegal(restaurant))
  const [payments, setPayments] = useState(() => initialPayments(restaurant))
  const [serviceModel, setServiceModel] = useState(() => initialServiceModel(restaurant))
  const [taxRates, setTaxRates] = useState([defaultTaxRate()])
  const [serviceCharges, setServiceCharges] = useState([])
  const [discountRules, setDiscountRules] = useState([])
  const [sections, setSections] = useState(['Table'])
  const [hours, setHours] = useState(DEFAULT_HOURS)
  const [sameHours, setSameHours] = useState(true)
  const [floorTables, setFloorTables] = useState([])
  const [floorPlanMode, setFloorPlanMode] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [menuMode, setMenuMode] = useState(null)
  const [waiters, setWaiters] = useState([])
  const [jobCodes, setJobCodes] = useState([])
  const [rateEdits, setRateEdits] = useState({})
  const [savingRateId, setSavingRateId] = useState('')
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
    setLegal(initialLegal(restaurant))
    setPayments(initialPayments(restaurant))
    setServiceModel(initialServiceModel(restaurant))
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
      const [staffRows, menuRows, jobCodeRows, hoursResult, sectionRows, floorPlan, taxesCharges, discountData] = await Promise.all([
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=false`),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/items`),
        fetchWithSupabaseAuth('/manager/job-codes').catch(() => []),
        supabase
          .from('operating_hours')
          .select('day_of_week, open_time, close_time, is_closed')
          .eq('restaurant_id', restaurantId)
          .order('day_of_week'),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/sections`).catch(() => []),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/floor-plan`).catch(() => null),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/taxes-charges`).catch(() => null),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/discount-rules`).catch(() => null),
      ])

      if (hoursResult.error) throw hoursResult.error
      const normalized = normalizeHours(hoursResult.data)
      setHours(normalized)
      setSameHours(deriveSameHours(normalized))
      setWaiters(Array.isArray(staffRows) ? staffRows : [])
      const normalizedJobCodes = Array.isArray(jobCodeRows) ? jobCodeRows : []
      setJobCodes(normalizedJobCodes)
      setRateEdits(Object.fromEntries(normalizedJobCodes.map(code => [code.id, String(code.default_hourly_rate ?? '')])))
      setMenuItems(mapMenuItems(menuRows))
      setSections(normalizeSectionNames((Array.isArray(sectionRows) ? sectionRows : []).map(section => section.name)))
      setFloorTables(mapFloorPlanTables(floorPlan))
      setTaxRates(normalizeTaxRates(taxesCharges?.tax_rates))
      setServiceCharges(normalizeServiceCharges(taxesCharges?.service_charges))
      setDiscountRules(normalizeDiscountRules(discountData?.discount_rules))
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
    await auth.refreshRestaurants?.(restaurantId)
    onSetupChanged?.()
    setSaveMessage('Saved basics.')
  }

  const updateRestaurantConfig = async (patch, successMessage) => {
    setIsSaving(true)
    setSaveMessage('')
    setSetupError('')
    const baseRestaurant = auth.restaurant.currentRestaurant?.id === restaurantId
      ? auth.restaurant.currentRestaurant
      : restaurant
    const nextConfig = {
      ...(baseRestaurant.config && typeof baseRestaurant.config === 'object' ? baseRestaurant.config : {}),
      ...patch,
    }
    const { data: updatedRestaurant, error } = await supabase
      .from('restaurants')
      .update({ config: nextConfig })
      .eq('id', restaurantId)
      .select()
      .single()
    setIsSaving(false)
    if (error) {
      setSetupError(error.message || 'Could not save setup.')
      return null
    }
    auth.seedCurrentRestaurant(updatedRestaurant)
    await auth.refreshRestaurants?.(restaurantId)
    onSetupChanged?.()
    setSaveMessage(successMessage)
    return updatedRestaurant
  }

  const saveLegal = async () => {
    if (!legal.legal_business_name.trim()) {
      setSetupError('Legal business name is required.')
      return
    }
    if (!legal.legal_contact_name.trim()) {
      setSetupError('Authorized signer name is required.')
      return
    }
    if (!legal.tos_signature_data_url) {
      setSetupError('Signature is required.')
      return
    }
    await updateRestaurantConfig({
      ...legal,
      tos_version: 'shire-placeholder-tos-v1',
    }, 'Saved legal setup.')
  }

  const savePayments = async () => {
    await updateRestaurantConfig(payments, 'Saved payment setup.')
  }

  const saveServiceModel = async () => {
    await updateRestaurantConfig(serviceModel, 'Saved service model.')
  }

  const updateTaxRate = (index, patch) => {
    setTaxRates(prev => normalizeTaxRates(prev).map((row, currentIndex) => {
      const updated = currentIndex === index ? { ...row, ...patch } : row
      if (patch.is_default && currentIndex !== index) return { ...updated, is_default: false }
      return updated
    }))
  }

  const removeTaxRate = (index) => {
    setTaxRates(prev => {
      const next = normalizeTaxRates(prev).filter((_, currentIndex) => currentIndex !== index)
      if (next.length === 0) return [defaultTaxRate()]
      if (!next.some(row => row.is_default)) next[0] = { ...next[0], is_default: true }
      return next
    })
  }

  const updateServiceCharge = (index, patch) => {
    setServiceCharges(prev => prev.map((row, currentIndex) => currentIndex === index ? { ...row, ...patch } : row))
  }

  const saveTaxesCharges = async () => {
    setIsSaving(true)
    setSaveMessage('')
    setSetupError('')
    try {
      const saved = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/taxes-charges`, {
        method: 'PUT',
        body: JSON.stringify(taxesChargesPayload(taxRates, serviceCharges)),
      })
      setTaxRates(normalizeTaxRates(saved?.tax_rates))
      setServiceCharges(normalizeServiceCharges(saved?.service_charges))
      setSaveMessage('Saved taxes and charges.')
      await auth.refreshRestaurants?.(restaurantId)
      onSetupChanged?.()
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not save taxes and charges.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateDiscountRule = (index, patch) => {
    setDiscountRules(prev => prev.map((row, currentIndex) => currentIndex === index ? { ...row, ...patch } : row))
  }

  const toggleDiscountArrayValue = (values, value) =>
    values.includes(value) ? values.filter(item => item !== value) : [...values, value]

  const saveDiscountRules = async () => {
    setIsSaving(true)
    setSaveMessage('')
    setSetupError('')
    try {
      const saved = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/discount-rules`, {
        method: 'PUT',
        body: JSON.stringify(discountRulesPayload(discountRules)),
      })
      setDiscountRules(normalizeDiscountRules(saved?.discount_rules))
      setSaveMessage('Saved discounts.')
      await auth.refreshRestaurants?.(restaurantId)
      onSetupChanged?.()
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not save discounts.')
    } finally {
      setIsSaving(false)
    }
  }

  const saveSections = async () => {
    setIsSaving(true)
    setSaveMessage('')
    setSetupError('')
    try {
      const saved = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/sections`, {
        method: 'PUT',
        body: JSON.stringify({ sections: normalizeSectionNames(sections) }),
      })
      setSections(normalizeSectionNames((Array.isArray(saved) ? saved : []).map(section => section.name)))
      setFloorTables(prev => prev.map(table => {
        if (table.section_id) return table
        return { ...table, section_name: table.section_name || 'Table' }
      }))
      setSaveMessage('Saved sections.')
      await auth.refreshRestaurants?.(restaurantId)
      onSetupChanged?.()
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not save sections.')
    } finally {
      setIsSaving(false)
    }
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
    await auth.refreshRestaurants?.(restaurantId)
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

  const saveRoleRate = async (jobCode) => {
    const rawRate = rateEdits[jobCode.id] ?? ''
    const parsed = Number(rawRate)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setSetupError('Enter a valid hourly rate.')
      return
    }
    setSavingRateId(jobCode.id)
    setSetupError('')
    try {
      const saved = await fetchWithSupabaseAuth(`/manager/job-codes/${jobCode.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ default_hourly_rate: parsed.toFixed(2) }),
      })
      setJobCodes(prev => prev.map(code => code.id === saved.id ? saved : code))
      setRateEdits(prev => ({ ...prev, [saved.id]: String(saved.default_hourly_rate ?? parsed.toFixed(2)) }))
      setSaveMessage('Saved role rate.')
      onSetupChanged?.()
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not save role rate.')
    } finally {
      setSavingRateId('')
    }
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
          description="Restaurant profile, service modes, and default guest flow from Stage 1 onboarding."
          actions={(
            <>
              <SmallButton variant="primary" onClick={() => void saveBasics()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save basics'}</SmallButton>
              <SmallButton onClick={() => void saveServiceModel()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save service model'}</SmallButton>
            </>
          )}
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
            <div className="border-t border-white/10 pt-6">
              <div className="mb-4">
                <p className="label-mono">Service Modes</p>
                <p className="mt-2 text-sm text-dash-secondary">Select every service style this location will operate.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SERVICE_MODE_OPTIONS.map(option => {
                  const selected = serviceModel.service_modes.includes(option.id)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setServiceModel(prev => ({
                        ...prev,
                        service_modes: selected
                          ? prev.service_modes.filter(item => item !== option.id)
                          : [...prev.service_modes, option.id],
                      }))}
                      className={[
                        'rounded-xl border p-4 text-left text-sm font-semibold transition',
                        selected
                          ? 'border-dash-gold bg-dash-gold/10 text-dash-cream'
                          : 'border-white/10 bg-white/[0.03] text-dash-secondary hover:border-white/20 hover:text-dash-cream',
                      ].join(' ')}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              <Field label="Default Guest Flow">
                <SelectInput
                  value={serviceModel.default_guest_flow}
                  onChange={event => setServiceModel(prev => ({ ...prev, default_guest_flow: event.target.value }))}
                  className="mt-3"
                >
                  {GUEST_FLOW_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                </SelectInput>
              </Field>
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'legal' && (
        <SectionShell
          title="Business & Legal"
          description="Legal entity details and the placeholder Shire agreement signature captured during Stage 1 onboarding."
          actions={<SmallButton variant="primary" onClick={() => void saveLegal()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save legal'}</SmallButton>}
        >
          {setupWarnings.legal?.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              Missing: {setupWarnings.legal.join(', ')}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Legal Business Name">
              <TextInput value={legal.legal_business_name} onChange={event => setLegal(prev => ({ ...prev, legal_business_name: event.target.value }))} placeholder="The Golden Fork LLC" />
            </Field>
            <Field label="DBA / Trade Name">
              <TextInput value={legal.dba_name} onChange={event => setLegal(prev => ({ ...prev, dba_name: event.target.value }))} placeholder="The Golden Fork" />
            </Field>
            <Field label="EIN">
              <TextInput value={legal.ein} onChange={event => setLegal(prev => ({ ...prev, ein: event.target.value }))} placeholder="12-3456789" />
            </Field>
            <Field label="Authorized Signer">
              <TextInput value={legal.legal_contact_name} onChange={event => setLegal(prev => ({ ...prev, legal_contact_name: event.target.value }))} placeholder="Owner or officer name" />
            </Field>
            <Field label="Signer Title">
              <TextInput value={legal.legal_contact_title} onChange={event => setLegal(prev => ({ ...prev, legal_contact_title: event.target.value }))} placeholder="Owner" />
            </Field>
            <Field label="Legal Contact Email">
              <TextInput type="email" value={legal.legal_contact_email} onChange={event => setLegal(prev => ({ ...prev, legal_contact_email: event.target.value }))} placeholder="owner@restaurant.com" />
            </Field>
            <Field label="Legal Contact Phone">
              <TextInput value={legal.legal_contact_phone} onChange={event => setLegal(prev => ({ ...prev, legal_contact_phone: event.target.value }))} placeholder="(555) 123-4567" />
            </Field>
          </div>
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <p className="label-mono">Placeholder Shire Terms of Service</p>
            <p className="mt-3 max-h-32 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-dash-secondary">
              By signing, the authorized restaurant representative confirms that the information entered during setup is accurate, authorizes Shire to configure restaurant operations based on this setup, and agrees to complete payment processing and hardware validation before go-live. Final production terms will replace this placeholder agreement.
            </p>
            <div className="mt-4">
              <SignaturePad
                value={legal.tos_signature_data_url}
                signedAt={legal.tos_signed_at}
                onChange={patch => setLegal(prev => ({ ...prev, ...patch }))}
              />
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'payments' && (
        <SectionShell
          title="Payments & Payouts"
          description="Bank account readiness and default processing behavior for refunds, tips, and batch close."
          actions={<SmallButton variant="primary" onClick={() => void savePayments()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save payments'}</SmallButton>}
        >
          {setupWarnings.payments?.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              Missing: {setupWarnings.payments.join(', ')}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Account Holder">
              <TextInput value={payments.bank_account_holder} onChange={event => setPayments(prev => ({ ...prev, bank_account_holder: event.target.value }))} placeholder="The Golden Fork LLC" />
            </Field>
            <Field label="Bank Name">
              <TextInput value={payments.bank_name} onChange={event => setPayments(prev => ({ ...prev, bank_name: event.target.value }))} placeholder="Bank name" />
            </Field>
            <Field label="Routing Number">
              <TextInput inputMode="numeric" value={payments.bank_routing_number} onChange={event => setPayments(prev => ({ ...prev, bank_routing_number: event.target.value.replace(/\D/g, '').slice(0, 9) }))} placeholder="9 digits" />
            </Field>
            <Field label="Account Number">
              <TextInput inputMode="numeric" value={payments.bank_account_number} onChange={event => setPayments(prev => ({ ...prev, bank_account_number: event.target.value.replace(/\D/g, '').slice(0, 17) }))} placeholder="Account number" />
            </Field>
            <Field label="Payout Schedule">
              <SelectInput value={payments.payout_schedule} onChange={event => setPayments(prev => ({ ...prev, payout_schedule: event.target.value }))}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="manual">Manual</option>
              </SelectInput>
            </Field>
            <Field label="Refund Funding">
              <SelectInput value={payments.refund_funding_source} onChange={event => setPayments(prev => ({ ...prev, refund_funding_source: event.target.value }))}>
                <option value="processor_balance">Processor balance first</option>
                <option value="bank_account">Linked bank account</option>
              </SelectInput>
            </Field>
            <Field label="Batch Close">
              <SelectInput value={payments.batch_close_mode} onChange={event => setPayments(prev => ({ ...prev, batch_close_mode: event.target.value }))}>
                <option value="automatic">Automatic</option>
                <option value="manual">Manual manager close</option>
              </SelectInput>
            </Field>
            <Field label="Batch Close Time">
              <TextInput type="time" value={payments.batch_close_time} onChange={event => setPayments(prev => ({ ...prev, batch_close_time: event.target.value }))} />
            </Field>
            <Field label="Credit Card Tips Paid">
              <SelectInput value={payments.credit_card_tip_payout} onChange={event => setPayments(prev => ({ ...prev, credit_card_tip_payout: event.target.value }))}>
                <option value="nightly">Nightly</option>
                <option value="payroll">Through payroll</option>
              </SelectInput>
            </Field>
            <Field label="Refund Approval Threshold">
              <TextInput inputMode="decimal" value={payments.refund_approval_threshold} onChange={event => setPayments(prev => ({ ...prev, refund_approval_threshold: event.target.value.replace(/[^\d.]/g, '').slice(0, 8) }))} placeholder="Manager approval over $..." />
            </Field>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'taxes_charges' && (
        <SectionShell
          title="Taxes & Charges"
          description="Tax categories and service charges used by the POS for order totals, refunds, closeout, and reports."
          actions={<SmallButton variant="primary" onClick={() => void saveTaxesCharges()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save taxes & charges'}</SmallButton>}
        >
          <div className="space-y-8">
            <div className="space-y-4">
              <div>
                <p className="label-mono">Tax Rates</p>
                <p className="mt-2 text-sm text-dash-secondary">Add one or more tax categories. The default tax also syncs to legacy POS tax settings.</p>
              </div>
              {normalizeTaxRates(taxRates).map((tax, index) => (
                <div key={tax.id || `tax:${index}`} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="grid gap-3 md:grid-cols-[1.2fr_0.7fr_1fr]">
                    <TextInput value={tax.name} onChange={event => updateTaxRate(index, { name: event.target.value })} placeholder="Sales Tax" />
                    <TextInput inputMode="decimal" value={tax.rate} onChange={event => updateTaxRate(index, { rate: sanitizeNumber(event.target.value) })} placeholder="Rate %" />
                    <SelectInput value={tax.applies_to} onChange={event => updateTaxRate(index, { applies_to: event.target.value })}>
                      {TAX_APPLIES_TO_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </SelectInput>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SmallButton variant={tax.is_default ? 'primary' : 'secondary'} onClick={() => updateTaxRate(index, { is_default: true })}>Default tax</SmallButton>
                    <SmallButton variant={tax.is_inclusive ? 'primary' : 'secondary'} onClick={() => updateTaxRate(index, { is_inclusive: !tax.is_inclusive })}>Tax included in price</SmallButton>
                    <SmallButton variant="danger" onClick={() => removeTaxRate(index)}>Remove</SmallButton>
                  </div>
                </div>
              ))}
              <SmallButton onClick={() => setTaxRates(prev => [...normalizeTaxRates(prev), { ...defaultTaxRate(), name: 'Additional Tax', is_default: false }])}>Add tax rate</SmallButton>
            </div>

            <div className="space-y-4 border-t border-white/10 pt-6">
              <div>
                <p className="label-mono">Service Charges</p>
                <p className="mt-2 text-sm text-dash-secondary">Use for automatic gratuity, delivery, catering, large-party, or house service fees.</p>
              </div>
              {serviceCharges.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-sm text-dash-secondary">
                  No service charges configured.
                </div>
              )}
              {serviceCharges.map((charge, index) => (
                <div key={charge.id || `charge:${index}`} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.7fr_1fr]">
                    <TextInput value={charge.name} onChange={event => updateServiceCharge(index, { name: event.target.value })} placeholder="Service Charge" />
                    <SelectInput value={charge.charge_type} onChange={event => updateServiceCharge(index, { charge_type: event.target.value })}>
                      <option value="percentage">Percent</option>
                      <option value="fixed">Fixed $</option>
                    </SelectInput>
                    <TextInput inputMode="decimal" value={charge.amount} onChange={event => updateServiceCharge(index, { amount: sanitizeNumber(event.target.value) })} placeholder={charge.charge_type === 'fixed' ? 'Amount' : 'Rate %'} />
                    <SelectInput value={charge.applies_to} onChange={event => updateServiceCharge(index, { applies_to: event.target.value })}>
                      {CHARGE_APPLIES_TO_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </SelectInput>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SmallButton variant={charge.taxable ? 'primary' : 'secondary'} onClick={() => updateServiceCharge(index, { taxable: !charge.taxable })}>Taxable</SmallButton>
                    <SmallButton variant={charge.auto_apply ? 'primary' : 'secondary'} onClick={() => updateServiceCharge(index, { auto_apply: !charge.auto_apply })}>Auto apply</SmallButton>
                    <SmallButton variant={charge.is_tip ? 'primary' : 'secondary'} onClick={() => updateServiceCharge(index, { is_tip: !charge.is_tip })}>Counts as gratuity</SmallButton>
                    <SmallButton variant="danger" onClick={() => setServiceCharges(prev => prev.filter((_, currentIndex) => currentIndex !== index))}>Remove</SmallButton>
                  </div>
                </div>
              ))}
              <SmallButton onClick={() => setServiceCharges(prev => [...prev, defaultServiceCharge(prev.length)])}>Add service charge</SmallButton>
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'discounts' && (
        <SectionShell
          title="Discounts, Comps & Promos"
          description="Preset POS rules for item discounts, whole-check discounts, comps, employee meals, promos, and service recovery."
          actions={<SmallButton variant="primary" onClick={() => void saveDiscountRules()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save discounts'}</SmallButton>}
        >
          <div className="space-y-5">
            {discountRules.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-sm text-dash-secondary">
                No discount rules configured. This is okay if the restaurant does not want preset discounts yet.
              </div>
            )}

            {discountRules.map((rule, index) => (
              <div key={rule.id || `discount:${index}`} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.8fr]">
                  <TextInput value={rule.name} onChange={event => updateDiscountRule(index, { name: event.target.value })} placeholder="Manager Comp" />
                  <SelectInput value={rule.discount_type} onChange={event => updateDiscountRule(index, { discount_type: event.target.value })}>
                    {DISCOUNT_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectInput>
                  <SelectInput value={rule.applies_to} onChange={event => updateDiscountRule(index, { applies_to: event.target.value })}>
                    {DISCOUNT_APPLIES_TO_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectInput>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[0.9fr_0.7fr_1.2fr]">
                  <SelectInput value={rule.value_type} onChange={event => updateDiscountRule(index, { value_type: event.target.value })}>
                    {DISCOUNT_VALUE_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectInput>
                  <TextInput
                    inputMode="decimal"
                    disabled={rule.value_type === 'open'}
                    value={rule.default_value}
                    onChange={event => updateDiscountRule(index, { default_value: sanitizeNumber(event.target.value) })}
                    placeholder={rule.value_type === 'fixed' ? 'Default $' : 'Default %'}
                  />
                  <SelectInput value={rule.tax_behavior} onChange={event => updateDiscountRule(index, { tax_behavior: event.target.value })}>
                    {DISCOUNT_TAX_BEHAVIOR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectInput>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <SmallButton variant={rule.editable_by_employee ? 'primary' : 'secondary'} onClick={() => updateDiscountRule(index, { editable_by_employee: !rule.editable_by_employee })}>Editable by employee</SmallButton>
                  <SmallButton variant={rule.requires_manager_approval ? 'primary' : 'secondary'} onClick={() => updateDiscountRule(index, { requires_manager_approval: !rule.requires_manager_approval })}>Manager approval</SmallButton>
                  <SmallButton variant={rule.reason_required ? 'primary' : 'secondary'} onClick={() => updateDiscountRule(index, { reason_required: !rule.reason_required })}>Reason required</SmallButton>
                  <SmallButton variant="danger" onClick={() => setDiscountRules(prev => prev.filter((_, currentIndex) => currentIndex !== index))}>Remove</SmallButton>
                </div>

                {rule.editable_by_employee && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <TextInput inputMode="decimal" value={rule.min_value} onChange={event => updateDiscountRule(index, { min_value: sanitizeNumber(event.target.value) })} placeholder="Minimum" />
                    <TextInput inputMode="decimal" value={rule.max_value} onChange={event => updateDiscountRule(index, { max_value: sanitizeNumber(event.target.value) })} placeholder="Maximum" />
                  </div>
                )}

                <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                  <div>
                    <p className="label-mono mb-2">Allowed Roles</p>
                    <div className="flex flex-wrap gap-2">
                      {DISCOUNT_ROLE_OPTIONS.map(role => (
                        <SmallButton
                          key={role}
                          variant={rule.allowed_roles.includes(role) ? 'primary' : 'secondary'}
                          onClick={() => updateDiscountRule(index, { allowed_roles: toggleDiscountArrayValue(rule.allowed_roles, role) })}
                        >
                          {role}
                        </SmallButton>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="label-mono mb-2">Service Availability</p>
                    <div className="flex flex-wrap gap-2">
                      {DISCOUNT_SERVICE_MODE_OPTIONS.map(mode => (
                        <SmallButton
                          key={mode.value}
                          variant={rule.service_modes.includes(mode.value) ? 'primary' : 'secondary'}
                          onClick={() => updateDiscountRule(index, { service_modes: toggleDiscountArrayValue(rule.service_modes, mode.value) })}
                        >
                          {mode.label}
                        </SmallButton>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {DAYS.map((day, dayIndex) => (
                        <SmallButton
                          key={day}
                          variant={rule.days_of_week.includes(dayIndex) ? 'primary' : 'secondary'}
                          onClick={() => updateDiscountRule(index, { days_of_week: toggleDiscountArrayValue(rule.days_of_week, dayIndex).sort((a, b) => a - b) })}
                        >
                          {day.slice(0, 3)}
                        </SmallButton>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <SmallButton onClick={() => setDiscountRules(prev => [...prev, defaultDiscountRule(prev.length)])}>Add discount</SmallButton>
              {[
                { ...defaultDiscountRule(discountRules.length), name: 'Manager Comp', discount_type: 'comp', applies_to: 'both', value_type: 'open', editable_by_employee: true, max_value: '100', reason_required: true },
                { ...defaultDiscountRule(discountRules.length), name: 'Employee Meal', discount_type: 'employee_meal', applies_to: 'item', value_type: 'percent', default_value: '50' },
                { ...defaultDiscountRule(discountRules.length), name: 'Service Recovery', discount_type: 'service_recovery', applies_to: 'check', value_type: 'fixed', default_value: '20', reason_required: true },
              ].filter(template => !discountRules.some(rule => rule.name.toLowerCase() === template.name.toLowerCase())).map(template => (
                <SmallButton key={template.name} onClick={() => setDiscountRules(prev => [...prev, template])}>{template.name}</SmallButton>
              ))}
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'sections' && (
        <SectionShell
          title="Sections"
          description="Sections are areas in your restaurant, such as Bar, Patio, Outdoor, or Main Dining. Tables in the floor plan are assigned to one of these categories, and unassigned tables default to Table."
          actions={<SmallButton variant="primary" onClick={() => void saveSections()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save sections'}</SmallButton>}
        >
          {setupWarnings.sections?.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              Missing: {setupWarnings.sections.join(', ')}
            </div>
          )}
          <div className="space-y-3">
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
            <div className="flex flex-wrap gap-2 pt-2">
              <SmallButton onClick={() => setSections(prev => {
                const current = normalizeSectionNames(prev)
                return [...current, `New Section ${current.length}`]
              })}>Add section</SmallButton>
              {['Main Dining', 'Bar', 'Patio', 'Outdoor'].filter(name => !normalizeSectionNames(sections).some(section => section.toLowerCase() === name.toLowerCase())).map(name => (
                <SmallButton key={name} onClick={() => setSections(prev => [...normalizeSectionNames(prev), name])}>{name}</SmallButton>
              ))}
            </div>
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

      {activeSetupTab === 'routing' && (
        <SectionShell
          title="Kitchen Routing"
          description="Configure stations, output targets, fallback behavior, category defaults, item coverage, modifier overrides, and audit history."
        >
          <KitchenRoutingSetup restaurantId={restaurantId} />
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

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="label-mono">Role rates</p>
                <h3 className="text-lg font-semibold">Default hourly rates</h3>
              </div>
              <p className="text-sm text-dash-tertiary">Clocked labor snapshots these rates unless an employee override exists.</p>
            </div>
            {jobCodes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-dash-secondary">Role rates are not available yet.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {jobCodes.filter(code => code.is_active !== false).map(code => (
                  <div key={code.id} className="grid grid-cols-[1fr_110px_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                    <div>
                      <p className="text-sm font-semibold capitalize">{code.label || code.code}</p>
                      <p className="mt-1 text-xs text-dash-tertiary">{code.is_tipped ? 'Tipped role' : 'Hourly role'}</p>
                    </div>
                    <TextInput
                      value={rateEdits[code.id] ?? ''}
                      onChange={event => setRateEdits(prev => ({ ...prev, [code.id]: event.target.value.replace(/[^\d.]/g, '').slice(0, 8) }))}
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                    <SmallButton
                      onClick={() => void saveRoleRate(code)}
                      disabled={Boolean(savingRateId)}
                      variant={savingRateId === code.id ? 'primary' : 'secondary'}
                    >
                      {savingRateId === code.id ? 'Saving...' : 'Save'}
                    </SmallButton>
                  </div>
                ))}
              </div>
            )}
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

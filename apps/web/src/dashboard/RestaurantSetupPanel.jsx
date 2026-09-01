import { useEffect, useMemo, useRef, useState } from 'react'
import {
  SERVICE_MODE_OPTIONS,
  GUEST_FLOW_OPTIONS,
  TAX_APPLIES_TO_OPTIONS,
  taxAppliesToOptions,
  MYRTLE_BEACH_CITY_LIMITS_TAX_PRESET,
  taxPresetDraft,
  CHARGE_APPLIES_TO_OPTIONS,
  DISCOUNT_TYPE_OPTIONS,
  DISCOUNT_APPLIES_TO_OPTIONS,
  DISCOUNT_VALUE_TYPE_OPTIONS,
  DISCOUNT_TAX_BEHAVIOR_OPTIONS,
  DISCOUNT_ROLE_OPTIONS,
  DISCOUNT_SERVICE_MODE_OPTIONS,
  MANAGER_PERMISSION_OPTIONS,
  CASH_TRACKING_OPTIONS,
  CHECKOUT_REPORT_OPTIONS,
  EOD_BATCH_OPTIONS,
  EOD_REPORT_OPTIONS,
  ORDER_FIRE_MODE_OPTIONS,
  CASH_TIP_OPTIONS,
  PAYROLL_EXPORT_OPTIONS,
  TIP_POOL_RESET_OPTIONS,
  PERMISSION_TIER_OPTIONS,
  CAPACITY_OPTIONS,
  DAY_LABELS_LONG as DAYS,
  DEFAULT_HOURS,
  discountRuleNeedsBounds,
  discountRuleWarning,
  sanitizeNumber,
  clampInteger,
  normalizeSectionNames,
  defaultSectionProfile,
  normalizeSectionProfiles,
  defaultTaxRate,
  normalizeTaxRates,
  defaultAutoGratuity,
  normalizeAutoGratuity,
  normalizeServiceCharges,
  taxesChargesPayload,
  normalizeDiscountRules,
  discountRulesPayload,
  slugRoleCode,
  normalizeJobCodes,
  defaultRolePermissions,
  normalizeRolePermissions,
  managerControlsPayload,
  defaultCloseoutSettings,
  normalizeCloseoutSettings,
  closeoutSettingsPayload,
  defaultCheckWorkflowSettings,
  normalizeCheckWorkflowSettings,
  checkWorkflowSettingsPayload,
  normalizeTipPayrollSettings,
  defaultTipPayrollSettings,
  tipPayrollPayload,
} from '@shire/settings'
export {
  defaultTipPayrollSettings,
  normalizeJobCodes,
  normalizeTipPayrollSettings,
  tipPayrollPayload,
} from '@shire/settings'
import { Link } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import { queryClient, queryKeys, fetchCached, fetchWithSupabaseAuth, STALE_TIMES } from '../shared/query'
import { fetchPosApi } from '../shared/api/posClient'
import { fetchReservationsApi } from '../shared/api/reservationsClient'
import { FloorPlanEditor } from '../onboarding/components/FloorPlanEditor'
import { normalizeFloorPlanTablesForEditor } from '../onboarding/components/FloorPlanCanvas'
import { FloorPlanTableSetup } from '../onboarding/components/FloorPlanTableSetup'
import {
  assignedStaffRoles,
  buildStaffRoleUpdate,
  normalizeRoleCode,
  normalizeStaffRoleOptions,
  primaryStaffRole,
  roleCodeFromJobCode,
  staffRoleLabel,
} from './utils/staffRoles'
import { PublishControls } from '../shared/components/PublishControls'
import { SmartTimeInput } from '../shared/components/SmartTimeInput'
import { ScheduledChangesPanel } from '../shared/components/ScheduledChangesPanel'
import { scheduleChange } from '../shared/api/scheduledChanges'
import { cashDrawerRoleSummary } from './utils/cashDrawerPermissions'
import StoreDangerZone from './components/StoreDangerZone'
import {
  normalizeWorkweekStartWeekday,
  WORKWEEK_START_DAY_OPTIONS,
} from './workweekSettings'

const SETUP_TABS = [
  { id: 'basics', label: 'Basics' },
  { id: 'branding', label: 'Branding' },
  { id: 'legal', label: 'Legal' },
  { id: 'payments', label: 'Payments' },
  { id: 'taxes_charges', label: 'Taxes & Charges' },
  { id: 'discounts', label: 'Discounts' },
  { id: 'manager_controls', label: 'Manager Controls' },
  { id: 'closeout', label: 'Cash & Closeout' },
  { id: 'check_workflow', label: 'Check Workflow' },
  { id: 'tips_payroll', label: 'Tips & Payroll' },
  { id: 'goals', label: 'Goals' },
  { id: 'service_model', label: 'Tools & Service Model' },
  { id: 'sections', label: 'Sections' },
  { id: 'hours', label: 'Hours' },
  { id: 'reservation_timing', label: 'Reservations' },
  { id: 'capacity', label: 'Capacity / Floor Plan' },
  // Menu data (items, categories, modifiers/questions, specials) lives in the
  // dedicated Menu workspace — the single source of truth. The tab below only
  // links there so setup can never overwrite menu-editor configuration.
  { id: 'menu', label: 'Menu' },
  { id: 'routing', label: 'Kitchen Routing' },
  { id: 'employees', label: 'Employees' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'lifecycle', label: 'Danger Zone' },
]

const RESTAURANT_ASSET_BUCKET = 'restaurant-assets'
const MAX_COVER_IMAGE_BYTES = 5 * 1024 * 1024
const COVER_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function coverImageExtension(file) {
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/webp') return 'webp'
  return 'png'
}

const SETUP_PROPAGATION = {
  basics: 'specified',
  legal: 'specified',
  payments: 'specified',
  pricing_policy: 'general',
  service_model: 'general',
  taxes_charges: 'general',
  discounts: 'general',
  manager_controls: 'general',
  closeout: 'general',
  check_workflow: 'general',
  tips_payroll: 'general',
  sections: 'specified',
  hours: 'specified',
  reservation_timing: 'specified',
  capacity: 'specified',
}

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

const DEFAULT_RESERVATION_TIMING = {
  reservation_timing_same_for_channels: true,
  reservation_online_booking_horizon_days: '30',
  reservation_online_lead_time_minutes: '120',
  reservation_online_grace_period_minutes: '15',
  reservation_staff_booking_horizon_days: '30',
  reservation_staff_lead_time_minutes: '120',
  reservation_staff_grace_period_minutes: '15',
  reservation_slot_interval_minutes: '15',
  reservation_min_party_size: '1',
  reservation_max_party_size: '10',
  reservation_default_duration_minutes: '90',
  reservation_windows_follow_operating_hours: true,
}

const publicBookingBaseUrl = (
  import.meta.env.VITE_RESERVATIONS_PUBLIC_BASE_URL ||
  import.meta.env.VITE_RESERVATIONS_WEB_BASE_URL ||
  window.location.origin
).replace(/\/+$/, '')

const normalizePublicSlugDraft = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const ROLE_OPTIONS = ['server', 'bartender', 'host', 'manager', 'busser', 'runner']

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

const PRICING_MODE_OPTIONS = [
  { value: 'dual_pricing_posted_electronic', label: 'Posted electronic price' },
  { value: 'cash_discount', label: 'Cash discount' },
  { value: 'credit_surcharge', label: 'Credit surcharge' },
  { value: 'none', label: 'No pricing adjustment' },
]

const PRICING_BASIS_OPTIONS = [
  { value: 'subtotal_plus_tax', label: 'Subtotal + tax' },
  { value: 'subtotal', label: 'Subtotal before tax' },
]

const PRICING_TENDER_OPTIONS = [
  { value: 'card', label: 'Card' },
  { value: 'credit', label: 'Credit' },
  { value: 'debit', label: 'Debit' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'gift_card', label: 'Gift card' },
  { value: 'standalone', label: 'Standalone tender' },
  { value: 'external', label: 'External card terminal' },
]

const DEFAULT_PRICING_POLICY = {
  enabled: true,
  mode: 'dual_pricing_posted_electronic',
  rate: 0.035,
  basis: 'subtotal_plus_tax',
  listed_price_basis: 'electronic',
  display_order: 'electronic_first',
  applies_to: ['card', 'credit', 'debit', 'terminal', 'gift_card', 'standalone', 'external'],
  jurisdiction_state: 'SC',
  label: 'Dual pricing',
  disclosure: 'Cash and electronic prices are shown before payment. The final receipt reflects the selected payment method.',
}

const DEFAULT_PRICING_LABELS = {
  dual_pricing_posted_electronic: 'Dual pricing',
  cash_discount: 'Cash discount',
  credit_surcharge: 'Credit surcharge',
  service_fee_all: 'Service fee',
  none: 'Pricing adjustment',
}

const DEFAULT_PRICING_DISCLOSURES = {
  dual_pricing_posted_electronic: DEFAULT_PRICING_POLICY.disclosure,
  cash_discount: 'Posted total is shown before payment. Cash payments receive the listed cash discount.',
  credit_surcharge: 'A card fee applies only to eligible card payments and is shown before payment.',
  service_fee_all: 'A service fee is included in the payment total.',
  none: '',
}

const defaultPricingLabel = (mode) => DEFAULT_PRICING_LABELS[mode] || DEFAULT_PRICING_POLICY.label
const defaultPricingDisclosure = (mode) => DEFAULT_PRICING_DISCLOSURES[mode] ?? DEFAULT_PRICING_POLICY.disclosure
const isDefaultPricingCopy = (value, defaults) => Object.values(defaults).includes(value)

const normalizePricingPolicy = (raw = {}) => {
  const source = raw && typeof raw === 'object' ? raw : {}
  const merged = { ...DEFAULT_PRICING_POLICY, ...source }
  const rate = Number(merged.rate)
  const listedPriceBasis = ['cash', 'electronic'].includes(source.listed_price_basis)
    ? source.listed_price_basis
    : ['credit_surcharge', 'service_fee_all', 'none'].includes(merged.mode) ? 'cash' : 'electronic'
  return {
    ...merged,
    enabled: merged.enabled !== false,
    rate: Number.isFinite(rate) ? Math.max(0, rate) : DEFAULT_PRICING_POLICY.rate,
    listed_price_basis: listedPriceBasis,
    display_order: ['cash_first', 'electronic_first'].includes(source.display_order)
      ? source.display_order
      : `${listedPriceBasis}_first`,
    applies_to: Array.isArray(merged.applies_to) && merged.applies_to.length > 0 ? merged.applies_to : DEFAULT_PRICING_POLICY.applies_to,
    jurisdiction_state: String(merged.jurisdiction_state || 'SC').toUpperCase().slice(0, 2),
    label: merged.label || defaultPricingLabel(merged.mode),
    disclosure: merged.disclosure || defaultPricingDisclosure(merged.mode),
  }
}

const pricingPolicyPayload = (policy) => {
  const rate = Number(policy.rate)
  return {
    enabled: policy.enabled !== false,
    mode: policy.mode || DEFAULT_PRICING_POLICY.mode,
    rate: Number.isFinite(rate) ? Math.max(0, rate) : DEFAULT_PRICING_POLICY.rate,
    basis: policy.basis || DEFAULT_PRICING_POLICY.basis,
    listed_price_basis: policy.listed_price_basis || DEFAULT_PRICING_POLICY.listed_price_basis,
    display_order: policy.display_order || `${policy.listed_price_basis || DEFAULT_PRICING_POLICY.listed_price_basis}_first`,
    applies_to: Array.isArray(policy.applies_to) ? policy.applies_to : DEFAULT_PRICING_POLICY.applies_to,
    jurisdiction_state: String(policy.jurisdiction_state || 'SC').toUpperCase().slice(0, 2),
    label: policy.label || defaultPricingLabel(policy.mode),
    disclosure: policy.disclosure || defaultPricingDisclosure(policy.mode),
    expected_version: Number(policy.version) || 0,
  }
}

const initialServiceModel = (restaurant) => {
  const config = restaurant.config && typeof restaurant.config === 'object' ? restaurant.config : {}
  return {
    current_pos: config.current_pos ?? '',
    current_scheduling: config.current_scheduling ?? '',
    current_reservations: config.current_reservations ?? '',
    service_modes: Array.isArray(config.service_modes) && config.service_modes.length > 0 ? config.service_modes : ['dine_in'],
    default_guest_flow: config.default_guest_flow || 'seat_first',
  }
}

const initialGoals = (restaurant) => {
  const config = restaurant.config && typeof restaurant.config === 'object' ? restaurant.config : {}
  return {
    challenges: Array.isArray(config.challenges) ? config.challenges : [],
    daily_covers_range: config.daily_covers_range ?? '',
    team_size_range: config.team_size_range ?? '',
    primary_goal: config.primary_goal ?? '',
  }
}

const CURRENT_TOOL_OPTIONS = {
  current_pos: [['', 'None selected'], ['toast', 'Toast'], ['square', 'Square'], ['clover', 'Clover'], ['lightspeed', 'Lightspeed'], ['other', 'Other'], ['none', 'None']],
  current_scheduling: [['', 'None selected'], ['7shifts', '7shifts'], ['hotschedules', 'HotSchedules'], ['wheniwork', 'When I Work'], ['deputy', 'Deputy'], ['spreadsheet', 'Spreadsheet'], ['none', 'None']],
  current_reservations: [['', 'None selected'], ['opentable', 'OpenTable'], ['resy', 'Resy'], ['yelp', 'Yelp'], ['walkins', 'Walk-ins only'], ['other', 'Other']],
}

const GOAL_CHALLENGES = [
  ['table_turnover', 'Table turnover'],
  ['floor_visibility', 'Floor visibility'],
  ['scheduling', 'Scheduling'],
  ['performance_data', 'Performance data'],
  ['waitlist', 'Waitlist management'],
  ['communication', 'Team communication'],
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

function TextAreaInput(props) {
  return (
    <textarea
      {...props}
      className={[
        'min-h-28 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-dash-cream outline-none transition placeholder:text-dash-tertiary focus:border-dash-gold/70',
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

function StaffRoleAssignment({ waiter, jobCodes, onChange }) {
  const availableRoles = normalizeStaffRoleOptions(
    jobCodes.length > 0 ? jobCodes : [{ id: 'server', code: 'server', label: 'Server' }],
  )
  const assignedRoles = assignedStaffRoles(waiter, availableRoles)
  const primaryRole = primaryStaffRole(waiter, availableRoles)

  const commit = (nextPrimary, nextRoles) => {
    const update = buildStaffRoleUpdate(nextPrimary, nextRoles, availableRoles)
    if (update.role) onChange(update)
  }

  const toggleRole = (role) => {
    const selected = assignedRoles.includes(role)
    const nextRoles = selected
      ? assignedRoles.filter(item => item !== role)
      : [...assignedRoles, role]
    if (nextRoles.length === 0) return
    commit(selected && role === primaryRole ? nextRoles[0] : primaryRole || role, nextRoles)
  }

  return (
    <div className="min-w-0 space-y-2">
      <SelectInput
        value={primaryRole}
        onChange={event => {
          const role = event.target.value
          commit(role, [role, ...assignedRoles.filter(item => item !== role)])
        }}
      >
        {availableRoles.map(role => <option key={role.id || role.code} value={roleCodeFromJobCode(role)}>{staffRoleLabel(role)}</option>)}
        {primaryRole && availableRoles.every(role => roleCodeFromJobCode(role) !== primaryRole) && (
          <option value={primaryRole}>{primaryRole}</option>
        )}
      </SelectInput>
      <div className="flex min-w-0 flex-wrap gap-1">
        {availableRoles.map(code => {
          const role = roleCodeFromJobCode(code)
          const selected = assignedRoles.includes(role)
          return (
            <button
              key={code.id || code.code}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleRole(role)}
              disabled={selected && assignedRoles.length === 1}
              className={[
                'rounded-full border px-2 py-1 text-[11px] font-semibold leading-none transition disabled:cursor-default disabled:opacity-80',
                selected
                  ? 'border-dash-gold/60 bg-dash-gold/15 text-dash-cream'
                  : 'border-white/10 text-dash-tertiary hover:border-dash-gold/60 hover:text-dash-cream',
              ].join(' ')}
            >
              {staffRoleLabel(code)}
            </button>
          )
        })}
      </div>
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
      className={`inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${classes}`}
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

  const load = async (force = false) => {
    setLoading(true)
    setError('')
    try {
      const next = await fetchCached(
        queryKeys.kitchenRouting(restaurantId),
        () => fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing`),
        force ? 0 : STALE_TIMES.setup,
      )
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
    await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing/stations`, {
      method: 'POST',
      body: JSON.stringify({ name: stationName.trim(), is_active: true }),
    })
    setStationName('')
    await load(true)
  }

  const createTarget = async () => {
    await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing/targets`, {
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
    await load(true)
  }

  const assignTarget = async (stationId, targetId) => {
    await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing/station-targets`, {
      method: 'POST',
      body: JSON.stringify({ station_id: stationId, target_id: targetId, priority: 0, is_active: true }),
    })
    await load(true)
  }

  const setFallback = async (stationId) => {
    try {
      await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing/fallback`, {
        method: 'PUT',
        body: JSON.stringify({ station_id: stationId }),
      })
      await load(true)
    } catch {
      setError('Fallback station needs an active output target first.')
    }
  }

  const routeCategory = async (category) => {
    if (!selectedStationId) return
    try {
      await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing/categories`, {
        method: 'PUT',
        body: JSON.stringify({ category, mode: 'stations', station_ids: [selectedStationId] }),
      })
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the category route.')
    }
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
              <span className={(item.routing_covered ?? item.routing_publishable) ? 'text-emerald-200' : 'text-amber-200'}>
                {(item.routing_covered ?? item.routing_publishable)
                  ? item.routing_confirmed
                    ? 'Ready · confirmed'
                    : item.routing_source === 'category' ? 'Ready · category default'
                      : item.routing_source === 'fallback' ? 'Ready · restaurant fallback'
                        : item.routing_source?.includes('no_production') ? 'Ready · no production'
                          : 'Ready · item override'
                  : 'Missing route'}
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
    table_number: table.table_number ?? '',
    center_x: table.position?.center_x ?? 50,
    center_y: table.position?.center_y ?? 50,
    width: table.position?.width ?? 12,
    height: table.position?.height ?? 10,
    capacity: table.capacity ?? 4,
    shape: table.shape || 'rectangular',
    section_id: table.section_id ?? null,
    section_name: table.section_name ?? null,
    setup_complete: Boolean(table.setup_complete),
    confidence: table.confidence,
    notes: table.notes,
  })))
}

const reservationConfigString = (value, fallback) => {
  const text = String(value ?? '').trim()
  return text === '' ? String(fallback) : text
}

function normalizeReservationTiming(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    reservation_timing_same_for_channels:
      typeof source.reservation_timing_same_for_channels === 'boolean'
        ? source.reservation_timing_same_for_channels
        : DEFAULT_RESERVATION_TIMING.reservation_timing_same_for_channels,
    reservation_online_booking_horizon_days: reservationConfigString(source.reservation_online_booking_horizon_days, DEFAULT_RESERVATION_TIMING.reservation_online_booking_horizon_days),
    reservation_online_lead_time_minutes: reservationConfigString(source.reservation_online_lead_time_minutes, DEFAULT_RESERVATION_TIMING.reservation_online_lead_time_minutes),
    reservation_online_grace_period_minutes: reservationConfigString(source.reservation_online_grace_period_minutes, DEFAULT_RESERVATION_TIMING.reservation_online_grace_period_minutes),
    reservation_staff_booking_horizon_days: reservationConfigString(source.reservation_staff_booking_horizon_days, DEFAULT_RESERVATION_TIMING.reservation_staff_booking_horizon_days),
    reservation_staff_lead_time_minutes: reservationConfigString(source.reservation_staff_lead_time_minutes, DEFAULT_RESERVATION_TIMING.reservation_staff_lead_time_minutes),
    reservation_staff_grace_period_minutes: reservationConfigString(source.reservation_staff_grace_period_minutes, DEFAULT_RESERVATION_TIMING.reservation_staff_grace_period_minutes),
    reservation_slot_interval_minutes: reservationConfigString(source.reservation_slot_interval_minutes, DEFAULT_RESERVATION_TIMING.reservation_slot_interval_minutes),
    reservation_min_party_size: reservationConfigString(source.reservation_min_party_size, DEFAULT_RESERVATION_TIMING.reservation_min_party_size),
    reservation_max_party_size: reservationConfigString(source.reservation_max_party_size, DEFAULT_RESERVATION_TIMING.reservation_max_party_size),
    reservation_default_duration_minutes: reservationConfigString(source.reservation_default_duration_minutes, DEFAULT_RESERVATION_TIMING.reservation_default_duration_minutes),
    reservation_windows_follow_operating_hours:
      typeof source.reservation_windows_follow_operating_hours === 'boolean'
        ? source.reservation_windows_follow_operating_hours
        : DEFAULT_RESERVATION_TIMING.reservation_windows_follow_operating_hours,
  }
}

function reservationTimingPayload(data) {
  const slotIntervalMinutes = clampInteger(data.reservation_slot_interval_minutes, 15, 5, 180)
  const minPartySize = clampInteger(data.reservation_min_party_size, 1, 1, 99)
  const maxPartySize = Math.max(minPartySize, clampInteger(data.reservation_max_party_size, 10, 1, 99))
  const defaultDurationMinutes = clampInteger(data.reservation_default_duration_minutes, 90, 15, 240)
  const online = {
    bookingHorizonDays: clampInteger(data.reservation_online_booking_horizon_days, 30, 0, 365),
    leadTimeMinutes: clampInteger(data.reservation_online_lead_time_minutes, 120, 0, 10080),
    gracePeriodMinutes: clampInteger(data.reservation_online_grace_period_minutes, 15, 0, 360),
  }
  const staff = data.reservation_timing_same_for_channels
    ? { ...online }
    : {
        bookingHorizonDays: clampInteger(data.reservation_staff_booking_horizon_days, online.bookingHorizonDays, 0, 365),
        leadTimeMinutes: clampInteger(data.reservation_staff_lead_time_minutes, online.leadTimeMinutes, 0, 10080),
        gracePeriodMinutes: clampInteger(data.reservation_staff_grace_period_minutes, online.gracePeriodMinutes, 0, 360),
      }
  return {
    reservation_timing_same_for_channels: data.reservation_timing_same_for_channels,
    reservation_online_booking_horizon_days: String(online.bookingHorizonDays),
    reservation_online_lead_time_minutes: String(online.leadTimeMinutes),
    reservation_online_grace_period_minutes: String(online.gracePeriodMinutes),
    reservation_staff_booking_horizon_days: String(staff.bookingHorizonDays),
    reservation_staff_lead_time_minutes: String(staff.leadTimeMinutes),
    reservation_staff_grace_period_minutes: String(staff.gracePeriodMinutes),
    reservation_slot_interval_minutes: String(slotIntervalMinutes),
    reservation_min_party_size: String(minPartySize),
    reservation_max_party_size: String(maxPartySize),
    reservation_default_duration_minutes: String(defaultDurationMinutes),
    reservation_windows_follow_operating_hours: data.reservation_windows_follow_operating_hours,
    timingPolicies: { online, staff },
  }
}

const reservationDayOfWeek = (operatingDayOfWeek) => (Number(operatingDayOfWeek) + 6) % 7

function reservationPeriodsFromHours(timing, operatingHours, existingPeriods = []) {
  const payload = reservationTimingPayload(timing)
  const existingByDay = new Map(
    existingPeriods
      .filter(period => typeof period.dayOfWeek === 'number')
      .map(period => [Number(period.dayOfWeek), period])
  )
  return normalizeHours(operatingHours).map(day => {
    const dayOfWeek = reservationDayOfWeek(day.day_of_week)
    const existing = existingByDay.get(dayOfWeek)
    return {
      id: typeof existing?.id === 'string' ? existing.id : undefined,
      name: dayOfWeek >= 4 ? 'Weekend Reservations' : 'Reservations',
      dayOfWeek,
      startTime: `${day.open_time}:00`,
      endTime: `${day.close_time}:00`,
      slotIntervalMinutes: Number(payload.reservation_slot_interval_minutes),
      leadTimeMinutes: Number(payload.reservation_staff_lead_time_minutes),
      minPartySize: Number(payload.reservation_min_party_size),
      maxPartySize: Number(payload.reservation_max_party_size),
      defaultDurationMinutes: Number(payload.reservation_default_duration_minutes),
      active: !day.is_closed,
    }
  })
}

function reservationPeriodsWithDefaults(timing, periods) {
  const payload = reservationTimingPayload(timing)
  return periods.map(period => ({
    ...period,
    slotIntervalMinutes: Number(payload.reservation_slot_interval_minutes),
    minPartySize: Number(payload.reservation_min_party_size),
    maxPartySize: Number(payload.reservation_max_party_size),
    defaultDurationMinutes: Number(payload.reservation_default_duration_minutes),
  }))
}

const numericReservationValues = (records, field) =>
  (Array.isArray(records) ? records : [])
    .map(record => Number(record?.[field]))
    .filter(Number.isFinite)

const firstReservationValue = (records, field, fallback) => {
  const value = numericReservationValues(records, field)[0]
  return Number.isFinite(value) ? String(value) : fallback
}

function reservationTimingFromSettings(settings) {
  if (!settings || typeof settings !== 'object') return null
  const servicePeriods = Array.isArray(settings.servicePeriods)
    ? settings.servicePeriods.filter(period => period && typeof period === 'object')
    : []
  const timingPolicies = settings.timingPolicies && typeof settings.timingPolicies === 'object' ? settings.timingPolicies : {}
  const online = timingPolicies.online && typeof timingPolicies.online === 'object' ? timingPolicies.online : {}
  const staff = timingPolicies.staff && typeof timingPolicies.staff === 'object' ? timingPolicies.staff : {}
  const onlinePatch = {
    reservation_online_booking_horizon_days: reservationConfigString(online.bookingHorizonDays, reservationConfigString(settings.bookingHorizonDays, DEFAULT_RESERVATION_TIMING.reservation_online_booking_horizon_days)),
    reservation_online_lead_time_minutes: reservationConfigString(online.leadTimeMinutes, DEFAULT_RESERVATION_TIMING.reservation_online_lead_time_minutes),
    reservation_online_grace_period_minutes: reservationConfigString(online.gracePeriodMinutes, reservationConfigString(settings.gracePeriodMinutes, DEFAULT_RESERVATION_TIMING.reservation_online_grace_period_minutes)),
  }
  const staffPatch = {
    reservation_staff_booking_horizon_days: reservationConfigString(staff.bookingHorizonDays, onlinePatch.reservation_online_booking_horizon_days),
    reservation_staff_lead_time_minutes: reservationConfigString(staff.leadTimeMinutes, onlinePatch.reservation_online_lead_time_minutes),
    reservation_staff_grace_period_minutes: reservationConfigString(staff.gracePeriodMinutes, onlinePatch.reservation_online_grace_period_minutes),
  }
  const minPartyValues = numericReservationValues(servicePeriods, 'minPartySize')
  const maxPartyValues = numericReservationValues(servicePeriods, 'maxPartySize')
  return normalizeReservationTiming({
    ...onlinePatch,
    ...staffPatch,
    reservation_slot_interval_minutes: reservationConfigString(settings.defaultSlotIntervalMinutes, DEFAULT_RESERVATION_TIMING.reservation_slot_interval_minutes),
    reservation_min_party_size: minPartyValues.length ? String(Math.min(...minPartyValues)) : DEFAULT_RESERVATION_TIMING.reservation_min_party_size,
    reservation_max_party_size: maxPartyValues.length ? String(Math.max(...maxPartyValues)) : DEFAULT_RESERVATION_TIMING.reservation_max_party_size,
    reservation_default_duration_minutes: firstReservationValue(servicePeriods, 'defaultDurationMinutes', DEFAULT_RESERVATION_TIMING.reservation_default_duration_minutes),
    reservation_timing_same_for_channels:
      onlinePatch.reservation_online_booking_horizon_days === staffPatch.reservation_staff_booking_horizon_days &&
      onlinePatch.reservation_online_lead_time_minutes === staffPatch.reservation_staff_lead_time_minutes &&
      onlinePatch.reservation_online_grace_period_minutes === staffPatch.reservation_staff_grace_period_minutes,
  })
}

async function saveReservationPublicSlug(restaurantId, slug) {
  return fetchWithSupabaseAuth(`/locations/${restaurantId}/public-slug`, {
    method: 'PATCH',
    body: JSON.stringify({ public_slug: normalizePublicSlugDraft(slug) }),
  })
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
    suggested_tip_basis: 'before_discount',
  }
}

function validateDiscountRules(discountRules) {
  const rows = normalizeDiscountRules(discountRules)
  const blankIndex = rows.findIndex(row => !row.name)
  if (blankIndex >= 0) {
    throw new Error(`Discount ${blankIndex + 1} needs a name before saving.`)
  }
  return rows
}

// Pool methods, presented as cards. Each one sets BOTH tip_distribution_mode
// and tip_pooling_enabled so the two never disagree (the backend only pools when
// pooling_enabled AND mode is a pooled mode).
const POOL_METHODS = [
  { key: 'individual', mode: 'individual', pooled: false, title: 'Keep own', desc: 'Everyone keeps the tips on their own checks. No pool.' },
  { key: 'pooled', mode: 'pooled', pooled: true, title: 'Pool equally', desc: 'All tips pooled, divided evenly across everyone clocked in.' },
  { key: 'hours_based', mode: 'hours_based', pooled: true, title: 'Pool by hours', desc: 'Pooled, split in proportion to hours worked — more hours, bigger share.' },
  { key: 'points_based', mode: 'points_based', pooled: true, title: 'Pool by points', desc: 'Weighted split — set points per role below (server 10, busser 5…).' },
  { key: 'sales_based', mode: 'sales_based', pooled: true, title: 'Pool by sales', desc: 'Pooled, split in proportion to each person’s net sales.' },
]

function activePoolMethod(settings) {
  if (!settings.tip_pooling_enabled || settings.tip_distribution_mode === 'individual') return 'individual'
  const mode = settings.tip_distribution_mode
  if (mode === 'role_based') return 'points_based'
  return POOL_METHODS.some(method => method.key === mode) ? mode : 'pooled'
}

function TipInvariantNote() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-dash-gold/30 bg-dash-gold/[0.06] px-4 py-3 text-xs text-dash-secondary">
      <span className="text-dash-gold">◱</span>
      <p>
        <span className="font-semibold text-dash-gold">Tipouts are employee obligations.</span>{' '}
        A tip-based rule cannot exceed recorded tips. A sales-based rule is fully owed even when recorded tips are
        lower. The <span className="font-semibold">%</span> sets how much leaves; <span className="font-semibold">Split received</span> on
        the receiving role sets how it is divided among them.
      </p>
    </div>
  )
}

// Section 1 + 2 + 3: how tips are split, role-to-role tipouts, per-role rules.
export function TipRulesFields({
  settings,
  jobCodes,
  onUpdateSettings,
  onUpdateRoleRule,
}) {
  const methodKey = activePoolMethod(settings)
  const isPointsMode = methodKey === 'points_based'
  const isHoursMode = methodKey === 'hours_based'
  // pool_points is a weight in both points mode (flat per person) and hours mode
  // (a per-hour multiplier, so a host can out-earn a chef at equal hours).
  const usesWeight = isPointsMode || isHoursMode
  const isPooled = methodKey !== 'individual'

  return (
    <div className="space-y-6">
      {/* 1 — How tips are split */}
      <div className="space-y-3">
        <div>
          <p className="label-mono">How tips are split</p>
          <p className="mt-1 text-xs text-dash-secondary">Pick one. This decides how the pot (or each person’s own tips) is divided before any tipout.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {POOL_METHODS.map(method => {
            const selected = methodKey === method.key
            return (
              <button
                key={method.key}
                type="button"
                onClick={() => onUpdateSettings({ tip_distribution_mode: method.mode, tip_pooling_enabled: method.pooled })}
                className={[
                  'rounded-xl border p-3 text-left transition',
                  selected ? 'border-dash-gold/60 bg-dash-gold/[0.08]' : 'border-white/10 bg-white/[0.025] hover:border-dash-gold/40',
                ].join(' ')}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-dash-cream">
                  <span className={['h-3.5 w-3.5 flex-none rounded-full border', selected ? 'border-dash-gold bg-dash-gold shadow-[inset_0_0_0_3px_rgba(0,0,0,0.55)]' : 'border-dash-tertiary'].join(' ')} />
                  {method.title}
                </span>
                <span className="mt-1.5 block text-xs leading-relaxed text-dash-secondary">{method.desc}</span>
              </button>
            )
          })}
        </div>
        {isHoursMode ? (
          <p className="text-xs text-dash-secondary">
            Set a <span className="text-dash-cream">weight per hour</span> on any role below to pay it more per hour (e.g. host ×1.5 vs kitchen ×1). Leave every role at 1 for straight hours.
          </p>
        ) : null}
        {isPooled ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-dash-tertiary">Pool resets every</span>
            <SelectInput
              value={settings.tip_pool_reset}
              onChange={event => onUpdateSettings({ tip_pool_reset: event.target.value })}
              className="w-auto py-2"
            >
              {TIP_POOL_RESET_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectInput>
            <SmallButton variant={settings.tipout_include_managers ? 'primary' : 'secondary'} onClick={() => onUpdateSettings({ tipout_include_managers: !settings.tipout_include_managers })}>Managers share</SmallButton>
          </div>
        ) : null}
      </div>

      <TipInvariantNote />

      {/* 2 + 3 — Per-role rules (eligibility, points, split, tipouts) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-mono">Role tip rules</p>
          <SmallButton variant={settings.require_tipout_at_checkout ? 'primary' : 'secondary'} onClick={() => onUpdateSettings({ require_tipout_at_checkout: !settings.require_tipout_at_checkout })}>Require tipout at checkout</SmallButton>
        </div>
        {settings.role_tip_rules.map((rule, index) => {
          const role = jobCodes.find(code => code.code === rule.role_key)
          return (
            <div key={rule.role_key} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{role?.label || rule.role_key}</p>
                  <p className="text-xs text-dash-tertiary">{rule.role_key}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SmallButton variant={rule.tip_eligible ? 'primary' : 'secondary'} onClick={() => onUpdateRoleRule(index, { tip_eligible: !rule.tip_eligible })}>Tip eligible</SmallButton>
                  <SmallButton variant={rule.contributes_to_pool ? 'primary' : 'secondary'} onClick={() => onUpdateRoleRule(index, { contributes_to_pool: !rule.contributes_to_pool })}>Contributes</SmallButton>
                  <SmallButton variant={rule.receives_from_pool ? 'primary' : 'secondary'} onClick={() => onUpdateRoleRule(index, { receives_from_pool: !rule.receives_from_pool })}>Receives</SmallButton>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {isPooled && rule.contributes_to_pool ? (
                  <Field label="% of tips into pool (keeps the rest)">
                    <TextInput
                      value={rule.pool_contribution_percent}
                      inputMode="decimal"
                      onChange={event => onUpdateRoleRule(index, { pool_contribution_percent: sanitizeNumber(event.target.value).slice(0, 6) })}
                      placeholder="100"
                    />
                  </Field>
                ) : null}
                <Field label={isHoursMode ? 'Weight per hour (×)' : isPointsMode ? 'Pool points' : 'Pool weight (points / hours modes)'}>
                  <TextInput
                    value={rule.pool_points}
                    inputMode="decimal"
                    disabled={!usesWeight}
                    onChange={event => onUpdateRoleRule(index, { pool_points: sanitizeNumber(event.target.value).slice(0, 6) })}
                    placeholder={isHoursMode ? '1.0' : 'e.g. 10'}
                    className={usesWeight ? '' : 'opacity-40'}
                  />
                </Field>
                {rule.receives_from_pool ? (
                  <Field label="Split received tipout among this role">
                    <div className="flex gap-2">
                      <SmallButton variant={rule.tipout_split_basis === 'hours' ? 'primary' : 'secondary'} onClick={() => onUpdateRoleRule(index, { tipout_split_basis: 'hours' })}>By hours</SmallButton>
                      <SmallButton variant={rule.tipout_split_basis === 'even' ? 'primary' : 'secondary'} onClick={() => onUpdateRoleRule(index, { tipout_split_basis: 'even' })}>Even</SmallButton>
                    </div>
                  </Field>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.1em] text-dash-tertiary">Tipouts — % reserved from this role's tips (they keep the rest)</p>
                  <SmallButton
                    variant="secondary"
                    onClick={() => onUpdateRoleRule(index, {
                      tipouts: [...(rule.tipouts || []), { target_role: '', percent: '', basis: 'tips' }],
                    })}
                  >
                    Add tipout
                  </SmallButton>
                </div>
                {(rule.tipouts || []).length === 0 ? (
                  <p className="text-xs text-dash-tertiary">No tipouts — this role keeps 100% of its tips (unless it contributes to a pool).</p>
                ) : null}
                {(rule.tipouts || []).map((tipout, tipoutIndex) => (
                  <div key={tipoutIndex} className="grid gap-2 md:grid-cols-[1fr_110px_150px_auto]">
                    <SelectInput
                      value={tipout.target_role}
                      onChange={event => onUpdateRoleRule(index, {
                        tipouts: rule.tipouts.map((item, i) => i === tipoutIndex ? { ...item, target_role: event.target.value } : item),
                      })}
                    >
                      <option value="">Choose role...</option>
                      {jobCodes.filter(code => code.code !== rule.role_key).map(code => <option key={code.code} value={code.code}>{code.label}</option>)}
                    </SelectInput>
                    <TextInput
                      value={tipout.percent}
                      inputMode="decimal"
                      onChange={event => onUpdateRoleRule(index, {
                        tipouts: rule.tipouts.map((item, i) => i === tipoutIndex ? { ...item, percent: sanitizeNumber(event.target.value).slice(0, 6) } : item),
                      })}
                      placeholder="%"
                    />
                    <SelectInput
                      value={tipout.basis}
                      onChange={event => onUpdateRoleRule(index, {
                        tipouts: rule.tipouts.map((item, i) => i === tipoutIndex ? { ...item, basis: event.target.value } : item),
                      })}
                    >
                      <option value="tips">of tips</option>
                      <option value="sales">of net sales</option>
                    </SelectInput>
                    <SmallButton
                      variant="secondary"
                      onClick={() => onUpdateRoleRule(index, {
                        tipouts: rule.tipouts.filter((_, i) => i !== tipoutIndex),
                      })}
                    >
                      Remove
                    </SmallButton>
                  </div>
                ))}
                {(() => {
                  const valid = (rule.tipouts || []).filter(t => t.target_role && Number(t.percent) > 0)
                  if (!valid.length) return null
                  const tipsPct = valid.filter(t => t.basis !== 'sales').reduce((s, t) => s + Number(t.percent), 0)
                  const salesPct = valid.filter(t => t.basis === 'sales').reduce((s, t) => s + Number(t.percent), 0)
                  const roleLabel = role?.label || rule.role_key
                  const contributesToPool = isPooled && rule.contributes_to_pool
                  return (
                    <div className="rounded-lg border border-dash-gold/25 bg-dash-gold/[0.05] px-3 py-2 text-xs text-dash-secondary">
                      {tipsPct > 0 ? (
                        <>Reserves <span className="font-semibold text-dash-gold">{+tipsPct.toFixed(2)}%</span> of tips
                          {salesPct > 0 ? <> plus a full <span className="font-semibold text-dash-gold">{+salesPct.toFixed(2)}% of net sales</span> obligation</> : null}
                          {' · '}{roleLabel} keeps what remains after those obligations
                        </>
                      ) : (
                        <>{roleLabel} owes <span className="font-semibold text-dash-gold">{+salesPct.toFixed(2)}% of net sales</span>, even when recorded tips are lower</>
                      )}
                      {contributesToPool ? <> — then the remainder goes into the pool</> : null}
                    </div>
                  )
                })()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PayoutPills({ value, options, onChange }) {
  return (
    <div className="inline-flex rounded-full border border-dash-border bg-black/20 p-1">
      {options.map(option => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${selected ? 'bg-dash-gold text-black' : 'text-dash-secondary hover:text-dash-cream'}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

// Payroll defaults: provider, export cadence, cash/credit handling, card fees.
export function PayrollSetupFields({ settings, onUpdateSettings, payPeriodCalendar = null }) {
  const periods = payPeriodCalendar?.periods || {}
  const periodCards = [
    ['previous', 'Previous'],
    ['last_completed', 'Last completed'],
    ['current_open', 'Current open'],
  ].filter(([key]) => periods[key])
  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-xl border border-dash-gold/30 bg-dash-gold/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-dash-cream">Apply employee payouts to expected drawer cash</p>
            <p className="mt-1 max-w-2xl text-xs text-dash-secondary">Off preserves legacy drawer math. On subtracts only immediate or nightly payouts; payroll amounts remain in restaurant cash.</p>
          </div>
          <PayoutPills
            value={settings.expected_drawer_payouts_enabled ? 'on' : 'off'}
            options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
            onChange={value => onUpdateSettings({ expected_drawer_payouts_enabled: value === 'on' })}
          />
        </div>
        {settings.expected_drawer_payouts_enabled ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['Cash voluntary tips', 'cash_tip_payout_timing', settings.cash_tip_payout_timing, [{ value: 'immediate', label: 'Keep now' }, { value: 'payroll', label: 'Payroll' }]],
              ['Cash employee gratuity', 'cash_employee_gratuity_payout_timing', settings.cash_employee_gratuity_payout_timing, [{ value: 'immediate', label: 'Keep now' }, { value: 'payroll', label: 'Payroll' }]],
              ['Card voluntary tips', 'credit_tip_payout_timing', settings.credit_tip_payout_timing, [{ value: 'nightly', label: 'Nightly cash' }, { value: 'payroll', label: 'Payroll' }]],
              ['Card employee gratuity', 'card_employee_gratuity_payout_timing', settings.card_employee_gratuity_payout_timing, [{ value: 'nightly', label: 'Nightly cash' }, { value: 'payroll', label: 'Payroll' }]],
              ['Tip-outs', 'tipout_payout_timing', settings.tipout_payout_timing, [{ value: 'nightly', label: 'Nightly drawer' }, { value: 'payroll', label: 'Payroll' }]],
            ].map(([label, key, value, options]) => (
              <div key={key} className="rounded-lg border border-dash-border bg-black/10 p-3">
                <p className="mb-2 text-xs font-medium text-dash-secondary">{label}</p>
                <PayoutPills value={value} options={options} onChange={next => onUpdateSettings({ [key]: next })} />
              </div>
            ))}
          </div>
        ) : null}
        <p className="text-xs text-dash-tertiary">Nightly tip-outs are withheld from contributors and paid to recipients. Allocated transfers net to $0 additional drawer impact; unresolved amounts remain reserved.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Field label="Payroll Provider">
          <TextInput value={settings.payroll_provider} onChange={event => onUpdateSettings({ payroll_provider: event.target.value })} placeholder="Gusto, ADP, manual..." />
        </Field>
        <Field label="Payroll Export">
          <SelectInput value={settings.payroll_export_frequency} onChange={event => onUpdateSettings({ payroll_export_frequency: event.target.value })}>
            {PAYROLL_EXPORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectInput>
        </Field>
        <Field label="Card Fee %">
          <TextInput value={settings.credit_card_fee_percent} inputMode="decimal" onChange={event => onUpdateSettings({ credit_card_fee_percent: sanitizeNumber(event.target.value).slice(0, 6) })} placeholder="Optional" />
        </Field>
        <div>
          <Field label="Cash Tips">
            <SelectInput value={settings.cash_tip_declaration_mode} onChange={event => onUpdateSettings({ cash_tip_declaration_mode: event.target.value })}>
              {CASH_TIP_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectInput>
          </Field>
          <p className="mt-2 text-xs text-dash-tertiary">Optional means Skip records no declaration. It never turns an unknown amount into $0. Only required mode blocks Server Checkout.</p>
        </div>
      </div>
      <div className="rounded-xl border border-dash-border bg-white/[0.025] p-4">
        <div>
          <p className="text-sm font-semibold text-dash-cream">Pay-period calendar</p>
          <p className="mt-1 text-xs text-dash-secondary">Shared by pay runs, Tips &amp; Tip-out, and emailed Excel reports. Dates are resolved by the backend in the restaurant timezone.</p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <Field label="Period starts">
            <SelectInput value={settings.payroll_period_start_weekday} onChange={event => onUpdateSettings({ payroll_period_start_weekday: Number(event.target.value) })} disabled={!['weekly', 'biweekly'].includes(settings.payroll_export_frequency)}>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((label, index) => <option key={label} value={index}>{label}</option>)}
            </SelectInput>
          </Field>
          <Field label="Biweekly anchor date">
            <TextInput type="date" value={settings.payroll_period_anchor_date} onChange={event => onUpdateSettings({ payroll_period_anchor_date: event.target.value })} disabled={settings.payroll_export_frequency !== 'biweekly'} />
          </Field>
          <Field label="Report default">
            <SelectInput value={settings.payroll_report_default_period} onChange={event => onUpdateSettings({ payroll_report_default_period: event.target.value })} disabled={settings.payroll_export_frequency === 'manual'}>
              <option value="last_completed">Last completed period</option>
              <option value="current_open">Current open period</option>
            </SelectInput>
          </Field>
          {settings.payroll_export_frequency === 'semimonthly' ? (
            <Field label="First period ends on">
              <TextInput type="number" min="1" max="27" value={settings.payroll_semimonthly_cutoff_day} onChange={event => onUpdateSettings({ payroll_semimonthly_cutoff_day: Math.max(1, Math.min(27, Number(event.target.value) || 15)) })} />
            </Field>
          ) : null}
        </div>
        {payPeriodCalendar?.available ? (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {periodCards.map(([key, label]) => (
              <div key={key} className={`rounded-lg border p-3 ${key === payPeriodCalendar.default_period ? 'border-dash-gold bg-dash-gold/5' : 'border-dash-border'}`}>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">{label}</p>
                <p className="mt-1 text-sm font-medium text-dash-cream">{periods[key].start_date} to {periods[key].end_date}</p>
                <p className="mt-1 text-[11px] text-dash-tertiary">{periods[key].id}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dash-border p-3 text-xs text-dash-secondary">{payPeriodCalendar?.reason || 'Save payroll setup to preview backend-resolved periods.'}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <SmallButton variant={settings.auto_withhold_credit_card_fees ? 'primary' : 'secondary'} onClick={() => onUpdateSettings({ auto_withhold_credit_card_fees: !settings.auto_withhold_credit_card_fees })}>Withhold card fees from tips</SmallButton>
        <SmallButton variant={settings.allow_manager_tip_adjustments ? 'primary' : 'secondary'} onClick={() => onUpdateSettings({ allow_manager_tip_adjustments: !settings.allow_manager_tip_adjustments })}>Allow manager tip edits</SmallButton>
        <SmallButton variant={settings.tipout_sales_includes_tax ? 'primary' : 'secondary'} onClick={() => onUpdateSettings({ tipout_sales_includes_tax: !settings.tipout_sales_includes_tax })}>Sales include tax</SmallButton>
      </div>
      <Field label="Notes">
        <TextInput value={settings.notes} onChange={event => onUpdateSettings({ notes: event.target.value })} placeholder="Payroll or tipout notes..." />
      </Field>
    </div>
  )
}

// Backwards-compatible wrapper: renders both halves stacked. Used where the full
// tips/payroll config appears on one screen (Setup panel legacy usage).
export function TipPayrollSettingsFields(props) {
  return (
    <div className="space-y-6">
      <TipRulesFields {...props} />
      <div className="h-px bg-white/10" />
      <PayrollSetupFields settings={props.settings} onUpdateSettings={props.onUpdateSettings} />
    </div>
  )
}

function jobCodePayload(jobCode) {
  return {
    code: slugRoleCode(jobCode.code || jobCode.label),
    label: String(jobCode.label || jobCode.code).trim(),
    permission_tier: jobCode.permission_tier || 'normal',
    default_hourly_rate: jobCode.default_hourly_rate === '' ? 0 : Number(jobCode.default_hourly_rate),
    is_tipped: Boolean(jobCode.is_tipped),
    tipout_role: jobCode.tipout_role || null,
    sort_order: Number(jobCode.sort_order) || 0,
    is_active: jobCode.is_active !== false,
  }
}

export function buildSetupWarnings(restaurant, waiterCount = null, floorPlanStatus = null, jobCodeCount = null) {
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
  if (jobCodeCount === 0) warnings.employees.push('Roles')

  return warnings
}

export function warningCount(warnings) {
  return Object.values(warnings || {}).reduce((sum, items) => sum + items.length, 0)
}

export default function RestaurantSetupPanel({
  restaurant,
  restaurantId,
  auth,
  setupWarnings = {},
  onSetupChanged,
  propagationContext = null,
  allowedTabs = null,
  summaryTabs = [],
  initialTab = null,
  showHeader = true,
}) {
  const isPrimaryOwner = Boolean(auth?.user?.id && restaurant?.owner_id === auth.user.id)
  const visibleSetupTabs = useMemo(() => {
    const authorizedTabs = SETUP_TABS.filter((tab) => tab.id !== 'lifecycle' || isPrimaryOwner)
    if (!Array.isArray(allowedTabs)) return authorizedTabs
    const allowed = new Set(allowedTabs)
    return authorizedTabs.filter(tab => allowed.has(tab.id))
  }, [allowedTabs, isPrimaryOwner])
  const visibleSetupTabIds = visibleSetupTabs.map(tab => tab.id).join(',')
  const [activeSetupTab, setActiveSetupTab] = useState(() => initialTab || visibleSetupTabs[0]?.id || 'basics')
  const activeTabIsSummary = summaryTabs.includes(activeSetupTab)
  const canEditTaxRates = auth?.accountType === 'admin'
  const [coverImageUrl, setCoverImageUrl] = useState(restaurant.cover_image_url || '')
  const [pendingCoverFile, setPendingCoverFile] = useState(null)
  const [pendingCoverPreviewUrl, setPendingCoverPreviewUrl] = useState('')
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
    workweek_start_weekday: normalizeWorkweekStartWeekday(restaurant.config?.workweek_start_weekday),
  }))
  const [legal, setLegal] = useState(() => initialLegal(restaurant))
  const [payments, setPayments] = useState(() => initialPayments(restaurant))
  const [pricingPolicy, setPricingPolicy] = useState(() => normalizePricingPolicy({ jurisdiction_state: restaurant.state || 'SC' }))
  const [serviceModel, setServiceModel] = useState(() => initialServiceModel(restaurant))
  const [goals, setGoals] = useState(() => initialGoals(restaurant))
  const [taxRates, setTaxRates] = useState([defaultTaxRate()])
  const [taxCategoryAssignments, setTaxCategoryAssignments] = useState(undefined)
  const [serviceCharges, setServiceCharges] = useState([])
  const [autoGratuity, setAutoGratuity] = useState(defaultAutoGratuity())
  const [discountRules, setDiscountRules] = useState([])
  const [rolePermissions, setRolePermissions] = useState(defaultRolePermissions())
  const [closeoutSettings, setCloseoutSettings] = useState(defaultCloseoutSettings())
  const [checkWorkflowSettings, setCheckWorkflowSettings] = useState(defaultCheckWorkflowSettings())
  const [tipPayrollSettings, setTipPayrollSettings] = useState(defaultTipPayrollSettings())
  const [sections, setSections] = useState(['Table'])
  const [sectionProfiles, setSectionProfiles] = useState([])
  const [hours, setHours] = useState(DEFAULT_HOURS)
  const [sameHours, setSameHours] = useState(true)
  const [reservationTiming, setReservationTiming] = useState(() => normalizeReservationTiming(restaurant.config))
  const [reservationPublicSlug, setReservationPublicSlug] = useState(() => restaurant.public_slug || restaurant.slug || '')
  const [floorTables, setFloorTables] = useState([])
  const [floorPlanMode, setFloorPlanMode] = useState(null)
  const [waiters, setWaiters] = useState([])
  const [jobCodes, setJobCodes] = useState([])
  const [jobCodeDraft, setJobCodeDraft] = useState({ code: '', label: '', permission_tier: 'normal', default_hourly_rate: '', is_tipped: false, tipout_role: '', sort_order: 100, is_active: true })
  const [rateEdits, setRateEdits] = useState({})
  const [savingRateId, setSavingRateId] = useState('')
  const [staffForm, setStaffForm] = useState({ name: '', email: '', role: '', hourly_rate: '', pin: '1111', employee_login_id: '', suggested_weekly_hours: '' })
  const [pinEdits, setPinEdits] = useState({})
  const [pinSaving, setPinSaving] = useState({})
  const [pinSaved, setPinSaved] = useState({})
  const [setupError, setSetupError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const savedDraftsRef = useRef({})

  const isPropagationEnabled = Boolean(propagationContext?.requestTargets)
  const reservationPublicUrl = useMemo(() => {
    const slug = normalizePublicSlugDraft(reservationPublicSlug) || normalizePublicSlugDraft(profile.name) || 'restaurant'
    return `${publicBookingBaseUrl}/book/${slug}`
  }, [profile.name, reservationPublicSlug])

  const rememberSavedDraft = (sectionId, value) => {
    savedDraftsRef.current[sectionId] = value == null ? value : structuredClone(value)
  }

  const savedDraft = (sectionId) => {
    const value = savedDraftsRef.current[sectionId]
    return value == null ? value : structuredClone(value)
  }

  const discardSetupChanges = (sectionId) => {
    const baseline = savedDraft(sectionId)
    if (baseline === undefined) return
    setSetupError('')
    setSaveMessage('Changes discarded.')
    switch (sectionId) {
      case 'basics':
        setProfile(current => ({ ...current, ...baseline }))
        break
      case 'goals': setGoals(baseline); break
      case 'service_model': setServiceModel(baseline); break
      case 'branding': setPendingCoverFile(null); break
      case 'legal': setLegal(baseline); break
      case 'payments': setPayments(baseline); break
      case 'pricing_policy': setPricingPolicy(baseline); break
      case 'taxes_charges':
        setTaxRates(baseline.taxRates)
        setTaxCategoryAssignments(baseline.taxCategoryAssignments)
        setServiceCharges(baseline.serviceCharges)
        setAutoGratuity(baseline.autoGratuity)
        break
      case 'discounts': setDiscountRules(baseline); break
      case 'manager_controls': setRolePermissions(baseline); break
      case 'closeout': setCloseoutSettings(baseline); break
      case 'check_workflow': setCheckWorkflowSettings(baseline); break
      case 'tips_payroll': setTipPayrollSettings(baseline); break
      case 'sections':
        setSections(baseline.sections)
        setSectionProfiles(baseline.sectionProfiles)
        break
      case 'hours':
        setHours(baseline.hours)
        setSameHours(baseline.sameHours)
        break
      case 'reservation_timing':
        setReservationTiming(baseline.timing)
        setReservationPublicSlug(baseline.publicSlug)
        break
      case 'capacity': setProfile(current => ({ ...current, ...baseline })); break
      case 'employees':
        setJobCodes(baseline.jobCodes)
        setRateEdits(baseline.rateEdits)
        setJobCodeDraft(baseline.jobCodeDraft)
        setStaffForm(baseline.staffForm)
        setPinEdits({})
        setPinSaved({})
        break
      default:
        break
    }
  }

  useEffect(() => {
    if (!visibleSetupTabs.some(tab => tab.id === activeSetupTab)) {
      setActiveSetupTab(initialTab || visibleSetupTabs[0]?.id || 'basics')
    }
  }, [activeSetupTab, initialTab, visibleSetupTabs])

  const updateRestaurantRow = async (targetRestaurantId, patch) => {
    const { data, error } = await supabase
      .from('restaurants')
      .update(patch)
      .eq('id', targetRestaurantId)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const selectCoverFile = (file) => {
    setSetupError('')
    setSaveMessage('')
    if (!file) return
    if (!COVER_IMAGE_MIME_TYPES.has(file.type)) {
      setSetupError('Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_COVER_IMAGE_BYTES) {
      setSetupError('The cover image must be 5 MB or smaller.')
      return
    }
    setPendingCoverFile(file)
  }

  const requestBrandingTargets = async () => {
    const requestedTargets = isPropagationEnabled
      ? await propagationContext.requestTargets({
          sectionId: 'branding',
          label: 'POS background image',
          propagation: 'specified',
          sourceRestaurantId: restaurantId,
        })
      : [restaurantId]
    if (requestedTargets === null) return null
    const targetIds = [...new Set((requestedTargets || []).filter(Boolean))]
    if (targetIds.length === 0) {
      setSetupError('Select at least one restaurant.')
      return null
    }
    return targetIds
  }

  const applyCoverImageUrl = async (nextUrl, targetIds, successMessage) => {
    let sourceResult = null
    for (const targetId of targetIds) {
      const updated = await updateRestaurantRow(targetId, { cover_image_url: nextUrl || null })
      if (targetId === restaurantId) sourceResult = updated
    }
    if (sourceResult) auth.seedCurrentRestaurant?.(sourceResult)
    await auth.refreshRestaurants?.(restaurantId)
    setCoverImageUrl(nextUrl || '')
    setPendingCoverFile(null)
    onSetupChanged?.()
    setSaveMessage(targetIds.length > 1 ? `${successMessage} Applied to ${targetIds.length} restaurants.` : successMessage)
  }

  const saveCoverImage = async () => {
    if (!pendingCoverFile) {
      setSetupError('Choose an image before saving.')
      return
    }
    const targetIds = await requestBrandingTargets()
    if (!targetIds) return
    setIsSaving(true)
    setSetupError('')
    setSaveMessage('')
    try {
      const extension = coverImageExtension(pendingCoverFile)
      const objectPath = `${restaurantId}/covers/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from(RESTAURANT_ASSET_BUCKET)
        .upload(objectPath, pendingCoverFile, {
          cacheControl: '31536000',
          contentType: pendingCoverFile.type,
          upsert: false,
        })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from(RESTAURANT_ASSET_BUCKET).getPublicUrl(objectPath)
      if (!data?.publicUrl) throw new Error('The uploaded image did not return a public URL.')
      await applyCoverImageUrl(data.publicUrl, targetIds, 'POS background saved.')
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not save the POS background.')
    } finally {
      setIsSaving(false)
    }
  }

  const removeCoverImage = async () => {
    const targetIds = await requestBrandingTargets()
    if (!targetIds) return
    setIsSaving(true)
    setSetupError('')
    setSaveMessage('')
    try {
      await applyCoverImageUrl('', targetIds, 'POS background removed.')
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not remove the POS background.')
    } finally {
      setIsSaving(false)
    }
  }

  const mergeRestaurantConfig = async (targetRestaurantId, patch) => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('config')
      .eq('id', targetRestaurantId)
      .single()
    if (error) throw error
    const currentConfig = data?.config && typeof data.config === 'object' ? data.config : {}
    return updateRestaurantRow(targetRestaurantId, { config: { ...currentConfig, ...patch } })
  }

  const putRestaurantEndpoint = (targetRestaurantId, path, body) =>
    fetchWithSupabaseAuth(`/restaurants/${targetRestaurantId}${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })

  const fetchReservationSettings = async (targetRestaurantId) => {
    try {
      return await fetchReservationsApi(`/locations/${targetRestaurantId}/reservation-settings`)
    } catch {
      return null
    }
  }

  const saveReservationSettings = async (targetRestaurantId, timing, operatingHours) => {
    const currentSettings = await fetchReservationSettings(targetRestaurantId)
    const existingPeriods = Array.isArray(currentSettings?.servicePeriods)
      ? currentSettings.servicePeriods.filter(period => period && typeof period === 'object')
      : []
    const payload = reservationTimingPayload(timing)
    const servicePeriods = timing.reservation_windows_follow_operating_hours
      ? reservationPeriodsFromHours(timing, operatingHours, existingPeriods)
      : existingPeriods.length > 0
        ? reservationPeriodsWithDefaults(timing, existingPeriods)
        : reservationPeriodsFromHours(timing, operatingHours, existingPeriods)
    await fetchReservationsApi(`/locations/${targetRestaurantId}/reservation-settings`, {
      method: 'PUT',
      body: JSON.stringify({
        bookingHorizonDays: Number(payload.reservation_online_booking_horizon_days),
        gracePeriodMinutes: Number(payload.reservation_online_grace_period_minutes),
        defaultSlotIntervalMinutes: Number(payload.reservation_slot_interval_minutes),
        servicePeriods,
        timingPolicies: payload.timingPolicies,
      }),
    })
  }

  const saveHoursForRestaurant = async (targetRestaurantId, nextHours) => {
    const { error: deleteError } = await supabase
      .from('operating_hours')
      .delete()
      .eq('restaurant_id', targetRestaurantId)
    if (deleteError) throw deleteError
    const { error: insertError } = await supabase
      .from('operating_hours')
      .insert(nextHours.map(day => ({
        restaurant_id: targetRestaurantId,
        day_of_week: day.day_of_week,
        open_time: day.open_time,
        close_time: day.close_time,
        is_closed: day.is_closed,
      })))
    if (insertError) throw insertError
  }

  const saveWithPropagation = async ({
    sectionId,
    label,
    propagation = SETUP_PROPAGATION[sectionId] || 'specified',
    successMessage,
    saveSource,
    saveTarget,
    onSourceSaved,
    afterSave,
    publication,
    buildCommand,
  }) => {
    const requestedTargets = isPropagationEnabled
      ? await propagationContext.requestTargets({
          sectionId,
          label,
          propagation,
          sourceRestaurantId: restaurantId,
        })
      : [restaurantId]

    if (requestedTargets === null) return null

    const targetIds = [...new Set((requestedTargets || []).filter(Boolean))]
      .sort((a, b) => (a === restaurantId ? -1 : b === restaurantId ? 1 : 0))

    if (targetIds.length === 0) {
      setSetupError('Select at least one restaurant.')
      return null
    }

    setIsSaving(true)
    setSaveMessage('')
    setSetupError('')
    let sourceResult = null
    let sourceWasSaved = false
    try {
      if (publication?.scheduledFor) {
        if (!buildCommand) throw new Error('This setup change cannot be scheduled yet.')
        const commands = targetIds.flatMap(targetId => {
          const command = buildCommand(targetId)
          return Array.isArray(command) ? command : [command]
        })
        const scheduled = await scheduleChange({
          label,
          scheduledFor: publication.scheduledFor,
          timezone: publication.timezone,
          commands,
        })
        setSaveMessage(`${label} scheduled for ${new Date(scheduled.scheduled_for).toLocaleString()}.`)
        return scheduled
      }
      for (const targetId of targetIds) {
        if (targetId === restaurantId) {
          sourceResult = await saveSource(targetId)
          sourceWasSaved = true
        } else {
          await saveTarget(targetId)
        }
      }
      if (sourceWasSaved && onSourceSaved) onSourceSaved(sourceResult)
      if (sourceResult) auth.seedCurrentRestaurant?.(sourceResult)
      await auth.refreshRestaurants?.(restaurantId)
      afterSave?.(sourceResult, targetIds)
      onSetupChanged?.()
      setSaveMessage(targetIds.length > 1 ? `${successMessage} Applied to ${targetIds.length} restaurants.` : successMessage)
      return sourceResult
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not save setup.')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const publishControls = (label, handler, sectionId) => (
    <div className="flex flex-wrap items-center gap-2">
      <SmallButton onClick={() => discardSetupChanges(sectionId)} disabled={isSaving}>Cancel</SmallButton>
      <PublishControls
        label={label}
        busy={isSaving}
        disabled={isSaving}
        onPublishNow={() => handler()}
        onSchedule={(scheduledFor, timezone) => handler({ scheduledFor, timezone })}
      />
    </div>
  )

  useEffect(() => {
    const nextProfile = {
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
      workweek_start_weekday: normalizeWorkweekStartWeekday(restaurant.config?.workweek_start_weekday),
    }
    const nextLegal = initialLegal(restaurant)
    const nextPayments = initialPayments(restaurant)
    const nextServiceModel = initialServiceModel(restaurant)
    const nextGoals = initialGoals(restaurant)
    const nextReservationTiming = normalizeReservationTiming(restaurant.config)
    const nextReservationPublicSlug = restaurant.public_slug || restaurant.slug || ''
    setProfile(nextProfile)
    setLegal(nextLegal)
    setPayments(nextPayments)
    setPricingPolicy(prev => normalizePricingPolicy({ ...prev, jurisdiction_state: prev.jurisdiction_state || restaurant.state || 'SC' }))
    setServiceModel(nextServiceModel)
    setGoals(nextGoals)
    setReservationTiming(nextReservationTiming)
    setReservationPublicSlug(nextReservationPublicSlug)
    setCoverImageUrl(restaurant.cover_image_url || '')
    setPendingCoverFile(null)
    setSaveMessage('')
    rememberSavedDraft('basics', {
      name: nextProfile.name,
      address: nextProfile.address,
      city: nextProfile.city,
      state: nextProfile.state,
      postal_code: nextProfile.postal_code,
      phone: nextProfile.phone,
      type: nextProfile.type,
      cuisine_types: nextProfile.cuisine_types,
      workweek_start_weekday: nextProfile.workweek_start_weekday,
    })
    rememberSavedDraft('capacity', {
      seating_capacity: nextProfile.seating_capacity,
      table_count: nextProfile.table_count,
    })
    rememberSavedDraft('legal', nextLegal)
    rememberSavedDraft('payments', nextPayments)
    rememberSavedDraft('service_model', nextServiceModel)
    rememberSavedDraft('goals', nextGoals)
    rememberSavedDraft('reservation_timing', { timing: nextReservationTiming, publicSlug: nextReservationPublicSlug })
    rememberSavedDraft('branding', { coverImageUrl: restaurant.cover_image_url || '' })
  }, [restaurant])

  useEffect(() => {
    if (!pendingCoverFile) {
      setPendingCoverPreviewUrl('')
      return undefined
    }
    const objectUrl = URL.createObjectURL(pendingCoverFile)
    setPendingCoverPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [pendingCoverFile])

  // Reads go through the shared query cache: returning to this tab within the
  // stale window renders instantly from memory with zero network requests.
  const loadSetupData = async () => {
    if (!restaurantId) return
    setSetupError('')
    const cached = (key, fn) => fetchCached(key, fn, STALE_TIMES.setup)
    const scoped = async (label, read, fallback) => {
      try {
        return { label, value: await read(), error: null }
      } catch (err) {
        return { label, value: fallback, error: err }
      }
    }
    const scopedFor = (tabIds, label, read, fallback) => (
      tabIds.some(tabId => visibleSetupTabs.some(tab => tab.id === tabId))
        ? scoped(label, read, fallback)
        : Promise.resolve({ label, value: fallback, error: null })
    )
    try {
      const results = await Promise.all([
        scopedFor(['employees'], 'Employees', () => fetchCached(queryKeys.waiters(restaurantId), () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=false`), 0), []),
        scopedFor(['employees', 'manager_controls', 'tips_payroll'], 'Roles', () => fetchCached(queryKeys.jobCodes(restaurantId), () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes`), 0), []),
        scopedFor(['hours'], 'Hours', () => cached(queryKeys.operatingHours(restaurantId), async () => {
          const { data, error } = await supabase
            .from('operating_hours')
            .select('day_of_week, open_time, close_time, is_closed')
            .eq('restaurant_id', restaurantId)
            .order('day_of_week')
          if (error) throw error
          return data
        }), []),
        scopedFor(['sections'], 'Sections', () => cached(queryKeys.sections(restaurantId), () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/sections`)), []),
        scopedFor(['capacity'], 'Floor plan', () => cached(queryKeys.floorPlan(restaurantId), () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/floor-plan`)), null),
        scopedFor(['taxes_charges'], 'Taxes and charges', () => cached(queryKeys.taxesCharges(restaurantId), () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/taxes-charges`)), null),
        scopedFor(['discounts'], 'Discounts', () => cached(queryKeys.discountRules(restaurantId), () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/discount-rules`)), null),
        scopedFor(['manager_controls'], 'Manager controls', () => cached(queryKeys.managerControls(restaurantId), () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/manager-controls`)), null),
        scopedFor(['closeout'], 'Closeout', () => cached(queryKeys.closeoutSettings(restaurantId), () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/closeout-settings`)), null),
        scopedFor(['check_workflow'], 'Check workflow', () => cached(queryKeys.checkWorkflowSettings(restaurantId), () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/check-workflow-settings`)), null),
        scopedFor(['tips_payroll'], 'Tips and payroll', () => cached(queryKeys.tipsPayrollSettings(restaurantId), () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tips-payroll-settings`)), null),
        scopedFor(['payments'], 'Pricing policy', () => cached(queryKeys.pricingPolicy(restaurantId), () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/pricing-policy`)), null),
        scopedFor(['reservation_timing'], 'Reservation timing', () => fetchReservationSettings(restaurantId), null),
      ])
      const [
        staffRows,
        jobCodeRows,
        hoursRows,
        sectionRows,
        floorPlan,
        taxesCharges,
        discountData,
        managerControls,
        closeoutData,
        checkWorkflowData,
        tipPayrollData,
        pricingPolicyData,
        reservationSettingsData,
      ] = results.map(result => result.value)

      const normalized = normalizeHours(hoursRows)
      const nextSameHours = deriveSameHours(normalized)
      setHours(normalized)
      setSameHours(nextSameHours)
      setWaiters(Array.isArray(staffRows) ? staffRows : [])
      const normalizedJobCodes = normalizeJobCodes(jobCodeRows)
      const nextRateEdits = Object.fromEntries(normalizedJobCodes.map(code => [code.id, String(code.default_hourly_rate ?? '')]))
      setJobCodes(normalizedJobCodes)
      setRateEdits(nextRateEdits)
      const sectionNames = normalizeSectionNames((Array.isArray(sectionRows) ? sectionRows : []).map(section => section.name))
      const nextSectionProfiles = normalizeSectionProfiles(sectionRows, sectionNames)
      setSections(sectionNames)
      setSectionProfiles(nextSectionProfiles)
      setFloorTables(mapFloorPlanTables(floorPlan))
      const nextTaxRates = normalizeTaxRates(taxesCharges?.tax_rates)
      const nextServiceCharges = normalizeServiceCharges(taxesCharges?.service_charges)
      const nextAutoGratuity = normalizeAutoGratuity(taxesCharges?.auto_gratuity)
      const nextDiscountRules = normalizeDiscountRules(discountData?.discount_rules)
      const nextRolePermissions = normalizeRolePermissions(managerControls?.role_permissions, normalizedJobCodes)
      const nextCloseoutSettings = normalizeCloseoutSettings(closeoutData)
      const nextCheckWorkflowSettings = normalizeCheckWorkflowSettings(checkWorkflowData)
      const nextTipPayrollSettings = normalizeTipPayrollSettings(tipPayrollData, normalizedJobCodes)
      const nextPricingPolicy = normalizePricingPolicy(pricingPolicyData || { jurisdiction_state: restaurant.state || 'SC' })
      setTaxRates(nextTaxRates)
      setTaxCategoryAssignments(undefined)
      setServiceCharges(nextServiceCharges)
      setAutoGratuity(nextAutoGratuity)
      setDiscountRules(nextDiscountRules)
      setRolePermissions(nextRolePermissions)
      setCloseoutSettings(nextCloseoutSettings)
      setCheckWorkflowSettings(nextCheckWorkflowSettings)
      setTipPayrollSettings(nextTipPayrollSettings)
      setPricingPolicy(nextPricingPolicy)
      rememberSavedDraft('hours', { hours: normalized, sameHours: nextSameHours })
      rememberSavedDraft('sections', { sections: sectionNames, sectionProfiles: nextSectionProfiles })
      rememberSavedDraft('taxes_charges', { taxRates: nextTaxRates, taxCategoryAssignments: undefined, serviceCharges: nextServiceCharges, autoGratuity: nextAutoGratuity })
      rememberSavedDraft('discounts', nextDiscountRules)
      rememberSavedDraft('manager_controls', nextRolePermissions)
      rememberSavedDraft('closeout', nextCloseoutSettings)
      rememberSavedDraft('check_workflow', nextCheckWorkflowSettings)
      rememberSavedDraft('tips_payroll', nextTipPayrollSettings)
      rememberSavedDraft('pricing_policy', nextPricingPolicy)
      rememberSavedDraft('employees', {
        jobCodes: normalizedJobCodes,
        rateEdits: nextRateEdits,
        jobCodeDraft: { code: '', label: '', permission_tier: 'normal', default_hourly_rate: '', is_tipped: false, tipout_role: '', sort_order: 100, is_active: true },
        staffForm: { name: '', email: '', role: '', hourly_rate: '', pin: '1111', employee_login_id: '', suggested_weekly_hours: '' },
      })
      {
        const configReservationTiming = normalizeReservationTiming(restaurant.config)
        const serviceReservationTiming = reservationTimingFromSettings(reservationSettingsData)
        const nextReservationTiming = serviceReservationTiming ? { ...configReservationTiming, ...serviceReservationTiming } : configReservationTiming
        setReservationTiming(nextReservationTiming)
        rememberSavedDraft('reservation_timing', { timing: nextReservationTiming, publicSlug: restaurant.public_slug || restaurant.slug || '' })
      }
      const failedLabels = results.filter(result => result.error).map(result => result.label)
      if (failedLabels.length > 0) {
        setSetupError(`${failedLabels.join(', ')} failed to load. Other setup sections are still editable.`)
      }
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not load setup data.')
    }
  }

  useEffect(() => {
    void loadSetupData()
  }, [restaurantId, visibleSetupTabIds])

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

  const saveBasics = async (publication) => {
    const restaurantName = profile.name.trim()
    if (!restaurantName) {
      setSetupError('Restaurant name is required.')
      return
    }
    const payload = {
      name: restaurantName,
      address: profile.address.trim() || null,
      city: profile.city.trim() || null,
      state: profile.state.trim() || null,
      postal_code: profile.postal_code.trim() || null,
      phone: profile.phone.trim() || null,
      type: profile.type || 'casual',
      cuisine_types: profile.cuisine_types,
      workweek_start_weekday: normalizeWorkweekStartWeekday(profile.workweek_start_weekday),
    }
    const saveRestaurantBasics = async (targetId) => {
      return fetchWithSupabaseAuth(`/restaurants/${targetId}/setup-profile`, {
        method: 'PATCH',
        body: JSON.stringify({ patch: payload }),
      })
    }
    await saveWithPropagation({
      sectionId: 'basics',
      label: 'Basics',
      propagation: SETUP_PROPAGATION.basics,
      successMessage: 'Saved basics.',
      saveSource: saveRestaurantBasics,
      saveTarget: saveRestaurantBasics,
      onSourceSaved: (saved) => rememberSavedDraft('basics', {
        name: saved?.name || '',
        address: saved?.address || '',
        city: saved?.city || '',
        state: saved?.state || '',
        postal_code: saved?.postal_code || '',
        phone: saved?.phone || '',
        type: saved?.type || 'casual',
        cuisine_types: Array.isArray(saved?.cuisine_types) ? saved.cuisine_types : [],
        workweek_start_weekday: normalizeWorkweekStartWeekday(saved?.config?.workweek_start_weekday),
      }),
      publication,
      buildCommand: (targetId) => ({ method: 'PATCH', path: `/restaurants/${targetId}/setup-profile`, body: { patch: payload }, target_type: 'restaurant', target_id: targetId }),
    })
  }

  const saveGoals = async (publication) => saveWithPropagation({
    sectionId: 'goals',
    label: 'Goals',
    propagation: 'specified',
    successMessage: 'Saved goals.',
    saveSource: (targetId) => mergeRestaurantConfig(targetId, goals),
    saveTarget: (targetId) => mergeRestaurantConfig(targetId, goals),
    onSourceSaved: () => rememberSavedDraft('goals', goals),
    publication,
    buildCommand: (targetId) => ({ method: 'PATCH', path: `/restaurants/${targetId}/setup-config`, body: { patch: goals }, target_type: 'restaurant', target_id: targetId }),
  })

  const saveServiceModel = async (publication) => saveWithPropagation({
    sectionId: 'service_model',
    label: 'Tools & Service Model',
    propagation: SETUP_PROPAGATION.service_model,
    successMessage: 'Saved tools and service model.',
    saveSource: (targetId) => mergeRestaurantConfig(targetId, serviceModel),
    saveTarget: (targetId) => mergeRestaurantConfig(targetId, serviceModel),
    onSourceSaved: () => rememberSavedDraft('service_model', serviceModel),
    publication,
    buildCommand: (targetId) => ({ method: 'PATCH', path: `/restaurants/${targetId}/setup-config`, body: { patch: serviceModel }, target_type: 'restaurant', target_id: targetId }),
  })

  const updateRestaurantConfig = async (patch, successMessage) => {
    return saveWithPropagation({
      sectionId: 'config',
      label: 'Setup config',
      propagation: 'specified',
      successMessage,
      saveSource: (targetId) => mergeRestaurantConfig(targetId, patch),
      saveTarget: (targetId) => mergeRestaurantConfig(targetId, patch),
    })
  }

  const saveLegal = async (publication) => {
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
    await saveWithPropagation({
      sectionId: 'legal',
      label: 'Business & Legal',
      propagation: SETUP_PROPAGATION.legal,
      successMessage: 'Saved legal setup.',
      saveSource: (targetId) => mergeRestaurantConfig(targetId, {
        ...legal,
        tos_version: 'shire-placeholder-tos-v1',
      }),
      saveTarget: (targetId) => mergeRestaurantConfig(targetId, {
        ...legal,
        tos_version: 'shire-placeholder-tos-v1',
      }),
      onSourceSaved: () => rememberSavedDraft('legal', legal),
      publication,
      buildCommand: (targetId) => ({ method: 'PATCH', path: `/restaurants/${targetId}/setup-config`, body: { patch: { ...legal, tos_version: 'shire-placeholder-tos-v1' } }, target_type: 'restaurant', target_id: targetId }),
    })
  }

  const savePayments = async (publication) => {
    await saveWithPropagation({
      sectionId: 'payments',
      label: 'Payments & Payouts',
      propagation: SETUP_PROPAGATION.payments,
      successMessage: 'Saved payment setup.',
      saveSource: (targetId) => mergeRestaurantConfig(targetId, payments),
      saveTarget: (targetId) => mergeRestaurantConfig(targetId, payments),
      onSourceSaved: () => rememberSavedDraft('payments', payments),
      publication,
      buildCommand: (targetId) => ({ method: 'PATCH', path: `/restaurants/${targetId}/setup-config`, body: { patch: payments }, target_type: 'restaurant', target_id: targetId }),
    })
  }

  const updatePricingPolicy = (patch) => {
    setPricingPolicy(prev => {
      const normalizedPatch = { ...patch }
      if (Object.prototype.hasOwnProperty.call(patch, 'mode')) {
        if (!prev.label || isDefaultPricingCopy(prev.label, DEFAULT_PRICING_LABELS)) normalizedPatch.label = defaultPricingLabel(patch.mode)
        if (!prev.disclosure || isDefaultPricingCopy(prev.disclosure, DEFAULT_PRICING_DISCLOSURES)) normalizedPatch.disclosure = defaultPricingDisclosure(patch.mode)
        const listed = patch.mode === 'dual_pricing_posted_electronic'
          ? prev.listed_price_basis
          : ['credit_surcharge', 'service_fee_all', 'none'].includes(patch.mode) ? 'cash' : 'electronic'
        normalizedPatch.listed_price_basis = listed
        if (prev.display_order === `${prev.listed_price_basis}_first`) normalizedPatch.display_order = `${listed}_first`
      }
      const next = normalizePricingPolicy({ ...prev, ...normalizedPatch })
      return next
    })
  }

  const togglePricingTender = (tender) => {
    setPricingPolicy(prev => {
      const current = Array.isArray(prev.applies_to) ? prev.applies_to : []
      const next = current.includes(tender)
        ? current.filter(item => item !== tender)
        : [...current, tender]
      return normalizePricingPolicy({ ...prev, applies_to: next })
    })
  }

  const savePricingPolicy = async () => {
    const payload = pricingPolicyPayload(pricingPolicy)
    await saveWithPropagation({
      sectionId: 'pricing_policy',
      label: 'Pricing Policy',
      propagation: SETUP_PROPAGATION.pricing_policy,
      successMessage: 'Saved pricing policy.',
      saveSource: (targetId) => putRestaurantEndpoint(targetId, '/pricing-policy', payload),
      saveTarget: (targetId) => putRestaurantEndpoint(targetId, '/pricing-policy', { ...payload, expected_version: undefined }),
      onSourceSaved: (saved) => {
        const normalized = normalizePricingPolicy(saved)
        setPricingPolicy(normalized)
        rememberSavedDraft('pricing_policy', normalized)
        queryClient.setQueryData(queryKeys.pricingPolicy(restaurantId), saved)
      },
    })
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

  const updateAutoGratuityRule = (index, patch) => {
    setAutoGratuity(prev => ({
      ...prev,
      rules: (prev.rules || []).map((row, currentIndex) => (
        currentIndex === index ? { ...row, ...patch } : row
      )),
    }))
  }

  const addAutoGratuityRule = () => {
    setAutoGratuity(prev => {
      const rules = prev.rules?.length ? prev.rules : [{ party_threshold: prev.party_threshold || '6', percent: prev.percent || '18' }]
      const lastThreshold = Math.max(...rules.map(rule => Number(rule.party_threshold) || 0), 0)
      const lastPercent = rules.at(-1)?.percent || prev.percent || '18'
      return {
        ...prev,
        rules: [...rules, { party_threshold: String(Math.max(1, lastThreshold + 1)), percent: lastPercent }],
      }
    })
  }

  const removeAutoGratuityRule = (index) => {
    setAutoGratuity(prev => {
      const rules = (prev.rules || []).filter((_, currentIndex) => currentIndex !== index)
      return {
        ...prev,
        rules: rules.length ? rules : [{ party_threshold: prev.party_threshold || '6', percent: prev.percent || '18' }],
      }
    })
  }

  const saveTaxesCharges = async (publication) => {
    const rawPayload = taxesChargesPayload(taxRates, serviceCharges, autoGratuity, taxCategoryAssignments)
    const payload = canEditTaxRates
      ? rawPayload
      : (({ tax_rates, category_assignments, ...chargesOnlyPayload }) => chargesOnlyPayload)(rawPayload)
    const propagationPayload = {
      ...payload,
      ...(payload.tax_rates ? { tax_rates: payload.tax_rates.map(({ id, ...row }) => row) } : {}),
      service_charges: payload.service_charges.map(({ id, ...row }) => row),
    }
    await saveWithPropagation({
      sectionId: 'taxes_charges',
      label: 'Taxes & Charges',
      propagation: SETUP_PROPAGATION.taxes_charges,
      successMessage: 'Saved taxes and charges.',
      saveSource: (targetId) => putRestaurantEndpoint(targetId, '/taxes-charges', payload),
      saveTarget: (targetId) => putRestaurantEndpoint(targetId, '/taxes-charges', propagationPayload),
      onSourceSaved: (saved) => {
        const nextTaxRates = normalizeTaxRates(saved?.tax_rates)
        const nextServiceCharges = normalizeServiceCharges(saved?.service_charges)
        const nextAutoGratuity = normalizeAutoGratuity(saved?.auto_gratuity)
        setTaxRates(nextTaxRates)
        setServiceCharges(nextServiceCharges)
        setAutoGratuity(nextAutoGratuity)
        setTaxCategoryAssignments(undefined)
        rememberSavedDraft('taxes_charges', { taxRates: nextTaxRates, taxCategoryAssignments: undefined, serviceCharges: nextServiceCharges, autoGratuity: nextAutoGratuity })
        queryClient.setQueryData(queryKeys.taxesCharges(restaurantId), saved)
        if (saved?.category_assignment_warnings?.length) {
          setSetupError(saved.category_assignment_warnings.join(' '))
        }
      },
      publication,
      buildCommand: (targetId) => ({
        method: 'PUT',
        path: `/restaurants/${targetId}/taxes-charges`,
        body: targetId === restaurantId ? payload : propagationPayload,
        target_type: 'restaurant',
        target_id: targetId,
      }),
    })
  }

  const applyMyrtleBeachTaxes = () => {
    if (!canEditTaxRates) return
    if (!window.confirm('Confirm this restaurant is inside Myrtle Beach city limits. This replaces the tax-rate draft and assigns Beer & Wine and Cocktails to their correct rates.')) return
    const preset = taxPresetDraft(MYRTLE_BEACH_CITY_LIMITS_TAX_PRESET)
    setTaxRates(preset.tax_rates)
    setTaxCategoryAssignments(preset.category_assignments)
  }

  const updateDiscountRule = (index, patch) => {
    setDiscountRules(prev => prev.map((row, currentIndex) => currentIndex === index ? { ...row, ...patch } : row))
  }

  const toggleDiscountArrayValue = (values, value) =>
    values.includes(value) ? values.filter(item => item !== value) : [...values, value]

  const saveDiscountRules = async (publication) => {
    try {
      validateDiscountRules(discountRules)
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Check discount rules before saving.')
      return null
    }
    const payload = discountRulesPayload(discountRules)
    const propagationPayload = discountRulesPayload(discountRules, { includeIds: false })
    await saveWithPropagation({
      sectionId: 'discounts',
      label: 'Discounts, Comps & Promos',
      propagation: SETUP_PROPAGATION.discounts,
      successMessage: 'Saved discounts.',
      saveSource: (targetId) => putRestaurantEndpoint(targetId, '/discount-rules', payload),
      saveTarget: (targetId) => putRestaurantEndpoint(targetId, '/discount-rules', propagationPayload),
      onSourceSaved: (saved) => {
        const normalized = normalizeDiscountRules(saved?.discount_rules)
        setDiscountRules(normalized)
        rememberSavedDraft('discounts', normalized)
        queryClient.setQueryData(queryKeys.discountRules(restaurantId), saved)
      },
      publication,
      buildCommand: (targetId) => ({ method: 'PUT', path: `/restaurants/${targetId}/discount-rules`, body: payload, target_type: 'restaurant', target_id: targetId }),
    })
  }

  const updateRolePermission = (index, patch) => {
    setRolePermissions(prev => prev.map((row, currentIndex) => currentIndex === index ? { ...row, ...patch } : row))
  }

  const saveManagerControls = async (publication) => {
    const payload = managerControlsPayload(rolePermissions, jobCodes)
    await saveWithPropagation({
      sectionId: 'manager_controls',
      label: 'Manager Controls',
      propagation: SETUP_PROPAGATION.manager_controls,
      successMessage: 'Saved manager controls.',
      saveSource: (targetId) => putRestaurantEndpoint(targetId, '/manager-controls', payload),
      saveTarget: (targetId) => putRestaurantEndpoint(targetId, '/manager-controls', payload),
      onSourceSaved: (saved) => {
        const normalized = normalizeRolePermissions(saved?.role_permissions, jobCodes)
        setRolePermissions(normalized)
        rememberSavedDraft('manager_controls', normalized)
        queryClient.setQueryData(queryKeys.managerControls(restaurantId), saved)
      },
      publication,
      buildCommand: (targetId) => ({ method: 'PUT', path: `/restaurants/${targetId}/manager-controls`, body: payload, target_type: 'restaurant', target_id: targetId }),
    })
  }

  const updateCloseoutSettings = (patch) => {
    setCloseoutSettings(prev => ({ ...prev, ...patch }))
  }

  const updateCheckWorkflowSettings = (patch) => {
    setCheckWorkflowSettings(prev => ({ ...prev, ...patch }))
  }

  const saveCloseoutSettings = async (publication) => {
    const payload = closeoutSettingsPayload(closeoutSettings)
    await saveWithPropagation({
      sectionId: 'closeout',
      label: 'Cash & Closeout',
      propagation: SETUP_PROPAGATION.closeout,
      successMessage: 'Saved closeout settings.',
      saveSource: (targetId) => putRestaurantEndpoint(targetId, '/closeout-settings', payload),
      saveTarget: (targetId) => putRestaurantEndpoint(targetId, '/closeout-settings', payload),
      onSourceSaved: (saved) => {
        const normalized = normalizeCloseoutSettings(saved)
        setCloseoutSettings(normalized)
        rememberSavedDraft('closeout', normalized)
        queryClient.setQueryData(queryKeys.closeoutSettings(restaurantId), saved)
      },
      publication,
      buildCommand: (targetId) => ({ method: 'PUT', path: `/restaurants/${targetId}/closeout-settings`, body: payload, target_type: 'restaurant', target_id: targetId }),
    })
  }

  const saveCheckWorkflowSettings = async (publication) => {
    const payload = checkWorkflowSettingsPayload(checkWorkflowSettings)
    await saveWithPropagation({
      sectionId: 'check_workflow',
      label: 'Check Workflow',
      propagation: SETUP_PROPAGATION.check_workflow,
      successMessage: 'Saved check workflow settings.',
      saveSource: (targetId) => putRestaurantEndpoint(targetId, '/check-workflow-settings', payload),
      saveTarget: (targetId) => putRestaurantEndpoint(targetId, '/check-workflow-settings', payload),
      onSourceSaved: (saved) => {
        const normalized = normalizeCheckWorkflowSettings(saved)
        setCheckWorkflowSettings(normalized)
        rememberSavedDraft('check_workflow', normalized)
        queryClient.setQueryData(queryKeys.checkWorkflowSettings(restaurantId), saved)
      },
      publication,
      buildCommand: (targetId) => ({ method: 'PUT', path: `/restaurants/${targetId}/check-workflow-settings`, body: payload, target_type: 'restaurant', target_id: targetId }),
    })
  }

  const updateTipPayrollSettings = (patch) => {
    setTipPayrollSettings(prev => ({ ...prev, ...patch }))
  }

  const updateTipRoleRule = (index, patch) => {
    setTipPayrollSettings(prev => ({
      ...prev,
      role_tip_rules: prev.role_tip_rules.map((rule, currentIndex) => currentIndex === index ? { ...rule, ...patch } : rule),
    }))
  }

  const saveTipPayrollSettings = async (publication) => {
    const payload = tipPayrollPayload(tipPayrollSettings, jobCodes)
    await saveWithPropagation({
      sectionId: 'tips_payroll',
      label: 'Tips & Payroll',
      propagation: SETUP_PROPAGATION.tips_payroll,
      successMessage: 'Saved tips and payroll.',
      saveSource: (targetId) => putRestaurantEndpoint(targetId, '/tips-payroll-settings', payload),
      saveTarget: (targetId) => putRestaurantEndpoint(targetId, '/tips-payroll-settings', payload),
      onSourceSaved: (saved) => {
        const normalized = normalizeTipPayrollSettings(saved, jobCodes)
        setTipPayrollSettings(normalized)
        rememberSavedDraft('tips_payroll', normalized)
        queryClient.setQueryData(queryKeys.tipsPayrollSettings(restaurantId), saved)
      },
      publication,
      buildCommand: (targetId) => ({ method: 'PUT', path: `/restaurants/${targetId}/tips-payroll-settings`, body: payload, target_type: 'restaurant', target_id: targetId }),
    })
  }

  const saveJobCode = async (jobCode, publication) => {
    setSavingRateId(jobCode.id || 'new')
    setSetupError('')
    try {
      const payload = jobCodePayload(jobCode)
      const canonicalCode = normalizeRoleCode(payload.code)
      const duplicate = jobCodes.find(code => (
        code.id !== jobCode.id
        && code.is_active !== false
        && normalizeRoleCode(code.code) === canonicalCode
      ))
      if (duplicate) {
        throw new Error(canonicalCode === 'server'
          ? 'Server already exists — Waiter and Server are the same role.'
          : 'That role already exists.')
      }
      if (publication?.scheduledFor && jobCode.id) {
        const scheduled = await scheduleChange({
          label: `${jobCode.label || jobCode.code} role`,
          scheduledFor: publication.scheduledFor,
          timezone: publication.timezone,
          commands: [{
            method: 'PATCH',
            path: `/restaurants/${targetId}/job-codes/${jobCode.id}`,
            body: payload,
            target_type: 'restaurant',
            target_id: restaurantId,
          }],
        })
        setSaveMessage(`${jobCode.label || jobCode.code} role scheduled for ${new Date(scheduled.scheduled_for).toLocaleString()}.`)
        return
      }
      const saved = await fetchWithSupabaseAuth(
        jobCode.id ? `/restaurants/${restaurantId}/job-codes/${jobCode.id}` : `/restaurants/${restaurantId}/job-codes`,
        {
          method: jobCode.id ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        }
      )
      const nextCodes = jobCode.id
        ? jobCodes.map(code => code.id === saved.id ? saved : code)
        : [...jobCodes, saved]
      const normalized = normalizeJobCodes(nextCodes)
      const nextRateEdits = Object.fromEntries(normalized.map(code => [code.id, String(code.default_hourly_rate ?? '')]))
      const nextJobCodeDraft = { code: '', label: '', permission_tier: 'normal', default_hourly_rate: '', is_tipped: false, tipout_role: '', sort_order: Math.max(100, ...normalized.map(code => Number(code.sort_order) || 0)) + 10, is_active: true }
      setJobCodes(normalized)
      setRateEdits(nextRateEdits)
      setTipPayrollSettings(prev => normalizeTipPayrollSettings(prev, normalized))
      setRolePermissions(prev => normalizeRolePermissions(prev, normalized))
      setJobCodeDraft(nextJobCodeDraft)
      rememberSavedDraft('employees', {
        ...(savedDraft('employees') || {}),
        jobCodes: normalized,
        rateEdits: nextRateEdits,
        jobCodeDraft: nextJobCodeDraft,
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobCodes(restaurantId) })
      setSaveMessage('Saved role.')
      onSetupChanged?.()
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not save role.')
    } finally {
      setSavingRateId('')
    }
  }

  const removeJobCode = async (jobCode) => {
    if (!jobCode?.id) return
    setSavingRateId(jobCode.id)
    setSetupError('')
    try {
      await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes/${jobCode.id}`, {
        method: 'PATCH',
        body: JSON.stringify(jobCodePayload({ ...jobCode, is_active: false })),
      })
      const normalized = normalizeJobCodes(jobCodes.filter(code => code.id !== jobCode.id))
      const nextRateEdits = Object.fromEntries(normalized.map(code => [code.id, String(code.default_hourly_rate ?? '')]))
      setJobCodes(normalized)
      setRateEdits(nextRateEdits)
      setTipPayrollSettings(prev => normalizeTipPayrollSettings(prev, normalized))
      setRolePermissions(prev => normalizeRolePermissions(prev, normalized))
      rememberSavedDraft('employees', {
        ...(savedDraft('employees') || {}),
        jobCodes: normalized,
        rateEdits: nextRateEdits,
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobCodes(restaurantId) })
      setSaveMessage('Removed role.')
      onSetupChanged?.()
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not remove role.')
    } finally {
      setSavingRateId('')
    }
  }

  const saveSections = async (publication) => {
    const sectionNames = normalizeSectionNames(sections)
    const payload = {
      sections: normalizeSectionProfiles(sectionProfiles, sectionNames).map(section => ({
        ...section,
        id: section.id || undefined,
        auto_gratuity_value: Number(section.auto_gratuity_value || 0),
        minimum_party_size: section.minimum_party_size ? Number(section.minimum_party_size) : null,
      })),
    }
    await saveWithPropagation({
      sectionId: 'sections',
      label: 'Sections',
      propagation: SETUP_PROPAGATION.sections,
      successMessage: 'Saved sections.',
      saveSource: (targetId) => putRestaurantEndpoint(targetId, '/sections', payload),
      saveTarget: (targetId) => putRestaurantEndpoint(targetId, '/sections', payload),
      onSourceSaved: (saved) => {
        const savedNames = normalizeSectionNames((Array.isArray(saved) ? saved : []).map(section => section.name))
        const savedProfiles = normalizeSectionProfiles(saved, savedNames)
        setSections(savedNames)
        setSectionProfiles(savedProfiles)
        rememberSavedDraft('sections', { sections: savedNames, sectionProfiles: savedProfiles })
        queryClient.setQueryData(queryKeys.sections(restaurantId), saved)
        setFloorTables(prev => prev.map(table => {
          if (table.section_id) return table
          return { ...table, section_name: table.section_name || 'Table' }
        }))
      },
      publication,
      buildCommand: (targetId) => ({ method: 'PUT', path: `/restaurants/${targetId}/sections`, body: payload, target_type: 'restaurant', target_id: targetId }),
    })
  }

  const saveHours = async (publication) => {
    await saveWithPropagation({
      sectionId: 'hours',
      label: 'Hours',
      propagation: SETUP_PROPAGATION.hours,
      successMessage: 'Saved hours.',
      saveSource: (targetId) => saveHoursForRestaurant(targetId, hours),
      saveTarget: (targetId) => saveHoursForRestaurant(targetId, hours),
      onSourceSaved: () => {
        rememberSavedDraft('hours', { hours, sameHours })
        void queryClient.invalidateQueries({ queryKey: queryKeys.operatingHours(restaurantId) })
      },
      publication,
      buildCommand: (targetId) => ({ method: 'PUT', path: `/restaurants/${targetId}/operating-hours`, body: { hours }, target_type: 'restaurant', target_id: targetId }),
    })
  }

  const updateReservationTiming = (patch) => {
    setReservationTiming(prev => {
      const next = normalizeReservationTiming({ ...prev, ...patch })
      if (patch.reservation_timing_same_for_channels === true) {
        next.reservation_staff_booking_horizon_days = next.reservation_online_booking_horizon_days
        next.reservation_staff_lead_time_minutes = next.reservation_online_lead_time_minutes
        next.reservation_staff_grace_period_minutes = next.reservation_online_grace_period_minutes
      }
      if (
        next.reservation_timing_same_for_channels &&
        (
          Object.prototype.hasOwnProperty.call(patch, 'reservation_online_booking_horizon_days') ||
          Object.prototype.hasOwnProperty.call(patch, 'reservation_online_lead_time_minutes') ||
          Object.prototype.hasOwnProperty.call(patch, 'reservation_online_grace_period_minutes')
        )
      ) {
        next.reservation_staff_booking_horizon_days = next.reservation_online_booking_horizon_days
        next.reservation_staff_lead_time_minutes = next.reservation_online_lead_time_minutes
        next.reservation_staff_grace_period_minutes = next.reservation_online_grace_period_minutes
      }
      return next
    })
  }

  const saveReservationTiming = async (publication) => {
    const payload = reservationTimingPayload(reservationTiming)
    const configPatch = {
      reservation_timing_same_for_channels: payload.reservation_timing_same_for_channels,
      reservation_online_booking_horizon_days: payload.reservation_online_booking_horizon_days,
      reservation_online_lead_time_minutes: payload.reservation_online_lead_time_minutes,
      reservation_online_grace_period_minutes: payload.reservation_online_grace_period_minutes,
      reservation_staff_booking_horizon_days: payload.reservation_staff_booking_horizon_days,
      reservation_staff_lead_time_minutes: payload.reservation_staff_lead_time_minutes,
      reservation_staff_grace_period_minutes: payload.reservation_staff_grace_period_minutes,
      reservation_slot_interval_minutes: payload.reservation_slot_interval_minutes,
      reservation_min_party_size: payload.reservation_min_party_size,
      reservation_max_party_size: payload.reservation_max_party_size,
      reservation_default_duration_minutes: payload.reservation_default_duration_minutes,
      reservation_windows_follow_operating_hours: payload.reservation_windows_follow_operating_hours,
    }
    await saveWithPropagation({
      sectionId: 'reservation_timing',
      label: 'Reservation Timing',
      propagation: SETUP_PROPAGATION.reservation_timing,
      successMessage: 'Saved reservation timing.',
      saveSource: async (targetId) => {
        if (targetId === restaurantId) {
          await saveReservationPublicSlug(targetId, reservationPublicSlug || profile.name)
        }
        await saveReservationSettings(targetId, payload, hours)
        return mergeRestaurantConfig(targetId, configPatch)
      },
      saveTarget: async (targetId) => {
        await saveReservationSettings(targetId, payload, hours)
        return mergeRestaurantConfig(targetId, configPatch)
      },
      onSourceSaved: () => {
        const normalized = normalizeReservationTiming(configPatch)
        const normalizedPublicSlug = normalizePublicSlugDraft(reservationPublicSlug || profile.name)
        setReservationTiming(normalized)
        setReservationPublicSlug(normalizedPublicSlug)
        rememberSavedDraft('reservation_timing', { timing: normalized, publicSlug: normalizedPublicSlug })
      },
      publication,
    })
  }

  const saveCapacity = async (patch = {}, publication) => {
    const nextCapacity = patch.seating_capacity ?? profile.seating_capacity
    const nextCount = patch.table_count ?? profile.table_count
    const payload = {
      seating_capacity: nextCapacity === '' ? null : Number(nextCapacity),
      table_count: nextCount === '' ? null : Number(nextCount),
    }
    await saveWithPropagation({
      sectionId: 'capacity',
      label: 'Capacity / Floor Plan',
      propagation: SETUP_PROPAGATION.capacity,
      successMessage: 'Saved capacity.',
      saveSource: (targetId) => updateRestaurantRow(targetId, payload),
      saveTarget: (targetId) => updateRestaurantRow(targetId, payload),
      onSourceSaved: () => {
        setProfile(prev => ({ ...prev, seating_capacity: nextCapacity, table_count: nextCount }))
        rememberSavedDraft('capacity', { seating_capacity: nextCapacity, table_count: nextCount })
      },
      publication,
      buildCommand: (targetId) => ({ method: 'PATCH', path: `/restaurants/${targetId}/setup-profile`, body: { patch: payload }, target_type: 'restaurant', target_id: targetId }),
    })
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
    if (!staffForm.role) {
      setSetupError('Choose an employee role.')
      return
    }
    setSetupError('')
    const roleUpdate = buildStaffRoleUpdate(staffForm.role, [staffForm.role], jobCodes)
    const created = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters`, {
      method: 'POST',
      body: JSON.stringify({
        name: staffForm.name.trim(),
        email: staffForm.email.trim() || null,
        ...roleUpdate,
        hourly_rate: staffForm.hourly_rate === '' ? null : Number(staffForm.hourly_rate),
        pin: staffForm.pin,
        employee_login_id: staffForm.employee_login_id.trim() || defaultEmployeeId(staffForm.name),
        suggested_weekly_hours: staffForm.suggested_weekly_hours === '' ? null : Number(staffForm.suggested_weekly_hours),
      }),
    })
    setWaiters(prev => [...prev, created])
    queryClient.setQueryData(queryKeys.waiters(restaurantId), prev => Array.isArray(prev) ? [...prev, created] : prev)
    setStaffForm({ name: '', email: '', role: '', hourly_rate: '', pin: '1111', employee_login_id: '', suggested_weekly_hours: '' })
    onSetupChanged?.()
  }

  const updateStaff = async (waiterId, updates) => {
    setSetupError('')
    const updated = await fetchWithSupabaseAuth(`/waiters/${waiterId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
    setWaiters(prev => prev.map(item => item.id === waiterId ? updated : item))
    queryClient.setQueryData(queryKeys.waiters(restaurantId), prev => Array.isArray(prev) ? prev.map(item => item.id === waiterId ? updated : item) : prev)
    onSetupChanged?.()
  }

  const removeStaff = async (waiterId) => {
    await fetchWithSupabaseAuth(`/waiters/${waiterId}`, { method: 'DELETE' })
    setWaiters(prev => prev.filter(item => item.id !== waiterId))
    queryClient.setQueryData(queryKeys.waiters(restaurantId), prev => Array.isArray(prev) ? prev.filter(item => item.id !== waiterId) : prev)
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
      const saved = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes/${jobCode.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ default_hourly_rate: parsed.toFixed(2) }),
      })
      setJobCodes(prev => prev.map(code => code.id === saved.id ? saved : code))
      setRateEdits(prev => ({ ...prev, [saved.id]: String(saved.default_hourly_rate ?? parsed.toFixed(2)) }))
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobCodes(restaurantId) })
      setSaveMessage('Saved role rate.')
      onSetupChanged?.()
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not save role rate.')
    } finally {
      setSavingRateId('')
    }
  }

  const discardJobCodeChanges = (jobCodeId) => {
    const baseline = savedDraft('employees')
    const original = baseline?.jobCodes?.find(code => code.id === jobCodeId)
    if (!original) return
    setJobCodes(current => current.map(code => code.id === jobCodeId ? original : code))
    setRateEdits(current => ({ ...current, [jobCodeId]: baseline.rateEdits?.[jobCodeId] ?? String(original.default_hourly_rate ?? '') }))
    setSetupError('')
    setSaveMessage('Changes discarded.')
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
            void queryClient.invalidateQueries({ queryKey: queryKeys.floorPlan(restaurantId) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.tables(restaurantId) })
            onSetupChanged?.()
          }}
        />
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <ScheduledChangesPanel />
      {showHeader && <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
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
          {visibleSetupTabs.map(item => (
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
      </section>}

      {!showHeader && visibleSetupTabs.length > 1 && (
        <nav className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
          {visibleSetupTabs.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSetupTab(item.id)}
              className={[
                'rounded-lg px-3 py-2 text-sm font-semibold transition',
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
      )}

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

      {activeTabIsSummary ? (
        <SectionShell
          title={visibleSetupTabs.find((tab) => tab.id === activeSetupTab)?.label || 'Configuration'}
          description="Current configuration status"
        >
          {setupWarnings[activeSetupTab]?.length > 0 ? (
            <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-4">
              <p className="text-sm font-semibold text-amber-100">Needs attention</p>
              <p className="mt-1 text-sm text-amber-100/80">{setupWarnings[activeSetupTab].join(', ')}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-sm font-semibold text-emerald-100">
              Configured
            </div>
          )}
        </SectionShell>
      ) : <>
      {activeSetupTab === 'basics' && (
        <SectionShell
          title="Basics"
          description="Restaurant profile, service modes, and default guest flow from Stage 1 onboarding."
          actions={publishControls('Save basics', saveBasics, 'basics')}
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
            <Field label="Workweek Start Day">
              <SelectInput
                value={profile.workweek_start_weekday}
                onChange={event => setProfile(prev => ({
                  ...prev,
                  workweek_start_weekday: normalizeWorkweekStartWeekday(event.target.value),
                }))}
              >
                {WORKWEEK_START_DAY_OPTIONS.map(day => (
                  <option key={day.value} value={day.value}>{day.label}</option>
                ))}
              </SelectInput>
              <span className="block text-xs leading-5 text-dash-tertiary">
                Week-to-date hours reset when the selected workweek start business day begins.
              </span>
            </Field>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'goals' && (
        <SectionShell
          title="Goals"
          description="Operating priorities and restaurant profile ranges captured during onboarding."
          actions={publishControls('Save goals', saveGoals, 'goals')}
        >
          <div className="space-y-6">
            <Field label="Biggest Challenges">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {GOAL_CHALLENGES.map(([value, label]) => {
                  const selected = goals.challenges.includes(value)
                  return <button key={value} type="button" onClick={() => setGoals(prev => ({ ...prev, challenges: selected ? prev.challenges.filter(item => item !== value) : [...prev.challenges, value] }))} className={`rounded-xl border p-4 text-left text-sm font-semibold transition ${selected ? 'border-dash-gold bg-dash-gold/10 text-dash-cream' : 'border-white/10 bg-white/[0.03] text-dash-secondary hover:border-white/20'}`}>{label}</button>
                })}
              </div>
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Daily Covers"><SelectInput value={goals.daily_covers_range} onChange={event => setGoals(prev => ({ ...prev, daily_covers_range: event.target.value }))}><option value="">Not specified</option><option value="under_50">Under 50</option><option value="50_150">50 - 150</option><option value="150_300">150 - 300</option><option value="300_plus">300+</option></SelectInput></Field>
              <Field label="Team Size"><SelectInput value={goals.team_size_range} onChange={event => setGoals(prev => ({ ...prev, team_size_range: event.target.value }))}><option value="">Not specified</option><option value="1_5">1 - 5</option><option value="6_15">6 - 15</option><option value="16_30">16 - 30</option><option value="30_plus">30+</option></SelectInput></Field>
              <Field label="Primary Goal"><SelectInput value={goals.primary_goal} onChange={event => setGoals(prev => ({ ...prev, primary_goal: event.target.value }))}><option value="">Not specified</option><option value="revenue">Increase revenue</option><option value="costs">Reduce costs</option><option value="guest_experience">Guest experience</option><option value="data">Better data</option><option value="replace_tools">Replace current tools</option></SelectInput></Field>
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'service_model' && (
        <SectionShell
          title="Tools & Service Model"
          description="Current operating systems, service styles, and the default guest flow captured during onboarding."
          actions={publishControls('Save tools & service model', saveServiceModel, 'service_model')}
        >
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Current POS"><SelectInput value={serviceModel.current_pos} onChange={event => setServiceModel(prev => ({ ...prev, current_pos: event.target.value }))}>{CURRENT_TOOL_OPTIONS.current_pos.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput></Field>
              <Field label="Scheduling Tool"><SelectInput value={serviceModel.current_scheduling} onChange={event => setServiceModel(prev => ({ ...prev, current_scheduling: event.target.value }))}>{CURRENT_TOOL_OPTIONS.current_scheduling.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput></Field>
              <Field label="Reservations Tool"><SelectInput value={serviceModel.current_reservations} onChange={event => setServiceModel(prev => ({ ...prev, current_reservations: event.target.value }))}>{CURRENT_TOOL_OPTIONS.current_reservations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput></Field>
            </div>
            <Field label="Service Modes">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SERVICE_MODE_OPTIONS.map(option => {
                  const selected = serviceModel.service_modes.includes(option.id)
                  return <button key={option.id} type="button" onClick={() => setServiceModel(prev => ({ ...prev, service_modes: selected ? prev.service_modes.filter(item => item !== option.id) : [...prev.service_modes, option.id] }))} className={`rounded-xl border p-4 text-left text-sm font-semibold transition ${selected ? 'border-dash-gold bg-dash-gold/10 text-dash-cream' : 'border-white/10 bg-white/[0.03] text-dash-secondary hover:border-white/20'}`}>{option.label}</button>
                })}
              </div>
            </Field>
            <Field label="Default Guest Flow"><SelectInput value={serviceModel.default_guest_flow} onChange={event => setServiceModel(prev => ({ ...prev, default_guest_flow: event.target.value }))}>{GUEST_FLOW_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</SelectInput></Field>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'branding' && (
        <SectionShell
          title="POS Branding"
          description={`Choose the background shown on ${restaurant.name}'s PIN screen and restaurant-selection card.`}
          actions={(
            <div className="flex flex-wrap gap-2">
              <SmallButton onClick={() => discardSetupChanges('branding')} disabled={isSaving || !pendingCoverFile}>Cancel</SmallButton>
              <SmallButton variant="primary" onClick={() => void saveCoverImage()} disabled={isSaving || !pendingCoverFile}>
                {isSaving ? 'Saving...' : 'Save background'}
              </SmallButton>
            </div>
          )}
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
            <div className="space-y-4">
              <label
                className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.025] px-6 py-8 text-center transition hover:border-dash-gold/60 hover:bg-dash-gold/[0.04]"
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault()
                  selectCoverFile(event.dataTransfer.files?.[0])
                }}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={event => {
                    selectCoverFile(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
                <span className="text-base font-semibold text-dash-cream">
                  {pendingCoverFile ? pendingCoverFile.name : 'Drop a restaurant photo here'}
                </span>
                <span className="mt-2 text-sm text-dash-secondary">or click to choose a JPEG, PNG, or WebP up to 5 MB</span>
                <span className="mt-3 text-xs text-dash-tertiary">A landscape 4:3 image works best on the POS.</span>
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <SmallButton variant="primary" onClick={() => void saveCoverImage()} disabled={isSaving || !pendingCoverFile}>
                  {isSaving ? 'Saving...' : coverImageUrl ? 'Replace background' : 'Save background'}
                </SmallButton>
                {(coverImageUrl || pendingCoverFile) && (
                  <SmallButton
                    onClick={() => {
                      if (pendingCoverFile) {
                        setPendingCoverFile(null)
                        return
                      }
                      void removeCoverImage()
                    }}
                    disabled={isSaving}
                  >
                    {pendingCoverFile ? 'Discard selection' : 'Remove background'}
                  </SmallButton>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-dash-secondary">
                <p className="font-semibold text-dash-cream">Currently editing: {restaurant.name}</p>
                <p className="mt-1">The image is darkened and softly blurred on the live PIN screen so staff names and keypad controls stay readable.</p>
                <p className="mt-1">A connected POS picks up the change the next time its lock screen opens and refreshes device status.</p>
              </div>
            </div>

            <div>
              <p className="label-mono">POS Preview</p>
              <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-[#14120f] shadow-2xl">
                {(pendingCoverPreviewUrl || coverImageUrl) && (
                  <img
                    src={pendingCoverPreviewUrl || coverImageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full scale-105 object-cover blur-sm"
                  />
                )}
                <div className="absolute inset-0 bg-[rgba(20,18,15,0.62)]" />
                <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">Welcome to</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{restaurant.display_name || restaurant.name}</p>
                  <div className="mt-8 grid grid-cols-3 gap-2 opacity-90">
                    {[1, 2, 3, 4, 5, 6].map(number => (
                      <span key={number} className="flex h-10 w-14 items-center justify-center rounded-xl border border-white/15 bg-black/20 text-sm font-semibold text-white/80">
                        {number}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-dash-tertiary">Preview approximates the POS crop, blur, and contrast overlay.</p>
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'legal' && (
        <SectionShell
          title="Business & Legal"
          description="Legal entity details and the placeholder Shire agreement signature captured during Stage 1 onboarding."
          actions={publishControls('Save legal', saveLegal, 'legal')}
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
          actions={publishControls('Save payments', savePayments, 'payments')}
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
              <SmartTimeInput ariaLabel="Automatic batch close time" minuteStep={5} value={payments.batch_close_time} onChange={value => setPayments(prev => ({ ...prev, batch_close_time: value }))} />
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
          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h4 className="text-lg font-semibold text-dash-cream">Pricing Policy</h4>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-dash-secondary">
                  Dual pricing prints cash and electronic options before payment, then receipts show the selected tender outcome.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <SmallButton onClick={() => discardSetupChanges('pricing_policy')} disabled={isSaving}>Cancel</SmallButton>
                <SmallButton variant="primary" onClick={() => void savePricingPolicy()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save pricing policy'}</SmallButton>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Enabled">
                <label className="flex min-h-[46px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-dash-cream">
                  <input
                    type="checkbox"
                    checked={pricingPolicy.enabled !== false}
                    onChange={event => updatePricingPolicy({ enabled: event.target.checked })}
                    className="h-4 w-4 rounded border-white/20 bg-black/20"
                  />
                  Active
                </label>
              </Field>
              <Field label="Mode">
                <SelectInput value={pricingPolicy.mode} onChange={event => updatePricingPolicy({ mode: event.target.value })}>
                  {PRICING_MODE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectInput>
              </Field>
              <Field label="Commercial Rate">
                <div className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-dash-secondary">
                  <span className="font-mono text-dash-cream">
                    {(Number(pricingPolicy.rate || 0) * 100).toFixed(2).replace(/\.?0+$/, '')}%
                  </span>
                  <p className="mt-1 text-xs leading-5 text-dash-tertiary">
                    Set by Shire or reseller terms. Owners can configure display rules, not the per-transaction rate.
                  </p>
                </div>
              </Field>
              <Field label="Adjustment Basis">
                <SelectInput value={pricingPolicy.basis} onChange={event => updatePricingPolicy({ basis: event.target.value })}>
                  {PRICING_BASIS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectInput>
              </Field>
              <Field label="Listed Prices">
                <SelectInput
                  value={pricingPolicy.listed_price_basis}
                  disabled={pricingPolicy.mode !== 'dual_pricing_posted_electronic'}
                  onChange={event => updatePricingPolicy({
                    listed_price_basis: event.target.value,
                    display_order: `${event.target.value}_first`,
                  })}
                >
                  <option value="cash">Cash</option>
                  <option value="electronic">Electronic</option>
                </SelectInput>
              </Field>
              <Field label="Show First">
                <SelectInput value={pricingPolicy.display_order} onChange={event => updatePricingPolicy({ display_order: event.target.value })}>
                  <option value="cash_first">Cash</option>
                  <option value="electronic_first">Electronic</option>
                </SelectInput>
              </Field>
              <Field label="State">
                <TextInput
                  value={pricingPolicy.jurisdiction_state}
                  onChange={event => updatePricingPolicy({ jurisdiction_state: event.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2) })}
                  placeholder="SC"
                />
              </Field>
              <Field label="Label">
                <TextInput value={pricingPolicy.label} onChange={event => updatePricingPolicy({ label: event.target.value.slice(0, 120) })} placeholder={pricingPolicy.mode === 'cash_discount' ? 'Cash discount' : 'Dual pricing'} />
              </Field>
            </div>

            <p className="mt-3 text-xs leading-5 text-dash-tertiary">
              Listed prices determine payment math. Show first changes only the order shown on the POS and customer checks.
            </p>

            <div className="mt-5 space-y-3">
              <span className="label-mono">Applies To</span>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PRICING_TENDER_OPTIONS.map(option => (
                  <label key={option.value} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-dash-cream">
                    <input
                      type="checkbox"
                      checked={(pricingPolicy.applies_to || []).includes(option.value)}
                      onChange={() => togglePricingTender(option.value)}
                      className="h-4 w-4 rounded border-white/20 bg-black/20"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <Field label="Disclosure">
                <TextAreaInput value={pricingPolicy.disclosure} onChange={event => updatePricingPolicy({ disclosure: event.target.value.slice(0, 1000) })} />
              </Field>
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'taxes_charges' && (
        <SectionShell
          title="Taxes & Charges"
          description="Tax categories and service charges used by the POS for order totals, refunds, closeout, and reports."
          actions={publishControls('Save taxes & charges', saveTaxesCharges, 'taxes_charges')}
        >
          <div className="space-y-8">
            <div className="space-y-4">
              <div>
                <p className="label-mono">Tax Rates</p>
                <p className="mt-2 text-sm text-dash-secondary">
                  {canEditTaxRates
                    ? 'Tax categories are maintained by platform support from the restaurant address. The default tax also syncs to legacy POS tax settings.'
                    : 'Tax categories are derived from the restaurant address and shown here for review. Platform support updates them when the address or jurisdiction changes.'}
                </p>
                {canEditTaxRates && <SmallButton onClick={applyMyrtleBeachTaxes} className="mt-3">Use Myrtle Beach city-limits rates</SmallButton>}
              </div>
              {normalizeTaxRates(taxRates).map((tax, index) => (
                <div key={tax.id || `tax:${index}`} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="grid gap-3 md:grid-cols-[1.2fr_0.7fr_1fr]">
                    <TextInput value={tax.name} onChange={event => updateTaxRate(index, { name: event.target.value })} placeholder="Sales Tax" disabled={!canEditTaxRates} />
                    <TextInput inputMode="decimal" value={tax.rate} onChange={event => updateTaxRate(index, { rate: sanitizeNumber(event.target.value) })} placeholder="Rate %" disabled={!canEditTaxRates} />
                    <SelectInput value={tax.applies_to} onChange={event => updateTaxRate(index, { applies_to: event.target.value })} disabled={!canEditTaxRates}>
                      {taxAppliesToOptions(tax.applies_to).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </SelectInput>
                  </div>
                  {canEditTaxRates && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <SmallButton variant={tax.is_default ? 'primary' : 'secondary'} onClick={() => updateTaxRate(index, { is_default: true })}>Default tax</SmallButton>
                      <SmallButton variant={tax.is_inclusive ? 'primary' : 'secondary'} onClick={() => updateTaxRate(index, { is_inclusive: !tax.is_inclusive })}>Tax included in price</SmallButton>
                      <SmallButton variant="danger" onClick={() => removeTaxRate(index)}>Remove</SmallButton>
                    </div>
                  )}
                </div>
              ))}
              {canEditTaxRates && <SmallButton onClick={() => setTaxRates(prev => [...normalizeTaxRates(prev), { ...defaultTaxRate(), name: 'Additional Tax', is_default: false }])}>Add tax rate</SmallButton>}
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
                    <SmallButton variant={charge.is_tip ? 'primary' : 'secondary'} onClick={() => updateServiceCharge(index, { is_tip: !charge.is_tip })}>{charge.is_tip ? 'Employee receives charge' : 'Restaurant keeps charge'}</SmallButton>
                    <SmallButton variant="danger" onClick={() => setServiceCharges(prev => prev.filter((_, currentIndex) => currentIndex !== index))}>Remove</SmallButton>
                  </div>
                </div>
              ))}
              <SmallButton onClick={() => setServiceCharges(prev => [...prev, defaultServiceCharge(prev.length)])}>Add service charge</SmallButton>
            </div>

            <div className="space-y-4 border-t border-white/10 pt-6">
              <div>
                <p className="label-mono">Large-Party Auto Gratuity</p>
                <p className="mt-2 text-sm text-dash-secondary">Restaurant-wide default the POS applies by party size. When multiple tiers apply, the POS uses the largest matching minimum. Section service-charge profiles override these rules for their tables.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <label className="flex items-center gap-3 text-sm text-dash-primary">
                  <input type="checkbox" checked={autoGratuity.enabled} onChange={event => setAutoGratuity(prev => ({ ...prev, enabled: event.target.checked }))} className="h-4 w-4 accent-dash-gold" />
                  Automatically apply gratuity to large parties
                </label>
                {autoGratuity.enabled && <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                  <div className="space-y-3">
                    {(autoGratuity.rules || [{ party_threshold: autoGratuity.party_threshold || '6', percent: autoGratuity.percent || '18' }]).map((rule, index) => (
                      <div key={`auto-grat-rule:${index}`} className="grid gap-3 rounded-xl border border-white/10 bg-black/10 p-3 md:grid-cols-[1fr_1fr_auto]">
                        <Field label="Minimum party size"><TextInput inputMode="numeric" value={rule.party_threshold} onChange={event => updateAutoGratuityRule(index, { party_threshold: event.target.value.replace(/\D/g, '') })} placeholder="6" /></Field>
                        <Field label="Gratuity rate %"><TextInput inputMode="decimal" value={rule.percent} onChange={event => updateAutoGratuityRule(index, { percent: sanitizeNumber(event.target.value) })} placeholder="18" /></Field>
                        <div className="flex items-end">
                          <SmallButton variant="danger" disabled={(autoGratuity.rules || []).length <= 1} onClick={() => removeAutoGratuityRule(index)}>Remove</SmallButton>
                        </div>
                      </div>
                    ))}
                    <SmallButton onClick={addAutoGratuityRule}>Add tier</SmallButton>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Receipt label"><TextInput value={autoGratuity.label} maxLength={40} onChange={event => setAutoGratuity(prev => ({ ...prev, label: event.target.value }))} placeholder="Gratuity" /></Field>
                    <Field label="Who receives it"><SelectInput value={autoGratuity.assigned_to_employee ? 'employee' : 'restaurant'} onChange={event => setAutoGratuity(prev => ({ ...prev, assigned_to_employee: event.target.value === 'employee' }))}><option value="employee">Employee — tip earnings</option><option value="restaurant">Restaurant — service-charge revenue</option></SelectInput></Field>
                    <p className="text-xs text-dash-tertiary md:col-span-2">Employee-owned gratuity is shown separately from voluntary tips and is included exactly once in the employee settlement. Restaurant-owned charges never increase employee tip earnings.</p>
                  </div>
                </div>}
              </div>
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'discounts' && (
        <SectionShell
          title="Discounts, Comps & Promos"
          description="Preset POS rules for item discounts, whole-check discounts, comps, employee meals, promos, and service recovery."
          actions={publishControls('Save discounts', saveDiscountRules, 'discounts')}
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
                    placeholder={rule.value_type === 'open' ? 'Staff enters the amount' : rule.value_type === 'fixed' ? 'Default $' : 'Default %'}
                  />
                  <SelectInput value={rule.tax_behavior} onChange={event => updateDiscountRule(index, { tax_behavior: event.target.value })}>
                    {DISCOUNT_TAX_BEHAVIOR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectInput>
                </div>

                <div className="mt-3 rounded-xl border border-dash-gold/20 bg-dash-gold/[0.06] p-3">
                  <p className="label-mono mb-2">Suggested-tip calculation</p>
                  <SelectInput value={rule.suggested_tip_basis} onChange={event => updateDiscountRule(index, { suggested_tip_basis: event.target.value })}>
                    <option value="before_discount">Before discount — ignore this reduction</option>
                    <option value="after_discount">After discount — reduce the tip basis</option>
                  </SelectInput>
                  <p className="mt-2 text-xs text-dash-tertiary">This choice is snapshotted when the discount, comp, employee meal, or recovery is applied.</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <SmallButton variant={rule.editable_by_employee ? 'primary' : 'secondary'} onClick={() => updateDiscountRule(index, { editable_by_employee: !rule.editable_by_employee })}>Editable by employee</SmallButton>
                  <SmallButton variant={rule.requires_manager_approval ? 'primary' : 'secondary'} onClick={() => updateDiscountRule(index, { requires_manager_approval: !rule.requires_manager_approval })}>Manager approval</SmallButton>
                  <SmallButton variant={rule.reason_required ? 'primary' : 'secondary'} onClick={() => updateDiscountRule(index, { reason_required: !rule.reason_required })}>Reason required</SmallButton>
                  <SmallButton variant="danger" onClick={() => setDiscountRules(prev => prev.filter((_, currentIndex) => currentIndex !== index))}>Remove</SmallButton>
                </div>

                {discountRuleNeedsBounds(rule) && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <TextInput inputMode="decimal" value={rule.min_value} onChange={event => updateDiscountRule(index, { min_value: sanitizeNumber(event.target.value) })} placeholder={rule.value_type === 'fixed' ? 'Minimum $' : 'Minimum %'} />
                    <TextInput inputMode="decimal" value={rule.max_value} onChange={event => updateDiscountRule(index, { max_value: sanitizeNumber(event.target.value) })} placeholder={`${rule.value_type === 'fixed' ? 'Maximum $' : 'Maximum %'}${rule.value_type === 'open' ? ' (required)' : ''}`} />
                  </div>
                )}

                {discountRuleWarning(rule) && (
                  <p className="mt-3 text-xs font-semibold text-amber-300">{discountRuleWarning(rule)}</p>
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
                { ...defaultDiscountRule(discountRules.length), name: 'Custom Amount', discount_type: 'discount', applies_to: 'both', value_type: 'open', default_value: '', editable_by_employee: true, max_value: '50', requires_manager_approval: true, reason_required: true },
                { ...defaultDiscountRule(discountRules.length), name: 'Item Comp', discount_type: 'comp', applies_to: 'item', value_type: 'percent', default_value: '100', requires_manager_approval: true, reason_required: true },
                { ...defaultDiscountRule(discountRules.length), name: 'Employee Meal', discount_type: 'employee_meal', applies_to: 'item', value_type: 'percent', default_value: '50' },
                { ...defaultDiscountRule(discountRules.length), name: 'Service Recovery', discount_type: 'service_recovery', applies_to: 'check', value_type: 'fixed', default_value: '20', reason_required: true },
              ].filter(template => !discountRules.some(rule => rule.name.toLowerCase() === template.name.toLowerCase())).map(template => (
                <SmallButton key={template.name} onClick={() => setDiscountRules(prev => [...prev, template])}>{template.name}</SmallButton>
              ))}
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'manager_controls' && (
        <SectionShell
          title="Manager Controls"
          description="Role permissions for manager-level POS actions. Employee roles are assigned in the Employees tab; this controls what each role can do during service."
          actions={publishControls('Save controls', saveManagerControls, 'manager_controls')}
        >
          <div className="space-y-4">
            {rolePermissions.map((role, index) => (
              <div key={role.role_key} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold capitalize">{role.role_key.replace('_', ' ')}</p>
                    <p className="text-sm text-dash-tertiary">Permissions and approval thresholds</p>
                  </div>
                  <SmallButton
                    variant={role.require_manager_pin_for_approval ? 'primary' : 'secondary'}
                    onClick={() => updateRolePermission(index, { require_manager_pin_for_approval: !role.require_manager_pin_for_approval })}
                  >
                    Approval PIN
                  </SmallButton>
                </div>
                <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
                  {MANAGER_PERMISSION_OPTIONS.map(permission => (
                    <SmallButton
                      key={permission.key}
                      variant={role[permission.key] ? 'primary' : 'secondary'}
                      onClick={() => updateRolePermission(index, { [permission.key]: !role[permission.key] })}
                    >
                      {permission.label}
                    </SmallButton>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-dash-tertiary">
                  {cashDrawerRoleSummary(role, closeoutSettings).map(item => (
                    <span key={item.key} className="rounded-full border border-white/10 px-2 py-0.5">
                      {item.label}: {item.value}
                    </span>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <TextInput value={role.refund_limit} inputMode="decimal" onChange={event => updateRolePermission(index, { refund_limit: sanitizeNumber(event.target.value) })} placeholder="Refund limit, blank for unlimited" />
                  <TextInput value={role.discount_limit_percent} inputMode="decimal" onChange={event => updateRolePermission(index, { discount_limit_percent: sanitizeNumber(event.target.value) })} placeholder="Discount % limit, blank for unlimited" />
                </div>
              </div>
            ))}
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'closeout' && (
        <SectionShell
          title="Cash & Closeout"
          description="Cash drawer handling, server checkout requirements, and end-of-day close rules."
          actions={publishControls('Save closeout', saveCloseoutSettings, 'closeout')}
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <p className="label-mono mb-3">Cash Management</p>
              <div className="grid gap-3 lg:grid-cols-3">
                <SelectInput value={closeoutSettings.cash_tracking_mode} onChange={event => updateCloseoutSettings({ cash_tracking_mode: event.target.value })}>
                  {CASH_TRACKING_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectInput>
                <TextInput value={closeoutSettings.cash_drop_threshold} inputMode="decimal" onChange={event => updateCloseoutSettings({ cash_drop_threshold: sanitizeNumber(event.target.value) })} placeholder="Cash drop threshold" />
                <TextInput value={closeoutSettings.cash_variance_threshold} inputMode="decimal" onChange={event => updateCloseoutSettings({ cash_variance_threshold: sanitizeNumber(event.target.value) })} placeholder="Variance approval threshold" />
                <SelectInput value={closeoutSettings.opening_bank_source} onChange={event => updateCloseoutSettings({ opening_bank_source: event.target.value, require_starting_bank: false })}>
                  <option value="none">Opening bank: $0 automatically</option>
                  <option value="fixed">Opening bank: fixed amount</option>
                  <option value="previous_retained">Starting cash: use cash left at last Close Day (recommended)</option>
                </SelectInput>
                {closeoutSettings.opening_bank_source !== 'none' && (
                  <TextInput
                    value={closeoutSettings.opening_bank_default}
                    inputMode="decimal"
                    onChange={event => updateCloseoutSettings({ opening_bank_default: sanitizeNumber(event.target.value) })}
                    placeholder={closeoutSettings.opening_bank_source === 'fixed' ? 'Fixed opening bank' : 'Fallback if no prior close exists'}
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ['track_deposit_at_close', 'Require deposit amount'],
                  ['blind_drawer_close', 'Blind close'],
                  ['allow_paid_in_out', 'Paid in/out'],
                ].map(([field, label]) => (
                  <SmallButton key={field} variant={closeoutSettings[field] ? 'primary' : 'secondary'} onClick={() => updateCloseoutSettings({ [field]: !closeoutSettings[field] })}>{label}</SmallButton>
                ))}
                <SmallButton
                  variant={!closeoutSettings.require_manager_for_drawer_open ? 'primary' : 'secondary'}
                  onClick={() => updateCloseoutSettings({ require_manager_for_drawer_open: !closeoutSettings.require_manager_for_drawer_open })}
                >
                  Assigned staff can use No Sale
                </SmallButton>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <p className="label-mono mb-3">Server Checkout</p>
              <SelectInput value={closeoutSettings.server_checkout_report_delivery} onChange={event => updateCloseoutSettings({ server_checkout_report_delivery: event.target.value })}>
                {CHECKOUT_REPORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </SelectInput>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ['server_require_all_checks_closed', 'Checks closed'],
                  ['server_require_tabs_closed', 'Tabs closed'],
                  ['server_require_credit_tips_reviewed', 'Credit tips reviewed'],
                  ['deduct_credit_card_tips_from_cash_due', 'Deduct card tips from cash due'],
                  ['server_require_tipout_entry', 'Tipout entry'],
                  ['server_require_manager_approval', 'Manager approval'],
                  ['allow_clockout_before_checkout', 'Clockout before checkout'],
                ].map(([field, label]) => (
                  <SmallButton key={field} variant={closeoutSettings[field] ? 'primary' : 'secondary'} onClick={() => updateCloseoutSettings({ [field]: !closeoutSettings[field] })}>{label}</SmallButton>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <p className="label-mono mb-3">End of Day</p>
              <div className="grid gap-3 lg:grid-cols-2">
                <SelectInput value={closeoutSettings.eod_batch_close_mode} onChange={event => updateCloseoutSettings({ eod_batch_close_mode: event.target.value })}>
                  {EOD_BATCH_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectInput>
                <TextInput value={closeoutSettings.eod_report_recipients.join(', ')} onChange={event => updateCloseoutSettings({ eod_report_recipients: event.target.value.split(',').map(email => email.trim()).filter(Boolean) })} placeholder="Report emails, comma-separated" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <SmallButton variant={closeoutSettings.eod_email_on_close ? 'primary' : 'secondary'} onClick={() => updateCloseoutSettings({ eod_email_on_close: !closeoutSettings.eod_email_on_close })}>Email report on close</SmallButton>
                <SmallButton variant={closeoutSettings.eod_email_formats.includes('pdf') ? 'primary' : 'secondary'} onClick={() => updateCloseoutSettings({ eod_email_formats: toggleDiscountArrayValue(closeoutSettings.eod_email_formats, 'pdf') })}>PDF</SmallButton>
                <SmallButton variant={closeoutSettings.eod_email_formats.includes('xlsx') ? 'primary' : 'secondary'} onClick={() => updateCloseoutSettings({ eod_email_formats: toggleDiscountArrayValue(closeoutSettings.eod_email_formats, 'xlsx') })}>Excel</SmallButton>
                {[
                  ['eod_require_drawers_closed', 'Drawers closed'],
                  ['eod_require_servers_checked_out', 'Servers checked out'],
                  ['eod_require_open_checks_resolved', 'Open checks resolved'],
                  ['eod_require_paid_outs_reviewed', 'Paid outs reviewed'],
                  ['eod_require_tip_adjustments_reviewed', 'Tip edits reviewed'],
                ].map(([field, label]) => (
                  <SmallButton key={field} variant={closeoutSettings[field] ? 'primary' : 'secondary'} onClick={() => updateCloseoutSettings({ [field]: !closeoutSettings[field] })}>{label}</SmallButton>
                ))}
              </div>
              <div className="mt-4">
                <p className="label-mono mb-2">Reports</p>
                <div className="flex flex-wrap gap-2">
                  {EOD_REPORT_OPTIONS.map(report => (
                    <SmallButton
                      key={report.value}
                      variant={closeoutSettings.eod_reports.includes(report.value) ? 'primary' : 'secondary'}
                      onClick={() => updateCloseoutSettings({ eod_reports: toggleDiscountArrayValue(closeoutSettings.eod_reports, report.value) })}
                    >
                      {report.label}
                    </SmallButton>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'check_workflow' && (
        <SectionShell
          title="Check Workflow"
          description="Seat numbers, order fire and hold rules, split-by-seat/item, bar tabs, preauthorization, and reopen approval."
          actions={publishControls('Save workflow', saveCheckWorkflowSettings, 'check_workflow')}
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <p className="label-mono mb-3">Seats & Firing</p>
              <div className="grid gap-3 lg:grid-cols-3">
                <Field label="Default Fire Mode">
                  <SelectInput value={checkWorkflowSettings.default_order_fire_mode} onChange={event => updateCheckWorkflowSettings({ default_order_fire_mode: event.target.value })}>
                    {ORDER_FIRE_MODE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Default Hold Minutes">
                  <TextInput value={checkWorkflowSettings.default_hold_minutes} inputMode="numeric" onChange={event => updateCheckWorkflowSettings({ default_hold_minutes: event.target.value.replace(/[^\d]/g, '').slice(0, 3) || '1' })} placeholder="10" />
                </Field>
                <Field label="Hold Presets">
                  <TextInput
                    value={(checkWorkflowSettings.hold_preset_minutes || []).join(', ')}
                    inputMode="text"
                    onChange={event => updateCheckWorkflowSettings({
                      hold_preset_minutes: event.target.value
                        .split(',')
                        .map(part => Number(part.replace(/[^\d]/g, '')))
                        .filter(minutes => Number.isFinite(minutes) && minutes > 0)
                        .slice(0, 8),
                    })}
                    placeholder="5, 10, 15"
                  />
                </Field>
                <Field label="Sent-item correction window (minutes)">
                  <TextInput value={checkWorkflowSettings.sent_item_correction_window_minutes} inputMode="numeric" onChange={event => updateCheckWorkflowSettings({ sent_item_correction_window_minutes: String(Math.max(0, Math.min(15, Number(event.target.value.replace(/[^\d]/g, '') || 0)))) })} placeholder="4" />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ['seat_numbers_enabled', 'Seat numbers'],
                  ['seat_number_required', 'Seats required'],
                  ['course_required', 'Course required'],
                  ['allow_hold_and_fire', 'Hold & fire'],
                  ['allow_manual_hold', 'Manual hold'],
                  ['allow_item_seat_move', 'Move item seat'],
                  ['allow_multi_item_seat_move', 'Multi-move items'],
                  ['require_manager_for_item_move_after_send', 'Manager after sent'],
                  ['split_by_seat_enabled', 'Split by seat'],
                  ['split_by_item_enabled', 'Split by item'],
                  ['to_go_enabled', 'TO GO button'],
                ].map(([field, label]) => (
                  <SmallButton key={field} variant={checkWorkflowSettings[field] ? 'primary' : 'secondary'} onClick={() => updateCheckWorkflowSettings({ [field]: !checkWorkflowSettings[field] })}>{label}</SmallButton>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <p className="label-mono mb-1">Tabs & Preauthorization</p>
              <p className="mb-3 text-xs text-dash-secondary">The card is tapped once when the tab opens; the hold rises automatically as the tab grows and is captured with tip at close. Blank = $25 default.</p>
              <div className="grid gap-3 lg:grid-cols-3">
                <Field label="Default Preauth Amount">
                  <TextInput value={checkWorkflowSettings.default_preauth_amount} inputMode="decimal" onChange={event => updateCheckWorkflowSettings({ default_preauth_amount: sanitizeNumber(event.target.value) })} placeholder="Optional" />
                </Field>
                <Field label="Tab Name">
                  <SelectInput value={checkWorkflowSettings.tab_name_required ? 'required' : 'optional'} onChange={event => updateCheckWorkflowSettings({ tab_name_required: event.target.value === 'required' })}>
                    <option value="required">Required</option>
                    <option value="optional">Optional</option>
                  </SelectInput>
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ['allow_bar_tabs', 'Bar tabs'],
                  ['card_preauth_required', 'Card preauth'],
                  ['require_manager_for_reopen', 'Manager reopen approval'],
                ].map(([field, label]) => (
                  <SmallButton key={field} variant={checkWorkflowSettings[field] ? 'primary' : 'secondary'} onClick={() => updateCheckWorkflowSettings({ [field]: !checkWorkflowSettings[field] })}>{label}</SmallButton>
                ))}
              </div>
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'tips_payroll' && (
        <SectionShell
          title="Tips & Payroll"
          description="Tip ownership, pooling, tipout rules, cash declarations, credit tip payout, and payroll export defaults."
          actions={publishControls('Save tips & payroll', saveTipPayrollSettings, 'tips_payroll')}
        >
          <TipPayrollSettingsFields
            settings={tipPayrollSettings}
            jobCodes={jobCodes}
            onUpdateSettings={updateTipPayrollSettings}
            onUpdateRoleRule={updateTipRoleRule}
          />
        </SectionShell>
      )}

      {activeSetupTab === 'sections' && (
        <SectionShell
          title="Sections"
          description="Sections are areas in your restaurant, such as Bar, Patio, Outdoor, or Main Dining. Tables in the floor plan are assigned to one of these categories, and unassigned tables default to Table."
          actions={publishControls('Save sections', saveSections, 'sections')}
        >
          {setupWarnings.sections?.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              Missing: {setupWarnings.sections.join(', ')}
            </div>
          )}
          <div className="space-y-4">
            {normalizeSectionNames(sections).map((section, index) => {
              const profile = normalizeSectionProfiles(sectionProfiles, sections).find(item => item.name.toLowerCase() === section.toLowerCase()) || defaultSectionProfile(section)
              const patchProfile = (patch) => setSectionProfiles(prev => [
                ...prev.filter(item => String(item.name).toLowerCase() !== section.toLowerCase()),
                { ...profile, ...patch, name: section },
              ])
              return (
              <div key={profile.id || `${index}:${section}`} className="space-y-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <TextInput value={section} disabled={index === 0} placeholder="Bar, Patio, Hibachi..." onChange={event => {
                    const next = normalizeSectionNames(sections)
                    const oldName = next[index]
                    next[index] = index === 0 ? 'Table' : event.target.value
                    setSections(next)
                    setSectionProfiles(prev => prev.map(item => String(item.name).toLowerCase() === oldName.toLowerCase() ? { ...item, name: next[index] } : item))
                  }} />
                  <SmallButton variant={index === 0 ? 'secondary' : 'danger'} disabled={index === 0} onClick={() => {
                    setSections(prev => normalizeSectionNames(prev).filter((_, currentIndex) => currentIndex !== index))
                    setSectionProfiles(prev => prev.filter(item => String(item.name).toLowerCase() !== section.toLowerCase()))
                  }}>Remove</SmallButton>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Section behavior">
                    <SelectInput value={profile.service_mode} onChange={event => patchProfile({ service_mode: event.target.value })}>
                      <option value="standard">Standard dining</option><option value="hibachi">Hibachi</option><option value="bar">Bar</option><option value="patio">Patio</option><option value="counter">Counter service</option><option value="custom">Custom</option>
                    </SelectInput>
                  </Field>
                  <label className="flex items-center gap-3 self-end rounded-xl border border-white/10 px-4 py-3 text-sm text-dash-primary">
                    <input type="checkbox" checked={Boolean(profile.auto_gratuity_enabled)} onChange={event => patchProfile({ auto_gratuity_enabled: event.target.checked })} className="h-4 w-4 accent-dash-gold" />
                    Automatically apply service charge
                  </label>
                </div>
                {profile.auto_gratuity_enabled && <div className="grid gap-3 border-t border-white/10 pt-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="Charge amount"><div className="grid grid-cols-[1fr_7rem] gap-2"><TextInput inputMode="decimal" value={profile.auto_gratuity_value} onChange={event => patchProfile({ auto_gratuity_value: sanitizeNumber(event.target.value) })} /><SelectInput value={profile.auto_gratuity_type} onChange={event => patchProfile({ auto_gratuity_type: event.target.value })}><option value="percentage">Percent</option><option value="fixed">Fixed</option></SelectInput></div></Field>
                  <Field label="Receipt label"><TextInput value={profile.auto_gratuity_label} onChange={event => patchProfile({ auto_gratuity_label: event.target.value })} /></Field>
                  <Field label="Minimum party size"><TextInput inputMode="numeric" placeholder="Any party size" value={profile.minimum_party_size} onChange={event => patchProfile({ minimum_party_size: event.target.value.replace(/\D/g, '') })} /></Field>
                  <Field label="Tip prompt"><SelectInput value={profile.tip_prompt_mode} onChange={event => patchProfile({ tip_prompt_mode: event.target.value })}><option value="additional">Offer additional tip</option><option value="normal">Standard tip prompt</option><option value="disabled">No tip prompt</option></SelectInput></Field>
                  <Field label="Who receives it"><SelectInput value={profile.assigned_to_employee ? 'employee' : 'restaurant'} onChange={event => patchProfile({ assigned_to_employee: event.target.value === 'employee' })}><option value="employee">Employee — tip earnings</option><option value="restaurant">Restaurant — service-charge revenue</option></SelectInput></Field>
                  <label className="flex items-center gap-3 self-end px-1 py-3 text-sm text-dash-primary"><input type="checkbox" checked={Boolean(profile.auto_gratuity_taxable)} onChange={event => patchProfile({ auto_gratuity_taxable: event.target.checked })} className="h-4 w-4 accent-dash-gold" />Charge is taxable</label>
                  <p className="text-xs text-dash-tertiary md:col-span-2 lg:col-span-3">Employee-owned gratuity remains separate from voluntary tips and is included once in the employee settlement.</p>
                </div>}
              </div>
              )
            })}
            <div className="flex flex-wrap gap-2 pt-2">
              <SmallButton onClick={() => setSections(prev => {
                const current = normalizeSectionNames(prev)
                const name = `New Section ${current.length}`
                setSectionProfiles(profiles => [...profiles, defaultSectionProfile(name)])
                return [...current, name]
              })}>Add section</SmallButton>
              {['Main Dining', 'Bar', 'Patio', 'Outdoor'].filter(name => !normalizeSectionNames(sections).some(section => section.toLowerCase() === name.toLowerCase())).map(name => (
                <SmallButton key={name} onClick={() => { setSections(prev => [...normalizeSectionNames(prev), name]); setSectionProfiles(prev => [...prev, defaultSectionProfile(name)]) }}>{name}</SmallButton>
              ))}
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'hours' && (
        <SectionShell
          title="Hours"
          description="Actual operating hours, matching the original onboarding hours editor."
          actions={publishControls('Save hours', saveHours, 'hours')}
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
                  <SmartTimeInput ariaLabel="Restaurant opens" value={referenceHours.open_time} onChange={value => updateDayHours(1, 'open_time', value)} />
                </Field>
                <span className="pb-3 text-sm text-dash-tertiary">to</span>
                <Field label="Closes">
                  <SmartTimeInput ariaLabel="Restaurant closes" value={referenceHours.close_time} onChange={value => updateDayHours(1, 'close_time', value)} />
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
                        <SmartTimeInput ariaLabel={`${day} opens`} value={dayHours.open_time} onChange={value => updateDayHours(index, 'open_time', value)} />
                        <SmartTimeInput ariaLabel={`${day} closes`} value={dayHours.close_time} onChange={value => updateDayHours(index, 'close_time', value)} />
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </SectionShell>
      )}

      {activeSetupTab === 'reservation_timing' && (
        <SectionShell
          title="Reservation Timing"
          description="Booking windows, party limits, turn time, and whether online and staff-created reservations share the same timing."
          actions={
            <div className="flex flex-wrap gap-2">
              <SmallButton onClick={() => discardSetupChanges('reservation_timing')} disabled={isSaving}>Cancel</SmallButton>
              <SmallButton variant="primary" onClick={() => void saveReservationTiming()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save reservations'}
              </SmallButton>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <p className="label-mono mb-3">Public Booking Page</p>
              <div className="grid gap-3 md:grid-cols-[1fr,1.4fr]">
                <Field label="Booking slug">
                  <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
                    <span className="shrink-0 border-r border-white/10 px-4 py-3 text-sm text-dash-tertiary">/book/</span>
                    <input
                      value={reservationPublicSlug || normalizePublicSlugDraft(profile.name)}
                      onChange={event => setReservationPublicSlug(normalizePublicSlugDraft(event.target.value))}
                      className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary"
                      placeholder="restaurant-name"
                    />
                  </div>
                </Field>
                <Field label="Guest link">
                  <a
                    href={reservationPublicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-dash-secondary hover:text-dash-cream"
                  >
                    {reservationPublicUrl}
                  </a>
                </Field>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-dash-cream">Reservation channel timing</p>
                  <p className="mt-1 text-sm leading-6 text-dash-secondary">
                    Use one timing policy for online booking and host-created reservations, or split them when staff need more flexibility.
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <SmallButton variant={reservationTiming.reservation_timing_same_for_channels ? 'primary' : 'secondary'} onClick={() => updateReservationTiming({ reservation_timing_same_for_channels: true })}>Same</SmallButton>
                  <SmallButton variant={!reservationTiming.reservation_timing_same_for_channels ? 'primary' : 'secondary'} onClick={() => updateReservationTiming({ reservation_timing_same_for_channels: false })}>Different</SmallButton>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <p className="label-mono mb-3">Slots & Parties</p>
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Slot spacing">
                  <TextInput inputMode="numeric" value={reservationTiming.reservation_slot_interval_minutes} onChange={event => updateReservationTiming({ reservation_slot_interval_minutes: event.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="15" />
                </Field>
                <Field label="Min party">
                  <TextInput inputMode="numeric" value={reservationTiming.reservation_min_party_size} onChange={event => updateReservationTiming({ reservation_min_party_size: event.target.value.replace(/\D/g, '').slice(0, 2) })} placeholder="1" />
                </Field>
                <Field label="Max party">
                  <TextInput inputMode="numeric" value={reservationTiming.reservation_max_party_size} onChange={event => updateReservationTiming({ reservation_max_party_size: event.target.value.replace(/\D/g, '').slice(0, 2) })} placeholder="10" />
                </Field>
                <Field label="Turn time">
                  <TextInput inputMode="numeric" value={reservationTiming.reservation_default_duration_minutes} onChange={event => updateReservationTiming({ reservation_default_duration_minutes: event.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="90" />
                </Field>
              </div>
              <button
                type="button"
                onClick={() => updateReservationTiming({ reservation_windows_follow_operating_hours: !reservationTiming.reservation_windows_follow_operating_hours })}
                className={[
                  'mt-4 w-full rounded-xl border p-4 text-left text-sm transition',
                  reservationTiming.reservation_windows_follow_operating_hours
                    ? 'border-dash-gold/60 bg-dash-gold/10 text-dash-cream'
                    : 'border-white/10 text-dash-secondary hover:border-dash-gold/50',
                ].join(' ')}
              >
                <span className="font-semibold">Use operating hours as reservation windows</span>
                <span className="mt-1 block text-xs leading-5 text-dash-tertiary">
                  Closed days stay closed, and open/close times from the Hours tab become reservation service periods.
                </span>
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <p className="label-mono mb-3">Online Booking</p>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Book ahead days">
                  <TextInput inputMode="numeric" value={reservationTiming.reservation_online_booking_horizon_days} onChange={event => updateReservationTiming({ reservation_online_booking_horizon_days: event.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="30" />
                </Field>
                <Field label="Lead time minutes">
                  <TextInput inputMode="numeric" value={reservationTiming.reservation_online_lead_time_minutes} onChange={event => updateReservationTiming({ reservation_online_lead_time_minutes: event.target.value.replace(/\D/g, '').slice(0, 5) })} placeholder="120" />
                </Field>
                <Field label="No-show grace minutes">
                  <TextInput inputMode="numeric" value={reservationTiming.reservation_online_grace_period_minutes} onChange={event => updateReservationTiming({ reservation_online_grace_period_minutes: event.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="15" />
                </Field>
              </div>
            </div>

            {!reservationTiming.reservation_timing_same_for_channels && (
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="label-mono mb-3">Staff, Phone & Walk-in</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Book ahead days">
                    <TextInput inputMode="numeric" value={reservationTiming.reservation_staff_booking_horizon_days} onChange={event => updateReservationTiming({ reservation_staff_booking_horizon_days: event.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="30" />
                  </Field>
                  <Field label="Lead time minutes">
                    <TextInput inputMode="numeric" value={reservationTiming.reservation_staff_lead_time_minutes} onChange={event => updateReservationTiming({ reservation_staff_lead_time_minutes: event.target.value.replace(/\D/g, '').slice(0, 5) })} placeholder="120" />
                  </Field>
                  <Field label="No-show grace minutes">
                    <TextInput inputMode="numeric" value={reservationTiming.reservation_staff_grace_period_minutes} onChange={event => updateReservationTiming({ reservation_staff_grace_period_minutes: event.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="15" />
                  </Field>
                </div>
              </div>
            )}
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'capacity' && (
        <SectionShell
          title="Capacity / Floor Plan"
          description="Seating capacity plus the visual table editor from onboarding. Use this to add, move, resize, and edit table seats."
          actions={publishControls('Save capacity', (publication) => saveCapacity({}, publication), 'capacity')}
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
                  Use the visual editor to create table records, place them on the floor map, and assign each table to a section.
                </SetupEmptyState>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <OptionCard title="Upload Image" description="Upload a floor plan image and let AI detect tables." onClick={() => setFloorPlanMode('upload')} />
                <OptionCard title="Draw Manually" description="Open the visual editor to place tables, assign sections, and set seats." onClick={() => setFloorPlanMode('manual')} />
              </div>
              {floorTables.length > 0 && (
                <FloorPlanTableSetup
                  restaurantId={restaurantId}
                  tables={floorTables}
                  onTablesChange={(tables) => {
                    setFloorTables(tables)
                    setProfile(prev => ({ ...prev, table_count: tables.length }))
                  }}
                  onSaved={(tables) => {
                    setFloorTables(tables)
                    setProfile(prev => ({ ...prev, table_count: tables.length }))
                    void queryClient.invalidateQueries({ queryKey: queryKeys.floorPlan(restaurantId) })
                    void queryClient.invalidateQueries({ queryKey: queryKeys.tables(restaurantId) })
                    onSetupChanged?.()
                  }}
                />
              )}
            </div>
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'menu' && (
        <SectionShell
          title="Menu"
          description="Menu items, categories, modifiers & questions, specials, and pricing all live in the Menu workspace — the single place that edits them, so setup can never overwrite menu configuration."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link to="../menu" relative="path" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.055]">
              <h3 className="text-sm font-semibold text-dash-cream">Items &amp; categories</h3>
              <p className="mt-2 text-sm leading-5 text-dash-tertiary">Add, edit, 86, photograph, and organize everything guests can order.</p>
            </Link>
            <Link to="../menu" relative="path" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.055]">
              <h3 className="text-sm font-semibold text-dash-cream">Modifiers &amp; questions</h3>
              <p className="mt-2 text-sm leading-5 text-dash-tertiary">Choices the POS asks — sides, temperatures, add-ons, follow-ups.</p>
            </Link>
            <Link to="../menu" relative="path" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.055]">
              <h3 className="text-sm font-semibold text-dash-cream">Specials &amp; pricing</h3>
              <p className="mt-2 text-sm leading-5 text-dash-tertiary">Daily specials, scheduled price rules, and bulk price changes.</p>
            </Link>
          </div>
          <div className="mt-4">
            <Link
              to="../menu"
              relative="path"
              className="inline-flex items-center justify-center rounded-xl bg-dash-gold px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Open Menu workspace →
            </Link>
          </div>
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
          <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 lg:grid-cols-[1fr_1fr_140px_110px_110px_120px_130px_auto]">
            <TextInput placeholder="Name" value={staffForm.name} onChange={event => setStaffForm(prev => ({ ...prev, name: event.target.value, employee_login_id: prev.employee_login_id || defaultEmployeeId(event.target.value) }))} />
            <TextInput placeholder="Email optional" value={staffForm.email} onChange={event => setStaffForm(prev => ({ ...prev, email: event.target.value }))} />
            <SelectInput value={staffForm.role} onChange={event => setStaffForm(prev => ({ ...prev, role: event.target.value }))}>
              <option value="">Choose role</option>
              {normalizeStaffRoleOptions(jobCodes).map(role => <option key={role.id || role.code} value={roleCodeFromJobCode(role)}>{staffRoleLabel(role)}</option>)}
            </SelectInput>
            <TextInput placeholder="Hrs/week" value={staffForm.suggested_weekly_hours} onChange={event => setStaffForm(prev => ({ ...prev, suggested_weekly_hours: event.target.value.replace(/[^\d.]/g, '').slice(0, 5) }))} />
            <TextInput placeholder="$/hr" value={staffForm.hourly_rate} onChange={event => setStaffForm(prev => ({ ...prev, hourly_rate: event.target.value.replace(/[^\d.]/g, '').slice(0, 8) }))} />
            <TextInput placeholder="PIN" value={staffForm.pin} onChange={event => setStaffForm(prev => ({ ...prev, pin: event.target.value.replace(/\D/g, '').slice(0, 8) }))} />
            <TextInput placeholder="ID" value={staffForm.employee_login_id} onChange={event => setStaffForm(prev => ({ ...prev, employee_login_id: event.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '') }))} />
            <SmallButton variant="primary" onClick={() => void addStaff()}>Add</SmallButton>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="label-mono">Role Editor</p>
                <h3 className="text-lg font-semibold">Roles, wages, and tipped status</h3>
              </div>
              <p className="text-sm text-dash-tertiary">Clocked labor uses these role rates unless an employee override exists.</p>
            </div>
            {jobCodes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-dash-secondary">Role rates are not available yet.</p>
            ) : (
              <div className="grid gap-3">
                {normalizeStaffRoleOptions(jobCodes.filter(code => code.is_active !== false)).map(code => (
                  <div key={code.id} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 lg:grid-cols-[1fr_110px_130px_auto_auto_auto_auto]">
                    <TextInput
                      value={code.label || code.code}
                      onChange={event => setJobCodes(prev => prev.map(item => item.id === code.id ? { ...item, label: event.target.value } : item))}
                      placeholder="Role name"
                    />
                    <TextInput
                      value={code.default_hourly_rate ?? rateEdits[code.id] ?? ''}
                      onChange={event => setJobCodes(prev => prev.map(item => item.id === code.id ? { ...item, default_hourly_rate: event.target.value.replace(/[^\d.]/g, '').slice(0, 8) } : item))}
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                    <SelectInput value={code.permission_tier || 'normal'} onChange={event => setJobCodes(prev => prev.map(item => item.id === code.id ? { ...item, permission_tier: event.target.value } : item))}>
                      {PERMISSION_TIER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </SelectInput>
                    <SmallButton variant={code.is_tipped ? 'primary' : 'secondary'} onClick={() => setJobCodes(prev => prev.map(item => item.id === code.id ? { ...item, is_tipped: !item.is_tipped } : item))}>
                      {code.is_tipped ? 'Tipped' : 'Hourly'}
                    </SmallButton>
                    <SmallButton onClick={() => discardJobCodeChanges(code.id)} disabled={Boolean(savingRateId)}>Cancel</SmallButton>
                    <PublishControls
                      label="Save role"
                      busy={savingRateId === code.id}
                      disabled={Boolean(savingRateId)}
                      onPublishNow={() => saveJobCode(code)}
                      onSchedule={(scheduledFor, timezone) => saveJobCode(code, { scheduledFor, timezone })}
                    />
                    <SmallButton variant="danger" onClick={() => void removeJobCode(code)} disabled={Boolean(savingRateId)}>Remove</SmallButton>
                  </div>
                ))}
                <div className="grid gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3 lg:grid-cols-[1fr_110px_130px_auto_auto_auto]">
                  <TextInput value={jobCodeDraft.label} onChange={event => setJobCodeDraft(prev => ({ ...prev, label: event.target.value, code: slugRoleCode(event.target.value) }))} placeholder="New role" />
                  <TextInput value={jobCodeDraft.default_hourly_rate} onChange={event => setJobCodeDraft(prev => ({ ...prev, default_hourly_rate: event.target.value.replace(/[^\d.]/g, '').slice(0, 8) }))} placeholder="0.00" />
                  <SelectInput value={jobCodeDraft.permission_tier} onChange={event => setJobCodeDraft(prev => ({ ...prev, permission_tier: event.target.value }))}>
                    {PERMISSION_TIER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectInput>
                  <SmallButton variant={jobCodeDraft.is_tipped ? 'primary' : 'secondary'} onClick={() => setJobCodeDraft(prev => ({ ...prev, is_tipped: !prev.is_tipped }))}>
                    {jobCodeDraft.is_tipped ? 'Tipped' : 'Hourly'}
                  </SmallButton>
                  <SmallButton onClick={() => setJobCodeDraft(savedDraft('employees')?.jobCodeDraft || { code: '', label: '', permission_tier: 'normal', default_hourly_rate: '', is_tipped: false, tipout_role: '', sort_order: 100, is_active: true })} disabled={Boolean(savingRateId)}>Cancel</SmallButton>
                  <SmallButton variant="primary" onClick={() => void saveJobCode(jobCodeDraft)} disabled={!jobCodeDraft.label.trim() || Boolean(savingRateId)}>Add role</SmallButton>
                </div>
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
                <div key={waiter.id} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="grid gap-3 xl:grid-cols-[minmax(180px,0.9fr)_minmax(240px,1.1fr)_minmax(320px,1.3fr)]">
                    <Field label="Name">
                      <TextInput defaultValue={waiter.name || ''} onBlur={event => void updateStaff(waiter.id, { name: event.target.value })} />
                    </Field>
                    <Field label="Email">
                      <TextInput defaultValue={waiter.email || ''} placeholder="Email optional" onBlur={event => void updateStaff(waiter.id, { email: event.target.value || null })} />
                    </Field>
                    <Field label="Roles">
                      <StaffRoleAssignment
                        waiter={waiter}
                        jobCodes={jobCodes}
                        onChange={updates => void updateStaff(waiter.id, updates)}
                      />
                    </Field>
                  </div>
                  <div className="grid items-end gap-3 md:grid-cols-[120px_120px_minmax(150px,1fr)_minmax(150px,1fr)_auto_auto_auto]">
                    <Field label="Hrs/week">
                      <TextInput className="px-3 text-center" defaultValue={waiter.suggested_weekly_hours ?? ''} placeholder="0" onBlur={event => void updateStaff(waiter.id, { suggested_weekly_hours: event.target.value === '' ? null : Number(event.target.value) })} />
                    </Field>
                    <Field label="$/hr">
                      <TextInput className="px-3 text-center" defaultValue={waiter.hourly_rate ?? ''} placeholder="0.00" onBlur={event => void updateStaff(waiter.id, { hourly_rate: event.target.value === '' ? null : Number(event.target.value) })} />
                    </Field>
                    <Field label="Login ID">
                      <TextInput defaultValue={waiter.employee_login_id || defaultEmployeeId(waiter.name || '')} placeholder="Login ID" onBlur={event => void updateStaff(waiter.id, { employee_login_id: event.target.value || defaultEmployeeId(waiter.name || '') })} />
                    </Field>
                    <Field label="New PIN">
                      <TextInput
                        className="px-3 text-center font-mono tracking-[0.2em]"
                        placeholder="PIN"
                        value={pinEdits[waiter.id] || ''}
                        onChange={event => {
                          setPinSaved(prev => ({ ...prev, [waiter.id]: false }))
                          setPinEdits(prev => ({ ...prev, [waiter.id]: event.target.value.replace(/\D/g, '').slice(0, 8) }))
                        }}
                      />
                    </Field>
                    <SmallButton
                      variant={pinEdits[waiter.id] ? 'primary' : 'secondary'}
                      onClick={() => void saveEditedPin(waiter.id)}
                      disabled={!pinEdits[waiter.id] || pinSaving[waiter.id]}
                    >
                      {pinSaving[waiter.id] ? 'Saving...' : pinSaved[waiter.id] ? 'Saved' : 'Save PIN'}
                    </SmallButton>
                    <SmallButton onClick={() => { setPinEdits(prev => ({ ...prev, [waiter.id]: '' })); setPinSaved(prev => ({ ...prev, [waiter.id]: false })) }} disabled={!pinEdits[waiter.id] || pinSaving[waiter.id]}>Cancel</SmallButton>
                    <SmallButton variant="danger" onClick={() => void removeStaff(waiter.id)}>Remove</SmallButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionShell>
      )}

      {activeSetupTab === 'integrations' && (
        <SectionShell title="Integrations" description="Provider connections are managed from the Tools & Service Model and Reservations sections above.">
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-dash-secondary">
            Declared POS, scheduling, and reservation providers are saved as restaurant configuration. OAuth connection records remain provider-managed and are never replaced by this screen.
          </div>
        </SectionShell>
      )}
      {activeSetupTab === 'lifecycle' && (
        <StoreDangerZone restaurant={restaurant} restaurantId={restaurantId} auth={auth} />
      )}
      </>}
    </div>
  )
}

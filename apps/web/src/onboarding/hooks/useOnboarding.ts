import { useState, useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabase'
import { API_CONFIG } from '../../shared/api/config'
import { useAuth } from '../../auth'
import type { Restaurant } from '@shire/db'

export type RestaurantType =
  | 'fine_dining'
  | 'casual'
  | 'fast_casual'
  | 'bar'
  | 'cafe'
  | 'food_truck'

// ============================================
// TYPES
// ============================================

export interface OnboardingData {
  // Step 0: Basics
  name: string
  address: string
  city: string
  state: string
  postal_code: string
  country: string
  timezone: string
  type: RestaurantType | null
  cuisine_types: string[]
  phone: string

  // Step 1: Legal & Agreements
  legal_business_name: string
  dba_name: string
  ein: string
  legal_contact_name: string
  legal_contact_title: string
  legal_contact_email: string
  legal_contact_phone: string
  tos_signature_data_url: string | null
  tos_signed_at: string | null

  // Step 2: Payments & Processing
  bank_account_holder: string
  bank_name: string
  bank_routing_number: string
  bank_account_number: string
  payout_schedule: 'daily' | 'weekly' | 'manual'
  refund_funding_source: 'processor_balance' | 'bank_account'
  batch_close_mode: 'automatic' | 'manual'
  batch_close_time: string
  credit_card_tip_payout: 'nightly' | 'payroll'
  refund_approval_threshold: string

  // Step 3: Taxes & Charges
  tax_rates: TaxRateData[]
  service_charges: ServiceChargeData[]

  // Step 4: Discounts, Comps & Promos
  discount_rules: DiscountRuleData[]

  // Step 5: Goals & Priorities
  challenges: string[]
  daily_covers_range: string | null
  team_size_range: string | null
  primary_goal: string | null

  // Step 6: Current Tools & Service Model
  current_pos: string | null
  current_scheduling: string | null
  current_reservations: string | null
  service_modes: string[]
  default_guest_flow: string | null

  // Step 7: Sections & Areas
  sections: string[]

  // Step 8: Hours
  operating_hours: OperatingHoursData[]
  same_hours_every_day: boolean

  // Step 9: Capacity
  seating_capacity: number | null
  table_count: number | null

  // Step 10: Menu
  menu_import_method: 'skip' | 'manual' | 'upload' | 'toast' | 'scrape' | 'template'

  // Step 13: Team
  team_setup_method: 'skip' | 'invite' | 'sevenshifts'
  invites: TeamInvite[]
}

export interface TaxRateData {
  id?: string | null
  name: string
  rate: string
  applies_to: 'all' | 'food' | 'alcohol' | 'non_alcohol' | 'merchandise'
  is_default: boolean
  is_inclusive: boolean
  is_active?: boolean
}

export interface ServiceChargeData {
  id?: string | null
  name: string
  charge_type: 'percentage' | 'fixed'
  amount: string
  applies_to: 'all' | 'dine_in' | 'bar' | 'takeout' | 'delivery' | 'catering' | 'large_party'
  taxable: boolean
  auto_apply: boolean
  is_tip: boolean
  is_active?: boolean
}

export interface DiscountRuleData {
  id?: string | null
  name: string
  discount_type: 'discount' | 'comp' | 'promo' | 'employee_meal' | 'service_recovery'
  applies_to: 'item' | 'check' | 'both'
  value_type: 'percent' | 'fixed' | 'open'
  default_value: string
  editable_by_employee: boolean
  min_value: string
  max_value: string
  allowed_roles: string[]
  requires_manager_approval: boolean
  tax_behavior: 'reduce_taxable_amount' | 'apply_after_tax' | 'no_tax_impact'
  reason_required: boolean
  service_modes: string[]
  days_of_week: number[]
  is_active?: boolean
}

export interface OperatingHoursData {
  day_of_week: number
  open_time: string
  close_time: string
  is_closed: boolean
}

export interface TeamInvite {
  email: string
  role: 'manager' | 'server' | 'host' | 'kitchen'
}

export interface OnboardingValidationIssue {
  field: string
  message: string
}

interface OnboardingDraft {
  version: number
  currentStep: number
  restaurantId: string | null
  data: Partial<OnboardingData>
  updatedAt: string
}

const DEFAULT_HOURS: OperatingHoursData[] = [
  { day_of_week: 0, open_time: '11:00', close_time: '22:00', is_closed: true }, // Sunday
  { day_of_week: 1, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 2, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 3, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 4, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 5, open_time: '11:00', close_time: '23:00', is_closed: false },
  { day_of_week: 6, open_time: '11:00', close_time: '23:00', is_closed: false },
]

const INITIAL_DATA: OnboardingData = {
  name: '',
  address: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'US',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  type: null,
  cuisine_types: [],
  phone: '',

  legal_business_name: '',
  dba_name: '',
  ein: '',
  legal_contact_name: '',
  legal_contact_title: '',
  legal_contact_email: '',
  legal_contact_phone: '',
  tos_signature_data_url: null,
  tos_signed_at: null,

  bank_account_holder: '',
  bank_name: '',
  bank_routing_number: '',
  bank_account_number: '',
  payout_schedule: 'daily',
  refund_funding_source: 'processor_balance',
  batch_close_mode: 'automatic',
  batch_close_time: '04:00',
  credit_card_tip_payout: 'payroll',
  refund_approval_threshold: '',

  tax_rates: [
    {
      name: 'Sales Tax',
      rate: '',
      applies_to: 'all',
      is_default: true,
      is_inclusive: false,
      is_active: true,
    },
  ],
  service_charges: [],
  discount_rules: [],

  challenges: [],
  daily_covers_range: null,
  team_size_range: null,
  primary_goal: null,

  current_pos: null,
  current_scheduling: null,
  current_reservations: null,
  service_modes: ['dine_in'],
  default_guest_flow: 'seat_first',

  operating_hours: DEFAULT_HOURS,
  same_hours_every_day: true,

  seating_capacity: null,
  table_count: null,
  sections: ['Table', 'Main Floor', 'Bar', 'Patio'],

  menu_import_method: 'skip',

  team_setup_method: 'skip',
  invites: [],
}

const ONBOARDING_MAX_STEP = 14
const REQUEST_TIMEOUT_MS = 20000
const ONBOARDING_DRAFT_VERSION = 1

const MENU_IMPORT_METHODS: OnboardingData['menu_import_method'][] = [
  'skip',
  'manual',
  'upload',
  'toast',
  'scrape',
  'template',
]

const TEAM_SETUP_METHODS: OnboardingData['team_setup_method'][] = [
  'skip',
  'invite',
  'sevenshifts',
]

const TEAM_ROLES: TeamInvite['role'][] = ['manager', 'server', 'host', 'kitchen']

const PAYOUT_SCHEDULES: OnboardingData['payout_schedule'][] = ['daily', 'weekly', 'manual']
const REFUND_FUNDING_SOURCES: OnboardingData['refund_funding_source'][] = ['processor_balance', 'bank_account']
const BATCH_CLOSE_MODES: OnboardingData['batch_close_mode'][] = ['automatic', 'manual']
const CREDIT_CARD_TIP_PAYOUTS: OnboardingData['credit_card_tip_payout'][] = ['nightly', 'payroll']
const TAX_APPLIES_TO: TaxRateData['applies_to'][] = ['all', 'food', 'alcohol', 'non_alcohol', 'merchandise']
const CHARGE_TYPES: ServiceChargeData['charge_type'][] = ['percentage', 'fixed']
const CHARGE_APPLIES_TO: ServiceChargeData['applies_to'][] = ['all', 'dine_in', 'bar', 'takeout', 'delivery', 'catering', 'large_party']
const DISCOUNT_TYPES: DiscountRuleData['discount_type'][] = ['discount', 'comp', 'promo', 'employee_meal', 'service_recovery']
const DISCOUNT_APPLIES_TO: DiscountRuleData['applies_to'][] = ['item', 'check', 'both']
const DISCOUNT_VALUE_TYPES: DiscountRuleData['value_type'][] = ['percent', 'fixed', 'open']
const DISCOUNT_TAX_BEHAVIORS: DiscountRuleData['tax_behavior'][] = ['reduce_taxable_amount', 'apply_after_tax', 'no_tax_impact']
const DISCOUNT_ROLES = ['owner', 'manager', 'server', 'bartender', 'cashier', 'host', 'runner', 'busser']
const DISCOUNT_SERVICE_MODES = ['dine_in', 'bar', 'counter_service', 'takeout', 'delivery', 'catering']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const asNullableNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const asStringNumber = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') return value.replace(/[^\d.]/g, '').slice(0, 10)
  return ''
}

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

const normalizeSectionNames = (sections: string[]): string[] => {
  const normalized: string[] = []
  const seen = new Set<string>()
  for (const raw of ['Table', ...sections]) {
    const name = raw.trim().replace(/\s+/g, ' ')
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(key === 'table' ? 'Table' : name)
  }
  return normalized.length > 0 ? normalized : ['Table']
}

const asEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

const asMenuImportMethod = (value: unknown): OnboardingData['menu_import_method'] =>
  MENU_IMPORT_METHODS.includes(value as OnboardingData['menu_import_method'])
    ? (value as OnboardingData['menu_import_method'])
    : INITIAL_DATA.menu_import_method

const asTeamSetupMethod = (value: unknown): OnboardingData['team_setup_method'] =>
  TEAM_SETUP_METHODS.includes(value as OnboardingData['team_setup_method'])
    ? (value as OnboardingData['team_setup_method'])
    : INITIAL_DATA.team_setup_method

const asInvites = (value: unknown): TeamInvite[] => {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .map((invite) => {
      const email = asString(invite.email).trim()
      const role = invite.role

      if (!email || !TEAM_ROLES.includes(role as TeamInvite['role'])) {
        return null
      }

      return { email, role: role as TeamInvite['role'] }
    })
    .filter((invite): invite is TeamInvite => invite !== null)
}

const normalizeTime = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback
  return value.slice(0, 5)
}

const normalizeOperatingHours = (value: unknown): OperatingHoursData[] => {
  const seeded = DEFAULT_HOURS.map(hours => ({ ...hours }))
  if (!Array.isArray(value)) return seeded

  for (const row of value) {
    if (!isRecord(row)) continue

    const dayOfWeek = Number(row.day_of_week)
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) continue

    const fallback = seeded[dayOfWeek]
    seeded[dayOfWeek] = {
      day_of_week: dayOfWeek,
      open_time: normalizeTime(row.open_time, fallback.open_time),
      close_time: normalizeTime(row.close_time, fallback.close_time),
      is_closed: typeof row.is_closed === 'boolean' ? row.is_closed : fallback.is_closed,
    }
  }

  return seeded
}

const normalizeTaxRates = (value: unknown): TaxRateData[] => {
  const rows = Array.isArray(value) ? value : []
  const normalized = rows
    .filter(isRecord)
    .map(row => ({
      id: asNullableString(row.id),
      name: asString(row.name).trim(),
      rate: asStringNumber(row.rate),
      applies_to: asEnum(row.applies_to, TAX_APPLIES_TO, 'all'),
      is_default: typeof row.is_default === 'boolean' ? row.is_default : false,
      is_inclusive: typeof row.is_inclusive === 'boolean' ? row.is_inclusive : false,
      is_active: typeof row.is_active === 'boolean' ? row.is_active : true,
    }))
    .filter(row => row.name && row.is_active !== false)

  if (normalized.length === 0) {
    return INITIAL_DATA.tax_rates.map(row => ({ ...row }))
  }

  const hasDefault = normalized.some(row => row.is_default)
  return normalized.map((row, index) => ({
    ...row,
    is_default: row.is_default || (!hasDefault && index === 0),
  }))
}

const normalizeServiceCharges = (value: unknown): ServiceChargeData[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map(row => ({
      id: asNullableString(row.id),
      name: asString(row.name).trim(),
      charge_type: asEnum(row.charge_type, CHARGE_TYPES, 'percentage'),
      amount: asStringNumber(row.amount),
      applies_to: asEnum(row.applies_to, CHARGE_APPLIES_TO, 'all'),
      taxable: typeof row.taxable === 'boolean' ? row.taxable : true,
      auto_apply: typeof row.auto_apply === 'boolean' ? row.auto_apply : false,
      is_tip: typeof row.is_tip === 'boolean' ? row.is_tip : false,
      is_active: typeof row.is_active === 'boolean' ? row.is_active : true,
    }))
    .filter(row => row.name && row.is_active !== false)
}

const normalizeDiscountRoles = (value: unknown): string[] => {
  const roles = asStringArray(value).map(role => role.toLowerCase()).filter(role => DISCOUNT_ROLES.includes(role))
  return Array.from(new Set(roles.length > 0 ? roles : ['owner', 'manager']))
}

const normalizeDiscountServiceModes = (value: unknown): string[] =>
  Array.from(new Set(asStringArray(value).map(mode => mode.toLowerCase()).filter(mode => DISCOUNT_SERVICE_MODES.includes(mode))))

const normalizeDaysOfWeek = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(
    value
      .map(day => Number(day))
      .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
  )).sort((a, b) => a - b)
}

const normalizeDiscountRules = (value: unknown): DiscountRuleData[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map(row => ({
      id: asNullableString(row.id),
      name: asString(row.name).trim(),
      discount_type: asEnum(row.discount_type, DISCOUNT_TYPES, 'discount'),
      applies_to: asEnum(row.applies_to, DISCOUNT_APPLIES_TO, 'check'),
      value_type: asEnum(row.value_type, DISCOUNT_VALUE_TYPES, 'percent'),
      default_value: asStringNumber(row.default_value),
      editable_by_employee: typeof row.editable_by_employee === 'boolean' ? row.editable_by_employee : false,
      min_value: asStringNumber(row.min_value),
      max_value: asStringNumber(row.max_value),
      allowed_roles: normalizeDiscountRoles(row.allowed_roles),
      requires_manager_approval: typeof row.requires_manager_approval === 'boolean' ? row.requires_manager_approval : false,
      tax_behavior: asEnum(row.tax_behavior, DISCOUNT_TAX_BEHAVIORS, 'reduce_taxable_amount'),
      reason_required: typeof row.reason_required === 'boolean' ? row.reason_required : false,
      service_modes: normalizeDiscountServiceModes(row.service_modes),
      days_of_week: normalizeDaysOfWeek(row.days_of_week),
      is_active: typeof row.is_active === 'boolean' ? row.is_active : true,
    }))
    .filter(row => row.name && row.is_active !== false)
}

const taxesChargesToPayload = (data: OnboardingData) => ({
  tax_rates: normalizeTaxRates(data.tax_rates).map(row => ({
    id: row.id || undefined,
    name: row.name,
    rate: row.rate === '' ? 0 : Number(row.rate),
    applies_to: row.applies_to,
    is_default: row.is_default,
    is_inclusive: row.is_inclusive,
    is_active: true,
  })),
  service_charges: normalizeServiceCharges(data.service_charges).map(row => ({
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
})

const discountRulesToPayload = (data: OnboardingData) => ({
  discount_rules: normalizeDiscountRules(data.discount_rules).map(row => ({
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
})

const toOnboardingData = (value: Partial<OnboardingData> | null | undefined): OnboardingData => {
  const input = value ?? {}
  const sections = normalizeSectionNames(asStringArray(input.sections))

  return {
    name: asString(input.name),
    address: asString(input.address),
    city: asString(input.city),
    state: asString(input.state),
    postal_code: asString(input.postal_code),
    country: asString(input.country, INITIAL_DATA.country),
    timezone: asString(input.timezone, INITIAL_DATA.timezone),
    type: input.type ?? INITIAL_DATA.type,
    cuisine_types: asStringArray(input.cuisine_types),
    phone: asString(input.phone),
    legal_business_name: asString(input.legal_business_name),
    dba_name: asString(input.dba_name),
    ein: asString(input.ein),
    legal_contact_name: asString(input.legal_contact_name),
    legal_contact_title: asString(input.legal_contact_title),
    legal_contact_email: asString(input.legal_contact_email),
    legal_contact_phone: asString(input.legal_contact_phone),
    tos_signature_data_url: asNullableString(input.tos_signature_data_url),
    tos_signed_at: asNullableString(input.tos_signed_at),
    bank_account_holder: asString(input.bank_account_holder),
    bank_name: asString(input.bank_name),
    bank_routing_number: asString(input.bank_routing_number),
    bank_account_number: asString(input.bank_account_number),
    payout_schedule: asEnum(input.payout_schedule, PAYOUT_SCHEDULES, INITIAL_DATA.payout_schedule),
    refund_funding_source: asEnum(input.refund_funding_source, REFUND_FUNDING_SOURCES, INITIAL_DATA.refund_funding_source),
    batch_close_mode: asEnum(input.batch_close_mode, BATCH_CLOSE_MODES, INITIAL_DATA.batch_close_mode),
    batch_close_time: asString(input.batch_close_time, INITIAL_DATA.batch_close_time),
    credit_card_tip_payout: asEnum(input.credit_card_tip_payout, CREDIT_CARD_TIP_PAYOUTS, INITIAL_DATA.credit_card_tip_payout),
    refund_approval_threshold: asString(input.refund_approval_threshold),
    tax_rates: normalizeTaxRates(input.tax_rates),
    service_charges: normalizeServiceCharges(input.service_charges),
    discount_rules: normalizeDiscountRules(input.discount_rules),
    challenges: asStringArray(input.challenges),
    daily_covers_range: asNullableString(input.daily_covers_range),
    team_size_range: asNullableString(input.team_size_range),
    primary_goal: asNullableString(input.primary_goal),
    current_pos: asNullableString(input.current_pos),
    current_scheduling: asNullableString(input.current_scheduling),
    current_reservations: asNullableString(input.current_reservations),
    service_modes: asStringArray(input.service_modes).length > 0
      ? asStringArray(input.service_modes)
      : INITIAL_DATA.service_modes,
    default_guest_flow: asNullableString(input.default_guest_flow) || INITIAL_DATA.default_guest_flow,
    operating_hours: normalizeOperatingHours(input.operating_hours),
    same_hours_every_day:
      typeof input.same_hours_every_day === 'boolean'
        ? input.same_hours_every_day
        : INITIAL_DATA.same_hours_every_day,
    seating_capacity: asNullableNumber(input.seating_capacity),
    table_count: asNullableNumber(input.table_count),
    sections,
    menu_import_method: asMenuImportMethod(input.menu_import_method),
    team_setup_method: asTeamSetupMethod(input.team_setup_method),
    invites: asInvites(input.invites),
  }
}

const mergeOnboardingData = (base: OnboardingData, updates: Partial<OnboardingData>): OnboardingData =>
  toOnboardingData({ ...base, ...updates })

const clampStep = (step: number): number =>
  Math.max(0, Math.min(step, ONBOARDING_MAX_STEP))

const mapDbStepToUiStep = (step: number | null | undefined): number => clampStep(step ?? 0)

const getDraftStorageKey = (userId: string): string => `shire_onboarding_draft:${userId}`

const readDraft = (userId: string): OnboardingDraft | null => {
  try {
    const raw = localStorage.getItem(getDraftStorageKey(userId))
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>
    if (parsed.version !== ONBOARDING_DRAFT_VERSION) return null

    return {
      version: ONBOARDING_DRAFT_VERSION,
      currentStep: clampStep(typeof parsed.currentStep === 'number' ? parsed.currentStep : 0),
      restaurantId: typeof parsed.restaurantId === 'string' ? parsed.restaurantId : null,
      data: isRecord(parsed.data) ? parsed.data as Partial<OnboardingData> : {},
      updatedAt: asString(parsed.updatedAt, new Date(0).toISOString()),
    }
  } catch {
    return null
  }
}

const writeDraft = (userId: string, draft: OnboardingDraft) => {
  try {
    localStorage.setItem(getDraftStorageKey(userId), JSON.stringify(draft))
  } catch (err) {
    console.warn('[Onboarding] Could not persist onboarding draft:', err)
  }
}

const clearDraft = (userId: string) => {
  try {
    localStorage.removeItem(getDraftStorageKey(userId))
  } catch (err) {
    console.warn('[Onboarding] Could not clear onboarding draft:', err)
  }
}

const parseConfig = (value: unknown): Partial<OnboardingData> => {
  if (!isRecord(value)) return {}

  return {
    legal_business_name: asString(value.legal_business_name),
    dba_name: asString(value.dba_name),
    ein: asString(value.ein),
    legal_contact_name: asString(value.legal_contact_name),
    legal_contact_title: asString(value.legal_contact_title),
    legal_contact_email: asString(value.legal_contact_email),
    legal_contact_phone: asString(value.legal_contact_phone),
    tos_signature_data_url: asNullableString(value.tos_signature_data_url),
    tos_signed_at: asNullableString(value.tos_signed_at),
    bank_account_holder: asString(value.bank_account_holder),
    bank_name: asString(value.bank_name),
    bank_routing_number: asString(value.bank_routing_number),
    bank_account_number: asString(value.bank_account_number),
    payout_schedule: asEnum(value.payout_schedule, PAYOUT_SCHEDULES, INITIAL_DATA.payout_schedule),
    refund_funding_source: asEnum(value.refund_funding_source, REFUND_FUNDING_SOURCES, INITIAL_DATA.refund_funding_source),
    batch_close_mode: asEnum(value.batch_close_mode, BATCH_CLOSE_MODES, INITIAL_DATA.batch_close_mode),
    batch_close_time: asString(value.batch_close_time, INITIAL_DATA.batch_close_time),
    credit_card_tip_payout: asEnum(value.credit_card_tip_payout, CREDIT_CARD_TIP_PAYOUTS, INITIAL_DATA.credit_card_tip_payout),
    refund_approval_threshold: asString(value.refund_approval_threshold),
    challenges: asStringArray(value.challenges),
    daily_covers_range: asNullableString(value.daily_covers_range),
    team_size_range: asNullableString(value.team_size_range),
    primary_goal: asNullableString(value.primary_goal),
    current_pos: asNullableString(value.current_pos),
    current_scheduling: asNullableString(value.current_scheduling),
    current_reservations: asNullableString(value.current_reservations),
    service_modes: asStringArray(value.service_modes),
    default_guest_flow: asNullableString(value.default_guest_flow),
    menu_import_method: asMenuImportMethod(value.menu_import_method),
    team_setup_method: asTeamSetupMethod(value.team_setup_method),
    invites: asInvites(value.invites),
  }
}

const getApiHeaders = async (): Promise<Headers> => {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }
  return headers
}

const fetchTaxesCharges = async (restaurantId: string) => {
  const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/taxes-charges`, {
    headers: await getApiHeaders(),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(asString(body.detail) || asString(body.message) || `Loading taxes and charges failed (${response.status})`)
  }
  return response.json()
}

const fetchDiscountRules = async (restaurantId: string) => {
  const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/discount-rules`, {
    headers: await getApiHeaders(),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(asString(body.detail) || asString(body.message) || `Loading discounts failed (${response.status})`)
  }
  return response.json()
}

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'restaurant'

const buildUniqueSlug = (name: string): string => {
  const randomSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)

  return `${slugify(name)}-${randomSuffix}`
}

const isSlugConflict = (error: unknown): boolean => {
  if (!isRecord(error)) return false
  const code = asString(error.code).trim()
  const message = asString(error.message).toLowerCase()

  return code === '23505' && message.includes('slug')
}

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

const getRequiredBasicsIssues = (data: OnboardingData): OnboardingValidationIssue[] => {
  const issues: OnboardingValidationIssue[] = []

  if (!data.name.trim()) {
    issues.push({
      field: 'name',
      message: 'Restaurant name is required.',
    })
  }

  return issues
}

const getCompletionIssues = (
  data: OnboardingData,
  activeRestaurantId: string | null
): OnboardingValidationIssue[] => {
  const issues = getRequiredBasicsIssues(data)

  if (!activeRestaurantId) {
    issues.push({
      field: 'restaurant',
      message: 'Create or select a restaurant before completing onboarding.',
    })
  }

  return issues
}

const throwIfInvalid = (issues: OnboardingValidationIssue[]) => {
  if (issues.length > 0) {
    throw new Error(issues[0].message)
  }
}

// ============================================
// HOOK
// ============================================

export function useOnboarding() {
  const auth = useAuth()
  const { user, refreshRestaurants, seedCurrentRestaurant } = auth
  const currentRestaurant = auth.restaurant.currentRestaurant
  const isRestaurantLoading = auth.restaurant.isLoading
  const navigate = useNavigate()
  const location = useLocation()
  const isSetupEditor = /^\/restaurants\/[^/]+\/setup\/?$/.test(location.pathname)
  const isNewRestaurantFlow =
    location.pathname === '/onboarding' &&
    new URLSearchParams(location.search).get('new') === '1'
  const shouldUseCurrentRestaurant = !isNewRestaurantFlow
  const currentRestaurantStep = isSetupEditor ? null : currentRestaurant?.onboarding_step
  const currentRestaurantUpdatedAt = isSetupEditor ? null : currentRestaurant?.updated_at

  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<OnboardingData>(toOnboardingData(INITIAL_DATA))
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLaunchScreen, setShowLaunchScreen] = useState(false)
  const [isHydrating, setIsHydrating] = useState(true)

  const activeRestaurantId = restaurantId || (shouldUseCurrentRestaurant ? currentRestaurant?.id : null) || null
  const completionIssues = getCompletionIssues(data, activeRestaurantId)

  const getActiveRestaurantId = useCallback((): string => {
    if (!activeRestaurantId) {
      throw new Error('No restaurant created')
    }
    return activeRestaurantId
  }, [activeRestaurantId])

  const runWithTimeout = useCallback(async <T,>(
    operation: () => PromiseLike<T>,
    timeoutMessage: string
  ): Promise<T> => {
    let timerId: ReturnType<typeof setTimeout> | null = null

    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        reject(new Error(timeoutMessage))
      }, REQUEST_TIMEOUT_MS)
    })

    try {
      return await Promise.race([Promise.resolve(operation()), timeoutPromise])
    } finally {
      if (timerId) clearTimeout(timerId)
    }
  }, [])

  const hydrateFromRestaurant = useCallback(async (restaurant: Restaurant): Promise<Partial<OnboardingData>> => {
    const [hoursResult, sectionsResult, taxesChargesResult, discountRulesResult] = await Promise.all([
      runWithTimeout(
        () =>
          supabase
            .from('operating_hours')
            .select('day_of_week, open_time, close_time, is_closed')
            .eq('restaurant_id', restaurant.id),
        'Loading operating hours timed out.'
      ),
      runWithTimeout(
        () =>
          supabase
            .from('sections')
            .select('name')
            .eq('restaurant_id', restaurant.id)
            .eq('is_active', true),
        'Loading sections timed out.'
      ),
      runWithTimeout(
        () => fetchTaxesCharges(restaurant.id),
        'Loading taxes and charges timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate taxes and charges:', err)
        return null
      }),
      runWithTimeout(
        () => fetchDiscountRules(restaurant.id),
        'Loading discounts timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate discounts:', err)
        return null
      }),
    ])

    if (hoursResult.error) {
      console.warn('[Onboarding] Could not hydrate operating hours:', hoursResult.error.message)
    }
    if (sectionsResult.error) {
      console.warn('[Onboarding] Could not hydrate sections:', sectionsResult.error.message)
    }

    const sectionNames = normalizeSectionNames(asStringArray((sectionsResult.data || []).map(section => section.name)))
    const configData = parseConfig(restaurant.config)

    return {
      name: asString(restaurant.name),
      address: asString(restaurant.address),
      city: asString(restaurant.city),
      state: asString(restaurant.state),
      postal_code: asString(restaurant.postal_code),
      country: asString(restaurant.country, INITIAL_DATA.country),
      timezone: asString(restaurant.timezone, INITIAL_DATA.timezone),
      type: restaurant.type as RestaurantType | null,
      cuisine_types: Array.isArray(restaurant.cuisine_types) ? restaurant.cuisine_types : [],
      phone: asString(restaurant.phone),
      seating_capacity: restaurant.seating_capacity,
      table_count: restaurant.table_count,
      operating_hours: normalizeOperatingHours(hoursResult.data),
      sections: sectionNames.length > 0 ? sectionNames : INITIAL_DATA.sections,
      tax_rates: normalizeTaxRates(isRecord(taxesChargesResult) ? taxesChargesResult.tax_rates : []),
      service_charges: normalizeServiceCharges(isRecord(taxesChargesResult) ? taxesChargesResult.service_charges : []),
      discount_rules: normalizeDiscountRules(isRecord(discountRulesResult) ? discountRulesResult.discount_rules : []),
      ...configData,
    }
  }, [runWithTimeout])

  const fetchRestaurantConfig = useCallback(async (activeRestaurantId: string): Promise<Record<string, unknown>> => {
    const { data: restaurantRow, error: fetchError } = await runWithTimeout(
      () =>
        supabase
          .from('restaurants')
          .select('config')
          .eq('id', activeRestaurantId)
          .single(),
      'Loading current onboarding settings timed out. Please retry.'
    )

    if (fetchError) throw fetchError

    if (isRecord(restaurantRow?.config)) {
      return restaurantRow.config
    }

    return {}
  }, [runWithTimeout])

  const onboardingProgressPatch = useCallback((step: number) =>
    isSetupEditor ? {} : { onboarding_step: step },
  [isSetupEditor])

  // Hydrate local onboarding state from Supabase + local draft.
  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      if (!user) {
        if (!cancelled) {
          setData(toOnboardingData(INITIAL_DATA))
          setCurrentStep(0)
          setRestaurantId(null)
          setIsHydrating(false)
        }
        return
      }

      // Auth is still fetching the restaurant list — stay in loading state
      // so we don't accidentally overwrite the localStorage draft with blank data.
      if (isRestaurantLoading) {
        setIsHydrating(true)
        return
      }

      setIsHydrating(true)

      let mergedData = toOnboardingData(INITIAL_DATA)
      let resolvedRestaurantId: string | null = null
      let resolvedStep = 0

      const localDraft = isNewRestaurantFlow || isSetupEditor ? null : readDraft(user.id)
      if (localDraft) {
        mergedData = mergeOnboardingData(mergedData, localDraft.data)
        resolvedRestaurantId = localDraft.restaurantId
        resolvedStep = localDraft.currentStep
      }

      const onboardingRestaurant =
        shouldUseCurrentRestaurant &&
        currentRestaurant &&
        (isSetupEditor || !currentRestaurant.onboarding_completed_at)
          ? currentRestaurant
          : null

      if (onboardingRestaurant) {
        const restaurantData = await hydrateFromRestaurant(onboardingRestaurant)
        mergedData = mergeOnboardingData(mergedData, restaurantData)
        resolvedRestaurantId = onboardingRestaurant.id
        resolvedStep = isSetupEditor
          ? 0
          : Math.max(
              resolvedStep,
              mapDbStepToUiStep(onboardingRestaurant.onboarding_step)
            )
      }

      if (!cancelled) {
        setData(mergedData)
        setRestaurantId(resolvedRestaurantId)
        setCurrentStep(resolvedStep)
        setError(null)
        setIsHydrating(false)
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [
    user?.id,
    isRestaurantLoading,
    currentRestaurant?.id,
    currentRestaurantStep,
    currentRestaurantUpdatedAt,
    currentRestaurant?.onboarding_completed_at,
    shouldUseCurrentRestaurant,
    isSetupEditor,
    isNewRestaurantFlow,
    hydrateFromRestaurant,
  ])

  // Persist in-progress onboarding draft for refresh resilience.
  useEffect(() => {
    if (isSetupEditor) return
    if (!user || isHydrating) return

    writeDraft(user.id, {
      version: ONBOARDING_DRAFT_VERSION,
      currentStep: clampStep(currentStep),
      restaurantId,
      data,
      updatedAt: new Date().toISOString(),
    })
  }, [user?.id, isHydrating, isSetupEditor, currentStep, restaurantId, data])

  // Update data
  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData(prev => mergeOnboardingData(prev, updates))
  }, [])

  // Navigate steps (8 steps: 0-7)
  const nextStep = useCallback(() => {
    setCurrentStep(prev => clampStep(prev + 1))
  }, [])

  const prevStep = useCallback(() => {
    setCurrentStep(prev => clampStep(prev - 1))
  }, [])

  const goToStep = useCallback((step: number) => {
    setCurrentStep(clampStep(step))
  }, [])

  // Persist visible step so onboarding resumes across browsers, not just localStorage.
  useEffect(() => {
    const activeRestaurantId = restaurantId || (shouldUseCurrentRestaurant ? currentRestaurant?.id : null)
    if (isSetupEditor) return
    if (!activeRestaurantId) return
    if (isHydrating || showLaunchScreen) return
    if (currentRestaurant?.onboarding_completed_at && !isSetupEditor) return

    // Step 0 is the "create restaurant" screen. Once a restaurant exists,
    // never persist 0 back to the DB or we can reset users to the first screen
    // while the basics submit/refresh cycle is still settling.
    if (currentStep === 0) return

    const step = clampStep(currentStep)

    void supabase
      .from('restaurants')
      .update({ onboarding_step: step })
      .eq('id', activeRestaurantId)
      .then(({ error: stepError }) => {
        if (stepError) {
          console.warn('[Onboarding] Could not persist onboarding step:', stepError.message)
        }
      })
  }, [
    currentStep,
    restaurantId,
    currentRestaurant?.id,
    currentRestaurant?.onboarding_completed_at,
    shouldUseCurrentRestaurant,
    isSetupEditor,
    isHydrating,
    showLaunchScreen,
  ])

  // Create restaurant (after step 0)
  const createRestaurant = useCallback(async () => {
    if (!user) throw new Error('Not authenticated')

    setIsLoading(true)
    setError(null)

    try {
      throwIfInvalid(getRequiredBasicsIssues(data))

      const basePayload = {
        owner_id: user.id,
        name: data.name.trim(),
        address: data.address.trim() || null,
        city: data.city.trim() || null,
        state: data.state.trim() || null,
        postal_code: data.postal_code.trim() || null,
        country: data.country,
        timezone: data.timezone,
        type: data.type || 'casual',
        cuisine_types: data.cuisine_types,
        phone: data.phone.trim() || null,
      }

      // If a restaurant already exists, update instead of creating a duplicate.
      const existingRestaurantId =
        restaurantId || (shouldUseCurrentRestaurant ? currentRestaurant?.id : null) || null
      const existingIsCompleted = Boolean(
        existingRestaurantId &&
        currentRestaurant?.id === existingRestaurantId &&
        currentRestaurant.onboarding_completed_at
      )
      if (existingRestaurantId) {
        const { data: updatedRestaurant, error: updateError } = await runWithTimeout(
          () =>
            supabase
              .from('restaurants')
              .update({
                ...basePayload,
                ...(!existingIsCompleted
                  ? {
                      status: 'onboarding',
                      onboarding_step: Math.max(1, currentRestaurant?.onboarding_step || 1),
                    }
                  : {}),
              })
              .eq('id', existingRestaurantId)
              .select()
              .single(),
          'Saving restaurant basics timed out. Please retry.'
        )

        if (updateError) throw updateError

        setRestaurantId(updatedRestaurant.id)
        setCurrentStep(prev => Math.max(prev, 1))
        seedCurrentRestaurant(updatedRestaurant)
        if (user && !isSetupEditor) {
          writeDraft(user.id, {
            version: ONBOARDING_DRAFT_VERSION,
            currentStep: 1,
            restaurantId: updatedRestaurant.id,
            data,
            updatedAt: new Date().toISOString(),
          })
        }
        if (!isSetupEditor) {
          await refreshRestaurants(updatedRestaurant.id)
        }
        return updatedRestaurant
      }

      let createdRestaurant: Restaurant | null = null
      let lastCreateError: unknown = null

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const slug = buildUniqueSlug(data.name)
        const { data: restaurant, error: createError } = await runWithTimeout(
          () =>
            supabase
              .from('restaurants')
              .insert({
                ...basePayload,
                status: 'onboarding',
                onboarding_step: 1,
                slug,
                public_slug: slug,
              })
              .select()
              .single(),
          'Creating restaurant timed out. Please retry.'
        )

        if (!createError && restaurant) {
          createdRestaurant = restaurant
          break
        }

        lastCreateError = createError
        if (!isSlugConflict(createError)) {
          throw createError
        }
      }

      if (!createdRestaurant) {
        throw lastCreateError || new Error('Failed to create restaurant')
      }

      // Try to create owner membership — soft fail.
      // owner_id on restaurants is the source of truth for onboarding.
      try {
        const { error: memberError } = await runWithTimeout(
          () =>
            supabase
              .from('restaurant_members')
              .insert({
                restaurant_id: createdRestaurant.id,
                user_id: user.id,
                role: 'owner',
                status: 'active',
                accepted_at: new Date().toISOString(),
              }),
          'Creating owner membership timed out.'
        )

        if (memberError && memberError.code !== '23505') {
          console.warn('[Onboarding] Could not create membership:', memberError.message)
        }
      } catch (membershipError) {
        console.warn('[Onboarding] Could not create membership:', membershipError)
      }

      setRestaurantId(createdRestaurant.id)
      setCurrentStep(prev => Math.max(prev, 1))
      seedCurrentRestaurant(createdRestaurant)
      if (user) {
        writeDraft(user.id, {
          version: ONBOARDING_DRAFT_VERSION,
          currentStep: 1,
          restaurantId: createdRestaurant.id,
          data,
          updatedAt: new Date().toISOString(),
        })
      }
      await refreshRestaurants(createdRestaurant.id)
      return createdRestaurant
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to create restaurant')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [
    user,
    data,
    restaurantId,
    currentRestaurant?.id,
    currentRestaurant?.onboarding_completed_at,
    currentRestaurant?.onboarding_step,
    isSetupEditor,
    shouldUseCurrentRestaurant,
    refreshRestaurants,
    runWithTimeout,
    seedCurrentRestaurant,
  ])

  // Save goals & priorities (after step 1)
  const saveLegal = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const existingConfig = await fetchRestaurantConfig(activeRestaurantId)

      const { error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              config: {
                ...existingConfig,
                legal_business_name: data.legal_business_name,
                dba_name: data.dba_name,
                ein: data.ein,
                legal_contact_name: data.legal_contact_name,
                legal_contact_title: data.legal_contact_title,
                legal_contact_email: data.legal_contact_email,
                legal_contact_phone: data.legal_contact_phone,
                tos_signature_data_url: data.tos_signature_data_url,
                tos_signed_at: data.tos_signed_at,
                tos_version: 'shire-placeholder-tos-v1',
              },
              ...onboardingProgressPatch(2),
            })
            .eq('id', activeRestaurantId),
        'Saving legal setup timed out. Please retry.'
      )

      if (updateError) throw updateError
      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save legal setup')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, fetchRestaurantConfig, onboardingProgressPatch, runWithTimeout])

  const savePayments = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const existingConfig = await fetchRestaurantConfig(activeRestaurantId)

      const { error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              config: {
                ...existingConfig,
                bank_account_holder: data.bank_account_holder,
                bank_name: data.bank_name,
                bank_routing_number: data.bank_routing_number,
                bank_account_number: data.bank_account_number,
                payout_schedule: data.payout_schedule,
                refund_funding_source: data.refund_funding_source,
                batch_close_mode: data.batch_close_mode,
                batch_close_time: data.batch_close_time,
                credit_card_tip_payout: data.credit_card_tip_payout,
                refund_approval_threshold: data.refund_approval_threshold,
              },
              ...onboardingProgressPatch(3),
            })
            .eq('id', activeRestaurantId),
        'Saving payment setup timed out. Please retry.'
      )

      if (updateError) throw updateError
      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save payment setup')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, fetchRestaurantConfig, onboardingProgressPatch, runWithTimeout])

  const saveTaxesCharges = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const response = await runWithTimeout(
        async () => fetch(`${API_CONFIG.baseUrl}/restaurants/${activeRestaurantId}/taxes-charges`, {
          method: 'PUT',
          headers: await getApiHeaders(),
          body: JSON.stringify(taxesChargesToPayload(data)),
        }),
        'Saving taxes and charges timed out. Please retry.'
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(asString(body.detail) || asString(body.message) || `Saving taxes and charges failed (${response.status})`)
      }

      const saved = await response.json().catch(() => ({}))
      setData(prev => mergeOnboardingData(prev, {
        tax_rates: normalizeTaxRates(isRecord(saved) ? saved.tax_rates : []),
        service_charges: normalizeServiceCharges(isRecord(saved) ? saved.service_charges : []),
      }))

      const { error: stepError } = isSetupEditor
        ? { error: null }
        : await runWithTimeout(
            () =>
              supabase
                .from('restaurants')
                .update({ onboarding_step: 4 })
                .eq('id', activeRestaurantId),
            'Updating onboarding progress timed out. Please retry.'
          )

      if (stepError) throw stepError
      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save taxes and charges')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, isSetupEditor, runWithTimeout])

  const saveDiscountRules = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const response = await runWithTimeout(
        async () => fetch(`${API_CONFIG.baseUrl}/restaurants/${activeRestaurantId}/discount-rules`, {
          method: 'PUT',
          headers: await getApiHeaders(),
          body: JSON.stringify(discountRulesToPayload(data)),
        }),
        'Saving discounts timed out. Please retry.'
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(asString(body.detail) || asString(body.message) || `Saving discounts failed (${response.status})`)
      }

      const saved = await response.json().catch(() => ({}))
      setData(prev => mergeOnboardingData(prev, {
        discount_rules: normalizeDiscountRules(isRecord(saved) ? saved.discount_rules : []),
      }))

      const { error: stepError } = isSetupEditor
        ? { error: null }
        : await runWithTimeout(
            () =>
              supabase
                .from('restaurants')
                .update({ onboarding_step: 5 })
                .eq('id', activeRestaurantId),
            'Updating onboarding progress timed out. Please retry.'
          )

      if (stepError) throw stepError
      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save discounts')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, isSetupEditor, runWithTimeout])

  // Save goals & priorities
  const saveGoals = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const existingConfig = await fetchRestaurantConfig(activeRestaurantId)

      const { error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              config: {
                ...existingConfig,
                challenges: data.challenges,
                daily_covers_range: data.daily_covers_range,
                team_size_range: data.team_size_range,
                primary_goal: data.primary_goal,
              },
              ...onboardingProgressPatch(6),
            })
            .eq('id', activeRestaurantId),
        'Saving goals timed out. Please retry.'
      )

      if (updateError) throw updateError

      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save goals')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, fetchRestaurantConfig, onboardingProgressPatch, runWithTimeout])

  // Save tech stack (after step 3)
  const saveTechStack = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const existingConfig = await fetchRestaurantConfig(activeRestaurantId)

      const { error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              config: {
                ...existingConfig,
                current_pos: data.current_pos,
                current_scheduling: data.current_scheduling,
                current_reservations: data.current_reservations,
                service_modes: data.service_modes,
                default_guest_flow: data.default_guest_flow,
              },
              ...onboardingProgressPatch(8),
            })
            .eq('id', activeRestaurantId),
        'Saving current tools timed out. Please retry.'
      )

      if (updateError) throw updateError

      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save tech stack')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, fetchRestaurantConfig, onboardingProgressPatch, runWithTimeout])

  const saveSections = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const sectionNames = normalizeSectionNames(data.sections)
      const response = await runWithTimeout(
        async () => fetch(`${API_CONFIG.baseUrl}/restaurants/${activeRestaurantId}/sections`, {
          method: 'PUT',
          headers: await getApiHeaders(),
          body: JSON.stringify({ sections: sectionNames }),
        }),
        'Saving restaurant sections timed out. Please retry.'
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(asString(body.detail) || asString(body.message) || `Saving sections failed (${response.status})`)
      }

      const saved = await response.json().catch(() => [])
      const savedNames = normalizeSectionNames(asStringArray((saved || []).map((section: { name?: unknown }) => section.name)))
      setData(prev => mergeOnboardingData(prev, { sections: savedNames }))

      const { error: stepError } = isSetupEditor
        ? { error: null }
        : await runWithTimeout(
            () =>
              supabase
                .from('restaurants')
                .update({ onboarding_step: 9 })
                .eq('id', activeRestaurantId),
            'Updating onboarding progress timed out. Please retry.'
          )

      if (stepError) throw stepError
      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save restaurant sections')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data.sections, getActiveRestaurantId, isSetupEditor, runWithTimeout])

  // Save operating hours (after step 4)
  const saveOperatingHours = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()

      // Delete existing hours
      const { error: deleteError } = await runWithTimeout(
        () =>
          supabase
            .from('operating_hours')
            .delete()
            .eq('restaurant_id', activeRestaurantId),
        'Clearing previous operating hours timed out. Please retry.'
      )

      if (deleteError) throw deleteError

      // Insert new hours
      const { error: insertError } = await runWithTimeout(
        () =>
          supabase
            .from('operating_hours')
            .insert(
              data.operating_hours.map(h => ({
                restaurant_id: activeRestaurantId,
                day_of_week: h.day_of_week,
                open_time: h.open_time,
                close_time: h.close_time,
                is_closed: h.is_closed,
              }))
            ),
        'Saving operating hours timed out. Please retry.'
      )

      if (insertError) throw insertError

      const { error: stepError } = isSetupEditor
        ? { error: null }
        : await runWithTimeout(
            () =>
              supabase
                .from('restaurants')
                .update({ onboarding_step: 10 })
                .eq('id', activeRestaurantId),
            'Updating onboarding progress timed out. Please retry.'
          )

      if (stepError) throw stepError

      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save hours')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data.operating_hours, getActiveRestaurantId, isSetupEditor, runWithTimeout])

  // Save capacity (after step 5)
  const saveCapacity = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()

      // Update restaurant
      const { error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              seating_capacity: data.seating_capacity,
              table_count: data.table_count,
              ...onboardingProgressPatch(11),
            })
            .eq('id', activeRestaurantId),
        'Saving capacity settings timed out. Please retry.'
      )

      if (updateError) throw updateError

      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save capacity')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data.seating_capacity, data.table_count, getActiveRestaurantId, onboardingProgressPatch, runWithTimeout])

  // Save menu step progress (after step 6)
  const saveMenuProgress = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const existingConfig = await fetchRestaurantConfig(activeRestaurantId)

      const { error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              config: {
                ...existingConfig,
                menu_import_method: data.menu_import_method,
              },
              ...onboardingProgressPatch(12),
            })
            .eq('id', activeRestaurantId),
        'Saving menu setup timed out. Please retry.'
      )

      if (updateError) throw updateError
      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save menu setup')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data.menu_import_method, getActiveRestaurantId, fetchRestaurantConfig, onboardingProgressPatch, runWithTimeout])

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      throwIfInvalid(getCompletionIssues(data, activeRestaurantId))

      const existingConfig = await fetchRestaurantConfig(activeRestaurantId)

      // Mark onboarding complete
      const { data: completedRestaurant, error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              name: data.name.trim(),
              country: data.country || INITIAL_DATA.country,
              timezone: data.timezone || INITIAL_DATA.timezone,
              type: data.type || 'casual',
              config: {
                ...existingConfig,
                challenges: data.challenges,
                daily_covers_range: data.daily_covers_range,
                team_size_range: data.team_size_range,
                primary_goal: data.primary_goal,
                current_pos: data.current_pos,
                current_scheduling: data.current_scheduling,
                current_reservations: data.current_reservations,
                service_modes: data.service_modes,
                default_guest_flow: data.default_guest_flow,
                menu_import_method: data.menu_import_method,
                team_setup_method: data.team_setup_method,
                invites: data.invites,
                legal_business_name: data.legal_business_name,
                dba_name: data.dba_name,
                ein: data.ein,
                legal_contact_name: data.legal_contact_name,
                legal_contact_title: data.legal_contact_title,
                legal_contact_email: data.legal_contact_email,
                legal_contact_phone: data.legal_contact_phone,
                tos_signature_data_url: data.tos_signature_data_url,
                tos_signed_at: data.tos_signed_at,
                tos_version: 'shire-placeholder-tos-v1',
                bank_account_holder: data.bank_account_holder,
                bank_name: data.bank_name,
                bank_routing_number: data.bank_routing_number,
                bank_account_number: data.bank_account_number,
                payout_schedule: data.payout_schedule,
                refund_funding_source: data.refund_funding_source,
                batch_close_mode: data.batch_close_mode,
                batch_close_time: data.batch_close_time,
                credit_card_tip_payout: data.credit_card_tip_payout,
                refund_approval_threshold: data.refund_approval_threshold,
              },
              ...(isSetupEditor
                ? {}
                : {
                    status: 'active',
                    onboarding_step: ONBOARDING_MAX_STEP,
                    onboarding_completed_at: new Date().toISOString(),
                  }),
            })
            .eq('id', activeRestaurantId)
            .select()
            .single(),
        'Finalizing onboarding timed out. Please retry.'
      )

      if (updateError) throw updateError

      seedCurrentRestaurant(completedRestaurant)

      // Refresh restaurant list in auth context
      await refreshRestaurants(activeRestaurantId)

      // Show launch screen
      if (user) {
        clearDraft(user.id)
      }
      if (isSetupEditor) {
        navigate(`/restaurants/${activeRestaurantId}/analytics`, { replace: true })
        return
      }
      setShowLaunchScreen(true)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to complete onboarding')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [
    data,
    getActiveRestaurantId,
    fetchRestaurantConfig,
    isSetupEditor,
    navigate,
    refreshRestaurants,
    runWithTimeout,
    seedCurrentRestaurant,
    user,
  ])

  // Navigate to dashboard (called from LaunchScreen)
  const goToDashboard = useCallback(async () => {
    const activeRestaurantId = restaurantId || currentRestaurant?.id || null
    if (activeRestaurantId) {
      await refreshRestaurants(activeRestaurantId)
      navigate(`/restaurants/${activeRestaurantId}/analytics`, { replace: true })
      return
    }
    navigate('/restaurants', { replace: true })
  }, [navigate, refreshRestaurants, restaurantId, currentRestaurant?.id])

  return {
    // State
    currentStep,
    data,
    restaurantId,
    isLoading,
    error,
    showLaunchScreen,
    isHydrating,
    completionIssues,

    // Actions
    updateData,
    nextStep,
    prevStep,
    goToStep,
    createRestaurant,
    saveLegal,
    savePayments,
    saveTaxesCharges,
    saveDiscountRules,
    saveGoals,
    saveTechStack,
    saveSections,
    saveOperatingHours,
    saveCapacity,
    saveMenuProgress,
    completeOnboarding,
    goToDashboard,

    // Helpers
    setError,
  }
}

export type UseOnboardingReturn = ReturnType<typeof useOnboarding>

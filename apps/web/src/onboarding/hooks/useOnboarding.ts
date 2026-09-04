import { useState, useCallback, useEffect } from 'react'
import {
  DEFAULT_HOURS,
  isRecord,
  asString,
  asNullableString,
  asEnum,
  defaultRolePermissions,
  defaultCloseoutSettings,
  defaultMenuCategories,
  defaultCheckWorkflowSettings,
  defaultTipPayrollSettings,
  defaultAutoGratuity,
  normalizeSectionNames,
  normalizeSectionProfiles,
  normalizeTaxRates,
  normalizeCategoryTaxAssignments,
  normalizeServiceCharges,
  normalizeMenuCategories,
  normalizeDiscountRules,
  normalizeRolePermissions,
  normalizeCloseoutSettings,
  normalizeCheckWorkflowSettings,
  normalizeJobCodes,
  normalizeTipPayrollSettings,
  normalizeAutoGratuity,
  taxesChargesPayload,
  discountRulesPayload,
  menuCategoriesPayload,
  managerControlsPayload,
  closeoutSettingsPayload,
  checkWorkflowSettingsPayload,
  tipPayrollPayload,
  collapseEntryWhitespace,
  normalizeEmailInput,
  normalizeUsPhoneE164,
  numberRangeError,
  reservationTimingError,
} from '@shire/settings'
import type {
  TaxRateData,
  ServiceChargeData,
  SectionBehaviorData,
  MenuCategoryData,
  DiscountRuleData,
  RolePermissionData,
  CloseoutSettingsData,
  CheckWorkflowSettingsData,
  JobCodeData,
  TipPayrollSettingsData,
  CategoryTaxAssignmentData,
  AutoGratuityData,
} from '@shire/settings'

// Settings types now live in @shire/settings; step components keep importing
// them from this hook.
export type {
  TaxRateData,
  ServiceChargeData,
  SectionBehaviorData,
  MenuCategoryData,
  DiscountRuleData,
  RolePermissionData,
  CloseoutSettingsData,
  CheckWorkflowSettingsData,
  JobCodeData,
  TipRoleRuleData,
  CategoryTipProfileData,
  TipPayrollSettingsData,
} from '@shire/settings'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabase'
import { API_CONFIG } from '../../shared/api/config'
import { fetchWithSupabaseAuth } from '../../shared/query/fetchWithSupabaseAuth'
import { fetchPosApi } from '../../shared/api/posClient'
import { fetchReservationsApi } from '../../shared/api/reservationsClient'
import { useAuth } from '../../auth'
import type { Restaurant } from '@shire/db'
import { isResumableOnboardingRestaurant } from '../onboardingRestaurantState.js'
import {
  onboardingResumePath,
  readOnboardingRoute,
  resolveOnboardingTargetId,
} from '../onboardingRoute.js'

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
  ein_configured: boolean
  ein_last4: string | null
  legal_contact_name: string
  legal_contact_title: string
  legal_contact_email: string
  legal_contact_phone: string
  tos_signature_data_url: string | null
  tos_signed_at: string | null
  signature_configured: boolean

  // Step 2: Payments & Processing
  bank_account_holder: string
  bank_name: string
  bank_routing_number: string
  bank_routing_configured: boolean
  bank_routing_last4: string | null
  bank_account_number: string
  bank_account_configured: boolean
  bank_account_last4: string | null
  payout_schedule: 'daily' | 'weekly' | 'manual'
  refund_funding_source: 'processor_balance' | 'bank_account'
  batch_close_mode: 'automatic' | 'manual'
  batch_close_time: string
  credit_card_tip_payout: 'nightly' | 'payroll'
  refund_approval_threshold: string
  pricing_policy: PricingPolicyData

  // Step 3: Taxes & Charges
  tax_rates: TaxRateData[]
  enabled_tax_classes: string[]
  service_charges: ServiceChargeData[]
  auto_gratuity: AutoGratuityData
  tax_category_assignments?: CategoryTaxAssignmentData[]

  // Step 4: Discounts, Comps & Promos
  discount_rules: DiscountRuleData[]

  // Step 5: Manager Controls
  role_permissions: RolePermissionData[]

  // Step 6: Cash & Closeout
  closeout_settings: CloseoutSettingsData

  // Step 7: Check Workflow
  check_workflow_settings: CheckWorkflowSettingsData

  // Step 8: Tips & Payroll
  job_codes: JobCodeData[]
  tip_payroll_settings: TipPayrollSettingsData

  // Step 9: Goals & Priorities
  challenges: string[]
  daily_covers_range: string | null
  team_size_range: string | null
  primary_goal: string | null

  // Step 10: Current Tools & Service Model
  current_pos: string | null
  current_scheduling: string | null
  current_reservations: string | null
  service_modes: string[]
  default_guest_flow: string | null

  // Step 11: Sections & Areas
  sections: string[]
  section_behaviors: SectionBehaviorData[]

  // Step 12: Hours
  operating_hours: OperatingHoursData[]
  same_hours_every_day: boolean

  // Step 13: Reservation Timing
  public_slug: string
  canonical_booking_url: string | null
  reservation_timing_same_for_channels: boolean
  reservation_online_booking_horizon_days: string
  reservation_online_lead_time_minutes: string
  reservation_online_grace_period_minutes: string
  reservation_staff_booking_horizon_days: string
  reservation_staff_lead_time_minutes: string
  reservation_staff_grace_period_minutes: string
  reservation_slot_interval_minutes: string
  reservation_min_party_size: string
  reservation_max_party_size: string
  reservation_default_duration_minutes: string
  reservation_windows_follow_operating_hours: boolean

  // Step 14: Capacity
  seating_capacity: number | null
  table_count: number | null

  // Step 14: Menu
  menu_categories: MenuCategoryData[]

  // Step 15: Menu
  menu_import_method: 'skip' | 'manual' | 'upload' | 'toast' | 'scrape' | 'template'

  // Step 18: Team
  team_setup_method: 'skip' | 'invite' | 'sevenshifts'
  invites: TeamInvite[]
}

export interface PricingPolicyData {
  version: number
  enabled: boolean
  mode: 'dual_pricing_posted_electronic' | 'cash_discount' | 'credit_surcharge' | 'service_fee_all' | 'none'
  rate: number
  basis: 'subtotal' | 'subtotal_plus_tax'
  listed_price_basis: 'cash' | 'electronic'
  display_order: 'cash_first' | 'electronic_first'
  applies_to: string[]
  jurisdiction_state: string
  label: string
  disclosure: string
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

const defaultJobCodes = (): JobCodeData[] => [
  { code: 'owner', label: 'Owner', permission_tier: 'owner', default_hourly_rate: '', is_tipped: false, tipout_role: '', sort_order: 10, is_active: true },
  { code: 'manager', label: 'Manager', permission_tier: 'manager', default_hourly_rate: '', is_tipped: false, tipout_role: '', sort_order: 20, is_active: true },
  { code: 'server', label: 'Server', permission_tier: 'waiter', default_hourly_rate: '', is_tipped: true, tipout_role: 'server', sort_order: 30, is_active: true },
  { code: 'bartender', label: 'Bartender', permission_tier: 'waiter', default_hourly_rate: '', is_tipped: true, tipout_role: 'bartender', sort_order: 40, is_active: true },
  { code: 'host', label: 'Host', permission_tier: 'normal', default_hourly_rate: '', is_tipped: false, tipout_role: 'host', sort_order: 50, is_active: true },
  { code: 'runner', label: 'Runner', permission_tier: 'normal', default_hourly_rate: '', is_tipped: true, tipout_role: 'runner', sort_order: 60, is_active: true },
  { code: 'busser', label: 'Busser', permission_tier: 'normal', default_hourly_rate: '', is_tipped: true, tipout_role: 'busser', sort_order: 70, is_active: true },
  { code: 'kitchen', label: 'Kitchen', permission_tier: 'normal', default_hourly_rate: '', is_tipped: false, tipout_role: 'kitchen', sort_order: 80, is_active: true },
]

const defaultOnboardingTipPayrollSettings = (): TipPayrollSettingsData => ({
  ...defaultTipPayrollSettings(defaultJobCodes()),
  expected_drawer_payouts_enabled: true,
  credit_tip_payout_timing: 'nightly',
  card_employee_gratuity_payout_timing: 'nightly',
})

const defaultPricingPolicy = (): PricingPolicyData => ({
  version: 0,
  enabled: true,
  mode: 'dual_pricing_posted_electronic',
  rate: 0.035,
  basis: 'subtotal_plus_tax',
  listed_price_basis: 'electronic',
  display_order: 'cash_first',
  applies_to: ['card', 'credit', 'debit', 'terminal', 'gift_card', 'standalone', 'external'],
  jurisdiction_state: 'SC',
  label: 'Dual pricing',
  disclosure: 'Cash and electronic prices are shown before payment. The final receipt reflects the selected payment method.',
})

const normalizePricingPolicy = (value: unknown): PricingPolicyData => {
  const fallback = defaultPricingPolicy()
  const row = isRecord(value) ? value : {}
  const mode = ['dual_pricing_posted_electronic', 'cash_discount', 'credit_surcharge', 'service_fee_all', 'none'].includes(asString(row.mode))
    ? asString(row.mode) as PricingPolicyData['mode']
    : fallback.mode
  return {
    version: Number.isInteger(Number(row.version)) ? Math.max(0, Number(row.version)) : 0,
    enabled: typeof row.enabled === 'boolean' ? row.enabled : fallback.enabled,
    mode,
    rate: Number.isFinite(Number(row.rate)) ? Number(row.rate) : fallback.rate,
    basis: row.basis === 'subtotal' ? 'subtotal' : 'subtotal_plus_tax',
    listed_price_basis: row.listed_price_basis === 'cash' ? 'cash' : 'electronic',
    display_order: row.display_order === 'electronic_first' ? 'electronic_first' : 'cash_first',
    applies_to: asStringArray(row.applies_to).length ? asStringArray(row.applies_to) : fallback.applies_to,
    jurisdiction_state: asString(row.jurisdiction_state, fallback.jurisdiction_state).toUpperCase().slice(0, 2),
    label: asString(row.label, fallback.label),
    disclosure: asString(row.disclosure, fallback.disclosure),
  }
}

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
  ein_configured: false,
  ein_last4: null,
  legal_contact_name: '',
  legal_contact_title: '',
  legal_contact_email: '',
  legal_contact_phone: '',
  tos_signature_data_url: null,
  tos_signed_at: null,
  signature_configured: false,

  bank_account_holder: '',
  bank_name: '',
  bank_routing_number: '',
  bank_routing_configured: false,
  bank_routing_last4: null,
  bank_account_number: '',
  bank_account_configured: false,
  bank_account_last4: null,
  payout_schedule: 'daily',
  refund_funding_source: 'processor_balance',
  batch_close_mode: 'automatic',
  batch_close_time: '04:00',
  credit_card_tip_payout: 'payroll',
  refund_approval_threshold: '',
  pricing_policy: defaultPricingPolicy(),

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
  enabled_tax_classes: ['prepared_food'],
  service_charges: [],
  auto_gratuity: defaultAutoGratuity(),
  tax_category_assignments: undefined,
  discount_rules: [],
  role_permissions: defaultRolePermissions(defaultJobCodes()),
  closeout_settings: defaultCloseoutSettings(),
  check_workflow_settings: defaultCheckWorkflowSettings(),
  job_codes: defaultJobCodes(),
  tip_payroll_settings: defaultOnboardingTipPayrollSettings(),

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

  reservation_timing_same_for_channels: true,
  public_slug: '',
  canonical_booking_url: null,
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

  seating_capacity: null,
  table_count: null,
  sections: ['Table', 'Main Floor', 'Bar', 'Patio'],
  section_behaviors: [],

  menu_categories: defaultMenuCategories(),
  menu_import_method: 'skip',

  team_setup_method: 'skip',
  invites: [],
}

const ONBOARDING_MAX_STEP = 21
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

const asNullableNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

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

const asConfigString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
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

const taxesChargesToPayload = (data: OnboardingData) => {
  const { tax_rates: _taxRates, category_assignments: _assignments, ...chargesOnly } = taxesChargesPayload(
    data.tax_rates,
    data.service_charges,
    data.auto_gratuity,
    data.tax_category_assignments,
  )
  return chargesOnly
}

const discountRulesToPayload = (data: OnboardingData) => discountRulesPayload(data.discount_rules)

const managerControlsToPayload = (data: OnboardingData) => managerControlsPayload(data.role_permissions, data.job_codes)

const closeoutSettingsToPayload = (data: OnboardingData) => closeoutSettingsPayload(data.closeout_settings)

const checkWorkflowSettingsToPayload = (data: OnboardingData) => checkWorkflowSettingsPayload(data.check_workflow_settings)

const tipPayrollToPayload = (data: OnboardingData) => tipPayrollPayload(data.tip_payroll_settings, data.job_codes)

const validateMenuCategories = (categories: MenuCategoryData[]) => {
  const blankIndex = normalizeMenuCategories(categories).findIndex(row => !row.name.trim())
  if (blankIndex >= 0) {
    throw new Error(`Menu category ${blankIndex + 1} needs a name. Use Remove to delete it.`)
  }
}

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
    ein_configured: Boolean(input.ein_configured),
    ein_last4: asNullableString(input.ein_last4),
    legal_contact_name: asString(input.legal_contact_name),
    legal_contact_title: asString(input.legal_contact_title),
    legal_contact_email: asString(input.legal_contact_email),
    legal_contact_phone: asString(input.legal_contact_phone),
    tos_signature_data_url: asNullableString(input.tos_signature_data_url),
    tos_signed_at: asNullableString(input.tos_signed_at),
    signature_configured: Boolean(input.signature_configured),
    bank_account_holder: asString(input.bank_account_holder),
    bank_name: asString(input.bank_name),
    bank_routing_number: asString(input.bank_routing_number),
    bank_routing_configured: Boolean(input.bank_routing_configured),
    bank_routing_last4: asNullableString(input.bank_routing_last4),
    bank_account_number: asString(input.bank_account_number),
    bank_account_configured: Boolean(input.bank_account_configured),
    bank_account_last4: asNullableString(input.bank_account_last4),
    payout_schedule: asEnum(input.payout_schedule, PAYOUT_SCHEDULES, INITIAL_DATA.payout_schedule),
    refund_funding_source: asEnum(input.refund_funding_source, REFUND_FUNDING_SOURCES, INITIAL_DATA.refund_funding_source),
    batch_close_mode: asEnum(input.batch_close_mode, BATCH_CLOSE_MODES, INITIAL_DATA.batch_close_mode),
    batch_close_time: asString(input.batch_close_time, INITIAL_DATA.batch_close_time),
    credit_card_tip_payout: asEnum(input.credit_card_tip_payout, CREDIT_CARD_TIP_PAYOUTS, INITIAL_DATA.credit_card_tip_payout),
    refund_approval_threshold: asString(input.refund_approval_threshold),
    pricing_policy: normalizePricingPolicy(input.pricing_policy),
    tax_rates: normalizeTaxRates(input.tax_rates),
    enabled_tax_classes: asStringArray(input.enabled_tax_classes).length
      ? asStringArray(input.enabled_tax_classes)
      : INITIAL_DATA.enabled_tax_classes,
    service_charges: normalizeServiceCharges(input.service_charges),
    auto_gratuity: normalizeAutoGratuity(input.auto_gratuity),
    tax_category_assignments: Array.isArray(input.tax_category_assignments)
      ? normalizeCategoryTaxAssignments(input.tax_category_assignments)
      : undefined,
    menu_categories: normalizeMenuCategories(input.menu_categories),
    discount_rules: normalizeDiscountRules(input.discount_rules),
    role_permissions: normalizeRolePermissions(input.role_permissions, normalizeJobCodes(input.job_codes)),
    closeout_settings: normalizeCloseoutSettings(input.closeout_settings),
    check_workflow_settings: normalizeCheckWorkflowSettings(input.check_workflow_settings),
    job_codes: normalizeJobCodes(input.job_codes),
    tip_payroll_settings: normalizeTipPayrollSettings(input.tip_payroll_settings, normalizeJobCodes(input.job_codes)),
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
    reservation_timing_same_for_channels:
      typeof input.reservation_timing_same_for_channels === 'boolean'
        ? input.reservation_timing_same_for_channels
        : INITIAL_DATA.reservation_timing_same_for_channels,
    public_slug: asString(input.public_slug, INITIAL_DATA.public_slug),
    canonical_booking_url: asNullableString(input.canonical_booking_url),
    reservation_online_booking_horizon_days: asString(input.reservation_online_booking_horizon_days, INITIAL_DATA.reservation_online_booking_horizon_days),
    reservation_online_lead_time_minutes: asString(input.reservation_online_lead_time_minutes, INITIAL_DATA.reservation_online_lead_time_minutes),
    reservation_online_grace_period_minutes: asString(input.reservation_online_grace_period_minutes, INITIAL_DATA.reservation_online_grace_period_minutes),
    reservation_staff_booking_horizon_days: asString(input.reservation_staff_booking_horizon_days, INITIAL_DATA.reservation_staff_booking_horizon_days),
    reservation_staff_lead_time_minutes: asString(input.reservation_staff_lead_time_minutes, INITIAL_DATA.reservation_staff_lead_time_minutes),
    reservation_staff_grace_period_minutes: asString(input.reservation_staff_grace_period_minutes, INITIAL_DATA.reservation_staff_grace_period_minutes),
    reservation_slot_interval_minutes: asString(input.reservation_slot_interval_minutes, INITIAL_DATA.reservation_slot_interval_minutes),
    reservation_min_party_size: asString(input.reservation_min_party_size, INITIAL_DATA.reservation_min_party_size),
    reservation_max_party_size: asString(input.reservation_max_party_size, INITIAL_DATA.reservation_max_party_size),
    reservation_default_duration_minutes: asString(input.reservation_default_duration_minutes, INITIAL_DATA.reservation_default_duration_minutes),
    reservation_windows_follow_operating_hours:
      typeof input.reservation_windows_follow_operating_hours === 'boolean'
        ? input.reservation_windows_follow_operating_hours
        : INITIAL_DATA.reservation_windows_follow_operating_hours,
    seating_capacity: asNullableNumber(input.seating_capacity),
    table_count: asNullableNumber(input.table_count),
    sections,
    section_behaviors: normalizeSectionProfiles(input.section_behaviors, sections),
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

const withoutSensitiveDraftValues = (data: Partial<OnboardingData>): Partial<OnboardingData> => ({
  ...data,
  ein: '',
  tos_signature_data_url: null,
  bank_account_holder: '',
  bank_name: '',
  bank_routing_number: '',
  bank_account_number: '',
})

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
      data: withoutSensitiveDraftValues(
        isRecord(parsed.data) ? parsed.data as Partial<OnboardingData> : {},
      ),
      updatedAt: asString(parsed.updatedAt, new Date(0).toISOString()),
    }
  } catch {
    return null
  }
}

const writeDraft = (userId: string, draft: OnboardingDraft) => {
  try {
    localStorage.setItem(getDraftStorageKey(userId), JSON.stringify({
      ...draft,
      data: withoutSensitiveDraftValues(draft.data),
    }))
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
    ein_configured: Boolean(value.ein),
    ein_last4: asString(value.ein).replace(/\D/g, '').slice(-4) || null,
    legal_contact_name: asString(value.legal_contact_name),
    legal_contact_title: asString(value.legal_contact_title),
    legal_contact_email: asString(value.legal_contact_email),
    legal_contact_phone: asString(value.legal_contact_phone),
    tos_signature_data_url: asNullableString(value.tos_signature_data_url),
    tos_signed_at: asNullableString(value.tos_signed_at),
    signature_configured: Boolean(value.tos_signature_data_url),
    bank_account_holder: asString(value.bank_account_holder),
    bank_name: asString(value.bank_name),
    bank_routing_number: asString(value.bank_routing_number),
    bank_routing_configured: Boolean(value.bank_routing_number),
    bank_routing_last4: asString(value.bank_routing_number).replace(/\D/g, '').slice(-4) || null,
    bank_account_number: asString(value.bank_account_number),
    bank_account_configured: Boolean(value.bank_account_number),
    bank_account_last4: asString(value.bank_account_number).replace(/\D/g, '').slice(-4) || null,
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
    reservation_timing_same_for_channels:
      typeof value.reservation_timing_same_for_channels === 'boolean'
        ? value.reservation_timing_same_for_channels
        : undefined,
    reservation_online_booking_horizon_days: asString(value.reservation_online_booking_horizon_days, INITIAL_DATA.reservation_online_booking_horizon_days),
    reservation_online_lead_time_minutes: asString(value.reservation_online_lead_time_minutes, INITIAL_DATA.reservation_online_lead_time_minutes),
    reservation_online_grace_period_minutes: asString(value.reservation_online_grace_period_minutes, INITIAL_DATA.reservation_online_grace_period_minutes),
    reservation_staff_booking_horizon_days: asString(value.reservation_staff_booking_horizon_days, INITIAL_DATA.reservation_staff_booking_horizon_days),
    reservation_staff_lead_time_minutes: asString(value.reservation_staff_lead_time_minutes, INITIAL_DATA.reservation_staff_lead_time_minutes),
    reservation_staff_grace_period_minutes: asString(value.reservation_staff_grace_period_minutes, INITIAL_DATA.reservation_staff_grace_period_minutes),
    reservation_slot_interval_minutes: asString(value.reservation_slot_interval_minutes, INITIAL_DATA.reservation_slot_interval_minutes),
    reservation_min_party_size: asString(value.reservation_min_party_size, INITIAL_DATA.reservation_min_party_size),
    reservation_max_party_size: asString(value.reservation_max_party_size, INITIAL_DATA.reservation_max_party_size),
    reservation_default_duration_minutes: asString(value.reservation_default_duration_minutes, INITIAL_DATA.reservation_default_duration_minutes),
    reservation_windows_follow_operating_hours:
      typeof value.reservation_windows_follow_operating_hours === 'boolean'
        ? value.reservation_windows_follow_operating_hours
        : undefined,
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

const clampInteger = (value: string, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

const reservationTimingPatch = (data: OnboardingData) => {
  const validationError = reservationTimingError(data)
  if (validationError) throw new Error(validationError)
  const slotIntervalMinutes = clampInteger(data.reservation_slot_interval_minutes, 15, 5, 180)
  const minPartySize = clampInteger(data.reservation_min_party_size, 1, 1, 99)
  const requestedMaxPartySize = clampInteger(data.reservation_max_party_size, 10, 1, 99)
  const maxPartySize = Math.max(minPartySize, requestedMaxPartySize)
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

const reservationDayOfWeek = (operatingDayOfWeek: number): number => (Number(operatingDayOfWeek) + 6) % 7

const servicePeriodsFromOperatingHours = (
  data: OnboardingData,
  existingPeriods: Record<string, unknown>[] = []
): Record<string, unknown>[] => {
  const patch = reservationTimingPatch(data)
  const existingByDay = new Map(
    existingPeriods
      .filter(period => typeof period.dayOfWeek === 'number')
      .map(period => [Number(period.dayOfWeek), period])
  )
  return data.operating_hours.map(hours => {
    const dayOfWeek = reservationDayOfWeek(hours.day_of_week)
    const existing = existingByDay.get(dayOfWeek)
    return {
      id: typeof existing?.id === 'string' ? existing.id : undefined,
      name: dayOfWeek >= 4 ? 'Weekend Reservations' : 'Reservations',
      dayOfWeek,
      startTime: `${hours.open_time}:00`,
      endTime: `${hours.close_time}:00`,
      slotIntervalMinutes: Number(patch.reservation_slot_interval_minutes),
      leadTimeMinutes: Number(patch.reservation_staff_lead_time_minutes),
      minPartySize: Number(patch.reservation_min_party_size),
      maxPartySize: Number(patch.reservation_max_party_size),
      defaultDurationMinutes: Number(patch.reservation_default_duration_minutes),
      active: !hours.is_closed,
    }
  })
}

const applyReservationPeriodDefaults = (
  periods: Record<string, unknown>[],
  data: OnboardingData
): Record<string, unknown>[] => {
  const patch = reservationTimingPatch(data)
  return periods.map(period => ({
    ...period,
    slotIntervalMinutes: Number(patch.reservation_slot_interval_minutes),
    minPartySize: Number(patch.reservation_min_party_size),
    maxPartySize: Number(patch.reservation_max_party_size),
    defaultDurationMinutes: Number(patch.reservation_default_duration_minutes),
  }))
}

const numericValues = (records: Record<string, unknown>[], field: string): number[] =>
  records
    .map(record => Number(record[field]))
    .filter(Number.isFinite)

const firstNumericValue = (
  records: Record<string, unknown>[],
  field: string,
  fallback: string
): string => {
  const value = numericValues(records, field)[0]
  return Number.isFinite(value) ? String(value) : fallback
}

const fetchReservationSettings = async (restaurantId: string): Promise<Record<string, unknown> | null> => {
  try {
    const body = await fetchReservationsApi<unknown>(`/locations/${restaurantId}/reservation-settings`)
    return isRecord(body) ? body : null
  } catch (err) {
    console.warn('[Onboarding] Could not load reservation timing:', err)
    return null
  }
}

const saveReservationSettings = async (restaurantId: string, data: OnboardingData): Promise<void> => {
  const patch = reservationTimingPatch(data)
  const currentSettings = await fetchReservationSettings(restaurantId)
  const existingPeriods = Array.isArray(currentSettings?.servicePeriods)
    ? currentSettings.servicePeriods.filter(isRecord)
    : []
  const servicePeriods = data.reservation_windows_follow_operating_hours
    ? servicePeriodsFromOperatingHours(data, existingPeriods)
    : existingPeriods.length > 0
      ? applyReservationPeriodDefaults(existingPeriods, data)
      : servicePeriodsFromOperatingHours(data, existingPeriods)
  await fetchReservationsApi(`/locations/${restaurantId}/reservation-settings`, {
    method: 'PUT',
    body: JSON.stringify({
      bookingHorizonDays: Number(patch.reservation_online_booking_horizon_days),
      gracePeriodMinutes: Number(patch.reservation_online_grace_period_minutes),
      defaultSlotIntervalMinutes: Number(patch.reservation_slot_interval_minutes),
      servicePeriods,
      timingPolicies: patch.timingPolicies,
    }),
  })
}

const reservationTimingFromSettings = (settings: Record<string, unknown> | null): Partial<OnboardingData> => {
  if (!settings) return {}
  const servicePeriods = Array.isArray(settings.servicePeriods)
    ? settings.servicePeriods.filter(isRecord)
    : []
  const minPartyValues = numericValues(servicePeriods, 'minPartySize')
  const maxPartyValues = numericValues(servicePeriods, 'maxPartySize')
  const timingPolicies = isRecord(settings.timingPolicies) ? settings.timingPolicies : {}
  const online = isRecord(timingPolicies.online) ? timingPolicies.online : {}
  const staff = isRecord(timingPolicies.staff) ? timingPolicies.staff : {}
  const onlinePatch = {
    reservation_online_booking_horizon_days: asConfigString(online.bookingHorizonDays, asConfigString(settings.bookingHorizonDays, INITIAL_DATA.reservation_online_booking_horizon_days)),
    reservation_online_lead_time_minutes: asConfigString(online.leadTimeMinutes, INITIAL_DATA.reservation_online_lead_time_minutes),
    reservation_online_grace_period_minutes: asConfigString(online.gracePeriodMinutes, asConfigString(settings.gracePeriodMinutes, INITIAL_DATA.reservation_online_grace_period_minutes)),
  }
  const staffPatch = {
    reservation_staff_booking_horizon_days: asConfigString(staff.bookingHorizonDays, onlinePatch.reservation_online_booking_horizon_days),
    reservation_staff_lead_time_minutes: asConfigString(staff.leadTimeMinutes, onlinePatch.reservation_online_lead_time_minutes),
    reservation_staff_grace_period_minutes: asConfigString(staff.gracePeriodMinutes, onlinePatch.reservation_online_grace_period_minutes),
  }
  return {
    ...onlinePatch,
    ...staffPatch,
    reservation_slot_interval_minutes: asConfigString(settings.defaultSlotIntervalMinutes, INITIAL_DATA.reservation_slot_interval_minutes),
    reservation_min_party_size: minPartyValues.length ? String(Math.min(...minPartyValues)) : INITIAL_DATA.reservation_min_party_size,
    reservation_max_party_size: maxPartyValues.length ? String(Math.max(...maxPartyValues)) : INITIAL_DATA.reservation_max_party_size,
    reservation_default_duration_minutes: firstNumericValue(servicePeriods, 'defaultDurationMinutes', INITIAL_DATA.reservation_default_duration_minutes),
    reservation_timing_same_for_channels:
      onlinePatch.reservation_online_booking_horizon_days === staffPatch.reservation_staff_booking_horizon_days &&
      onlinePatch.reservation_online_lead_time_minutes === staffPatch.reservation_staff_lead_time_minutes &&
      onlinePatch.reservation_online_grace_period_minutes === staffPatch.reservation_staff_grace_period_minutes,
  }
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

const fetchPricingPolicy = async (restaurantId: string) => {
  const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/pricing-policy`, {
    headers: await getApiHeaders(),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(asString(body.detail) || asString(body.message) || `Loading pricing policy failed (${response.status})`)
  }
  return response.json()
}

const fetchSections = async (restaurantId: string) => {
  const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/sections`, {
    headers: await getApiHeaders(),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(asString(body.detail) || asString(body.message) || `Loading sections failed (${response.status})`)
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

const fetchMenuCategories = async (restaurantId: string) => {
  const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/menu/categories`, {
    headers: await getApiHeaders(),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(asString(body.detail) || asString(body.message) || `Loading menu categories failed (${response.status})`)
  }
  return response.json()
}

const fetchManagerControls = async (restaurantId: string) => {
  const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/manager-controls`, {
    headers: await getApiHeaders(),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(asString(body.detail) || asString(body.message) || `Loading manager controls failed (${response.status})`)
  }
  return response.json()
}

const fetchCloseoutSettings = async (restaurantId: string) => {
  const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/closeout-settings`, {
    headers: await getApiHeaders(),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(asString(body.detail) || asString(body.message) || `Loading closeout settings failed (${response.status})`)
  }
  return response.json()
}

const fetchCheckWorkflowSettings = async (restaurantId: string) => {
  const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/check-workflow-settings`, {
    headers: await getApiHeaders(),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(asString(body.detail) || asString(body.message) || `Loading check workflow settings failed (${response.status})`)
  }
  return response.json()
}

const fetchJobCodes = async (restaurantId: string) => {
  return fetchPosApi(restaurantId, `/restaurants/${restaurantId}/job-codes`)
}

const fetchTipPayrollSettings = async (restaurantId: string) => {
  return fetchPosApi(
    restaurantId,
    `/restaurants/${restaurantId}/tips-payroll-settings`,
  )
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

const savePublicSlug = async (restaurantId: string, slug: string) => {
  const normalized = slugify(slug)
  if (!normalized) return null
  return fetchWithSupabaseAuth<{
    public_slug?: string
    publicSlug?: string
    canonical_booking_url?: string
    canonicalBookingUrl?: string
  }>(
    `/locations/${restaurantId}/public-slug`,
    {
      method: 'PATCH',
      body: JSON.stringify({ public_slug: normalized }),
    }
  )
}

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message
  if (isRecord(error)) {
    const message = asString(error.message).trim()
    if (message) return message
  }
  return fallback
}

const getRequiredBasicsIssues = (data: OnboardingData): OnboardingValidationIssue[] => {
  const issues: OnboardingValidationIssue[] = []

  if (!data.name.trim()) {
    issues.push({
      field: 'name',
      message: 'Restaurant name is required.',
    })
  }

  for (const [field, label, value] of [
    ['address', 'Street address', data.address],
    ['city', 'City', data.city],
    ['state', 'State', data.state],
    ['postal_code', 'ZIP code', data.postal_code],
  ] as const) {
    if (!value.trim()) issues.push({ field, message: `${label} is required.` })
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
  const isAuthLoading = auth.isLoading
  const isRestaurantLoading = auth.restaurant.isLoading
  const navigate = useNavigate()
  const location = useLocation()
  const isSetupEditor = /^\/(?:reseller\/)?restaurants\/[^/]+\/setup\/?$/.test(location.pathname)
  const {
    isNewRestaurantFlow,
    isRestaurantSetupResume,
    requestedRestaurantId,
  } = readOnboardingRoute(location.pathname, location.search)
  const requestedResumeRestaurant = isRestaurantSetupResume && requestedRestaurantId
    ? auth.restaurant.restaurants.find(restaurant => restaurant.id === requestedRestaurantId) ?? null
    : null
  const resumeRestaurant = isResumableOnboardingRestaurant(requestedResumeRestaurant)
    ? requestedResumeRestaurant
    : null
  const shouldUseCurrentRestaurant = !isNewRestaurantFlow && !isRestaurantSetupResume
  const selectedOnboardingRestaurant =
    (isSetupEditor || isResumableOnboardingRestaurant(currentRestaurant))
      ? currentRestaurant
      : null
  const routeRestaurant = isRestaurantSetupResume
    ? resumeRestaurant
    : selectedOnboardingRestaurant
  const currentRestaurantStep = isSetupEditor ? null : routeRestaurant?.onboarding_step
  const currentRestaurantUpdatedAt = isSetupEditor ? null : routeRestaurant?.updated_at

  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<OnboardingData>(toOnboardingData(INITIAL_DATA))
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLaunchScreen, setShowLaunchScreen] = useState(false)
  const [isHydrating, setIsHydrating] = useState(true)

  const activeRestaurantId = resolveOnboardingTargetId({
    isNewRestaurantFlow,
    isRestaurantSetupResume,
    requestedRestaurantId,
    validatedResumeRestaurantId: resumeRestaurant?.id || null,
    stateRestaurantId: restaurantId,
    currentRestaurantId: shouldUseCurrentRestaurant ? selectedOnboardingRestaurant?.id || null : null,
  })
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
    const [hoursResult, sectionsResult, taxesChargesResult, pricingPolicyResult, discountRulesResult, menuCategoriesResult, managerControlsResult, closeoutSettingsResult, checkWorkflowResult, jobCodesResult, tipPayrollResult, sensitiveSettingsResult, reservationSettingsResult] = await Promise.all([
      runWithTimeout(
        () =>
          supabase
            .from('operating_hours')
            .select('day_of_week, open_time, close_time, is_closed')
            .eq('restaurant_id', restaurant.id),
        'Loading operating hours timed out.'
      ),
      runWithTimeout(
        () => fetchSections(restaurant.id),
        'Loading sections timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate sections:', err)
        return []
      }),
      runWithTimeout(
        () => fetchTaxesCharges(restaurant.id),
        'Loading taxes and charges timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate taxes and charges:', err)
        return null
      }),
      runWithTimeout(
        () => fetchPricingPolicy(restaurant.id),
        'Loading pricing policy timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate pricing policy:', err)
        return null
      }),
      runWithTimeout(
        () => fetchDiscountRules(restaurant.id),
        'Loading discounts timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate discounts:', err)
        return null
      }),
      runWithTimeout(
        () => fetchMenuCategories(restaurant.id),
        'Loading menu categories timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate menu categories:', err)
        return null
      }),
      runWithTimeout(
        () => fetchManagerControls(restaurant.id),
        'Loading manager controls timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate manager controls:', err)
        return null
      }),
      runWithTimeout(
        () => fetchCloseoutSettings(restaurant.id),
        'Loading closeout settings timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate closeout settings:', err)
        return null
      }),
      runWithTimeout(
        () => fetchCheckWorkflowSettings(restaurant.id),
        'Loading check workflow settings timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate check workflow settings:', err)
        return null
      }),
      runWithTimeout(
        () => fetchJobCodes(restaurant.id),
        'Loading roles timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate roles:', err)
        return []
      }),
      runWithTimeout(
        () => fetchTipPayrollSettings(restaurant.id),
        'Loading tips and payroll timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate tips and payroll:', err)
        return null
      }),
      runWithTimeout(
        () => fetchWithSupabaseAuth<Record<string, unknown>>(`/restaurants/${restaurant.id}/sensitive-settings`),
        'Loading protected legal and bank settings timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate protected legal and bank settings:', err)
        return null
      }),
      runWithTimeout(
        () => fetchReservationSettings(restaurant.id),
        'Loading reservation timing timed out.'
      ).catch(err => {
        console.warn('[Onboarding] Could not hydrate reservation timing:', err)
        return null
      }),
    ])

    if (hoursResult.error) {
      console.warn('[Onboarding] Could not hydrate operating hours:', hoursResult.error.message)
    }
    const sectionRows = Array.isArray(sectionsResult) ? sectionsResult : []
    const sectionNames = normalizeSectionNames(asStringArray(sectionRows.map(section => isRecord(section) ? section.name : null)))
    const configData = parseConfig(restaurant.config)
    const sensitiveData: Partial<OnboardingData> = isRecord(sensitiveSettingsResult) ? {
      ein: '',
      ein_configured: Boolean(sensitiveSettingsResult.ein_configured),
      ein_last4: asNullableString(sensitiveSettingsResult.ein_last4),
      tos_signature_data_url: null,
      tos_signed_at: asNullableString(sensitiveSettingsResult.tos_signed_at),
      signature_configured: Boolean(sensitiveSettingsResult.signature_configured),
      bank_account_holder: asString(sensitiveSettingsResult.bank_account_holder),
      bank_name: asString(sensitiveSettingsResult.bank_name),
      bank_routing_number: '',
      bank_routing_configured: Boolean(sensitiveSettingsResult.bank_routing_configured),
      bank_routing_last4: asNullableString(sensitiveSettingsResult.bank_routing_last4),
      bank_account_number: '',
      bank_account_configured: Boolean(sensitiveSettingsResult.bank_account_configured),
      bank_account_last4: asNullableString(sensitiveSettingsResult.bank_account_last4),
    } : {}
    const jobCodes = normalizeJobCodes(jobCodesResult)

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
      public_slug: asString(restaurant.public_slug || restaurant.slug),
      canonical_booking_url: restaurant.public_slug ? `/book/${restaurant.public_slug}` : null,
      seating_capacity: restaurant.seating_capacity,
      table_count: restaurant.table_count,
      operating_hours: normalizeOperatingHours(hoursResult.data),
      sections: sectionNames.length > 0 ? sectionNames : INITIAL_DATA.sections,
      section_behaviors: normalizeSectionProfiles(sectionRows, sectionNames),
      tax_rates: normalizeTaxRates(isRecord(taxesChargesResult) ? taxesChargesResult.tax_rates : []),
      enabled_tax_classes: asStringArray(
        isRecord(taxesChargesResult) && isRecord(taxesChargesResult.tax_profile)
          ? taxesChargesResult.tax_profile.enabled_tax_classes
          : [],
      ).length
        ? asStringArray((taxesChargesResult as Record<string, any>).tax_profile?.enabled_tax_classes)
        : INITIAL_DATA.enabled_tax_classes,
      service_charges: normalizeServiceCharges(isRecord(taxesChargesResult) ? taxesChargesResult.service_charges : []),
      auto_gratuity: normalizeAutoGratuity(isRecord(taxesChargesResult) ? taxesChargesResult.auto_gratuity : null),
      pricing_policy: normalizePricingPolicy(pricingPolicyResult),
      discount_rules: normalizeDiscountRules(isRecord(discountRulesResult) ? discountRulesResult.discount_rules : []),
      menu_categories: normalizeMenuCategories(isRecord(menuCategoriesResult) ? menuCategoriesResult.categories : []),
      role_permissions: normalizeRolePermissions(isRecord(managerControlsResult) ? managerControlsResult.role_permissions : [], jobCodes),
      closeout_settings: normalizeCloseoutSettings(closeoutSettingsResult),
      check_workflow_settings: normalizeCheckWorkflowSettings(checkWorkflowResult),
      job_codes: jobCodes,
      ...configData,
      ...sensitiveData,
      tip_payroll_settings: normalizeTipPayrollSettings(tipPayrollResult, jobCodes),
      ...reservationTimingFromSettings(reservationSettingsResult),
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
      if (isAuthLoading) {
        if (!cancelled) {
          setIsHydrating(true)
        }
        return
      }

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

      const localDraft = isSetupEditor ? null : readDraft(user.id)
      const newFlowCreatedRestaurant =
        isNewRestaurantFlow &&
        restaurantId &&
        currentRestaurant?.id === restaurantId &&
        isResumableOnboardingRestaurant(currentRestaurant)
          ? currentRestaurant
          : null

      const candidateRestaurant = isRestaurantSetupResume
        ? resumeRestaurant
        : shouldUseCurrentRestaurant
          ? selectedOnboardingRestaurant
          : newFlowCreatedRestaurant
      const onboardingRestaurant =
        candidateRestaurant &&
        (isSetupEditor || isResumableOnboardingRestaurant(candidateRestaurant))
          ? candidateRestaurant
          : null
      const shouldApplyLocalDraft = Boolean(
        localDraft &&
        (isNewRestaurantFlow
          ? !localDraft.restaurantId
          : Boolean(onboardingRestaurant && onboardingRestaurant.id === localDraft.restaurantId))
      )
      if (localDraft && shouldApplyLocalDraft) {
        mergedData = mergeOnboardingData(mergedData, localDraft.data)
        resolvedRestaurantId = localDraft.restaurantId
        resolvedStep = localDraft.currentStep
      }

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
    isAuthLoading,
    isRestaurantLoading,
    routeRestaurant?.id,
    currentRestaurantStep,
    currentRestaurantUpdatedAt,
    routeRestaurant?.onboarding_completed_at,
    restaurantId,
    shouldUseCurrentRestaurant,
    isSetupEditor,
    isNewRestaurantFlow,
    isRestaurantSetupResume,
    requestedRestaurantId,
    resumeRestaurant,
    hydrateFromRestaurant,
  ])

  // Persist in-progress onboarding draft for refresh resilience.
  useEffect(() => {
    if (isSetupEditor) return
    if (!user || isAuthLoading || isRestaurantLoading || isHydrating) return

    writeDraft(user.id, {
      version: ONBOARDING_DRAFT_VERSION,
      currentStep: clampStep(currentStep),
      restaurantId,
      data,
      updatedAt: new Date().toISOString(),
    })
  }, [user?.id, isAuthLoading, isRestaurantLoading, isHydrating, isSetupEditor, currentStep, restaurantId, data])

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
    const activeRestaurantId = resolveOnboardingTargetId({
      isNewRestaurantFlow,
      isRestaurantSetupResume,
      requestedRestaurantId,
      validatedResumeRestaurantId: resumeRestaurant?.id || null,
      stateRestaurantId: restaurantId,
      currentRestaurantId: shouldUseCurrentRestaurant ? selectedOnboardingRestaurant?.id || null : null,
    })
    if (isSetupEditor) return
    if (!activeRestaurantId) return
    if (isHydrating || showLaunchScreen) return
    if (routeRestaurant?.onboarding_completed_at && !isSetupEditor) return

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
    routeRestaurant?.id,
    routeRestaurant?.onboarding_completed_at,
    shouldUseCurrentRestaurant,
    isRestaurantSetupResume,
    isNewRestaurantFlow,
    requestedRestaurantId,
    resumeRestaurant?.id,
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
        phone: normalizeUsPhoneE164(data.phone),
      }

      // Resume and legacy onboarding may update only their explicitly resolved
      // target. New Store never inherits the dashboard's selected restaurant.
      const existingRestaurantId = resolveOnboardingTargetId({
        isNewRestaurantFlow,
        isRestaurantSetupResume,
        requestedRestaurantId,
        validatedResumeRestaurantId: resumeRestaurant?.id || null,
        stateRestaurantId: restaurantId,
        currentRestaurantId: shouldUseCurrentRestaurant ? selectedOnboardingRestaurant?.id || null : null,
      })
      if (existingRestaurantId) {
        const profilePatch = {
          name: basePayload.name,
          address: basePayload.address,
          city: basePayload.city,
          state: basePayload.state,
          postal_code: basePayload.postal_code,
          country: basePayload.country,
          type: basePayload.type,
          cuisine_types: basePayload.cuisine_types,
          phone: basePayload.phone,
        }
        const updatedRestaurant = await runWithTimeout(
          () => fetchWithSupabaseAuth<Restaurant>(`/restaurants/${existingRestaurantId}/onboarding-profile`, {
            method: 'PATCH',
            body: JSON.stringify({ patch: profilePatch }),
          }),
          'Saving restaurant basics timed out. Please retry.'
        )

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

      // Creation is service-owned: its transaction also initializes lifecycle,
      // Host access, and the owner's default back-office view. A direct browser
      // insert bypasses those invariants and cannot safely write the private
      // public-slug reservation registry used by the database trigger.
      const createdRestaurant = await runWithTimeout(
        () =>
          fetchWithSupabaseAuth<Restaurant>('/restaurants', {
            method: 'POST',
            body: JSON.stringify({
              ...basePayload,
              public_slug: buildUniqueSlug(data.name),
            }),
          }),
        'Creating restaurant timed out. Please retry.'
      )

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
      setData(prev => mergeOnboardingData(prev, {
        public_slug: asString(createdRestaurant.public_slug || createdRestaurant.slug),
        canonical_booking_url: createdRestaurant.public_slug ? `/book/${createdRestaurant.public_slug}` : null,
      }))
      if (user) {
        writeDraft(user.id, {
          version: ONBOARDING_DRAFT_VERSION,
          currentStep: 1,
          restaurantId: createdRestaurant.id,
          data,
          updatedAt: new Date().toISOString(),
        })
      }
      navigate(onboardingResumePath(createdRestaurant.id), { replace: true })
      await refreshRestaurants(createdRestaurant.id)
      return createdRestaurant
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to create restaurant')
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setIsLoading(false)
    }
  }, [
    user,
    data,
    restaurantId,
    currentRestaurant?.id,
    isSetupEditor,
    isNewRestaurantFlow,
    isRestaurantSetupResume,
    requestedRestaurantId,
    resumeRestaurant?.id,
    shouldUseCurrentRestaurant,
    navigate,
    refreshRestaurants,
    runWithTimeout,
    seedCurrentRestaurant,
  ])

  // Leave the guided flow without manufacturing a completed setup state.
  // The dashboard derives Setup visibility from canonical restaurant data, so
  // an incomplete restaurant remains recoverable from its normal workspace.
  const exitToBackOffice = useCallback(async () => {
    setError(null)

    try {
      const restaurant = activeRestaurantId
        ? null
        : await createRestaurant()
      const targetRestaurantId = restaurant?.id || activeRestaurantId

      if (!targetRestaurantId) {
        throw new Error('Save restaurant basics before exiting setup.')
      }

      if (user) {
        clearDraft(user.id)
      }
      // Creation already seeds and refreshes the restaurant. A resumed flow
      // still refreshes once so its normal workspace receives the latest row.
      if (!restaurant) {
        await refreshRestaurants(targetRestaurantId)
      }
      navigate(`/restaurants/${targetRestaurantId}/setup`, { replace: true })
    } catch (err) {
      const message = toErrorMessage(err, 'Could not exit restaurant setup')
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    }
  }, [
    activeRestaurantId,
    createRestaurant,
    navigate,
    refreshRestaurants,
    user,
  ])

  // Cancel permanently removes only a never-operational onboarding restaurant.
  // The backend repeats the owner, lifecycle, completion, and operational-
  // history checks under lock; active stores remain behind the recoverable
  // Store Settings lifecycle.
  const cancelOnboarding = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (activeRestaurantId) {
        await runWithTimeout(
          () => fetchWithSupabaseAuth(
            `/restaurants/${activeRestaurantId}/onboarding-cancellation`,
            { method: 'POST' },
          ),
          'Canceling restaurant setup timed out. Please retry.',
        )
      }
      if (user) {
        clearDraft(user.id)
      }
      setRestaurantId(null)
      await refreshRestaurants()
      navigate('/enterprise/stores', { replace: true })
    } catch (err) {
      const message = toErrorMessage(err, 'Could not cancel restaurant setup')
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setIsLoading(false)
    }
  }, [activeRestaurantId, navigate, refreshRestaurants, runWithTimeout, user])

  // Save goals & priorities (after step 1)
  const saveLegal = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const legalPatch = {
        legal_business_name: collapseEntryWhitespace(data.legal_business_name),
        dba_name: collapseEntryWhitespace(data.dba_name),
        legal_contact_name: collapseEntryWhitespace(data.legal_contact_name),
        legal_contact_title: collapseEntryWhitespace(data.legal_contact_title),
        legal_contact_email: normalizeEmailInput(data.legal_contact_email),
        legal_contact_phone: normalizeUsPhoneE164(data.legal_contact_phone) || '',
        tos_version: 'shire-placeholder-tos-v1',
        ...(data.ein ? { ein: data.ein } : {}),
        ...(data.tos_signature_data_url ? {
          tos_signature_data_url: data.tos_signature_data_url,
          tos_signed_at: data.tos_signed_at,
        } : {}),
      }
      await runWithTimeout(
        () => fetchWithSupabaseAuth(`/restaurants/${activeRestaurantId}/setup-config`, {
          method: 'PATCH',
          body: JSON.stringify({ patch: legalPatch }),
        }),
        'Saving legal setup timed out. Please retry.'
      )
      if (!isSetupEditor) {
        const { error: stepError } = await supabase.from('restaurants').update(onboardingProgressPatch(2)).eq('id', activeRestaurantId)
        if (stepError) throw stepError
      }
      setData(prev => mergeOnboardingData(prev, {
        ...legalPatch,
        ein: '',
        ein_configured: prev.ein_configured || Boolean(data.ein),
        ein_last4: data.ein ? data.ein.replace(/\D/g, '').slice(-4) : prev.ein_last4,
        tos_signature_data_url: null,
        signature_configured: prev.signature_configured || Boolean(data.tos_signature_data_url),
      }))

      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save legal setup')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, isSetupEditor, onboardingProgressPatch, runWithTimeout])

  const savePayments = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const paymentsPatch = {
        bank_account_holder: collapseEntryWhitespace(data.bank_account_holder),
        bank_name: collapseEntryWhitespace(data.bank_name),
        ...(data.bank_routing_number ? { bank_routing_number: data.bank_routing_number } : {}),
        ...(data.bank_account_number ? { bank_account_number: data.bank_account_number } : {}),
        payout_schedule: data.payout_schedule,
        refund_funding_source: data.refund_funding_source,
        batch_close_mode: data.batch_close_mode,
        batch_close_time: data.batch_close_time,
        credit_card_tip_payout: data.credit_card_tip_payout,
        refund_approval_threshold: data.refund_approval_threshold,
      }
      await runWithTimeout(
        () => fetchWithSupabaseAuth(`/restaurants/${activeRestaurantId}/setup-config`, {
          method: 'PATCH',
          body: JSON.stringify({ patch: paymentsPatch }),
        }),
        'Saving payment setup timed out. Please retry.'
      )
      if (!isSetupEditor) {
        const { error: stepError } = await supabase.from('restaurants').update(onboardingProgressPatch(3)).eq('id', activeRestaurantId)
        if (stepError) throw stepError
      }
      setData(prev => mergeOnboardingData(prev, {
        ...paymentsPatch,
        bank_routing_number: '',
        bank_routing_configured: prev.bank_routing_configured || Boolean(data.bank_routing_number),
        bank_routing_last4: data.bank_routing_number ? data.bank_routing_number.slice(-4) : prev.bank_routing_last4,
        bank_account_number: '',
        bank_account_configured: prev.bank_account_configured || Boolean(data.bank_account_number),
        bank_account_last4: data.bank_account_number ? data.bank_account_number.slice(-4) : prev.bank_account_last4,
      }))

      const pricingPayload: Record<string, unknown> = {
        ...data.pricing_policy,
        expected_version: data.pricing_policy.version,
      }
      delete pricingPayload.jurisdiction_state
      const pricingResponse = await runWithTimeout(
        async () => fetch(`${API_CONFIG.baseUrl}/restaurants/${activeRestaurantId}/pricing-policy`, {
          method: 'PUT',
          headers: await getApiHeaders(),
          body: JSON.stringify(pricingPayload),
        }),
        'Saving pricing policy timed out. Please retry.'
      )
      if (!pricingResponse.ok) {
        const body = await pricingResponse.json().catch(() => ({}))
        throw new Error(asString(body.detail) || asString(body.message) || `Saving pricing policy failed (${pricingResponse.status})`)
      }
      const savedPricingPolicy = await pricingResponse.json()
      setData(prev => mergeOnboardingData(prev, { pricing_policy: normalizePricingPolicy(savedPricingPolicy) }))
      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save payment setup')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, isSetupEditor, onboardingProgressPatch, runWithTimeout])

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
        enabled_tax_classes: asStringArray(
          isRecord(saved) && isRecord(saved.tax_profile) ? saved.tax_profile.enabled_tax_classes : [],
        ).length
          ? asStringArray((saved as Record<string, any>).tax_profile?.enabled_tax_classes)
          : data.enabled_tax_classes,
        service_charges: normalizeServiceCharges(isRecord(saved) ? saved.service_charges : []),
        auto_gratuity: normalizeAutoGratuity(isRecord(saved) ? saved.auto_gratuity : null),
        tax_category_assignments: data.tax_category_assignments,
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

  const saveManagerControls = useCallback(async (overrides: Partial<OnboardingData> = {}) => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const payloadData = mergeOnboardingData(data, overrides)
      const response = await runWithTimeout(
        async () => fetch(`${API_CONFIG.baseUrl}/restaurants/${activeRestaurantId}/manager-controls`, {
          method: 'PUT',
          headers: await getApiHeaders(),
          body: JSON.stringify(managerControlsToPayload(payloadData)),
        }),
        'Saving manager controls timed out. Please retry.'
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(asString(body.detail) || asString(body.message) || `Saving manager controls failed (${response.status})`)
      }

      const saved = await response.json().catch(() => ({}))
      setData(prev => mergeOnboardingData(prev, {
        ...overrides,
        role_permissions: normalizeRolePermissions(
          isRecord(saved) ? saved.role_permissions : [],
          payloadData.job_codes
        ),
      }))

      const { error: stepError } = isSetupEditor
        ? { error: null }
        : await runWithTimeout(
            () =>
              supabase
                .from('restaurants')
                .update({ onboarding_step: 6 })
                .eq('id', activeRestaurantId),
            'Updating onboarding progress timed out. Please retry.'
          )

      if (stepError) throw stepError
      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save manager controls')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, isSetupEditor, runWithTimeout])

  const saveCloseoutSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const response = await runWithTimeout(
        async () => fetch(`${API_CONFIG.baseUrl}/restaurants/${activeRestaurantId}/closeout-settings`, {
          method: 'PUT',
          headers: await getApiHeaders(),
          body: JSON.stringify(closeoutSettingsToPayload(data)),
        }),
        'Saving closeout settings timed out. Please retry.'
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(asString(body.detail) || asString(body.message) || `Saving closeout settings failed (${response.status})`)
      }

      const saved = await response.json().catch(() => ({}))
      setData(prev => mergeOnboardingData(prev, {
        closeout_settings: normalizeCloseoutSettings(saved),
      }))

      const { error: stepError } = isSetupEditor
        ? { error: null }
        : await runWithTimeout(
            () =>
              supabase
                .from('restaurants')
                .update({ onboarding_step: 7 })
                .eq('id', activeRestaurantId),
            'Updating onboarding progress timed out. Please retry.'
          )

      if (stepError) throw stepError
      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save closeout settings')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, isSetupEditor, runWithTimeout])

  const saveTipPayrollSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const saved = await runWithTimeout(
        async () => fetchPosApi(activeRestaurantId, `/restaurants/${activeRestaurantId}/tips-payroll-settings`, {
          method: 'PUT',
          body: JSON.stringify(tipPayrollToPayload(data)),
        }),
        'Saving tips and payroll timed out. Please retry.'
      )

      setData(prev => mergeOnboardingData(prev, {
        tip_payroll_settings: normalizeTipPayrollSettings(saved, prev.job_codes),
      }))

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
      const message = toErrorMessage(err, 'Failed to save tips and payroll')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, isSetupEditor, runWithTimeout])

  const saveCheckWorkflowSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const response = await runWithTimeout(
        async () => fetch(`${API_CONFIG.baseUrl}/restaurants/${activeRestaurantId}/check-workflow-settings`, {
          method: 'PUT',
          headers: await getApiHeaders(),
          body: JSON.stringify(checkWorkflowSettingsToPayload(data)),
        }),
        'Saving check workflow settings timed out. Please retry.'
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(asString(body.detail) || asString(body.message) || `Saving check workflow settings failed (${response.status})`)
      }

      const saved = await response.json().catch(() => ({}))
      setData(prev => mergeOnboardingData(prev, {
        check_workflow_settings: normalizeCheckWorkflowSettings(saved),
      }))

      const { error: stepError } = isSetupEditor
        ? { error: null }
        : await runWithTimeout(
            () =>
              supabase
                .from('restaurants')
                .update({ onboarding_step: 8 })
                .eq('id', activeRestaurantId),
            'Updating onboarding progress timed out. Please retry.'
          )

      if (stepError) throw stepError
      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save check workflow settings')
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
              ...onboardingProgressPatch(10),
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
              ...onboardingProgressPatch(12),
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
      const sectionBehaviors = normalizeSectionProfiles(data.section_behaviors, sectionNames)
      const response = await runWithTimeout(
        async () => fetch(`${API_CONFIG.baseUrl}/restaurants/${activeRestaurantId}/sections`, {
          method: 'PUT',
          headers: await getApiHeaders(),
          body: JSON.stringify({
            sections: sectionBehaviors.map(section => ({
              ...section,
              id: section.id || undefined,
              auto_gratuity_value: Number(section.auto_gratuity_value || 0),
              minimum_party_size: section.minimum_party_size ? Number(section.minimum_party_size) : null,
            })),
          }),
        }),
        'Saving restaurant sections timed out. Please retry.'
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(asString(body.detail) || asString(body.message) || `Saving sections failed (${response.status})`)
      }

      const saved = await response.json().catch(() => [])
      const savedNames = normalizeSectionNames(asStringArray((saved || []).map((section: { name?: unknown }) => section.name)))
      setData(prev => mergeOnboardingData(prev, {
        sections: savedNames,
        section_behaviors: normalizeSectionProfiles(saved, savedNames),
      }))

      const { error: stepError } = isSetupEditor
        ? { error: null }
        : await runWithTimeout(
            () =>
              supabase
                .from('restaurants')
                .update({ onboarding_step: 13 })
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
  }, [data.section_behaviors, data.sections, getActiveRestaurantId, isSetupEditor, runWithTimeout])

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
                .update({ onboarding_step: 14 })
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

  const saveReservationTiming = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const existingConfig = await fetchRestaurantConfig(activeRestaurantId)
      const timing = reservationTimingPatch(data)
      const slugResult = await runWithTimeout(
        () => savePublicSlug(activeRestaurantId, data.public_slug || data.name),
        'Saving public booking URL timed out. Please retry.'
      )

      await runWithTimeout(
        () => saveReservationSettings(activeRestaurantId, data),
        'Saving reservation timing timed out. Please retry.'
      )

      const { error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              config: {
                ...existingConfig,
                reservation_timing_same_for_channels: timing.reservation_timing_same_for_channels,
                reservation_online_booking_horizon_days: timing.reservation_online_booking_horizon_days,
                reservation_online_lead_time_minutes: timing.reservation_online_lead_time_minutes,
                reservation_online_grace_period_minutes: timing.reservation_online_grace_period_minutes,
                reservation_staff_booking_horizon_days: timing.reservation_staff_booking_horizon_days,
                reservation_staff_lead_time_minutes: timing.reservation_staff_lead_time_minutes,
                reservation_staff_grace_period_minutes: timing.reservation_staff_grace_period_minutes,
                reservation_slot_interval_minutes: timing.reservation_slot_interval_minutes,
                reservation_min_party_size: timing.reservation_min_party_size,
                reservation_max_party_size: timing.reservation_max_party_size,
                reservation_default_duration_minutes: timing.reservation_default_duration_minutes,
                reservation_windows_follow_operating_hours: timing.reservation_windows_follow_operating_hours,
              },
              ...onboardingProgressPatch(15),
            })
            .eq('id', activeRestaurantId),
        'Saving reservation timing draft timed out. Please retry.'
      )

      if (updateError) throw updateError

      setData(prev => mergeOnboardingData(prev, {
        reservation_timing_same_for_channels: timing.reservation_timing_same_for_channels,
        reservation_online_booking_horizon_days: timing.reservation_online_booking_horizon_days,
        reservation_online_lead_time_minutes: timing.reservation_online_lead_time_minutes,
        reservation_online_grace_period_minutes: timing.reservation_online_grace_period_minutes,
        reservation_staff_booking_horizon_days: timing.reservation_staff_booking_horizon_days,
        reservation_staff_lead_time_minutes: timing.reservation_staff_lead_time_minutes,
        reservation_staff_grace_period_minutes: timing.reservation_staff_grace_period_minutes,
        reservation_slot_interval_minutes: timing.reservation_slot_interval_minutes,
        reservation_min_party_size: timing.reservation_min_party_size,
        reservation_max_party_size: timing.reservation_max_party_size,
        reservation_default_duration_minutes: timing.reservation_default_duration_minutes,
        reservation_windows_follow_operating_hours: timing.reservation_windows_follow_operating_hours,
        ...(slugResult
          ? {
              public_slug: slugResult.public_slug || slugResult.publicSlug || '',
              canonical_booking_url: slugResult.canonical_booking_url || slugResult.canonicalBookingUrl || null,
            }
          : {}),
      }))
      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save reservation timing')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, fetchRestaurantConfig, onboardingProgressPatch, runWithTimeout])

  // Save capacity (after step 5)
  const saveCapacity = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const capacityError = numberRangeError(data.seating_capacity, 'Seating capacity', { required: true, min: 1, integer: true })
      const tableCountError = numberRangeError(data.table_count, 'Table count', { min: 0, integer: true })
      if (capacityError || tableCountError) throw new Error(capacityError || tableCountError)

      // Update restaurant
      const { error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              seating_capacity: data.seating_capacity,
              table_count: data.table_count,
              ...onboardingProgressPatch(16),
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
  const saveMenuCategories = useCallback(async (menuCategories: MenuCategoryData[] = data.menu_categories) => {
    setIsLoading(true)
    setError(null)

    try {
      validateMenuCategories(menuCategories)
      const activeRestaurantId = getActiveRestaurantId()
      const response = await runWithTimeout(
        async () => fetch(`${API_CONFIG.baseUrl}/restaurants/${activeRestaurantId}/menu/categories`, {
          method: 'PUT',
          headers: await getApiHeaders(),
          body: JSON.stringify(menuCategoriesPayload(menuCategories)),
        }),
        'Saving menu categories timed out. Please retry.'
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(asString(body.detail) || asString(body.message) || `Saving menu categories failed (${response.status})`)
      }

      const saved = await response.json().catch(() => ({}))
      setData(prev => mergeOnboardingData(prev, {
        menu_categories: normalizeMenuCategories(isRecord(saved) ? saved.categories : []),
        tax_category_assignments: undefined,
      }))

      const { error: stepError } = isSetupEditor
        ? { error: null }
        : await runWithTimeout(
            () =>
              supabase
                .from('restaurants')
                .update({ onboarding_step: 17 })
                .eq('id', activeRestaurantId),
            'Updating onboarding progress timed out. Please retry.'
          )

      if (stepError) throw stepError
      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save menu categories')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data.menu_categories, getActiveRestaurantId, isSetupEditor, runWithTimeout])

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
              ...onboardingProgressPatch(18),
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

  const saveRoutingProgress = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const activeRestaurantId = getActiveRestaurantId()
      const existingConfig = await fetchRestaurantConfig(activeRestaurantId)
      const { error: updateError } = await runWithTimeout(
        () => supabase
          .from('restaurants')
          .update({
            config: { ...existingConfig, kitchen_routing_reviewed_at: new Date().toISOString() },
            ...onboardingProgressPatch(20),
          })
          .eq('id', activeRestaurantId),
        'Saving kitchen routing review timed out. Please retry.'
      )
      if (updateError) throw updateError
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save kitchen routing review')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [fetchRestaurantConfig, getActiveRestaurantId, onboardingProgressPatch, runWithTimeout])

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      throwIfInvalid(getCompletionIssues(data, activeRestaurantId))

      const existingConfig = await fetchRestaurantConfig(activeRestaurantId)
      const timing = reservationTimingPatch(data)
      await runWithTimeout(
        () => saveReservationSettings(activeRestaurantId, data),
        'Saving reservation timing timed out. Please retry.'
      )

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
                legal_contact_name: data.legal_contact_name,
                legal_contact_title: data.legal_contact_title,
                legal_contact_email: data.legal_contact_email,
                legal_contact_phone: data.legal_contact_phone,
                tos_signed_at: data.tos_signed_at,
                tos_version: 'shire-placeholder-tos-v1',
                payout_schedule: data.payout_schedule,
                refund_funding_source: data.refund_funding_source,
                batch_close_mode: data.batch_close_mode,
                batch_close_time: data.batch_close_time,
                credit_card_tip_payout: data.credit_card_tip_payout,
                refund_approval_threshold: data.refund_approval_threshold,
                reservation_timing_same_for_channels: timing.reservation_timing_same_for_channels,
                reservation_online_booking_horizon_days: timing.reservation_online_booking_horizon_days,
                reservation_online_lead_time_minutes: timing.reservation_online_lead_time_minutes,
                reservation_online_grace_period_minutes: timing.reservation_online_grace_period_minutes,
                reservation_staff_booking_horizon_days: timing.reservation_staff_booking_horizon_days,
                reservation_staff_lead_time_minutes: timing.reservation_staff_lead_time_minutes,
                reservation_staff_grace_period_minutes: timing.reservation_staff_grace_period_minutes,
                reservation_slot_interval_minutes: timing.reservation_slot_interval_minutes,
                reservation_min_party_size: timing.reservation_min_party_size,
                reservation_max_party_size: timing.reservation_max_party_size,
                reservation_default_duration_minutes: timing.reservation_default_duration_minutes,
                reservation_windows_follow_operating_hours: timing.reservation_windows_follow_operating_hours,
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
    exitToBackOffice,
    cancelOnboarding,
    saveLegal,
    savePayments,
    saveTaxesCharges,
    saveDiscountRules,
    saveManagerControls,
    saveCloseoutSettings,
    saveCheckWorkflowSettings,
    saveTipPayrollSettings,
    saveGoals,
    saveTechStack,
    saveSections,
    saveOperatingHours,
    saveReservationTiming,
    saveCapacity,
    saveMenuCategories,
    saveMenuProgress,
    saveRoutingProgress,
    completeOnboarding,
    goToDashboard,

    // Helpers
    setError,
  }
}

export type UseOnboardingReturn = ReturnType<typeof useOnboarding>

import { useState, useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabase'
import { API_CONFIG } from '../../shared/api/config'
import { useAuth } from '../../auth'
import type { Restaurant } from '@shire/db'

const MAX_SPLIT_COUNT = 8

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

export interface SectionBehaviorData {
  id?: string | null
  name: string
  service_mode: 'standard' | 'hibachi' | 'bar' | 'patio' | 'counter' | 'custom'
  auto_gratuity_enabled: boolean
  auto_gratuity_type: 'percentage' | 'fixed'
  auto_gratuity_value: string
  auto_gratuity_label: string
  auto_gratuity_taxable: boolean
  minimum_party_size: string
  tip_prompt_mode: 'normal' | 'additional' | 'disabled'
}

export interface MenuCategoryData {
  id?: string | null
  name: string
  tax_rate_id: string
  routing_station_id: string
  routing_station_name: string
  default_fire_mode?: 'inherit' | 'immediate' | 'hold' | 'manual' | 'by_course' | ''
  kds_display_group?: string
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

export interface RolePermissionData {
  id?: string | null
  role_key: string
  can_refund: boolean
  refund_limit: string
  can_void: boolean
  can_comp: boolean
  can_discount: boolean
  discount_limit_percent: string
  can_open_cash_drawer: boolean
  can_no_sale: boolean
  can_paid_in_out: boolean
  can_adjust_tips: boolean
  can_edit_menu: boolean
  can_edit_employees: boolean
  can_edit_schedules: boolean
  can_view_reports: boolean
  can_close_drawer: boolean
  can_close_day: boolean
  can_change_payment_settings: boolean
  can_edit_sent_items_within_window: boolean
  can_edit_sent_items_after_window: boolean
  can_unsend_sent_items: boolean
  can_edit_paid_check_items: boolean
  require_manager_pin_for_approval: boolean
}

export interface CloseoutSettingsData {
  cash_tracking_mode: 'shared_drawer' | 'per_terminal' | 'per_employee' | 'no_cash'
  require_starting_bank: boolean
  blind_drawer_close: boolean
  allow_paid_in_out: boolean
  require_manager_for_drawer_open: boolean
  cash_drop_threshold: string
  cash_variance_threshold: string
  server_require_all_checks_closed: boolean
  server_require_tabs_closed: boolean
  server_require_cash_tips_declared: boolean
  server_require_credit_tips_reviewed: boolean
  server_require_tipout_entry: boolean
  server_require_manager_approval: boolean
  server_checkout_report_delivery: 'none' | 'print' | 'email' | 'print_and_email'
  allow_clockout_before_checkout: boolean
  eod_batch_close_mode: 'automatic' | 'manual' | 'prompt_manager'
  eod_require_drawers_closed: boolean
  eod_require_servers_checked_out: boolean
  eod_require_open_checks_resolved: boolean
  eod_require_paid_outs_reviewed: boolean
  eod_require_tip_adjustments_reviewed: boolean
  eod_report_recipients: string[]
  eod_reports: string[]
}

export interface CheckWorkflowSettingsData {
  seat_numbers_enabled: boolean
  seat_number_required: boolean
  course_required: boolean
  allow_split_checks: boolean
  split_by_seat_enabled: boolean
  split_by_item_enabled: boolean
  split_evenly_enabled: boolean
  max_split_count: string
  allow_partial_payments: boolean
  require_manager_for_split_after_payment: boolean
  allow_check_merge: boolean
  allow_table_transfer: boolean
  allow_server_transfer: boolean
  require_manager_for_transfer: boolean
  allow_bar_tabs: boolean
  tab_name_required: boolean
  card_preauth_required: boolean
  default_preauth_amount: string
  allow_tabs_without_table: boolean
  auto_close_paid_tabs: boolean
  allow_reopen_closed_checks: boolean
  require_manager_for_reopen: boolean
  allow_send_before_required_modifiers: boolean
  allow_hold_and_fire: boolean
  default_order_fire_mode: 'manual' | 'immediate' | 'by_course'
  default_hold_minutes: string
  hold_preset_minutes: number[]
  allow_manual_hold: boolean
  allow_item_seat_move: boolean
  allow_multi_item_seat_move: boolean
  require_manager_for_item_move_after_send: boolean
  print_guest_check_by_default: boolean
  sent_item_correction_window_minutes: string
  notes: string
}

export interface JobCodeData {
  id?: string | null
  code: string
  label: string
  permission_tier: 'owner' | 'manager' | 'normal' | 'limited' | 'waiter'
  default_hourly_rate: string
  is_tipped: boolean
  tipout_role: string
  sort_order: number
  is_active?: boolean
}

export interface TipRoleRuleData {
  role_key: string
  tip_eligible: boolean
  contributes_to_pool: boolean
  receives_from_pool: boolean
  pool_points: string
  pool_contribution_percent: string
  tipout_split_basis: 'hours' | 'even'
  tipouts: Array<{
    target_role: string
    percent: string
    basis: 'tips' | 'sales'
    sales_category: string
    basis_scope: 'own' | 'restaurant'
  }>
  tipout_percent: string
  tipout_target_role: string
  notes: string
}

export interface CategoryTipProfileData {
  id: string
  name: string
  category_ids: string[]
  category_names: string[]
  role_tip_rules: TipRoleRuleData[]
  item_overrides: Array<{
    menu_item_id: string
    menu_item_name: string
    role_tip_rules: TipRoleRuleData[]
  }>
}

export interface TipPayrollSettingsData {
  tip_distribution_mode: 'individual' | 'pooled' | 'role_based' | 'sales_based' | 'hours_based' | 'points_based'
  cash_tip_declaration_mode: 'not_tracked' | 'declared_by_employee' | 'declared_by_manager' | 'required_checkout'
  credit_tip_payout_timing: 'nightly' | 'payroll'
  payroll_provider: string
  payroll_export_frequency: 'daily' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'manual'
  tip_pooling_enabled: boolean
  tip_pool_reset: 'shift' | 'day' | 'pay_period'
  tipout_basis: 'none' | 'sales' | 'tips' | 'hours' | 'points' | 'custom'
  tipout_sales_includes_tax: boolean
  tipout_include_managers: boolean
  require_tipout_at_checkout: boolean
  allow_manager_tip_adjustments: boolean
  auto_withhold_credit_card_fees: boolean
  credit_card_fee_percent: string
  role_tip_rules: TipRoleRuleData[]
  category_tip_profiles: CategoryTipProfileData[]
  notes: string
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

const DEFAULT_ROLE_KEYS = ['owner', 'manager', 'server', 'bartender', 'cashier', 'host', 'runner', 'busser', 'kitchen']
const EOD_REPORT_OPTIONS = ['sales_summary', 'labor_summary', 'cash_drawer_summary', 'tip_summary', 'discounts_voids_refunds', 'tax_summary']

const defaultJobCodes = (): JobCodeData[] => [
  { code: 'owner', label: 'Owner', permission_tier: 'owner', default_hourly_rate: '', is_tipped: false, tipout_role: '', sort_order: 10, is_active: true },
  { code: 'manager', label: 'Manager', permission_tier: 'manager', default_hourly_rate: '', is_tipped: false, tipout_role: '', sort_order: 20, is_active: true },
  { code: 'server', label: 'Server', permission_tier: 'normal', default_hourly_rate: '', is_tipped: true, tipout_role: 'server', sort_order: 30, is_active: true },
  { code: 'bartender', label: 'Bartender', permission_tier: 'normal', default_hourly_rate: '', is_tipped: true, tipout_role: 'bartender', sort_order: 40, is_active: true },
  { code: 'host', label: 'Host', permission_tier: 'normal', default_hourly_rate: '', is_tipped: false, tipout_role: 'host', sort_order: 50, is_active: true },
  { code: 'runner', label: 'Runner', permission_tier: 'normal', default_hourly_rate: '', is_tipped: true, tipout_role: 'runner', sort_order: 60, is_active: true },
  { code: 'busser', label: 'Busser', permission_tier: 'normal', default_hourly_rate: '', is_tipped: true, tipout_role: 'busser', sort_order: 70, is_active: true },
  { code: 'kitchen', label: 'Kitchen', permission_tier: 'normal', default_hourly_rate: '', is_tipped: false, tipout_role: 'kitchen', sort_order: 80, is_active: true },
]

const defaultTipRoleRules = (jobCodes: JobCodeData[] = defaultJobCodes()): TipRoleRuleData[] =>
  jobCodes.map(code => ({
    role_key: code.code,
    tip_eligible: code.is_tipped,
    contributes_to_pool: code.is_tipped,
    receives_from_pool: code.is_tipped,
    pool_points: code.is_tipped ? '1' : '',
    pool_contribution_percent: '100',
    tipout_split_basis: 'hours',
    tipouts: [],
    tipout_percent: '',
    tipout_target_role: '',
    notes: '',
  }))

const defaultTipPayrollSettings = (): TipPayrollSettingsData => ({
  tip_distribution_mode: 'individual',
  cash_tip_declaration_mode: 'declared_by_employee',
  credit_tip_payout_timing: 'payroll',
  payroll_provider: '',
  payroll_export_frequency: 'biweekly',
  tip_pooling_enabled: false,
  tip_pool_reset: 'day',
  tipout_basis: 'none',
  tipout_sales_includes_tax: false,
  tipout_include_managers: false,
  require_tipout_at_checkout: false,
  allow_manager_tip_adjustments: true,
  auto_withhold_credit_card_fees: false,
  credit_card_fee_percent: '',
    role_tip_rules: defaultTipRoleRules(),
    category_tip_profiles: [],
  notes: '',
})

function slugRoleCode(value: unknown, fallback = 'role'): string {
  const raw = String(value || fallback).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  const normalized = raw || fallback
  return /^[a-z]/.test(normalized) ? normalized.slice(0, 80) : `role_${normalized}`.slice(0, 80)
}

const roleKeysForPermissions = (jobCodes: JobCodeData[] = defaultJobCodes()): string[] => {
  const seen = new Set<string>()
  const keys: string[] = []
  const activeJobCodeKeys = jobCodes
    .filter(code => code?.is_active !== false)
    .map(code => code.code)
  const sourceKeys = activeJobCodeKeys.length > 0 ? activeJobCodeKeys : DEFAULT_ROLE_KEYS
  for (const key of sourceKeys) {
    const roleKey = slugRoleCode(key)
    if (!roleKey || seen.has(roleKey)) continue
    seen.add(roleKey)
    keys.push(roleKey)
  }
  return keys
}

const defaultRolePermission = (roleKey: string): RolePermissionData => {
  const normalizedRoleKey = slugRoleCode(roleKey)
  const elevated = normalizedRoleKey === 'owner' || normalizedRoleKey === 'manager'
  const cashier = normalizedRoleKey === 'cashier'
  const service = normalizedRoleKey === 'server' || normalizedRoleKey === 'bartender' || normalizedRoleKey === 'cashier'
  return {
    role_key: normalizedRoleKey,
    can_refund: elevated || cashier,
    refund_limit: elevated ? '' : cashier ? '25' : '',
    can_void: elevated,
    can_comp: elevated,
    can_discount: elevated || service,
    discount_limit_percent: elevated ? '' : service ? '20' : '',
    can_open_cash_drawer: elevated || cashier || normalizedRoleKey === 'bartender',
    can_no_sale: elevated || cashier,
    can_paid_in_out: elevated || cashier,
    can_adjust_tips: elevated,
    can_edit_menu: elevated,
    can_edit_employees: elevated,
    can_edit_schedules: elevated,
    can_view_reports: elevated,
    can_close_drawer: elevated || cashier,
    can_close_day: elevated,
    can_change_payment_settings: normalizedRoleKey === 'owner',
    can_edit_sent_items_within_window: elevated || service,
    can_edit_sent_items_after_window: elevated,
    can_unsend_sent_items: elevated || service,
    can_edit_paid_check_items: elevated,
    require_manager_pin_for_approval: !elevated,
  }
}

const defaultRolePermissions = (jobCodes: JobCodeData[] = defaultJobCodes()): RolePermissionData[] =>
  roleKeysForPermissions(jobCodes).map(roleKey => defaultRolePermission(roleKey))

const defaultCloseoutSettings = (): CloseoutSettingsData => ({
  cash_tracking_mode: 'shared_drawer',
  require_starting_bank: true,
  blind_drawer_close: true,
  allow_paid_in_out: true,
  require_manager_for_drawer_open: true,
  cash_drop_threshold: '',
  cash_variance_threshold: '',
  server_require_all_checks_closed: true,
  server_require_tabs_closed: true,
  server_require_cash_tips_declared: true,
  server_require_credit_tips_reviewed: true,
  server_require_tipout_entry: false,
  server_require_manager_approval: true,
  server_checkout_report_delivery: 'print',
  allow_clockout_before_checkout: false,
  eod_batch_close_mode: 'prompt_manager',
  eod_require_drawers_closed: true,
  eod_require_servers_checked_out: true,
  eod_require_open_checks_resolved: true,
  eod_require_paid_outs_reviewed: true,
  eod_require_tip_adjustments_reviewed: true,
  eod_report_recipients: [],
  eod_reports: ['sales_summary', 'cash_drawer_summary', 'tip_summary', 'discounts_voids_refunds', 'tax_summary'],
})

const defaultMenuCategories = (): MenuCategoryData[] => [
  { name: 'Appetizers', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Kitchen', default_fire_mode: 'by_course', kds_display_group: 'Apps', is_active: true },
  { name: 'Entrees', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Kitchen', default_fire_mode: 'by_course', kds_display_group: 'Entrees', is_active: true },
  { name: 'Desserts', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Kitchen', default_fire_mode: 'by_course', kds_display_group: 'Desserts', is_active: true },
  { name: 'Sides', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Kitchen', default_fire_mode: 'inherit', kds_display_group: 'Sides', is_active: true },
  { name: 'Drinks', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Bar', default_fire_mode: 'immediate', kds_display_group: 'Drinks', is_active: true },
  { name: 'Cocktails', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Bar', default_fire_mode: 'immediate', kds_display_group: 'Bar', is_active: true },
  { name: 'Beer & Wine', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Bar', default_fire_mode: 'immediate', kds_display_group: 'Bar', is_active: true },
  { name: 'Specials', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Kitchen', default_fire_mode: 'inherit', kds_display_group: 'Specials', is_active: true },
  { name: 'Other', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Expo', default_fire_mode: 'inherit', kds_display_group: 'Other', is_active: true },
]

const defaultCheckWorkflowSettings = (): CheckWorkflowSettingsData => ({
  seat_numbers_enabled: true,
  seat_number_required: false,
  course_required: false,
  allow_split_checks: true,
  split_by_seat_enabled: true,
  split_by_item_enabled: true,
  split_evenly_enabled: true,
  max_split_count: '8',
  allow_partial_payments: true,
  require_manager_for_split_after_payment: true,
  allow_check_merge: true,
  allow_table_transfer: true,
  allow_server_transfer: true,
  require_manager_for_transfer: false,
  allow_bar_tabs: true,
  tab_name_required: true,
  card_preauth_required: false,
  default_preauth_amount: '',
  allow_tabs_without_table: true,
  auto_close_paid_tabs: true,
  allow_reopen_closed_checks: false,
  require_manager_for_reopen: true,
  allow_send_before_required_modifiers: false,
  allow_hold_and_fire: true,
  default_order_fire_mode: 'immediate',
  default_hold_minutes: '10',
  hold_preset_minutes: [5, 10, 15],
  allow_manual_hold: true,
  allow_item_seat_move: true,
  allow_multi_item_seat_move: true,
  require_manager_for_item_move_after_send: false,
  print_guest_check_by_default: true,
  sent_item_correction_window_minutes: '4',
  notes: '',
})

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
  role_permissions: defaultRolePermissions(),
  closeout_settings: defaultCloseoutSettings(),
  check_workflow_settings: defaultCheckWorkflowSettings(),
  job_codes: defaultJobCodes(),
  tip_payroll_settings: defaultTipPayrollSettings(),

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

const ONBOARDING_MAX_STEP = 20
const REQUEST_TIMEOUT_MS = 20000
const ONBOARDING_DRAFT_VERSION = 1
const RESERVATIONS_API_BASE_URL = (
  import.meta.env.VITE_RESERVATIONS_API_BASE_URL ||
  import.meta.env.VITE_RESERVATIONS_API_BASE ||
  'http://localhost:4100/api/v1'
).replace(/\/+$/, '')

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
const SECTION_SERVICE_MODES: SectionBehaviorData['service_mode'][] = ['standard', 'hibachi', 'bar', 'patio', 'counter', 'custom']
const SECTION_TIP_PROMPT_MODES: SectionBehaviorData['tip_prompt_mode'][] = ['normal', 'additional', 'disabled']
const DISCOUNT_TYPES: DiscountRuleData['discount_type'][] = ['discount', 'comp', 'promo', 'employee_meal', 'service_recovery']
const DISCOUNT_APPLIES_TO: DiscountRuleData['applies_to'][] = ['item', 'check', 'both']
const DISCOUNT_VALUE_TYPES: DiscountRuleData['value_type'][] = ['percent', 'fixed', 'open']
const DISCOUNT_TAX_BEHAVIORS: DiscountRuleData['tax_behavior'][] = ['reduce_taxable_amount', 'apply_after_tax', 'no_tax_impact']
const DISCOUNT_ROLES = ['owner', 'manager', 'server', 'bartender', 'cashier', 'host', 'runner', 'busser']
const DISCOUNT_SERVICE_MODES = ['dine_in', 'bar', 'counter_service', 'takeout', 'delivery', 'catering']
const CASH_TRACKING_MODES: CloseoutSettingsData['cash_tracking_mode'][] = ['shared_drawer', 'per_terminal', 'per_employee', 'no_cash']
const SERVER_REPORT_DELIVERY: CloseoutSettingsData['server_checkout_report_delivery'][] = ['none', 'print', 'email', 'print_and_email']
const EOD_BATCH_CLOSE_MODES: CloseoutSettingsData['eod_batch_close_mode'][] = ['automatic', 'manual', 'prompt_manager']
const ORDER_FIRE_MODES: CheckWorkflowSettingsData['default_order_fire_mode'][] = ['manual', 'immediate', 'by_course']
const PERMISSION_TIERS: JobCodeData['permission_tier'][] = ['owner', 'manager', 'normal', 'limited', 'waiter']
const TIP_DISTRIBUTION_MODES: TipPayrollSettingsData['tip_distribution_mode'][] = ['individual', 'pooled', 'role_based', 'sales_based', 'hours_based', 'points_based']
const CASH_TIP_DECLARATION_MODES: TipPayrollSettingsData['cash_tip_declaration_mode'][] = ['not_tracked', 'declared_by_employee', 'declared_by_manager', 'required_checkout']
const PAYROLL_EXPORT_FREQUENCIES: TipPayrollSettingsData['payroll_export_frequency'][] = ['daily', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'manual']
const TIP_POOL_RESETS: TipPayrollSettingsData['tip_pool_reset'][] = ['shift', 'day', 'pay_period']
const TIPOUT_BASES: TipPayrollSettingsData['tipout_basis'][] = ['none', 'sales', 'tips', 'hours', 'points', 'custom']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const asConfigString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

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

const normalizeSectionBehaviors = (value: unknown, names: string[]): SectionBehaviorData[] => {
  const rows = Array.isArray(value) ? value.filter(isRecord) : []
  const byName = new Map(rows.map(row => [asString(row.name).trim().toLowerCase(), row]))
  return normalizeSectionNames(names).map(name => {
    const row = byName.get(name.toLowerCase())
    return {
      id: row ? asNullableString(row.id) : null,
      name,
      service_mode: row ? asEnum(row.service_mode, SECTION_SERVICE_MODES, 'standard') : 'standard',
      auto_gratuity_enabled: row ? row.auto_gratuity_enabled === true : false,
      auto_gratuity_type: row ? asEnum(row.auto_gratuity_type, CHARGE_TYPES, 'percentage') : 'percentage',
      auto_gratuity_value: row ? asStringNumber(row.auto_gratuity_value) || '18' : '18',
      auto_gratuity_label: row ? asString(row.auto_gratuity_label).trim() || `${name} Service Charge` : `${name} Service Charge`,
      auto_gratuity_taxable: row ? row.auto_gratuity_taxable === true : false,
      minimum_party_size: row && row.minimum_party_size != null ? asStringNumber(row.minimum_party_size) : '',
      tip_prompt_mode: row ? asEnum(row.tip_prompt_mode, SECTION_TIP_PROMPT_MODES, 'additional') : 'additional',
    }
  })
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

const normalizeMenuCategories = (value: unknown): MenuCategoryData[] => {
  const rows = Array.isArray(value) ? value : []
  const normalized = rows
    .filter(isRecord)
    .map(row => ({
      id: asNullableString(row.id),
      name: asString(row.name).trim(),
      tax_rate_id: asString(row.tax_rate_id),
      routing_station_id: asString(row.routing_station_id),
      routing_station_name: asString(row.routing_station_name),
      default_fire_mode: asString(row.default_fire_mode) as MenuCategoryData['default_fire_mode'],
      kds_display_group: asString(row.kds_display_group),
      is_active: typeof row.is_active === 'boolean' ? row.is_active : true,
    }))
    .filter(row => row.is_active !== false)

  return normalized.length > 0 ? normalized : defaultMenuCategories()
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

const normalizeRolePermissions = (value: unknown, jobCodes: JobCodeData[] = defaultJobCodes()): RolePermissionData[] => {
  const rows = Array.isArray(value) ? value.filter(isRecord) : []
  const roleKeys = roleKeysForPermissions(jobCodes)
  const byRole = new Map<string, RolePermissionData>()
  for (const row of rows) {
    const role = slugRoleCode(row.role_key)
    const defaults = defaultRolePermission(role)
    byRole.set(role, {
      id: asNullableString(row.id),
      role_key: role,
      can_refund: typeof row.can_refund === 'boolean' ? row.can_refund : false,
      refund_limit: asStringNumber(row.refund_limit),
      can_void: typeof row.can_void === 'boolean' ? row.can_void : false,
      can_comp: typeof row.can_comp === 'boolean' ? row.can_comp : false,
      can_discount: typeof row.can_discount === 'boolean' ? row.can_discount : false,
      discount_limit_percent: asStringNumber(row.discount_limit_percent),
      can_open_cash_drawer: typeof row.can_open_cash_drawer === 'boolean' ? row.can_open_cash_drawer : false,
      can_no_sale: typeof row.can_no_sale === 'boolean' ? row.can_no_sale : false,
      can_paid_in_out: typeof row.can_paid_in_out === 'boolean' ? row.can_paid_in_out : false,
      can_adjust_tips: typeof row.can_adjust_tips === 'boolean' ? row.can_adjust_tips : false,
      can_edit_menu: typeof row.can_edit_menu === 'boolean' ? row.can_edit_menu : false,
      can_edit_employees: typeof row.can_edit_employees === 'boolean' ? row.can_edit_employees : false,
      can_edit_schedules: typeof row.can_edit_schedules === 'boolean' ? row.can_edit_schedules : false,
      can_view_reports: typeof row.can_view_reports === 'boolean' ? row.can_view_reports : false,
      can_close_drawer: typeof row.can_close_drawer === 'boolean' ? row.can_close_drawer : false,
      can_close_day: typeof row.can_close_day === 'boolean' ? row.can_close_day : false,
      can_change_payment_settings: typeof row.can_change_payment_settings === 'boolean' ? row.can_change_payment_settings : false,
      can_edit_sent_items_within_window: typeof row.can_edit_sent_items_within_window === 'boolean' ? row.can_edit_sent_items_within_window : defaults.can_edit_sent_items_within_window,
      can_edit_sent_items_after_window: typeof row.can_edit_sent_items_after_window === 'boolean' ? row.can_edit_sent_items_after_window : defaults.can_edit_sent_items_after_window,
      can_unsend_sent_items: typeof row.can_unsend_sent_items === 'boolean' ? row.can_unsend_sent_items : defaults.can_unsend_sent_items,
      can_edit_paid_check_items: typeof row.can_edit_paid_check_items === 'boolean' ? row.can_edit_paid_check_items : defaults.can_edit_paid_check_items,
      require_manager_pin_for_approval: typeof row.require_manager_pin_for_approval === 'boolean'
        ? row.require_manager_pin_for_approval
        : true,
    })
  }
  const normalized = roleKeys.map(role => byRole.get(role) || defaultRolePermission(role))
  for (const [role, row] of byRole.entries()) {
    if (!roleKeys.includes(role)) normalized.push(row)
  }
  return normalized
}

const normalizeReportRecipients = (value: unknown): string[] =>
  asStringArray(value)
    .map(email => email.toLowerCase())
    .filter(email => email.includes('@'))

const normalizeEodReports = (value: unknown): string[] => {
  const reports = asStringArray(value).filter(report => EOD_REPORT_OPTIONS.includes(report))
  return Array.from(new Set(reports.length > 0 ? reports : defaultCloseoutSettings().eod_reports))
}

const normalizeCloseoutSettings = (value: unknown): CloseoutSettingsData => {
  const fallback = defaultCloseoutSettings()
  if (!isRecord(value)) return fallback
  return {
    cash_tracking_mode: asEnum(value.cash_tracking_mode, CASH_TRACKING_MODES, fallback.cash_tracking_mode),
    require_starting_bank: typeof value.require_starting_bank === 'boolean' ? value.require_starting_bank : fallback.require_starting_bank,
    blind_drawer_close: typeof value.blind_drawer_close === 'boolean' ? value.blind_drawer_close : fallback.blind_drawer_close,
    allow_paid_in_out: typeof value.allow_paid_in_out === 'boolean' ? value.allow_paid_in_out : fallback.allow_paid_in_out,
    require_manager_for_drawer_open: typeof value.require_manager_for_drawer_open === 'boolean' ? value.require_manager_for_drawer_open : fallback.require_manager_for_drawer_open,
    cash_drop_threshold: asStringNumber(value.cash_drop_threshold),
    cash_variance_threshold: asStringNumber(value.cash_variance_threshold),
    server_require_all_checks_closed: typeof value.server_require_all_checks_closed === 'boolean' ? value.server_require_all_checks_closed : fallback.server_require_all_checks_closed,
    server_require_tabs_closed: typeof value.server_require_tabs_closed === 'boolean' ? value.server_require_tabs_closed : fallback.server_require_tabs_closed,
    server_require_cash_tips_declared: typeof value.server_require_cash_tips_declared === 'boolean' ? value.server_require_cash_tips_declared : fallback.server_require_cash_tips_declared,
    server_require_credit_tips_reviewed: typeof value.server_require_credit_tips_reviewed === 'boolean' ? value.server_require_credit_tips_reviewed : fallback.server_require_credit_tips_reviewed,
    server_require_tipout_entry: typeof value.server_require_tipout_entry === 'boolean' ? value.server_require_tipout_entry : fallback.server_require_tipout_entry,
    server_require_manager_approval: typeof value.server_require_manager_approval === 'boolean' ? value.server_require_manager_approval : fallback.server_require_manager_approval,
    server_checkout_report_delivery: asEnum(value.server_checkout_report_delivery, SERVER_REPORT_DELIVERY, fallback.server_checkout_report_delivery),
    allow_clockout_before_checkout: typeof value.allow_clockout_before_checkout === 'boolean' ? value.allow_clockout_before_checkout : fallback.allow_clockout_before_checkout,
    eod_batch_close_mode: asEnum(value.eod_batch_close_mode, EOD_BATCH_CLOSE_MODES, fallback.eod_batch_close_mode),
    eod_require_drawers_closed: typeof value.eod_require_drawers_closed === 'boolean' ? value.eod_require_drawers_closed : fallback.eod_require_drawers_closed,
    eod_require_servers_checked_out: typeof value.eod_require_servers_checked_out === 'boolean' ? value.eod_require_servers_checked_out : fallback.eod_require_servers_checked_out,
    eod_require_open_checks_resolved: typeof value.eod_require_open_checks_resolved === 'boolean' ? value.eod_require_open_checks_resolved : fallback.eod_require_open_checks_resolved,
    eod_require_paid_outs_reviewed: typeof value.eod_require_paid_outs_reviewed === 'boolean' ? value.eod_require_paid_outs_reviewed : fallback.eod_require_paid_outs_reviewed,
    eod_require_tip_adjustments_reviewed: typeof value.eod_require_tip_adjustments_reviewed === 'boolean' ? value.eod_require_tip_adjustments_reviewed : fallback.eod_require_tip_adjustments_reviewed,
    eod_report_recipients: normalizeReportRecipients(value.eod_report_recipients),
    eod_reports: normalizeEodReports(value.eod_reports),
  }
}

const normalizeCheckWorkflowSettings = (value: unknown): CheckWorkflowSettingsData => {
  const fallback = defaultCheckWorkflowSettings()
  if (!isRecord(value)) return fallback
  const maxSplitCount = Math.max(1, Math.min(MAX_SPLIT_COUNT, Number(asStringNumber(value.max_split_count) || fallback.max_split_count)))
  const holdPresetValues = Array.isArray(value.hold_preset_minutes)
    ? Array.from(new Set(value.hold_preset_minutes.map(Number).filter(minutes => Number.isFinite(minutes) && minutes > 0))).slice(0, 8)
    : fallback.hold_preset_minutes
  return {
    seat_numbers_enabled: typeof value.seat_numbers_enabled === 'boolean' ? value.seat_numbers_enabled : fallback.seat_numbers_enabled,
    seat_number_required: typeof value.seat_number_required === 'boolean' ? value.seat_number_required : fallback.seat_number_required,
    course_required: typeof value.course_required === 'boolean' ? value.course_required : fallback.course_required,
    allow_split_checks: typeof value.allow_split_checks === 'boolean' ? value.allow_split_checks : fallback.allow_split_checks,
    split_by_seat_enabled: typeof value.split_by_seat_enabled === 'boolean' ? value.split_by_seat_enabled : fallback.split_by_seat_enabled,
    split_by_item_enabled: typeof value.split_by_item_enabled === 'boolean' ? value.split_by_item_enabled : fallback.split_by_item_enabled,
    split_evenly_enabled: typeof value.split_evenly_enabled === 'boolean' ? value.split_evenly_enabled : fallback.split_evenly_enabled,
    max_split_count: String(maxSplitCount),
    allow_partial_payments: typeof value.allow_partial_payments === 'boolean' ? value.allow_partial_payments : fallback.allow_partial_payments,
    require_manager_for_split_after_payment: typeof value.require_manager_for_split_after_payment === 'boolean' ? value.require_manager_for_split_after_payment : fallback.require_manager_for_split_after_payment,
    allow_check_merge: typeof value.allow_check_merge === 'boolean' ? value.allow_check_merge : fallback.allow_check_merge,
    allow_table_transfer: typeof value.allow_table_transfer === 'boolean' ? value.allow_table_transfer : fallback.allow_table_transfer,
    allow_server_transfer: typeof value.allow_server_transfer === 'boolean' ? value.allow_server_transfer : fallback.allow_server_transfer,
    require_manager_for_transfer: typeof value.require_manager_for_transfer === 'boolean' ? value.require_manager_for_transfer : fallback.require_manager_for_transfer,
    allow_bar_tabs: typeof value.allow_bar_tabs === 'boolean' ? value.allow_bar_tabs : fallback.allow_bar_tabs,
    tab_name_required: typeof value.tab_name_required === 'boolean' ? value.tab_name_required : fallback.tab_name_required,
    card_preauth_required: typeof value.card_preauth_required === 'boolean' ? value.card_preauth_required : fallback.card_preauth_required,
    default_preauth_amount: asStringNumber(value.default_preauth_amount),
    allow_tabs_without_table: typeof value.allow_tabs_without_table === 'boolean' ? value.allow_tabs_without_table : fallback.allow_tabs_without_table,
    auto_close_paid_tabs: typeof value.auto_close_paid_tabs === 'boolean' ? value.auto_close_paid_tabs : fallback.auto_close_paid_tabs,
    allow_reopen_closed_checks: typeof value.allow_reopen_closed_checks === 'boolean' ? value.allow_reopen_closed_checks : fallback.allow_reopen_closed_checks,
    require_manager_for_reopen: typeof value.require_manager_for_reopen === 'boolean' ? value.require_manager_for_reopen : fallback.require_manager_for_reopen,
    allow_send_before_required_modifiers: typeof value.allow_send_before_required_modifiers === 'boolean' ? value.allow_send_before_required_modifiers : fallback.allow_send_before_required_modifiers,
    allow_hold_and_fire: typeof value.allow_hold_and_fire === 'boolean' ? value.allow_hold_and_fire : fallback.allow_hold_and_fire,
    default_order_fire_mode: asEnum(value.default_order_fire_mode, ORDER_FIRE_MODES, fallback.default_order_fire_mode),
    default_hold_minutes: asStringNumber(value.default_hold_minutes) || fallback.default_hold_minutes,
    hold_preset_minutes: holdPresetValues.length > 0 ? holdPresetValues : fallback.hold_preset_minutes,
    allow_manual_hold: typeof value.allow_manual_hold === 'boolean' ? value.allow_manual_hold : fallback.allow_manual_hold,
    allow_item_seat_move: typeof value.allow_item_seat_move === 'boolean' ? value.allow_item_seat_move : fallback.allow_item_seat_move,
    allow_multi_item_seat_move: typeof value.allow_multi_item_seat_move === 'boolean' ? value.allow_multi_item_seat_move : fallback.allow_multi_item_seat_move,
    require_manager_for_item_move_after_send: typeof value.require_manager_for_item_move_after_send === 'boolean' ? value.require_manager_for_item_move_after_send : fallback.require_manager_for_item_move_after_send,
    print_guest_check_by_default: typeof value.print_guest_check_by_default === 'boolean' ? value.print_guest_check_by_default : fallback.print_guest_check_by_default,
    sent_item_correction_window_minutes: String(Math.max(0, Math.min(15, Number(asStringNumber(value.sent_item_correction_window_minutes) || fallback.sent_item_correction_window_minutes)))),
    notes: asString(value.notes),
  }
}

const normalizeJobCodes = (value: unknown): JobCodeData[] => {
  const rows = Array.isArray(value) ? value.filter(isRecord) : []
  const normalized = rows
    .map((row, index) => ({
      id: asNullableString(row.id),
      code: slugRoleCode(row.code || row.label, `role_${index + 1}`),
      label: asString(row.label, asString(row.code)).trim(),
      permission_tier: asEnum(row.permission_tier, PERMISSION_TIERS, 'normal'),
      default_hourly_rate: asStringNumber(row.default_hourly_rate),
      is_tipped: typeof row.is_tipped === 'boolean' ? row.is_tipped : false,
      tipout_role: asString(row.tipout_role),
      sort_order: typeof row.sort_order === 'number' ? row.sort_order : index * 10,
      is_active: typeof row.is_active === 'boolean' ? row.is_active : true,
    }))
    .filter(row => row.label && row.is_active !== false)

  return normalized.length > 0 ? normalized : defaultJobCodes()
}

const normalizeTipRoleRules = (value: unknown, jobCodes: JobCodeData[] = defaultJobCodes()): TipRoleRuleData[] => {
  const fallback = defaultTipRoleRules(jobCodes)
  const rows = Array.isArray(value) ? value.filter(isRecord) : []
  const byRole = new Map<string, TipRoleRuleData>()
  for (const row of rows) {
    const roleKey = slugRoleCode(row.role_key)
    byRole.set(roleKey, {
      role_key: roleKey,
      tip_eligible: typeof row.tip_eligible === 'boolean' ? row.tip_eligible : true,
      contributes_to_pool: typeof row.contributes_to_pool === 'boolean' ? row.contributes_to_pool : true,
      receives_from_pool: typeof row.receives_from_pool === 'boolean' ? row.receives_from_pool : true,
      pool_points: asStringNumber(row.pool_points),
      pool_contribution_percent: row.pool_contribution_percent == null ? '100' : asStringNumber(row.pool_contribution_percent),
      tipout_split_basis: row.tipout_split_basis === 'even' ? 'even' : 'hours',
      tipouts: Array.isArray(row.tipouts)
        ? row.tipouts.filter(isRecord).flatMap(item => {
            const target = asString(item.target_role)
            if (!target) return []
            return [{
              target_role: slugRoleCode(target),
              percent: asStringNumber(item.percent),
              basis: item.basis === 'sales' ? 'sales' : 'tips',
              sales_category: asString(item.sales_category),
              basis_scope: item.basis_scope === 'restaurant' ? 'restaurant' : 'own',
            }]
          })
        : [],
      tipout_percent: asStringNumber(row.tipout_percent),
      tipout_target_role: asString(row.tipout_target_role),
      notes: asString(row.notes),
    })
  }
  return fallback.map(rule => byRole.get(rule.role_key) || rule)
}

const normalizeCategoryTipProfiles = (value: unknown, jobCodes: JobCodeData[]): CategoryTipProfileData[] => {
  const rows = Array.isArray(value) ? value.filter(isRecord) : []
  const seenCategories = new Set<string>()
  return rows.flatMap((row, index) => {
    const categoryIds = [...new Set(asStringArray(row.category_ids).map(String).filter(Boolean))].filter(id => {
      if (seenCategories.has(id)) return false
      seenCategories.add(id)
      return true
    })
    if (!categoryIds.length) return []
    const seenItems = new Set<string>()
    const itemOverrides = (Array.isArray(row.item_overrides) ? row.item_overrides.filter(isRecord) : []).flatMap(override => {
      const menuItemId = asString(override.menu_item_id)
      if (!menuItemId || seenItems.has(menuItemId)) return []
      seenItems.add(menuItemId)
      return [{
        menu_item_id: menuItemId,
        menu_item_name: asString(override.menu_item_name),
        role_tip_rules: normalizeTipRoleRules(override.role_tip_rules, jobCodes),
      }]
    })
    return [{
      id: asString(row.id) || `category_profile_${index + 1}`,
      name: asString(row.name),
      category_ids: categoryIds,
      category_names: asStringArray(row.category_names),
      role_tip_rules: normalizeTipRoleRules(row.role_tip_rules, jobCodes),
      item_overrides: itemOverrides,
    }]
  })
}

const normalizeTipPayrollSettings = (value: unknown, jobCodes: JobCodeData[] = defaultJobCodes()): TipPayrollSettingsData => {
  const fallback = defaultTipPayrollSettings()
  if (!isRecord(value)) {
    return { ...fallback, role_tip_rules: defaultTipRoleRules(jobCodes) }
  }
  return {
    tip_distribution_mode: asEnum(value.tip_distribution_mode, TIP_DISTRIBUTION_MODES, fallback.tip_distribution_mode),
    cash_tip_declaration_mode: asEnum(value.cash_tip_declaration_mode, CASH_TIP_DECLARATION_MODES, fallback.cash_tip_declaration_mode),
    credit_tip_payout_timing: asEnum(value.credit_tip_payout_timing, CREDIT_CARD_TIP_PAYOUTS, fallback.credit_tip_payout_timing),
    payroll_provider: asString(value.payroll_provider),
    payroll_export_frequency: asEnum(value.payroll_export_frequency, PAYROLL_EXPORT_FREQUENCIES, fallback.payroll_export_frequency),
    tip_pooling_enabled: typeof value.tip_pooling_enabled === 'boolean' ? value.tip_pooling_enabled : fallback.tip_pooling_enabled,
    tip_pool_reset: asEnum(value.tip_pool_reset, TIP_POOL_RESETS, fallback.tip_pool_reset),
    tipout_basis: asEnum(value.tipout_basis, TIPOUT_BASES, fallback.tipout_basis),
    tipout_sales_includes_tax: typeof value.tipout_sales_includes_tax === 'boolean' ? value.tipout_sales_includes_tax : fallback.tipout_sales_includes_tax,
    tipout_include_managers: typeof value.tipout_include_managers === 'boolean' ? value.tipout_include_managers : fallback.tipout_include_managers,
    require_tipout_at_checkout: typeof value.require_tipout_at_checkout === 'boolean' ? value.require_tipout_at_checkout : fallback.require_tipout_at_checkout,
    allow_manager_tip_adjustments: typeof value.allow_manager_tip_adjustments === 'boolean' ? value.allow_manager_tip_adjustments : fallback.allow_manager_tip_adjustments,
    auto_withhold_credit_card_fees: typeof value.auto_withhold_credit_card_fees === 'boolean' ? value.auto_withhold_credit_card_fees : fallback.auto_withhold_credit_card_fees,
    credit_card_fee_percent: asStringNumber(value.credit_card_fee_percent),
    role_tip_rules: normalizeTipRoleRules(value.role_tip_rules, jobCodes),
    category_tip_profiles: normalizeCategoryTipProfiles(value.category_tip_profiles, jobCodes),
    notes: asString(value.notes),
  }
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

const managerControlsToPayload = (data: OnboardingData) => ({
  role_permissions: normalizeRolePermissions(data.role_permissions, data.job_codes).map(row => ({
    ...row,
    id: undefined,
    refund_limit: row.refund_limit === '' ? null : Number(row.refund_limit),
    discount_limit_percent: row.discount_limit_percent === '' ? null : Number(row.discount_limit_percent),
  })),
})

const closeoutSettingsToPayload = (data: OnboardingData) => {
  const settings = normalizeCloseoutSettings(data.closeout_settings)
  return {
    ...settings,
    cash_drop_threshold: settings.cash_drop_threshold === '' ? null : Number(settings.cash_drop_threshold),
    cash_variance_threshold: settings.cash_variance_threshold === '' ? null : Number(settings.cash_variance_threshold),
  }
}

const menuCategoriesToPayload = (data: OnboardingData) => ({
  categories: normalizeMenuCategories(data.menu_categories).map(row => ({
    id: row.id || undefined,
    name: row.name,
    tax_rate_id: row.tax_rate_id || null,
    routing_station_id: row.routing_station_id || null,
    routing_station_name: row.routing_station_name || null,
    default_fire_mode: row.default_fire_mode || null,
    kds_display_group: row.kds_display_group || null,
    is_active: true,
  })),
})

const validateMenuCategories = (categories: MenuCategoryData[]) => {
  const blankIndex = normalizeMenuCategories(categories).findIndex(row => !row.name.trim())
  if (blankIndex >= 0) {
    throw new Error(`Menu category ${blankIndex + 1} needs a name. Use Remove to delete it.`)
  }
}

const checkWorkflowSettingsToPayload = (data: OnboardingData) => {
  const settings = normalizeCheckWorkflowSettings(data.check_workflow_settings)
  const holdPresetMinutes = Array.from(new Set(settings.hold_preset_minutes.map(Number).filter(minutes => Number.isFinite(minutes) && minutes > 0))).slice(0, 8)
  return {
    ...settings,
    max_split_count: Math.max(1, Math.min(MAX_SPLIT_COUNT, Number(settings.max_split_count || MAX_SPLIT_COUNT))),
    default_preauth_amount: settings.default_preauth_amount === '' ? null : Number(settings.default_preauth_amount),
    default_hold_minutes: Math.max(1, Math.min(360, Number(settings.default_hold_minutes || 10))),
    sent_item_correction_window_minutes: Math.max(0, Math.min(15, Number(settings.sent_item_correction_window_minutes || 0))),
    hold_preset_minutes: holdPresetMinutes.length > 0 ? holdPresetMinutes : defaultCheckWorkflowSettings().hold_preset_minutes,
    notes: settings.notes.trim() || null,
  }
}

const tipPayrollToPayload = (data: OnboardingData) => {
  const settings = normalizeTipPayrollSettings(data.tip_payroll_settings, data.job_codes)
  const roleRulesPayload = (rules: TipRoleRuleData[]) => rules.map(rule => ({
    ...rule,
    pool_points: rule.pool_points === '' ? null : Number(rule.pool_points),
    pool_contribution_percent: rule.pool_contribution_percent === '' ? null : Number(rule.pool_contribution_percent),
    tipout_split_basis: rule.tipout_split_basis === 'even' ? 'even' : 'hours',
    tipouts: (rule.tipouts || [])
      .filter(item => item.target_role && item.percent !== '' && Number(item.percent) > 0)
      .map(item => ({
        target_role: item.target_role,
        percent: Number(item.percent),
        basis: item.basis === 'sales' ? 'sales' : 'tips',
        sales_category: item.sales_category || null,
        basis_scope: item.basis_scope === 'restaurant' ? 'restaurant' : 'own',
      })),
    tipout_percent: rule.tipout_percent === '' ? null : Number(rule.tipout_percent),
    tipout_target_role: rule.tipout_target_role || null,
    notes: rule.notes || null,
  }))
  return {
    ...settings,
    credit_card_fee_percent: settings.credit_card_fee_percent === '' ? null : Number(settings.credit_card_fee_percent),
    role_tip_rules: roleRulesPayload(settings.role_tip_rules),
    category_tip_profiles: settings.category_tip_profiles.map(profile => ({
      ...profile,
      role_tip_rules: roleRulesPayload(profile.role_tip_rules),
      item_overrides: profile.item_overrides.map(override => ({ ...override, role_tip_rules: roleRulesPayload(override.role_tip_rules) })),
    })),
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
    section_behaviors: normalizeSectionBehaviors(input.section_behaviors, sections),
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
    const headers = await getApiHeaders()
    const response = await fetch(`${RESERVATIONS_API_BASE_URL}/locations/${restaurantId}/reservation-settings`, { headers })
    if (!response.ok) return null
    const body = await response.json()
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
  const headers = await getApiHeaders()
  const response = await fetch(`${RESERVATIONS_API_BASE_URL}/locations/${restaurantId}/reservation-settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      bookingHorizonDays: Number(patch.reservation_online_booking_horizon_days),
      gracePeriodMinutes: Number(patch.reservation_online_grace_period_minutes),
      defaultSlotIntervalMinutes: Number(patch.reservation_slot_interval_minutes),
      servicePeriods,
      timingPolicies: patch.timingPolicies,
    }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(asString(isRecord(body) ? body.message : null) || `Saving reservation timing failed (${response.status})`)
  }
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
  const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/job-codes`, {
    headers: await getApiHeaders(),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(asString(body.detail) || asString(body.message) || `Loading roles failed (${response.status})`)
  }
  return response.json()
}

const fetchTipPayrollSettings = async (restaurantId: string) => {
  const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/tips-payroll-settings`, {
    headers: await getApiHeaders(),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(asString(body.detail) || asString(body.message) || `Loading tips and payroll failed (${response.status})`)
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
  const isAuthLoading = auth.isLoading
  const isRestaurantLoading = auth.restaurant.isLoading
  const navigate = useNavigate()
  const location = useLocation()
  const isSetupEditor = /^\/(?:reseller\/)?restaurants\/[^/]+\/setup\/?$/.test(location.pathname)
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
    const [hoursResult, sectionsResult, taxesChargesResult, discountRulesResult, menuCategoriesResult, managerControlsResult, closeoutSettingsResult, checkWorkflowResult, jobCodesResult, tipPayrollResult, reservationSettingsResult] = await Promise.all([
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
      seating_capacity: restaurant.seating_capacity,
      table_count: restaurant.table_count,
      operating_hours: normalizeOperatingHours(hoursResult.data),
      sections: sectionNames.length > 0 ? sectionNames : INITIAL_DATA.sections,
      section_behaviors: normalizeSectionBehaviors(sectionRows, sectionNames),
      tax_rates: normalizeTaxRates(isRecord(taxesChargesResult) ? taxesChargesResult.tax_rates : []),
      service_charges: normalizeServiceCharges(isRecord(taxesChargesResult) ? taxesChargesResult.service_charges : []),
      discount_rules: normalizeDiscountRules(isRecord(discountRulesResult) ? discountRulesResult.discount_rules : []),
      menu_categories: normalizeMenuCategories(isRecord(menuCategoriesResult) ? menuCategoriesResult.categories : []),
      role_permissions: normalizeRolePermissions(isRecord(managerControlsResult) ? managerControlsResult.role_permissions : [], jobCodes),
      closeout_settings: normalizeCloseoutSettings(closeoutSettingsResult),
      check_workflow_settings: normalizeCheckWorkflowSettings(checkWorkflowResult),
      job_codes: jobCodes,
      ...configData,
      tip_payroll_settings: normalizeTipPayrollSettings(tipPayrollResult, jobCodes),
      ...reservationTimingFromSettings(reservationSettingsResult),
    }
  }, [runWithTimeout])

  const fetchDraftRestaurant = useCallback(async (draftRestaurantId: string): Promise<Restaurant | null> => {
    const { data: restaurantRow, error: fetchError } = await runWithTimeout(
      () =>
        supabase
          .from('restaurants')
          .select('*')
          .eq('id', draftRestaurantId)
          .maybeSingle(),
      'Loading saved onboarding restaurant timed out. Please retry.'
    )

    if (fetchError) {
      console.warn('[Onboarding] Could not load saved onboarding restaurant:', fetchError.message)
      return null
    }

    return restaurantRow as Restaurant | null
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
      const shouldApplyLocalDraft = Boolean(
        localDraft &&
        (
          !isNewRestaurantFlow ||
          !restaurantId ||
          (restaurantId && localDraft.restaurantId === restaurantId)
        )
      )
      if (localDraft && shouldApplyLocalDraft) {
        mergedData = mergeOnboardingData(mergedData, localDraft.data)
        resolvedRestaurantId = localDraft.restaurantId
        resolvedStep = localDraft.currentStep
      }

      const newFlowCreatedRestaurant =
        isNewRestaurantFlow &&
        restaurantId &&
        currentRestaurant?.id === restaurantId
          ? currentRestaurant
          : null
      const newFlowDraftRestaurant =
        isNewRestaurantFlow &&
        !newFlowCreatedRestaurant &&
        localDraft?.restaurantId
          ? await fetchDraftRestaurant(localDraft.restaurantId)
          : null
      const newFlowSelectedRestaurant =
        isNewRestaurantFlow &&
        !newFlowCreatedRestaurant &&
        !newFlowDraftRestaurant &&
        currentRestaurant &&
        !currentRestaurant.onboarding_completed_at
          ? currentRestaurant
          : null

      const candidateRestaurant = shouldUseCurrentRestaurant
        ? currentRestaurant
        : newFlowCreatedRestaurant || newFlowDraftRestaurant || newFlowSelectedRestaurant
      const onboardingRestaurant =
        candidateRestaurant &&
        (isSetupEditor || !candidateRestaurant.onboarding_completed_at)
          ? candidateRestaurant
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
    isAuthLoading,
    isRestaurantLoading,
    currentRestaurant?.id,
    currentRestaurantStep,
    currentRestaurantUpdatedAt,
    currentRestaurant?.onboarding_completed_at,
    restaurantId,
    shouldUseCurrentRestaurant,
    isSetupEditor,
    isNewRestaurantFlow,
    hydrateFromRestaurant,
    fetchDraftRestaurant,
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
      const response = await runWithTimeout(
        async () => fetch(`${API_CONFIG.baseUrl}/restaurants/${activeRestaurantId}/tips-payroll-settings`, {
          method: 'PUT',
          headers: await getApiHeaders(),
          body: JSON.stringify(tipPayrollToPayload(data)),
        }),
        'Saving tips and payroll timed out. Please retry.'
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(asString(body.detail) || asString(body.message) || `Saving tips and payroll failed (${response.status})`)
      }

      const saved = await response.json().catch(() => ({}))
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
      const sectionBehaviors = normalizeSectionBehaviors(data.section_behaviors, sectionNames)
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
        section_behaviors: normalizeSectionBehaviors(saved, savedNames),
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
  const saveMenuCategories = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      validateMenuCategories(data.menu_categories)
      const activeRestaurantId = getActiveRestaurantId()
      const response = await runWithTimeout(
        async () => fetch(`${API_CONFIG.baseUrl}/restaurants/${activeRestaurantId}/menu/categories`, {
          method: 'PUT',
          headers: await getApiHeaders(),
          body: JSON.stringify(menuCategoriesToPayload(data)),
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
  }, [data, getActiveRestaurantId, isSetupEditor, runWithTimeout])

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
    completeOnboarding,
    goToDashboard,

    // Helpers
    setError,
  }
}

export type UseOnboardingReturn = ReturnType<typeof useOnboarding>

// Canonical settings shapes. These match what the main API (localhost:8002,
// /api/v1) returns and accepts for the setup/onboarding/mobile-admin config
// surfaces; numeric inputs stay strings while editable and become numbers in
// the *Payload builders.

export type TaxAppliesTo = 'all' | 'food' | 'beer_wine' | 'liquor' | 'non_alcohol' | 'merchandise' | 'alcohol'

export interface TaxRateData {
  id?: string | null
  name: string
  rate: string
  applies_to: TaxAppliesTo
  is_default: boolean
  is_inclusive: boolean
  is_active?: boolean
}

export interface CategoryTaxAssignmentData {
  category_name: string
  tax_name: string | null
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

export interface AutoGratuityRuleData {
  party_threshold: string
  percent: string
}

export interface AutoGratuityData {
  enabled: boolean
  party_threshold: string
  percent: string
  label: string
  assigned_to_employee: boolean
  rules: AutoGratuityRuleData[]
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
  assigned_to_employee: boolean
  minimum_party_size: string
  tip_prompt_mode: 'normal' | 'additional' | 'disabled'
}

export interface MenuCategoryData {
  id?: string | null
  name: string
  tax_rate_id: string
  routing_station_id: string
  routing_station_name: string
  default_course_type?: 'none' | 'appetizer' | 'entree' | 'dessert' | 'drink' | 'side' | 'other' | null
  default_fire_mode?: 'inherit' | 'immediate' | 'hold' | 'manual' | 'by_course' | ''
  prep_time_minutes?: string | null
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
  suggested_tip_basis?: 'before_discount' | 'after_discount'
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
  can_adjust_gratuity: boolean
  can_edit_menu: boolean
  can_edit_employees: boolean
  can_edit_schedules: boolean
  can_view_reports: boolean
  can_close_drawer: boolean
  can_close_day: boolean
  can_reopen_business_day: boolean
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
  opening_bank_source: 'none' | 'fixed' | 'previous_retained'
  opening_bank_default: string
  track_deposit_at_close: boolean
  blind_drawer_close: boolean
  allow_paid_in_out: boolean
  require_manager_for_drawer_open: boolean
  cash_drop_threshold: string
  cash_variance_threshold: string
  server_require_all_checks_closed: boolean
  server_require_tabs_closed: boolean
  server_require_cash_tips_declared: boolean
  server_require_credit_tips_reviewed: boolean
  deduct_credit_card_tips_from_cash_due: boolean
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
  eod_email_on_close: boolean
  eod_email_formats: Array<'pdf' | 'xlsx'>
}

// Only fields the POS enforces; the dropped split/merge/transfer/tab-close
// toggles were never read by any POS code path.
export interface CheckWorkflowSettingsData {
  seat_numbers_enabled: boolean
  seat_number_required: boolean
  course_required: boolean
  split_by_seat_enabled: boolean
  split_by_item_enabled: boolean
  allow_bar_tabs: boolean
  tab_name_required: boolean
  card_preauth_required: boolean
  default_preauth_amount: string
  require_manager_for_reopen: boolean
  allow_hold_and_fire: boolean
  default_order_fire_mode: 'manual' | 'immediate' | 'by_course'
  default_hold_minutes: string
  hold_preset_minutes: number[]
  allow_manual_hold: boolean
  allow_item_seat_move: boolean
  allow_multi_item_seat_move: boolean
  require_manager_for_item_move_after_send: boolean
  sent_item_correction_window_minutes: string
  to_go_enabled: boolean
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
  assigned_count?: number
}

/**
 * Loose job-code shape accepted by functions that only read a few fields —
 * lets API wire types (optional is_tipped, plain-string permission_tier)
 * flow in without casts.
 */
export interface JobCodeLike {
  code: string
  label?: string
  is_active?: boolean
  is_tipped?: boolean
  permission_tier?: string
}

export interface HeadcountPolicyData {
  driver_role: string
  tiers: Array<{
    min_count: number
    max_count: number | null
    allocations: Array<{ target_role: string; unallocated: boolean; percent: string }>
  }>
}

export interface TipoutData {
  target_role: string
  percent: string
  basis: 'tips' | 'sales'
  sales_category: string
  basis_scope: 'own' | 'restaurant'
  headcount?: HeadcountPolicyData | null
}

export interface TipRoleRuleData {
  role_key: string
  tip_eligible: boolean
  contributes_to_pool: boolean
  receives_from_pool: boolean
  pool_points: string
  pool_contribution_percent: string
  pool_share_percent: string
  tipout_split_basis: 'hours' | 'even' | 'weights'
  tipout_split_weights: Array<{ staff_id: string; weight: string }>
  tipouts: TipoutData[]
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

export type TipoutWeekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export type WeekdayTipoutOverridesData = Partial<Record<TipoutWeekday, {
  mode: 'disabled' | 'custom'
  role_tip_rules?: TipRoleRuleData[]
  category_tip_profiles?: CategoryTipProfileData[]
}>>

export interface TipPayrollSettingsData {
  tip_distribution_mode: 'individual' | 'pooled' | 'role_based' | 'sales_based' | 'hours_based' | 'points_based' | 'role_shares'
  cash_tip_declaration_mode: 'not_tracked' | 'declared_by_employee' | 'declared_by_manager' | 'required_checkout'
  credit_tip_payout_timing: 'nightly' | 'payroll'
  expected_drawer_payouts_enabled: boolean
  cash_tip_payout_timing: 'immediate' | 'payroll'
  cash_employee_gratuity_payout_timing: 'immediate' | 'payroll'
  card_employee_gratuity_payout_timing: 'nightly' | 'payroll'
  tipout_payout_timing: 'nightly' | 'payroll'
  payroll_provider: string
  payroll_export_frequency: 'daily' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'manual'
  payroll_period_start_weekday: number
  payroll_period_anchor_date: string
  payroll_semimonthly_cutoff_day: number
  payroll_report_default_period: 'last_completed' | 'current_open'
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
  weekday_tipout_overrides: WeekdayTipoutOverridesData
  notes: string
}

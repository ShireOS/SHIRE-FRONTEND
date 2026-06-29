import { apiRequest } from './mobileApi';
import { getSBClient } from '../../packages/supabase';

export type RestaurantSection = {
  id: string;
  restaurant_id: string;
  name: string;
  is_active?: boolean;
  created_at?: string;
};

export async function fetchRestaurantSections(restaurantId: string) {
  return apiRequest<RestaurantSection[]>(`/restaurants/${restaurantId}/sections`);
}

export async function saveRestaurantSections(restaurantId: string, sections: string[]) {
  return apiRequest<RestaurantSection[]>(`/restaurants/${restaurantId}/sections`, {
    method: 'PUT',
    body: { sections },
  });
}

export type FloorPlanTable = {
  id: string;
  table_number?: string | null;
  position: {
    center_x: number;
    center_y: number;
    width: number;
    height: number;
  };
  shape: string;
  capacity: number;
  section_id?: string | null;
  section_name?: string | null;
  setup_complete?: boolean;
  confidence?: number | null;
  notes?: string | null;
};

export type FloorPlanPayload = {
  has_floor_plan: boolean;
  image_url?: string | null;
  tables: FloorPlanTable[];
  total_tables: number;
  total_capacity: number;
  incomplete_tables?: number;
};

export async function fetchFloorPlan(restaurantId: string) {
  return apiRequest<FloorPlanPayload>(`/restaurants/${restaurantId}/floor-plan`);
}

export async function saveFloorPlanTables(restaurantId: string, tables: FloorPlanTable[]) {
  return apiRequest<FloorPlanPayload>(`/restaurants/${restaurantId}/floor-plan/save`, {
    method: 'POST',
    body: {
      image_url: null,
      tables,
    },
  });
}

export type TaxRate = {
  id?: string | null;
  restaurant_id?: string;
  name: string;
  rate: string | number;
  applies_to: 'all' | 'food' | 'alcohol' | 'non_alcohol' | 'merchandise';
  is_default: boolean;
  is_inclusive: boolean;
  is_active?: boolean;
};

export type ServiceCharge = {
  id?: string | null;
  restaurant_id?: string;
  name: string;
  charge_type: 'percentage' | 'fixed';
  amount: string | number;
  applies_to: 'all' | 'dine_in' | 'bar' | 'takeout' | 'delivery' | 'catering' | 'large_party';
  taxable: boolean;
  auto_apply: boolean;
  is_tip: boolean;
  is_active?: boolean;
};

export type TaxesChargesPayload = {
  tax_rates: TaxRate[];
  service_charges: ServiceCharge[];
};

export async function fetchTaxesCharges(restaurantId: string) {
  return apiRequest<TaxesChargesPayload>(`/restaurants/${restaurantId}/taxes-charges`);
}

export async function saveTaxesCharges(restaurantId: string, payload: TaxesChargesPayload) {
  return apiRequest<TaxesChargesPayload>(`/restaurants/${restaurantId}/taxes-charges`, {
    method: 'PUT',
    body: payload,
  });
}

export type MenuCategory = {
  id?: string | null;
  restaurant_id?: string;
  name: string;
  tax_rate_id?: string | null;
  tax_rate_name?: string | null;
  routing_station_id?: string | null;
  routing_station_name?: string | null;
  default_course_type?: 'none' | 'appetizer' | 'entree' | 'dessert' | 'drink' | 'side' | 'other' | null;
  default_fire_mode?: 'inherit' | 'immediate' | 'hold' | 'manual' | 'by_course' | null;
  prep_time_minutes?: string | number | null;
  kds_display_group?: string | null;
  is_active?: boolean;
};

export type MenuCategorySetupPayload = {
  categories: MenuCategory[];
  tax_rates?: Array<{ id: string; name: string; rate?: string | number | null }>;
  stations?: Array<{ id: string; name: string }>;
};

export async function fetchMenuCategories(restaurantId: string) {
  return apiRequest<MenuCategorySetupPayload>(`/restaurants/${restaurantId}/menu/categories`);
}

export async function saveMenuCategories(restaurantId: string, payload: MenuCategorySetupPayload) {
  return apiRequest<MenuCategorySetupPayload>(`/restaurants/${restaurantId}/menu/categories`, {
    method: 'PUT',
    body: { categories: payload.categories },
  });
}

export type DiscountRule = {
  id?: string | null;
  restaurant_id?: string;
  name: string;
  discount_type: 'discount' | 'comp' | 'promo' | 'employee_meal' | 'service_recovery';
  applies_to: 'item' | 'check' | 'both';
  value_type: 'percent' | 'fixed' | 'open';
  default_value: string | number | null;
  editable_by_employee: boolean;
  min_value: string | number | null;
  max_value: string | number | null;
  allowed_roles: string[];
  requires_manager_approval: boolean;
  tax_behavior: 'reduce_taxable_amount' | 'apply_after_tax' | 'no_tax_impact';
  reason_required: boolean;
  service_modes: string[];
  days_of_week: number[];
  is_active?: boolean;
};

export type DiscountRulesPayload = {
  discount_rules: DiscountRule[];
};

export async function fetchDiscountRules(restaurantId: string) {
  return apiRequest<DiscountRulesPayload>(`/restaurants/${restaurantId}/discount-rules`);
}

export async function saveDiscountRules(restaurantId: string, payload: DiscountRulesPayload) {
  return apiRequest<DiscountRulesPayload>(`/restaurants/${restaurantId}/discount-rules`, {
    method: 'PUT',
    body: payload,
  });
}

export type RolePermission = {
  id?: string | null;
  restaurant_id?: string;
  role_key: string;
  can_refund: boolean;
  refund_limit: string | number | null;
  can_void: boolean;
  can_comp: boolean;
  can_discount: boolean;
  discount_limit_percent: string | number | null;
  can_open_cash_drawer: boolean;
  can_no_sale: boolean;
  can_paid_in_out: boolean;
  can_adjust_tips: boolean;
  can_edit_menu: boolean;
  can_edit_employees: boolean;
  can_edit_schedules: boolean;
  can_view_reports: boolean;
  can_close_drawer: boolean;
  can_close_day: boolean;
  can_change_payment_settings: boolean;
  require_manager_pin_for_approval: boolean;
};

export type ManagerControlsPayload = {
  role_permissions: RolePermission[];
};

export async function fetchManagerControls(restaurantId: string) {
  return apiRequest<ManagerControlsPayload>(`/restaurants/${restaurantId}/manager-controls`);
}

export async function saveManagerControls(restaurantId: string, payload: ManagerControlsPayload) {
  return apiRequest<ManagerControlsPayload>(`/restaurants/${restaurantId}/manager-controls`, {
    method: 'PUT',
    body: payload,
  });
}

export type CloseoutSettings = {
  cash_tracking_mode: 'shared_drawer' | 'per_terminal' | 'per_employee' | 'no_cash';
  require_starting_bank: boolean;
  blind_drawer_close: boolean;
  allow_paid_in_out: boolean;
  require_manager_for_drawer_open: boolean;
  cash_drop_threshold: string | number | null;
  cash_variance_threshold: string | number | null;
  server_require_all_checks_closed: boolean;
  server_require_tabs_closed: boolean;
  server_require_cash_tips_declared: boolean;
  server_require_credit_tips_reviewed: boolean;
  server_require_tipout_entry: boolean;
  server_require_manager_approval: boolean;
  server_checkout_report_delivery: 'none' | 'print' | 'email' | 'print_and_email';
  allow_clockout_before_checkout: boolean;
  eod_batch_close_mode: 'automatic' | 'manual' | 'prompt_manager';
  eod_require_drawers_closed: boolean;
  eod_require_servers_checked_out: boolean;
  eod_require_open_checks_resolved: boolean;
  eod_require_paid_outs_reviewed: boolean;
  eod_require_tip_adjustments_reviewed: boolean;
  eod_report_recipients: string[];
  eod_reports: string[];
};

export async function fetchCloseoutSettings(restaurantId: string) {
  return apiRequest<CloseoutSettings>(`/restaurants/${restaurantId}/closeout-settings`);
}

export async function saveCloseoutSettings(restaurantId: string, payload: CloseoutSettings) {
  return apiRequest<CloseoutSettings>(`/restaurants/${restaurantId}/closeout-settings`, {
    method: 'PUT',
    body: payload,
  });
}

export type CheckWorkflowSettings = {
  seat_numbers_enabled: boolean;
  seat_number_required: boolean;
  course_required: boolean;
  allow_split_checks: boolean;
  split_by_seat_enabled: boolean;
  split_by_item_enabled: boolean;
  split_evenly_enabled: boolean;
  max_split_count: string | number;
  allow_partial_payments: boolean;
  require_manager_for_split_after_payment: boolean;
  allow_check_merge: boolean;
  allow_table_transfer: boolean;
  allow_server_transfer: boolean;
  require_manager_for_transfer: boolean;
  allow_bar_tabs: boolean;
  tab_name_required: boolean;
  card_preauth_required: boolean;
  default_preauth_amount: string | number | null;
  allow_tabs_without_table: boolean;
  auto_close_paid_tabs: boolean;
  allow_reopen_closed_checks: boolean;
  require_manager_for_reopen: boolean;
  allow_send_before_required_modifiers: boolean;
  allow_hold_and_fire: boolean;
  default_order_fire_mode: 'manual' | 'immediate' | 'by_course';
  print_guest_check_by_default: boolean;
  notes?: string | null;
};

export async function fetchCheckWorkflowSettings(restaurantId: string) {
  return apiRequest<CheckWorkflowSettings>(`/restaurants/${restaurantId}/check-workflow-settings`);
}

export async function saveCheckWorkflowSettings(restaurantId: string, payload: CheckWorkflowSettings) {
  return apiRequest<CheckWorkflowSettings>(`/restaurants/${restaurantId}/check-workflow-settings`, {
    method: 'PUT',
    body: payload,
  });
}

export type TipRoleRule = {
  role_key: string;
  tip_eligible: boolean;
  contributes_to_pool: boolean;
  receives_from_pool: boolean;
  pool_points: string | number | null;
  tipout_percent: string | number | null;
  tipout_target_role: string | null;
  notes?: string | null;
};

export type TipPayrollSettings = {
  tip_distribution_mode: 'individual' | 'pooled' | 'role_based' | 'sales_based' | 'hours_based' | 'points_based';
  cash_tip_declaration_mode: 'not_tracked' | 'declared_by_employee' | 'declared_by_manager' | 'required_checkout';
  credit_tip_payout_timing: 'nightly' | 'payroll';
  payroll_provider: string | null;
  payroll_export_frequency: 'daily' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'manual';
  tip_pooling_enabled: boolean;
  tip_pool_reset: 'shift' | 'day' | 'pay_period';
  tipout_basis: 'none' | 'sales' | 'tips' | 'hours' | 'points' | 'custom';
  tipout_sales_includes_tax: boolean;
  tipout_include_managers: boolean;
  require_tipout_at_checkout: boolean;
  allow_manager_tip_adjustments: boolean;
  auto_withhold_credit_card_fees: boolean;
  credit_card_fee_percent: string | number | null;
  role_tip_rules: TipRoleRule[];
  notes?: string | null;
};

export async function fetchTipPayrollSettings(restaurantId: string) {
  return apiRequest<TipPayrollSettings>(`/restaurants/${restaurantId}/tips-payroll-settings`);
}

export async function saveTipPayrollSettings(restaurantId: string, payload: TipPayrollSettings) {
  return apiRequest<TipPayrollSettings>(`/restaurants/${restaurantId}/tips-payroll-settings`, {
    method: 'PUT',
    body: payload,
  });
}

export type RestaurantSetupConfig = {
  legal_business_name?: string;
  dba_name?: string;
  ein?: string;
  legal_contact_name?: string;
  legal_contact_title?: string;
  legal_contact_email?: string;
  legal_contact_phone?: string;
  tos_signature_data_url?: string;
  tos_signed_at?: string;
  tos_version?: string;
  bank_account_holder?: string;
  bank_name?: string;
  bank_routing_number?: string;
  bank_account_number?: string;
  payout_schedule?: 'daily' | 'weekly' | 'manual';
  refund_funding_source?: 'processor_balance' | 'bank_account';
  batch_close_mode?: 'automatic' | 'manual';
  batch_close_time?: string;
  credit_card_tip_payout?: 'nightly' | 'payroll';
  refund_approval_threshold?: string;
  service_modes?: string[];
  default_guest_flow?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function fetchRestaurantSetupConfig(restaurantId: string): Promise<RestaurantSetupConfig> {
  const client = getSBClient();
  const { data, error } = await client
    .from('restaurants')
    .select('config')
    .eq('id', restaurantId)
    .single();
  if (error) throw error;
  return isRecord(data?.config) ? data.config as RestaurantSetupConfig : {};
}

export async function saveRestaurantSetupConfig(
  restaurantId: string,
  patch: RestaurantSetupConfig,
): Promise<RestaurantSetupConfig> {
  const client = getSBClient();
  const current = await fetchRestaurantSetupConfig(restaurantId);
  const nextConfig = { ...current, ...patch };
  const { data, error } = await client
    .from('restaurants')
    .update({ config: nextConfig, updated_at: new Date().toISOString() })
    .eq('id', restaurantId)
    .select('config')
    .single();
  if (error) throw error;
  return isRecord(data?.config) ? data.config as RestaurantSetupConfig : nextConfig;
}

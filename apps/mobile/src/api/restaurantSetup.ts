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

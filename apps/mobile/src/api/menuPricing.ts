import { apiRequest } from './mobileApi';

export type PricingWorkspace = {
  restaurant_id: string;
  menu_items: { id: string; name: string; category?: string | null; price?: number | null }[];
  categories: { id: string; name: string }[];
  rules: Record<string, any>[];
  available_restaurants: { id: string; name: string }[];
  groups: { id: string; name: string; color?: string; restaurant_ids?: string[] }[];
  can_propagate: boolean;
};

export type PricingInput = {
  name: string;
  restaurant_ids: string[];
  scope_type: 'item' | 'category' | 'all';
  item_ids: string[];
  category_ids: string[];
  adjustment_type: 'percent_off' | 'amount_off' | 'percent_up' | 'amount_up' | 'fixed';
  adjustment_value: number;
  timing: 'now' | 'scheduled' | 'window' | 'weekly';
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  days_of_week?: number[];
  priority?: number;
};

export type PricingSpecial = {
  id: string;
  menu_item_id: string;
  display_name?: string | null;
  note?: string | null;
  special_price?: number | null;
  schedule_kind: 'manual' | 'weekly' | 'date_window' | 'cycle';
  days_of_week?: number[];
  start_time?: string | null;
  end_time?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  cycle_anchor_date?: string | null;
  cycle_length_days?: number | null;
  cycle_day_number?: number | null;
  is_active: boolean;
};

export type PricingSpecialInput = Omit<PricingSpecial, 'id'> & {
  sort_order?: number;
  expires_at?: string | null;
};

const base = (restaurantId: string) => `/restaurants/${restaurantId}/menu/pricing`;

export const fetchPricingWorkspace = (restaurantId: string) =>
  apiRequest<PricingWorkspace>(base(restaurantId));

export const previewPricing = (restaurantId: string, body: PricingInput) =>
  apiRequest<any>(`${base(restaurantId)}/preview`, { method: 'POST', body });

export const applyPricing = (restaurantId: string, body: PricingInput) =>
  apiRequest<any>(`${base(restaurantId)}/apply`, { method: 'POST', body });

export const updatePricingBatch = (
  restaurantId: string,
  batchId: string,
  restaurantIds: string[],
  action: 'pause' | 'resume' | 'archive',
) => apiRequest<any>(`${base(restaurantId)}/batches/${batchId}`, {
  method: 'PATCH',
  body: { restaurant_ids: restaurantIds, action },
});

export const fetchPricingSpecials = (restaurantId: string) =>
  apiRequest<PricingSpecial[]>(`${base(restaurantId)}/specials`);

export const createPricingSpecial = (restaurantId: string, body: PricingSpecialInput) =>
  apiRequest<PricingSpecial>(`${base(restaurantId)}/specials`, { method: 'POST', body });

export const updatePricingSpecial = (
  restaurantId: string,
  specialId: string,
  body: Partial<Pick<PricingSpecial, 'display_name' | 'note' | 'special_price' | 'is_active'>>,
) => apiRequest<PricingSpecial>(`${base(restaurantId)}/specials/${specialId}`, { method: 'PATCH', body });

export const archivePricingSpecial = (restaurantId: string, specialId: string) =>
  apiRequest<{ id: string; archived: boolean }>(`${base(restaurantId)}/specials/${specialId}`, { method: 'DELETE' });

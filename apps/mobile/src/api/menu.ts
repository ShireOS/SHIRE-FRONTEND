import { apiGet, apiPost, apiRequest } from './mobileApi';
import { getSBClient } from '../../packages/supabase';

export type AdminMenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  category: string | null;
  menu_category_id?: string | null;
  description: string | null;
  price: number | null;
  cost: number | null;
  is_available: boolean | null;
  availability_mode?: 'always' | 'schedule' | 'seasonal' | 'manual';
  availability_days?: number[];
  availability_start_time?: string | null;
  availability_end_time?: string | null;
  availability_service_modes?: string[];
  availability_start_date?: string | null;
  availability_end_date?: string | null;
  availability_notes?: string | null;
  course_type?: 'none' | 'appetizer' | 'entree' | 'dessert' | 'drink' | 'side' | 'other' | null;
  fire_mode?: 'inherit' | 'immediate' | 'hold' | 'manual' | 'by_course' | null;
  routing_station_id?: string | null;
  prep_time_minutes?: number | string | null;
  kds_display_group?: string | null;
  item_routing_notes?: string | null;
  updated_at: string | null;
  image_url?: string | null;
};

export type AdminMenuItemCreateInput = {
  name: string;
  category: string;
  price: number;
  description?: string | null;
  is_available?: boolean;
  image_url?: string | null;
  availability_mode?: AdminMenuItem['availability_mode'];
  availability_days?: number[];
  availability_start_time?: string | null;
  availability_end_time?: string | null;
  availability_service_modes?: string[];
  availability_start_date?: string | null;
  availability_end_date?: string | null;
  availability_notes?: string | null;
  course_type?: AdminMenuItem['course_type'];
  fire_mode?: AdminMenuItem['fire_mode'];
  routing_station_id?: string | null;
  prep_time_minutes?: number | string | null;
  kds_display_group?: string | null;
  item_routing_notes?: string | null;
};

export type AdminModifier = {
  id: string;
  restaurant_id: string;
  name: string;
  price_delta: number;
  group_name: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number | null;
  free_modifier_count: number;
  allow_quantity: boolean;
  is_default: boolean;
  sort_order: number;
  routing_station_id: string | null;
  print_on_kitchen_ticket: boolean;
  modifier_notes: string | null;
  is_active: boolean;
  tax_rate_id: string | null;
  reporting_category_id: string | null;
  item_ids: string[];
};

export type AdminModifierInput = Pick<
  AdminModifier,
  'name' | 'price_delta' | 'group_name' | 'print_on_kitchen_ticket' | 'modifier_notes' | 'is_active'
>;

const modifierPath = (restaurantId: string) => (
  `/restaurants/${encodeURIComponent(restaurantId)}/menu/modifiers`
);

export function fetchAdminModifiers(restaurantId: string) {
  return apiGet<AdminModifier[]>(modifierPath(restaurantId));
}

export function createAdminModifier(restaurantId: string, input: AdminModifierInput) {
  return apiPost<AdminModifier>(modifierPath(restaurantId), input);
}

export function updateAdminModifier(
  restaurantId: string,
  modifierId: string,
  patch: Partial<AdminModifierInput>,
) {
  return apiRequest<AdminModifier>(
    `${modifierPath(restaurantId)}/${encodeURIComponent(modifierId)}`,
    { method: 'PUT', body: patch },
  );
}

export function replaceAdminModifierItems(
  restaurantId: string,
  modifierId: string,
  itemIds: string[],
) {
  return apiRequest<AdminModifier>(
    `${modifierPath(restaurantId)}/${encodeURIComponent(modifierId)}/items`,
    { method: 'PUT', body: { item_ids: itemIds } },
  );
}

export type MenuItemInsight = {
  item_id: string;
  lookback_days: number;
  times_ordered: number | null;
  orders_per_day: number | null;
  demand_score: number | null;
  combined_score: number | null;
  margin_pct: number | null;
  rank: number | null;
  revenue: number | null;
  recommendation_reason: string | null;
  source: 'analytics' | 'pos_dashboard' | 'pos_orders' | 'none';
};

type MenuRankingItem = {
  id: string;
  combined_score?: number | null;
  demand_score?: number | null;
  margin_pct?: number | null;
  orders_per_day?: number | null;
  times_ordered?: number | null;
  rank?: number | null;
};

type MenuRankingResponse = {
  items?: MenuRankingItem[];
};

type MenuRecommendationResponse = {
  recommendations?: { id: string; reason?: string | null }[];
};

type ManagerDashboardResponse = {
  date?: string;
  top_items?: { name?: string; quantity?: number; sales?: number }[];
};

const MENU_ITEM_SELECT = 'id, restaurant_id, name, category, menu_category_id, description, price, cost, is_available, availability_mode, availability_days, availability_start_time, availability_end_time, availability_service_modes, availability_start_date, availability_end_date, availability_notes, course_type, fire_mode, routing_station_id, prep_time_minutes, kds_display_group, item_routing_notes, updated_at';

export async function fetchAdminMenuItems(restaurantId: string): Promise<AdminMenuItem[]> {
  const client = getSBClient();
  const [itemsResult, images] = await Promise.all([
    client
      .from('menu_items')
      .select(MENU_ITEM_SELECT)
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null)
      .order('category', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true }),
    fetchMenuItemImages(restaurantId),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  return ((itemsResult.data || []) as AdminMenuItem[]).map((item) => ({
    ...item,
    image_url: images[item.id] || null,
  }));
}

function normalizeMenuItem(row: Partial<AdminMenuItem>, restaurantId: string): AdminMenuItem {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id || restaurantId),
    name: String(row.name || ''),
    category: row.category ?? null,
    menu_category_id: row.menu_category_id ?? null,
    description: row.description ?? null,
    price: row.price ?? null,
    cost: row.cost ?? null,
    is_available: row.is_available ?? true,
    availability_mode: row.availability_mode ?? 'always',
    availability_days: row.availability_days ?? [0, 1, 2, 3, 4, 5, 6],
    availability_start_time: row.availability_start_time ?? null,
    availability_end_time: row.availability_end_time ?? null,
    availability_service_modes: row.availability_service_modes ?? [],
    availability_start_date: row.availability_start_date ?? null,
    availability_end_date: row.availability_end_date ?? null,
    availability_notes: row.availability_notes ?? null,
    course_type: row.course_type ?? null,
    fire_mode: row.fire_mode ?? null,
    routing_station_id: row.routing_station_id ?? null,
    prep_time_minutes: row.prep_time_minutes ?? null,
    kds_display_group: row.kds_display_group ?? null,
    item_routing_notes: row.item_routing_notes ?? null,
    updated_at: row.updated_at ?? null,
    image_url: row.image_url ?? null,
  };
}

export async function createAdminMenuItem(
  restaurantId: string,
  input: AdminMenuItemCreateInput,
): Promise<AdminMenuItem> {
  const body = {
    name: input.name.trim(),
    category: input.category.trim() || 'Other',
    price: input.price,
    description: input.description?.trim() || null,
    is_available: input.is_available ?? true,
    availability_mode: input.availability_mode || 'always',
    availability_days: input.availability_days?.length ? input.availability_days : [0, 1, 2, 3, 4, 5, 6],
    availability_start_time: input.availability_start_time || null,
    availability_end_time: input.availability_end_time || null,
    availability_service_modes: input.availability_service_modes || [],
    availability_start_date: input.availability_start_date || null,
    availability_end_date: input.availability_end_date || null,
    availability_notes: input.availability_notes?.trim() || null,
    course_type: input.course_type || null,
    fire_mode: input.fire_mode || null,
    routing_station_id: input.routing_station_id || null,
    prep_time_minutes: input.prep_time_minutes === '' ? null : input.prep_time_minutes ?? null,
    kds_display_group: input.kds_display_group?.trim() || null,
    item_routing_notes: input.item_routing_notes?.trim() || null,
  };

  try {
    const created = await apiPost<Partial<AdminMenuItem>>('/manager/menu/items', body);
    if (created?.id) {
      const normalized = normalizeMenuItem(created, restaurantId);
      if (input.image_url?.trim()) {
        await setMenuItemImageUrl(restaurantId, normalized.id, input.image_url);
        normalized.image_url = input.image_url.trim();
      }
      return normalized;
    }
  } catch {
    // Fall through to Supabase. Some mobile builds point API_BASE_URL at the analytics service.
  }

  const client = getSBClient();
  const { data, error } = await client
    .from('menu_items')
    .insert({ restaurant_id: restaurantId, ...body })
    .select(MENU_ITEM_SELECT)
    .single();

  if (error) throw error;
  const created = data as AdminMenuItem;
  if (input.image_url?.trim()) {
    await setMenuItemImageUrl(restaurantId, created.id, input.image_url);
    created.image_url = input.image_url.trim();
  }
  return created;
}

export async function updateAdminMenuItem(
  restaurantId: string,
  itemId: string,
  patch: Partial<AdminMenuItem>,
): Promise<AdminMenuItem> {
  const body = {
    ...patch,
    availability_notes: patch.availability_notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  const client = getSBClient();
  const { data, error } = await client
    .from('menu_items')
    .update(body)
    .eq('restaurant_id', restaurantId)
    .eq('id', itemId)
    .select(MENU_ITEM_SELECT)
    .single();

  if (error) throw error;
  return data as AdminMenuItem;
}

export async function setMenuItemAvailability(
  restaurantId: string,
  itemId: string,
  isAvailable: boolean,
): Promise<AdminMenuItem | null> {
  try {
    await apiPost(
      `/restaurants/${encodeURIComponent(restaurantId)}/menu/items/${encodeURIComponent(itemId)}/${isAvailable ? 'un-86' : '86'}`,
    );
  } catch {
    const client = getSBClient();
    const { data, error } = await client
      .from('menu_items')
      .update({
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq('restaurant_id', restaurantId)
      .eq('id', itemId)
      .select(MENU_ITEM_SELECT)
      .single();

    if (error) throw error;
    return data as AdminMenuItem;
  }

  const client = getSBClient();
  const { data } = await client
    .from('menu_items')
    .select(MENU_ITEM_SELECT)
    .eq('restaurant_id', restaurantId)
    .eq('id', itemId)
    .maybeSingle();

  return (data as AdminMenuItem | null) ?? null;
}

export async function setMenuItemImageUrl(
  restaurantId: string,
  itemId: string,
  imageUrl: string | null,
): Promise<Record<string, string>> {
  const client = getSBClient();
  const { data, error } = await client
    .from('restaurants')
    .select('config')
    .eq('id', restaurantId)
    .single();

  if (error) throw error;

  const config = isRecord(data?.config) ? data.config : {};
  const currentImages = isRecord(config.menu_item_images) ? config.menu_item_images : {};
  const nextImages = { ...currentImages };
  const normalizedUrl = imageUrl?.trim();
  if (normalizedUrl) nextImages[itemId] = normalizedUrl;
  else delete nextImages[itemId];

  const nextConfig = {
    ...config,
    menu_item_images: nextImages,
  };

  const { error: updateError } = await client
    .from('restaurants')
    .update({ config: nextConfig, updated_at: new Date().toISOString() })
    .eq('id', restaurantId);

  if (updateError) throw updateError;
  return nextImages as Record<string, string>;
}

async function fetchMenuItemImages(restaurantId: string): Promise<Record<string, string>> {
  const client = getSBClient();
  const { data, error } = await client
    .from('restaurants')
    .select('config')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error || !isRecord(data?.config) || !isRecord(data.config.menu_item_images)) return {};

  return Object.fromEntries(
    Object.entries(data.config.menu_item_images)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export async function fetchMenuItemInsight(
  restaurantId: string,
  item: Pick<AdminMenuItem, 'id' | 'name' | 'price' | 'cost'>,
  lookbackDays = 30,
): Promise<MenuItemInsight> {
  const itemId = item.id;
  const [topResult, bottomResult, recommendationResult] = await Promise.allSettled([
    apiGet<MenuRankingResponse>(
      `/restaurants/${encodeURIComponent(restaurantId)}/menu/rankings/top?lookback_days=${lookbackDays}&limit=100`,
    ),
    apiGet<MenuRankingResponse>(
      `/restaurants/${encodeURIComponent(restaurantId)}/menu/rankings/bottom?lookback_days=${lookbackDays}&limit=100`,
    ),
    apiGet<MenuRecommendationResponse>(
      `/restaurants/${encodeURIComponent(restaurantId)}/menu/86-recommendations?lookback_days=${lookbackDays}`,
    ),
  ]);

  const rankedItems = [
    ...(topResult.status === 'fulfilled' ? topResult.value.items || [] : []),
    ...(bottomResult.status === 'fulfilled' ? bottomResult.value.items || [] : []),
  ];
  const ranked = rankedItems.find((item) => item.id === itemId);
  const recommendation = recommendationResult.status === 'fulfilled'
    ? recommendationResult.value.recommendations?.find((item) => item.id === itemId)
    : null;

  if (ranked) {
    return {
      item_id: itemId,
      lookback_days: lookbackDays,
      times_ordered: ranked.times_ordered ?? null,
      orders_per_day: ranked.orders_per_day ?? null,
      demand_score: ranked.demand_score ?? null,
      combined_score: ranked.combined_score ?? null,
      margin_pct: ranked.margin_pct ?? null,
      rank: ranked.rank ?? null,
      revenue: null,
      recommendation_reason: recommendation?.reason ?? null,
      source: 'analytics',
    };
  }

  const dashboardInsight = await fetchManagerDashboardInsight(item, lookbackDays);
  if (dashboardInsight) return dashboardInsight;

  return fetchPosOrderInsight(itemId, lookbackDays);
}

async function fetchManagerDashboardInsight(
  item: Pick<AdminMenuItem, 'id' | 'name' | 'price' | 'cost'>,
  lookbackDays: number,
): Promise<MenuItemInsight | null> {
  const days = recentLocalDateStrings(Math.min(lookbackDays, 7));
  const results = await Promise.allSettled(
    days.map((day) => apiGet<ManagerDashboardResponse>(`/manager/dashboard?date=${encodeURIComponent(day)}`)),
  );
  const targetName = normalizeName(item.name);
  let timesOrdered = 0;
  let revenue = 0;

  results.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    const row = result.value.top_items?.find((candidate) => normalizeName(candidate.name) === targetName);
    if (!row) return;
    timesOrdered += Number(row.quantity || 0);
    revenue += Number(row.sales || 0);
  });

  if (timesOrdered <= 0 && revenue <= 0) return null;

  const price = Number(item.price || 0);
  const cost = Number(item.cost || 0);
  const marginPct = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : null;

  return {
    item_id: item.id,
    lookback_days: days.length,
    times_ordered: timesOrdered,
    orders_per_day: Number((timesOrdered / days.length).toFixed(2)),
    demand_score: null,
    combined_score: null,
    margin_pct: marginPct == null ? null : Number(marginPct.toFixed(2)),
    rank: null,
    revenue: Number(revenue.toFixed(2)),
    recommendation_reason: null,
    source: 'pos_dashboard',
  };
}

function normalizeName(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function recentLocalDateStrings(dayCount: number) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return Array.from({ length: Math.max(1, dayCount) }, (_value, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return formatter.format(date);
  });
}

async function fetchPosOrderInsight(itemId: string, lookbackDays: number): Promise<MenuItemInsight> {
  const client = getSBClient();
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from('pos_order_items')
    .select('id, quantity, total_price, created_at')
    .eq('menu_item_id', itemId)
    .is('parent_item_id', null)
    .gte('created_at', since);

  if (error) {
    return {
      item_id: itemId,
      lookback_days: lookbackDays,
      times_ordered: null,
      orders_per_day: null,
      demand_score: null,
      combined_score: null,
      margin_pct: null,
      rank: null,
      revenue: null,
      recommendation_reason: null,
      source: 'none',
    };
  }

  const rows = data || [];
  const timesOrdered = rows.reduce((sum, row) => sum + Number(row.quantity || 1), 0);
  const revenue = rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);

  return {
    item_id: itemId,
    lookback_days: lookbackDays,
    times_ordered: timesOrdered,
    orders_per_day: Number((timesOrdered / lookbackDays).toFixed(2)),
    demand_score: null,
    combined_score: null,
    margin_pct: null,
    rank: null,
    revenue: Number(revenue.toFixed(2)),
    recommendation_reason: null,
    source: 'pos_orders',
  };
}

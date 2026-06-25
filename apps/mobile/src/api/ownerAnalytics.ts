import { fetchCachedOwnerAnalytics, fetchCachedOwnerChecks } from '@/data/ownerAnalyticsCache';
import { apiRequest } from './mobileApi';
import { getSBClient } from '../../packages/supabase';

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'year' | 'full';

export type AnalyticsSection<TData = Record<string, unknown>> = {
  status?: string;
  sample_size?: number;
  empty_message?: string;
  data?: TData;
  items?: MenuSalesItem[];
  revenue?: HourlySalesBucket[];
};

export type MenuSalesItem = {
  name?: string;
  category?: string | null;
  quantity?: number;
  revenue?: number;
};

export type HourlySalesBucket = {
  bucket?: string;
  hour?: string;
  orders?: number;
  revenue?: number;
};

export type OwnerAnalyticsPayload = {
  window?: {
    start_at?: string;
    end_at?: string;
    is_full_history?: boolean;
  };
  sections?: {
    revenue?: AnalyticsSection<{
      sales?: number;
      gross_sales?: number;
      net_sales?: number;
      sales_excluding_tax_tip?: number;
      total_revenue?: number;
      order_count?: number;
      avg_order_value?: number;
      average_check?: number;
      tips?: number;
      tax?: number;
      card_deposit_estimate?: number;
      processor_fees_known?: number;
      processor_fees_pending?: boolean;
      configured_fee_in_sales?: boolean;
      paid_orders?: number;
      closed_orders?: number;
    }>;
    visits?: AnalyticsSection<{
      covers?: number;
      visit_count?: number;
      avg_turn_minutes?: number;
      avg_turn_time_minutes?: number;
      avg_turnover_minutes?: number;
      average_turn_minutes?: number;
      completed_turns?: number;
      avg_payment_to_clear_minutes?: number;
      avg_seated_to_payment_minutes?: number;
    }> & {
      quality?: {
        message?: string;
        turn_time_available?: boolean;
      };
    };
    reservations?: AnalyticsSection<{
      reservation_count?: number;
      booked_covers?: number;
    }>;
    staff?: AnalyticsSection<{
      shift_count?: number;
      staff_worked?: number;
      sales?: number;
      labor_cost?: number;
      worked_minutes?: number;
      has_missing_labor_rate?: boolean;
    }> & {
      top_staff?: {
        name?: string;
        shifts?: number;
        covers?: number;
        sales?: number;
      }[];
    };
    labor?: AnalyticsSection<{
      labor_cost?: number;
      worked_minutes?: number;
      open_entries?: number;
      staff_count?: number;
      has_missing_labor_rate?: boolean;
    }>;
    menu?: AnalyticsSection;
    time_series?: AnalyticsSection & {
      revenue?: HourlySalesBucket[];
    };
  };
  labor?: {
    totals?: {
      labor_cost?: number;
      worked_minutes?: number;
      open_entries?: number;
      staff_count?: number;
      has_missing_labor_rate?: boolean;
    };
  };
};

export type HostShiftAnalyticsRange = 'current_shift' | 'today' | 'week';

export type HostShiftAnalyticsPayload = {
  range?: HostShiftAnalyticsRange;
  generatedAt?: string;
  windowStart?: string;
  windowEnd?: string;
  summary?: {
    covers?: number;
    parties?: number;
    tablesTurned?: number;
    avgTurnTimeMinutes?: number | null;
    peakBucketLabel?: string | null;
  };
  waiters?: {
    waiterId?: string;
    waiterName?: string;
    covers?: number;
    tablesServed?: number;
    liveTables?: number;
    avgTurnTimeMinutes?: number | null;
  }[];
};

export type OwnerChecksPayload = {
  date?: string;
  totals?: {
    sales?: number;
    gross_sales?: number;
    net_sales?: number;
    sales_excluding_tax_tip?: number;
    tax?: number;
    tips?: number;
    orders?: number;
    covers?: number;
    avg_check?: number;
  };
  hourly_buckets?: {
    hour?: string;
    label?: string;
    sales?: number;
    orders?: number;
    checks?: number;
  }[];
  checks?: {
    id?: string;
    order_number?: string;
    opened_at?: string;
    closed_at?: string | null;
    table_number?: string | null;
    waiter_name?: string | null;
    party_size?: number | null;
    subtotal?: number;
    tax_amount?: number;
    tip_amount?: number;
    sales?: number;
    sales_excluding_tax_tip?: number;
    net_sales?: number;
    fees?: number | null;
    total?: number;
    payment_status?: string;
    status?: string;
  }[];
};

export type OwnerOperationalMetrics = {
  avgTurnMinutes?: number;
  laborCost?: number;
  workedMinutes?: number;
  staffWorked?: number;
  missingLaborRate?: boolean;
};

export type OwnerAnalyticsFetchOptions = {
  forceRefresh?: boolean;
  onRevalidate?: (data: OwnerAnalyticsPayload) => void;
  onError?: (error: unknown) => void;
};

export type OwnerChecksFetchOptions = {
  forceRefresh?: boolean;
  onRevalidate?: (data: OwnerChecksPayload) => void;
  onError?: (error: unknown) => void;
};

export function fetchOwnerAnalytics(
  restaurantId: string,
  period: AnalyticsPeriod,
  dateKey: string,
  options?: OwnerAnalyticsFetchOptions,
) {
  return fetchCachedOwnerAnalytics(restaurantId, period, dateKey, options);
}

export function fetchOwnerChecks(
  restaurantId: string,
  dateKey: string,
  options?: OwnerChecksFetchOptions,
) {
  return fetchCachedOwnerChecks(restaurantId, dateKey, options);
}

export function fetchHostShiftAnalytics(locationId: string, range: HostShiftAnalyticsRange = 'today') {
  return apiRequest<HostShiftAnalyticsPayload>(
    `/locations/${encodeURIComponent(locationId)}/analytics/shift?range=${encodeURIComponent(range)}`,
  );
}

export async function fetchOwnerOperationalMetrics(
  restaurantId: string,
  dateKey: string,
): Promise<OwnerOperationalMetrics> {
  const { startAt, endAt } = getLocalDayBounds(dateKey);
  const clockLookbackStart = new Date(startAt);
  clockLookbackStart.setDate(clockLookbackStart.getDate() - 1);
  const nowMs = Date.now();
  const dayEndMs = Math.min(endAt.getTime(), nowMs);
  const client = getSBClient();

  const [ordersResult, clockResult] = await Promise.all([
    client
      .from('pos_orders')
      .select('created_at,closed_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', startAt.toISOString())
      .lt('created_at', endAt.toISOString())
      .not('closed_at', 'is', null),
    client
      .from('pos_time_clock_entries')
      .select('staff_id,clock_in_at,clock_out_at,hourly_rate,is_voided')
      .eq('restaurant_id', restaurantId)
      .gte('clock_in_at', clockLookbackStart.toISOString())
      .lt('clock_in_at', endAt.toISOString()),
  ]);

  if (ordersResult.error) throw ordersResult.error;
  if (clockResult.error) throw clockResult.error;

  const turnDurations = (ordersResult.data || [])
    .map((order) => minutesBetween(order.created_at, order.closed_at))
    .filter((value): value is number => value !== null && value > 0 && value <= 8 * 60);

  const activeClockRows = (clockResult.data || []).filter((entry) => !entry.is_voided && entry.clock_in_at);
  let workedMinutes = 0;
  let laborCost = 0;
  let ratedRows = 0;
  const staffIds = new Set<string>();

  for (const entry of activeClockRows) {
    const clockInMs = new Date(entry.clock_in_at as string).getTime();
    const rawClockOutMs = entry.clock_out_at ? new Date(entry.clock_out_at as string).getTime() : dayEndMs;
    if (!Number.isFinite(clockInMs) || !Number.isFinite(rawClockOutMs)) continue;

    const clippedStart = Math.max(clockInMs, startAt.getTime());
    const clippedEnd = Math.min(rawClockOutMs, dayEndMs);
    if (clippedEnd <= clippedStart) continue;

    const minutes = (clippedEnd - clippedStart) / 60000;
    workedMinutes += minutes;
    if (entry.staff_id) staffIds.add(String(entry.staff_id));

    const hourlyRate = Number(entry.hourly_rate);
    if (Number.isFinite(hourlyRate)) {
      ratedRows += 1;
      laborCost += (minutes / 60) * hourlyRate;
    }
  }

  return {
    avgTurnMinutes: average(turnDurations),
    laborCost: ratedRows > 0 ? laborCost : undefined,
    workedMinutes: workedMinutes > 0 ? workedMinutes : undefined,
    staffWorked: staffIds.size > 0 ? staffIds.size : undefined,
    missingLaborRate: activeClockRows.some((entry) => entry.hourly_rate === null || entry.hourly_rate === undefined),
  };
}

function getLocalDayBounds(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  const startAt = new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
  const endAt = new Date(startAt);
  endAt.setDate(startAt.getDate() + 1);
  return { startAt, endAt };
}

function minutesBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return (endMs - startMs) / 60000;
}

function average(values: number[]) {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

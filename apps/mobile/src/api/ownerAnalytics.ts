import { fetchCachedOwnerAnalytics, fetchCachedOwnerChecks } from '@/data/ownerAnalyticsCache';

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
      total_revenue?: number;
      order_count?: number;
      avg_order_value?: number;
      tips?: number;
      paid_orders?: number;
      closed_orders?: number;
    }>;
    visits?: AnalyticsSection<{
      covers?: number;
      visit_count?: number;
      avg_turn_minutes?: number;
      completed_turns?: number;
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
    }> & {
      top_staff?: {
        name?: string;
        shifts?: number;
        covers?: number;
        sales?: number;
      }[];
    };
    menu?: AnalyticsSection;
    time_series?: AnalyticsSection & {
      revenue?: HourlySalesBucket[];
    };
  };
};

export type OwnerChecksPayload = {
  date?: string;
  totals?: {
    sales?: number;
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
    fees?: number | null;
    total?: number;
    payment_status?: string;
    status?: string;
  }[];
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

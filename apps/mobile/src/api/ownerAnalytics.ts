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

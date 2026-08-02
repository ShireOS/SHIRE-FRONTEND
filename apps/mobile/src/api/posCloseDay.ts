import { posApiRequest } from './mobileApi';

export type OpenTimeClockEntry = {
  id: string;
  staff_id: string;
  staff_name: string;
  role?: string | null;
  clock_in_at: string;
  worked_minutes?: number;
};

export type CloseDayPreview = {
  business_date: string;
  active_business_date?: string;
  open_checks: number;
  exception_count?: number;
  gross_subtotal: number;
  discounts: number;
  tax: number;
  sales_before_tip: number;
  tips: number;
  total_collected: number;
  cash_collected: number;
  card_collected: number;
  payment_count: number;
  closed_checks: number;
  voided_checks: number;
  pending_print_jobs?: number;
  open_timeclock_entries?: OpenTimeClockEntry[];
  business_day?: {
    status: 'open' | 'closed' | 'reopened';
    closed_at?: string | null;
    closed_by_name?: string | null;
  };
  closeout_settings?: {
    blind_drawer_close?: boolean;
    cash_variance_threshold?: number;
  };
  cash_reconciliation?: {
    opening_bank: number;
    cash_sales: number;
    paid_in: number;
    paid_out: number;
    cash_refunds: number;
    expected_cash: number;
  };
};

export type CloseDayInput = {
  business_date: string;
  close_attempt_id: string;
  confirm_auto_clock_out: boolean;
  opening_bank: number;
  paid_in: number;
  paid_out: number;
  cash_refunds: number;
  counted_cash: number;
  retained_bank: number;
  deposit_amount: number;
  variance_reason?: string;
};

export type CloseDayResult = {
  id: string;
  business_date: string;
  active_business_date: string;
  closed_at: string;
  totals: CloseDayPreview;
  auto_clocked_out: OpenTimeClockEntry[];
};

export function fetchCloseDayPreview(restaurantId: string, businessDate?: string) {
  const query = businessDate ? `?business_date=${encodeURIComponent(businessDate)}` : '';
  return posApiRequest<CloseDayPreview>(restaurantId, `/manager/close-day/preview${query}`);
}

export function closeBusinessDay(restaurantId: string, input: CloseDayInput) {
  return posApiRequest<CloseDayResult>(restaurantId, '/manager/close-day', {
    method: 'POST',
    body: input,
  });
}

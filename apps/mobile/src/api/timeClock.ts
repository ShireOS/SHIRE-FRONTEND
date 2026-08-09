import { Platform } from 'react-native';

import { apiPatch, apiPost, apiRequest, posApiRequest } from './mobileApi';

export type TimeClockEntry = {
  id: string;
  restaurant_id?: string;
  staff_id?: string;
  staff_name?: string;
  role?: string;
  job_code_id?: string | null;
  hourly_rate?: number | string | null;
  labor_cost?: number | null;
  worked_minutes?: number;
  clock_in_at: string;
  clock_out_at?: string | null;
  status?: string;
  is_voided?: boolean;
  edit_reason?: string | null;
};

export type TimeClockRequest = {
  id: string;
  request_id?: string;
  entry_id?: string | null;
  waiter_id?: string;
  waiter_name?: string;
  waiter_role?: string;
  request_type?: 'remote_clock_in' | 'remote_clock_out' | 'manual_time_entry' | string;
  status?: string;
  title?: string | null;
  notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  submitted_at?: string;
  reviewed_at?: string | null;
  mentioned_manager_id?: string | null;
  mentioned_manager_name?: string | null;
  structured_payload?: {
    reason?: string;
    requested_clock_in_at?: string;
    requested_clock_out_at?: string;
    manual_entry_date?: string;
    manual_start_time?: string;
    manual_end_time?: string;
    mentioned_manager_id?: string;
    mentioned_manager_name?: string;
    [key: string]: unknown;
  } | null;
};

export type JobCode = {
  // Absent/null for rows not yet saved to the server (normalizers keep drafts).
  id?: string | null;
  code: string;
  label: string;
  permission_tier?: string;
  default_hourly_rate?: number | string | null;
  is_tipped?: boolean;
  tipout_role?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

export function fetchManagerTimeClockRequests(
  restaurantId: string,
  status: 'pending' | 'all' = 'pending',
) {
  return apiRequest<TimeClockRequest[]>(
    `/restaurants/${restaurantId}/employee-requests?status=${encodeURIComponent(status)}`,
  );
}

export function reviewTimeClockRequest(
  requestId: string,
  status: 'approved' | 'denied',
) {
  return apiPatch<TimeClockRequest>(`/employee-requests/${requestId}`, { status });
}

export function fetchManagerJobCodes(restaurantId: string) {
  return posApiRequest<JobCode[]>(restaurantId, '/manager/job-codes');
}

export function fetchRestaurantJobCodes(restaurantId: string) {
  return posApiRequest<JobCode[]>(restaurantId, `/restaurants/${restaurantId}/job-codes`);
}

export function updateManagerJobCode(
  restaurantId: string,
  jobCodeId: string,
  body: Partial<Pick<JobCode, 'code' | 'label' | 'permission_tier' | 'default_hourly_rate' | 'is_tipped' | 'tipout_role' | 'sort_order' | 'is_active'>>,
) {
  return posApiRequest<JobCode>(restaurantId, `/restaurants/${restaurantId}/job-codes/${jobCodeId}`, {
    method: 'PATCH',
    body,
  });
}

export function createManagerJobCode(
  restaurantId: string,
  body: Pick<JobCode, 'code' | 'label'> & Partial<Pick<JobCode, 'permission_tier' | 'default_hourly_rate' | 'is_tipped' | 'tipout_role' | 'sort_order' | 'is_active'>>,
) {
  return posApiRequest<JobCode>(restaurantId, `/restaurants/${restaurantId}/job-codes`, {
    method: 'POST',
    body,
  });
}

export function registerMobilePushToken(body: {
  token: string;
  restaurant_id?: string | null;
  device_name?: string | null;
}) {
  return apiPost<void>('/mobile/push-tokens', {
    token: body.token,
    restaurant_id: body.restaurant_id || null,
    device_name: body.device_name || null,
    platform: Platform.OS,
  });
}

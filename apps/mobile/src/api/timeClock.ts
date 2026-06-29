import { Platform } from 'react-native';

import { apiPatch, apiPost, apiRequest } from './mobileApi';

export type RemoteTimeClockSettings = {
  enabled: boolean;
  allow_manual_entries: boolean;
  require_manager_mention: boolean;
};

export type RemoteTimeClockPolicy = {
  restaurant_id?: string;
  remote_time_clock: RemoteTimeClockSettings;
};

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

export type TimeClockStatus = {
  active_entry?: TimeClockEntry | null;
  latest_request?: TimeClockRequest | null;
  pending_requests?: TimeClockRequest[];
  server_time?: string;
};

export type JobCode = {
  id: string;
  code: string;
  label: string;
  permission_tier?: string;
  default_hourly_rate?: number | string | null;
  is_tipped?: boolean;
  tipout_role?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

export type AdminContact = {
  id: string;
  name?: string;
  role?: string;
  email?: string | null;
};

export type ClockInPayload = {
  reason: string;
  mentioned_manager_id?: string | null;
};

export type ManualEntryPayload = {
  work_date: string;
  start_time: string;
  end_time: string;
  reason: string;
  mentioned_manager_id?: string | null;
};

export const DEFAULT_REMOTE_TIME_CLOCK_POLICY: RemoteTimeClockPolicy = {
  remote_time_clock: {
    enabled: false,
    allow_manual_entries: false,
    require_manager_mention: true,
  },
};

export function normalizeRemoteTimeClockPolicy(value: unknown): RemoteTimeClockPolicy {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const managerSettings = root.manager_settings && typeof root.manager_settings === 'object'
    ? root.manager_settings as Record<string, unknown>
    : {};
  const rawPolicy = root.remote_time_clock && typeof root.remote_time_clock === 'object'
    ? root.remote_time_clock as Record<string, unknown>
    : managerSettings.remote_time_clock && typeof managerSettings.remote_time_clock === 'object'
      ? managerSettings.remote_time_clock as Record<string, unknown>
      : {};
  const enabled = rawPolicy.enabled === true;

  return {
    restaurant_id: typeof root.restaurant_id === 'string' ? root.restaurant_id : undefined,
    remote_time_clock: {
      enabled,
      allow_manual_entries: enabled && rawPolicy.allow_manual_entries !== false,
      require_manager_mention: rawPolicy.require_manager_mention !== false,
    },
  };
}

export function fetchEmployeeTimeClockPolicy() {
  return apiRequest<unknown>('/employee/time-clock/policy', { auth: 'supabase' })
    .then(normalizeRemoteTimeClockPolicy);
}

export function fetchEmployeeTimeClockStatus() {
  return apiRequest<TimeClockStatus>('/employee/time-clock/status', { auth: 'supabase' });
}

export function fetchEmployeeAdmins() {
  return apiRequest<AdminContact[]>('/employee/admins', { auth: 'supabase' });
}

export function clockInRemote(body: ClockInPayload) {
  return apiPost<TimeClockStatus>('/employee/time-clock/clock-in', body);
}

export function clockOutRemote() {
  return apiPost<TimeClockStatus>('/employee/time-clock/clock-out');
}

export function submitManualTimeEntry(body: ManualEntryPayload) {
  return apiPost<TimeClockRequest>('/employee/time-clock/manual-entry', body);
}

export function fetchManagerTimeClockPolicy(restaurantId: string) {
  return apiRequest<unknown>(`/restaurants/${restaurantId}/employee-request-policy`)
    .then(normalizeRemoteTimeClockPolicy);
}

export function saveManagerTimeClockPolicy(
  restaurantId: string,
  policy: RemoteTimeClockSettings,
) {
  return apiRequest<Record<string, unknown>>(`/restaurants/${restaurantId}/employee-request-policy`)
    .then((current) => apiRequest<unknown>(`/restaurants/${restaurantId}/employee-request-policy`, {
      method: 'PUT',
      body: {
        policy_year: current.policy_year || new Date().getFullYear(),
        critical_priority_limit: current.critical_priority_limit ?? null,
        high_priority_limit: current.high_priority_limit ?? null,
        normal_priority_limit: current.normal_priority_limit ?? null,
        low_priority_limit: current.low_priority_limit ?? null,
        manager_settings: {
          ...(
            current.manager_settings && typeof current.manager_settings === 'object'
              ? current.manager_settings as Record<string, unknown>
              : {}
          ),
          remote_time_clock: {
            enabled: Boolean(policy.enabled),
            allow_manual_entries: Boolean(policy.enabled && policy.allow_manual_entries),
            require_manager_mention: policy.require_manager_mention !== false,
          },
        },
      },
    }))
    .then(normalizeRemoteTimeClockPolicy);
}

export function fetchManagerTimeClockRequests(
  restaurantId: string,
  status: 'pending' | 'all' = 'pending',
) {
  return apiRequest<TimeClockRequest[]>(
    `/restaurants/${restaurantId}/time-clock/requests?status=${encodeURIComponent(status)}`,
  );
}

export function reviewTimeClockRequest(
  requestId: string,
  status: 'approved' | 'denied',
) {
  return apiPatch<TimeClockRequest>(`/time-clock/requests/${requestId}`, { status });
}

export function fetchManagerJobCodes() {
  return apiRequest<JobCode[]>('/manager/job-codes');
}

export function fetchRestaurantJobCodes(restaurantId: string) {
  return apiRequest<JobCode[]>(`/restaurants/${restaurantId}/job-codes`);
}

export function updateManagerJobCode(
  jobCodeId: string,
  body: Partial<Pick<JobCode, 'code' | 'label' | 'permission_tier' | 'default_hourly_rate' | 'is_tipped' | 'tipout_role' | 'sort_order' | 'is_active'>>,
) {
  return apiPatch<JobCode>(`/manager/job-codes/${jobCodeId}`, body);
}

export function createManagerJobCode(
  restaurantId: string,
  body: Pick<JobCode, 'code' | 'label'> & Partial<Pick<JobCode, 'permission_tier' | 'default_hourly_rate' | 'is_tipped' | 'tipout_role' | 'sort_order' | 'is_active'>>,
) {
  return apiPost<JobCode>(`/restaurants/${restaurantId}/job-codes`, body);
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

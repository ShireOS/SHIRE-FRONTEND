import { apiRequest } from './mobileApi';
import type { ReportingDimensions } from './homepageWidgets';

export const REPORT_SECTIONS = [
  'sales_revenue',
  'top_bottom_sellers',
  'average_check',
  'employee_reports',
  'payroll_support',
  'punch_log',
  'z_report',
  'daily_summary',
] as const;

export type ReportSectionId = typeof REPORT_SECTIONS[number];
export type RestaurantReport = {
  restaurant?: { id?: string; name?: string; timezone?: string };
  window?: Record<string, string>;
  access?: { can_manage_reports?: boolean };
  sections?: Record<ReportSectionId, any>;
};
export type ReportPreference = {
  visible_sections: ReportSectionId[];
  section_order: ReportSectionId[];
  section_settings: Record<string, unknown>;
};
export type ReportRecipient = {
  id: string;
  name: string;
  email: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  sections: ReportSectionId[];
  send_time: string;
  timezone: string;
  weekday: number | null;
  month_day: number | null;
  is_active: boolean;
  last_delivery_status?: string | null;
  last_delivery_at?: string | null;
  last_sent_at?: string | null;
  last_delivered_at?: string | null;
  last_delivery_error?: string | null;
};

export function fetchRestaurantReport(restaurantId: string, query: URLSearchParams) {
  return apiRequest<RestaurantReport>(`/restaurants/${restaurantId}/reports?${query.toString()}`);
}

export function fetchRestaurantReportingDimensions(restaurantId: string) {
  return apiRequest<ReportingDimensions>(`/restaurants/${restaurantId}/reports/dimensions`);
}

export function assignReportingDeviceSection(restaurantId: string, deviceId: string, sectionId: string | null) {
  return apiRequest(`/restaurants/${restaurantId}/reports/dimensions/devices/${deviceId}`, {
    method: 'PUT', body: { section_id: sectionId },
  });
}

export function fetchReportPreference(restaurantId: string) {
  return apiRequest<ReportPreference>(`/restaurants/${restaurantId}/reports/preferences`);
}

export function saveReportPreference(restaurantId: string, preference: ReportPreference) {
  return apiRequest<ReportPreference>(`/restaurants/${restaurantId}/reports/preferences`, {
    method: 'PUT',
    body: preference,
  });
}

export function fetchReportRecipients(restaurantId: string) {
  return apiRequest<{ recipients: ReportRecipient[]; can_manage: boolean; delivery_enabled: boolean; delivery_disabled_reason?: string | null }>(
    `/restaurants/${restaurantId}/reports/recipients`,
  );
}

export function sendTestReportRecipient(restaurantId: string, recipientId: string) {
  return apiRequest<{ message: string; delivery: Record<string, unknown> }>(
    `/restaurants/${restaurantId}/reports/recipients/${recipientId}/test`,
    { method: 'POST' },
  );
}

export function saveReportRecipient(
  restaurantId: string,
  recipient: Omit<ReportRecipient, 'id'>,
  recipientId?: string,
) {
  return apiRequest<ReportRecipient>(
    `/restaurants/${restaurantId}/reports/recipients${recipientId ? `/${recipientId}` : ''}`,
    { method: recipientId ? 'PUT' : 'POST', body: recipient },
  );
}

export function deleteReportRecipient(restaurantId: string, recipientId: string) {
  return apiRequest<void>(`/restaurants/${restaurantId}/reports/recipients/${recipientId}`, {
    method: 'DELETE',
  });
}

export function generateStaffReportInsight(
  restaurantId: string,
  staffId: string,
  startDate: string,
  endDate: string,
) {
  return apiRequest<any>(
    `/restaurants/${restaurantId}/staff/${staffId}/pos-insight?start_date=${startDate}&end_date=${endDate}`,
    { method: 'POST' },
  );
}

import { apiGet, apiRequest } from './mobileApi';
import type { PortfolioPeriod } from './portfolioReports';

export type WidgetScope = 'restaurant' | 'portfolio';
export type WidgetColumn = { id: string; label: string; kind: 'text' | 'number' | 'money' | 'percent' | 'minutes' | 'date' };
export type WidgetCatalogItem = {
  id: string;
  label: string;
  description: string;
  breakdowns: string[];
  columns: WidgetColumn[];
  default_columns: string[];
  default_breakdown: string;
  charts: ('bar' | 'line')[];
  grains: ('total' | 'day' | 'week' | 'month' | 'detail')[];
  reporting_dimensions: ('revenue_center' | 'device')[];
};
export type WidgetSettings = {
  display_grain?: 'total' | 'day' | 'week' | 'month';
  display_breakdown?: string;
  display_columns?: string[];
  display_mode?: 'table' | 'chart';
  chart_type?: 'bar' | 'line';
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
  limit?: number;
  alert_z_score?: number;
  alert_min_actions?: number;
  scope_dimension?: 'none' | 'revenue_center' | 'device';
  scope_mode?: 'cumulative' | 'breakdown';
  scope_ids?: string[];
};
export type HomepagePreferences = {
  visible_widgets: string[];
  widget_order: string[];
  widget_settings: Record<string, WidgetSettings>;
  catalog: WidgetCatalogItem[];
};
export type WidgetData = {
  rows?: Record<string, unknown>[];
  dimension_columns?: string[];
  measure_columns?: WidgetColumn[];
  grain?: string;
  breakdown?: string;
  summary?: Record<string, number>;
  employees?: (Record<string, unknown> & { employee_id?: string | null; employee_name: string; restaurant_id: string; restaurant_name: string; action_count: number; total_amount: number; is_flagged: boolean; alert_reasons: string[] })[];
  reasons?: (Record<string, unknown> & { reason_code: string; reason_label: string; action_type: string; restaurant_id: string; restaurant_name: string; count: number; total_amount: number; average_amount: number; share_percent: number })[];
  alerts?: (Record<string, unknown> & { employee_id: string; employee_name: string; restaurant_id: string; restaurant_name: string; action_count: number; total_amount: number; alert_reasons: string[] })[];
  recent_events?: Record<string, unknown>[];
};
export type HomepageData = { widgets: Record<string, WidgetData>; start_at: string; end_at: string };
export type WidgetPdfPayload = {
  start_date: string;
  end_date: string;
  grain: 'total' | 'day' | 'week' | 'month' | 'detail';
  breakdown: string;
  columns: string[];
  include_chart: boolean;
  chart_type: 'bar' | 'line';
  title: string;
  group_ids?: string[] | null;
  include_ungrouped?: boolean;
  employee_ids?: string[];
  action_types?: ('discount' | 'comp' | 'item_void' | 'check_void')[];
  reason_codes?: string[];
  include_team_average?: boolean;
  alert_z_score?: number;
  alert_min_actions?: number;
  scope_dimension?: 'none' | 'revenue_center' | 'device';
  scope_mode?: 'cumulative' | 'breakdown';
  scope_ids?: string[];
};
export type PdfArtifact = { file_name: string; mime_type: string; base64: string; rows: number };
export type ReportingDimensions = {
  sections: { id: string; restaurant_id: string; restaurant_name: string; name: string; section_name?: string | null }[];
  devices: { id: string; restaurant_id: string; restaurant_name: string; name: string; section_name?: string | null; revenue_center_id?: string | null }[];
  coverage: { total_orders?: number; section_attributed_orders?: number; device_attributed_orders?: number; unassigned_orders?: number };
  copy: string;
  can_manage?: boolean;
};

function prefix(scope: WidgetScope, restaurantId?: string) {
  if (scope === 'portfolio') return '/api/v1/portfolio-reports/homepage';
  if (!restaurantId) throw new Error('Restaurant is required for homepage widgets.');
  return `/api/v1/restaurants/${restaurantId}/reports/homepage`;
}

export function fetchHomepagePreferences(scope: WidgetScope, restaurantId?: string) {
  return apiGet<HomepagePreferences>(`${prefix(scope, restaurantId)}/preferences`);
}

export function saveHomepagePreferences(scope: WidgetScope, restaurantId: string | undefined, payload: Omit<HomepagePreferences, 'catalog'>) {
  return apiRequest<HomepagePreferences>(`${prefix(scope, restaurantId)}/preferences`, { method: 'PUT', body: payload });
}

export function fetchHomepageData(scope: WidgetScope, restaurantId: string | undefined, payload: {
  period: PortfolioPeriod;
  anchor_date?: string | null;
  widget_ids: string[];
  widget_settings: Record<string, WidgetSettings>;
  group_ids?: string[] | null;
  include_ungrouped?: boolean;
}) {
  return apiRequest<HomepageData>(`${prefix(scope, restaurantId)}/data`, { method: 'POST', body: payload });
}

export function downloadHomepageWidgetPdf(scope: WidgetScope, restaurantId: string | undefined, widgetId: string, payload: WidgetPdfPayload) {
  return apiRequest<PdfArtifact>(`${prefix(scope, restaurantId)}/widgets/${widgetId}/pdf`, { method: 'POST', body: payload });
}

export function fetchReportingDimensions(scope: WidgetScope, restaurantId?: string, groupIds?: string[] | null, includeUngrouped = false) {
  if (scope === 'portfolio') {
    const query = new URLSearchParams();
    if (groupIds?.length) query.set('group_ids', groupIds.join(','));
    query.set('include_ungrouped', String(includeUngrouped));
    return apiGet<ReportingDimensions>(`/api/v1/portfolio-reports/dimensions?${query.toString()}`);
  }
  if (!restaurantId) throw new Error('Restaurant is required for reporting dimensions.');
  return apiGet<ReportingDimensions>(`/api/v1/restaurants/${restaurantId}/reports/dimensions`);
}

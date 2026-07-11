import { apiGet, apiRequest } from './mobileApi';

export type PortfolioPeriod = 'day' | 'week' | 'month' | 'year' | 'full';
export type PortfolioModule =
  | 'profit_after_labor'
  | 'period_comparison'
  | 'portfolio_trends'
  | 'group_performance'
  | 'store_rankings';

export type PortfolioGroup = {
  id: string;
  name: string;
  color: string;
  source: 'store' | 'reseller';
  restaurant_ids: string[];
  store_count?: number;
  net_sales?: number;
  labor_cost?: number;
  profit_after_labor?: number;
  labor_percentage?: number | null;
  portfolio_sales_percentage?: number | null;
};

export type PortfolioStore = {
  id: string;
  name: string;
  rank: number;
  has_data: boolean;
  net_sales: number;
  order_count: number;
  covers: number;
  tips: number;
  labor_cost: number;
  profit_after_labor: number;
  labor_percentage: number | null;
  comparison?: Record<string, { delta: number; percent: number | null }>;
};

export type PortfolioReport = {
  period: PortfolioPeriod;
  totals: Record<string, number | null>;
  comparison: Record<string, { delta: number; percent: number | null }>;
  trends: { bucket: string; net_sales: number; orders: number; tips: number }[];
  groups: PortfolioGroup[];
  restaurants: PortfolioStore[];
  scope: {
    groups: PortfolioGroup[];
    can_manage: boolean;
    selected_group_ids: string[];
    include_ungrouped: boolean;
  };
};

export type PortfolioRecipient = {
  id: string;
  name: string;
  email: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  send_time: string;
  timezone: string;
  weekday: number | null;
  month_day: number | null;
  scope_mode: 'all' | 'groups';
  group_ids: string[];
  include_ungrouped: boolean;
  is_active: boolean;
  last_delivery_status?: string | null;
  last_delivery_error?: string | null;
};

export type PortfolioRecipientPayload = Omit<PortfolioRecipient, 'id' | 'last_delivery_status' | 'last_delivery_error'>;

export function fetchPortfolioReport(period: PortfolioPeriod, groupIds: string[], includeUngrouped: boolean) {
  const query = new URLSearchParams({ period });
  if (groupIds.length) query.set('group_ids', groupIds.join(','));
  if (includeUngrouped) query.set('include_ungrouped', 'true');
  return apiGet<PortfolioReport>(`/api/v1/portfolio-reports?${query.toString()}`);
}

export function fetchPortfolioPreferences() {
  return apiGet<{ visible_modules: PortfolioModule[] }>('/api/v1/portfolio-reports/preferences');
}

export function savePortfolioPreferences(visible_modules: PortfolioModule[]) {
  return apiRequest<{ visible_modules: PortfolioModule[] }>('/api/v1/portfolio-reports/preferences', {
    method: 'PUT', body: { visible_modules },
  });
}

export function fetchPortfolioRecipients() {
  return apiGet<{
    recipients: PortfolioRecipient[];
    groups: PortfolioGroup[];
    can_manage: boolean;
    delivery_enabled: boolean;
    delivery_disabled_reason?: string | null;
  }>('/api/v1/portfolio-reports/recipients');
}

export function savePortfolioRecipient(payload: PortfolioRecipientPayload, id?: string) {
  return apiRequest<PortfolioRecipient>(id ? `/api/v1/portfolio-reports/recipients/${id}` : '/api/v1/portfolio-reports/recipients', {
    method: id ? 'PUT' : 'POST', body: payload,
  });
}

export function deletePortfolioRecipient(id: string) {
  return apiRequest<void>(`/api/v1/portfolio-reports/recipients/${id}`, { method: 'DELETE' });
}

export function sendPortfolioTest(id: string) {
  return apiRequest<{ message: string }>(`/api/v1/portfolio-reports/recipients/${id}/test`, { method: 'POST' });
}

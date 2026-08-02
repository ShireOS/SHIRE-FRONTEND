import { apiGet, apiPost } from './mobileApi';

export type ManagerInboxSource = 'operational' | 'employee_request' | 'shift_trade';

export type ManagerInboxItem = {
  id: string;
  source: ManagerInboxSource;
  type: string;
  status: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  employee_id: string | null;
  employee_name: string | null;
  occurred_at: string;
  expected_at: string | null;
  details: Record<string, unknown>;
  available_actions: string[];
};

export type ManagerInboxResponse = {
  items: ManagerInboxItem[];
  open_count: number;
};

export function fetchManagerInbox(restaurantId: string, status: 'open' | 'all' = 'open') {
  return apiGet<ManagerInboxResponse>(
    `/restaurants/${restaurantId}/manager-action-inbox?status=${status}`,
  );
}

export function actOnManagerInboxItem(
  restaurantId: string,
  item: Pick<ManagerInboxItem, 'id' | 'source'>,
  input: { action: string; custom_clock_out_at?: string; note?: string },
) {
  return apiPost<unknown>(
    `/restaurants/${restaurantId}/manager-action-inbox/${item.source}/${item.id}/actions`,
    input,
  );
}

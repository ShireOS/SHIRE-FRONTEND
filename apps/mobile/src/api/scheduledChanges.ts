import { apiRequest } from './mobileApi';

export type ScheduledCommand = {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: Record<string, unknown> | unknown[] | null;
  target_type?: 'restaurant' | 'employee' | 'reseller' | 'portfolio';
  target_id?: string | null;
  restaurant_id?: string | null;
};

export type ScheduledChange = {
  id: string;
  label: string;
  status: string;
  scheduled_for: string;
  display_timezone: string;
  created_at: string;
};

export function scheduleChange(input: {
  label: string;
  scheduledFor: string;
  timezone: string;
  commands: ScheduledCommand[];
}) {
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return apiRequest<{ id: string; status: string; scheduled_for: string }>('/scheduled-changes', {
    method: 'POST',
    body: {
      label: input.label,
      scheduled_for: input.scheduledFor,
      display_timezone: input.timezone,
      commands: input.commands,
      idempotency_key: `mobile-${randomId}`,
    },
  });
}

export function listScheduledChanges() {
  return apiRequest<ScheduledChange[]>('/scheduled-changes');
}

export function cancelScheduledChange(id: string) {
  return apiRequest<ScheduledChange>(`/scheduled-changes/${id}/cancel`, {
    method: 'POST',
    body: { reason: 'Cancelled from back office' },
  });
}

export function publishScheduledChangeNow(id: string) {
  return apiRequest<ScheduledChange>(`/scheduled-changes/${id}/publish-now`, {
    method: 'POST',
  });
}

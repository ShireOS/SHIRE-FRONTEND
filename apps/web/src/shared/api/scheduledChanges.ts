import { fetchWithSupabaseAuth } from '../query'

export type ScheduledCommand = {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body?: Record<string, unknown> | unknown[] | null
  target_type?: 'restaurant' | 'employee' | 'reseller' | 'portfolio'
  target_id?: string | null
  restaurant_id?: string | null
}

export type ScheduledChange = {
  id: string
  label: string
  status: string
  scheduled_for: string
  display_timezone: string
  created_at: string
  targets?: ScheduledChangeTarget[]
}

export type ScheduledChangeTarget = {
  id: string
  target_id: string | null
  status: 'pending' | 'processing' | 'applied' | 'failed' | 'cancelled'
  last_error?: string | null
}

function webIdempotencyKey(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
  return `${prefix}-${randomId}`
}

export async function scheduleChange(input: {
  label: string
  scheduledFor: string
  timezone: string
  commands: ScheduledCommand[]
}) {
  return fetchWithSupabaseAuth<ScheduledChange>('/scheduled-changes', {
    method: 'POST',
    body: JSON.stringify({
      label: input.label,
      scheduled_for: input.scheduledFor,
      display_timezone: input.timezone,
      commands: input.commands,
      idempotency_key: webIdempotencyKey('web-scheduled'),
    }),
  })
}

export function applyChangeNow(input: {
  label: string
  commands: ScheduledCommand[]
}) {
  return fetchWithSupabaseAuth<ScheduledChange>('/scheduled-changes/apply-now', {
    method: 'POST',
    body: JSON.stringify({
      label: input.label,
      commands: input.commands,
      idempotency_key: webIdempotencyKey('web-immediate'),
    }),
  })
}

export function listScheduledChanges() {
  return fetchWithSupabaseAuth<ScheduledChange[]>('/scheduled-changes')
}

export function cancelScheduledChange(id: string) {
  return fetchWithSupabaseAuth<ScheduledChange>(`/scheduled-changes/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Cancelled from back office' }),
  })
}

export function publishScheduledChangeNow(id: string) {
  return fetchWithSupabaseAuth<ScheduledChange>(`/scheduled-changes/${id}/publish-now`, {
    method: 'POST',
  })
}

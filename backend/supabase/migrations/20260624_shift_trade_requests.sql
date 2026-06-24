create table if not exists public.shift_trade_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  schedule_item_id uuid not null references public.schedule_items(id) on delete cascade,
  requesting_waiter_id uuid not null references public.waiters(id) on delete cascade,
  target_waiter_id uuid not null references public.waiters(id) on delete cascade,
  status text not null default 'pending_target',
  reason text,
  requester_approved_at timestamptz,
  target_approved_at timestamptz,
  manager_approved_at timestamptz,
  manager_denied_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_trade_requests_status_check check (
    status in ('pending_target', 'pending_manager', 'approved', 'denied', 'cancelled', 'expired')
  ),
  constraint shift_trade_requests_distinct_waiters_check check (requesting_waiter_id <> target_waiter_id)
);

create index if not exists shift_trade_requests_restaurant_status_idx
  on public.shift_trade_requests (restaurant_id, status, created_at desc);

create index if not exists shift_trade_requests_schedule_item_idx
  on public.shift_trade_requests (schedule_item_id);

create unique index if not exists shift_trade_requests_one_active_per_shift_idx
  on public.shift_trade_requests (schedule_item_id)
  where status in ('pending_target', 'pending_manager');

create index if not exists shift_trade_requests_requesting_waiter_idx
  on public.shift_trade_requests (requesting_waiter_id, status);

create index if not exists shift_trade_requests_target_waiter_idx
  on public.shift_trade_requests (target_waiter_id, status);

alter table public.shift_trade_requests enable row level security;

update public.employee_request_policies
set manager_settings = coalesce(manager_settings, '{}'::jsonb) || jsonb_build_object(
  'shift_trades',
  coalesce(manager_settings -> 'shift_trades', '{}'::jsonb) || jsonb_build_object(
    'enabled', coalesce((manager_settings -> 'shift_trades' ->> 'enabled')::boolean, true),
    'require_manager_approval', coalesce((manager_settings -> 'shift_trades' ->> 'require_manager_approval')::boolean, true),
    'allow_employee_to_employee_trades', coalesce((manager_settings -> 'shift_trades' ->> 'allow_employee_to_employee_trades')::boolean, true),
    'notify_managers_in_chat', coalesce((manager_settings -> 'shift_trades' ->> 'notify_managers_in_chat')::boolean, true)
  )
)
where not coalesce(manager_settings, '{}'::jsonb) ? 'shift_trades';

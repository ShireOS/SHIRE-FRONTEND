create table if not exists public.guest_feedback (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references public.restaurants(id) on delete cascade,
    voice_call_id uuid references public.voice_calls(id) on delete set null,
    reservation_id uuid references public.reservations(id) on delete set null,
    guest_name text,
    guest_phone_e164 text,
    category text not null default 'other' check (category in ('complaint', 'compliment', 'service_issue', 'food_issue', 'wait_issue', 'reservation_issue', 'other')),
    severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
    summary text not null,
    details text,
    status text not null default 'open' check (status in ('open', 'reviewed', 'resolved')),
    source text not null default 'voice' check (source in ('voice', 'host', 'web', 'mobile', 'manual')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    reviewed_at timestamptz,
    resolved_at timestamptz
);

create index if not exists idx_guest_feedback_restaurant_status_created
    on public.guest_feedback(restaurant_id, status, created_at desc);

create index if not exists idx_guest_feedback_restaurant_severity_created
    on public.guest_feedback(restaurant_id, severity, created_at desc);

grant select, insert, update on table public.guest_feedback to authenticated;
grant select, insert, update on table public.guest_feedback to service_role;

alter table public.guest_feedback enable row level security;

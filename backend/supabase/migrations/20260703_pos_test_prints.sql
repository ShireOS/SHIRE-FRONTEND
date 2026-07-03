-- Portal test tickets + surfacing legacy POS-app printers.
-- Run manually in the Supabase SQL editor (repo convention), after
-- 20260703_pos_devices_grants.sql.

-- ---------------------------------------------------------------------------
-- 1. Test print queue. The portal can't reach a LAN printer, so it inserts a
--    request here; an online POS device's print bridge claims it, prints a
--    test ticket over TCP, and stamps the outcome for the portal to poll.
-- ---------------------------------------------------------------------------
create table if not exists public.pos_test_prints (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  target_id uuid not null references public.pos_routing_targets(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'printed', 'failed')),
  error text,
  requested_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  printed_at timestamptz
);

create index if not exists pos_test_prints_pending_idx
  on public.pos_test_prints (restaurant_id, status, created_at desc);

alter table public.pos_test_prints enable row level security;
grant select, insert, update on public.pos_test_prints to authenticated;

-- Portal side: owner / reseller / platform admin manage requests.
drop policy if exists pos_test_prints_portal_all on public.pos_test_prints;
create policy pos_test_prints_portal_all on public.pos_test_prints
  for all to authenticated
  using (can_manage_store_devices(restaurant_id))
  with check (
    can_manage_store_devices(restaurant_id)
    and exists (
      select 1 from public.pos_routing_targets target
      where target.id = pos_test_prints.target_id
        and target.restaurant_id = pos_test_prints.restaurant_id
    )
  );

-- Device side: staff signed into the POS app claim + ack jobs for their store.
drop policy if exists pos_test_prints_device_select on public.pos_test_prints;
create policy pos_test_prints_device_select on public.pos_test_prints
  for select to authenticated
  using (exists (
    select 1 from public.restaraunt_assignments ra
    where ra."user" = auth.uid()
      and ra.restaraunt = pos_test_prints.restaurant_id
      and coalesce(ra.approved, true)
  ));

drop policy if exists pos_test_prints_device_update on public.pos_test_prints;
create policy pos_test_prints_device_update on public.pos_test_prints
  for update to authenticated
  using (exists (
    select 1 from public.restaraunt_assignments ra
    where ra."user" = auth.uid()
      and ra.restaraunt = pos_test_prints.restaurant_id
      and coalesce(ra.approved, true)
  ))
  with check (exists (
    select 1 from public.restaraunt_assignments ra
    where ra."user" = auth.uid()
      and ra.restaraunt = pos_test_prints.restaurant_id
      and coalesce(ra.approved, true)
  )
  and exists (
    select 1 from public.pos_routing_targets target
    where target.id = pos_test_prints.target_id
      and target.restaurant_id = pos_test_prints.restaurant_id
  ));

-- ---------------------------------------------------------------------------
-- 2. Legacy printers. The POS app's printer-setup screen stores single
--    receipt/kitchen IPs on pos_restaurant_configs (id = restaurant id), not
--    pos_routing_targets — which is why they never appear in the portal.
--    Expose only the printer columns (the row also holds pos_password and
--    payment tokens, so no blanket select) so the portal can offer an import.
-- ---------------------------------------------------------------------------
alter table public.pos_restaurant_configs enable row level security;
grant select (id, receipt_printer_ip, kitchen_printer_ip, printer_profile)
  on public.pos_restaurant_configs to authenticated;

drop policy if exists pos_restaurant_configs_portal_select on public.pos_restaurant_configs;
create policy pos_restaurant_configs_portal_select on public.pos_restaurant_configs
  for select to authenticated
  using (can_manage_store_devices(id));

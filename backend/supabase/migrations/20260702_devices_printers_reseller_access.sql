-- Devices & printers: per-device printer assignments, portal-minted pairing
-- codes, and reseller/admin access to the device + kitchen-routing tables.
-- Run manually in the Supabase SQL editor (repo convention).

-- ---------------------------------------------------------------------------
-- 0. Cleanup: the legacy 0–9 step constraint still coexists with the newer
--    0–20 range constraint, so rows must satisfy BOTH — effective cap is 9.
-- ---------------------------------------------------------------------------
alter table public.restaurants
  drop constraint if exists restaurants_onboarding_step_check;

-- ---------------------------------------------------------------------------
-- 1. Device → printer assignments (physical layer).
--    One target per role per device; 'backup' is its own role, so a terminal
--    can have a receipt printer plus a fallback without a priority scheme.
-- ---------------------------------------------------------------------------
create table if not exists public.pos_device_printers (
  device_id uuid not null references public.pos_devices(id) on delete cascade,
  target_id uuid not null references public.pos_routing_targets(id) on delete cascade,
  role text not null check (role in ('receipt', 'cash_drawer', 'label', 'backup')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (device_id, role)
);

create index if not exists pos_device_printers_target_idx
  on public.pos_device_printers (target_id);

-- ---------------------------------------------------------------------------
-- 2. Pairing codes minted from the portal. The POS backend redeems them with
--    the service role (bypasses RLS) and stamps redeemed_device_id.
-- ---------------------------------------------------------------------------
create table if not exists public.pos_device_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  code text not null unique,
  device_name text,
  device_type text,
  created_by uuid not null default auth.uid(),
  expires_at timestamptz not null,
  redeemed_device_id uuid references public.pos_devices(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pos_device_pairing_codes_restaurant_idx
  on public.pos_device_pairing_codes (restaurant_id);

alter table public.pos_device_printers enable row level security;
alter table public.pos_device_pairing_codes enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Access policies. Owner via restaurants.owner_id; reseller via the
--    existing is_reseller_for(); admin via is_platform_admin(). Resellers do
--    IT for their stores, so device management is a mandatory surface —
--    full manage, not an owner-configured toggle.
--    Note: pos_devices previously had only legacy select/insert policies
--    (user_roles / restaraunt_assignments) and no update policy at all.
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_store_devices(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from restaurants r
    where r.id = rid and r.owner_id = auth.uid()
  )
  or is_reseller_for(rid)
  or is_platform_admin();
$$;

-- pos_devices: portal management (legacy POS-app policies left in place).
drop policy if exists pos_devices_portal_select on public.pos_devices;
create policy pos_devices_portal_select on public.pos_devices
  for select to authenticated
  using (can_manage_store_devices(restaurant_id));

drop policy if exists pos_devices_portal_update on public.pos_devices;
create policy pos_devices_portal_update on public.pos_devices
  for update to authenticated
  using (can_manage_store_devices(restaurant_id))
  with check (can_manage_store_devices(restaurant_id));

drop policy if exists pos_devices_portal_insert on public.pos_devices;
create policy pos_devices_portal_insert on public.pos_devices
  for insert to authenticated
  with check (can_manage_store_devices(restaurant_id));

-- pos_device_printers: scoped through the owning device.
drop policy if exists pos_device_printers_portal_all on public.pos_device_printers;
create policy pos_device_printers_portal_all on public.pos_device_printers
  for all to authenticated
  using (exists (
    select 1 from public.pos_devices d
    where d.id = pos_device_printers.device_id
      and can_manage_store_devices(d.restaurant_id)
  ))
  with check (exists (
    select 1 from public.pos_devices d
    where d.id = pos_device_printers.device_id
      and can_manage_store_devices(d.restaurant_id)
  ));

-- pos_device_pairing_codes
drop policy if exists pos_device_pairing_codes_portal_all on public.pos_device_pairing_codes;
create policy pos_device_pairing_codes_portal_all on public.pos_device_pairing_codes
  for all to authenticated
  using (can_manage_store_devices(restaurant_id))
  with check (can_manage_store_devices(restaurant_id));

-- Kitchen routing tables: owner ALL policies already exist; add reseller/admin.
drop policy if exists kitchen_stations_reseller_admin_all on public.kitchen_stations;
create policy kitchen_stations_reseller_admin_all on public.kitchen_stations
  for all to authenticated
  using (is_reseller_for(restaurant_id) or is_platform_admin())
  with check (is_reseller_for(restaurant_id) or is_platform_admin());

drop policy if exists pos_routing_targets_reseller_admin_all on public.pos_routing_targets;
create policy pos_routing_targets_reseller_admin_all on public.pos_routing_targets
  for all to authenticated
  using (is_reseller_for(restaurant_id) or is_platform_admin())
  with check (is_reseller_for(restaurant_id) or is_platform_admin());

drop policy if exists pos_station_targets_reseller_admin_all on public.pos_station_targets;
create policy pos_station_targets_reseller_admin_all on public.pos_station_targets
  for all to authenticated
  using (exists (
    select 1 from public.kitchen_stations ks
    where ks.id = pos_station_targets.station_id
      and (is_reseller_for(ks.restaurant_id) or is_platform_admin())
  ))
  with check (exists (
    select 1 from public.kitchen_stations ks
    where ks.id = pos_station_targets.station_id
      and (is_reseller_for(ks.restaurant_id) or is_platform_admin())
  ));

drop policy if exists pos_kitchen_routing_settings_reseller_admin_all on public.pos_kitchen_routing_settings;
create policy pos_kitchen_routing_settings_reseller_admin_all on public.pos_kitchen_routing_settings
  for all to authenticated
  using (is_reseller_for(restaurant_id) or is_platform_admin())
  with check (is_reseller_for(restaurant_id) or is_platform_admin());

-- Menu → print group assignment writes menu_categories/menu_items
-- routing_station_id; resellers need read + update (not insert/delete).
drop policy if exists menu_categories_reseller_admin_select on public.menu_categories;
create policy menu_categories_reseller_admin_select on public.menu_categories
  for select to authenticated
  using (is_reseller_for(restaurant_id) or is_platform_admin());

drop policy if exists menu_categories_reseller_admin_update on public.menu_categories;
create policy menu_categories_reseller_admin_update on public.menu_categories
  for update to authenticated
  using (is_reseller_for(restaurant_id) or is_platform_admin())
  with check (is_reseller_for(restaurant_id) or is_platform_admin());

drop policy if exists menu_items_reseller_admin_select on public.menu_items;
create policy menu_items_reseller_admin_select on public.menu_items
  for select to authenticated
  using (is_reseller_for(restaurant_id) or is_platform_admin());

drop policy if exists menu_items_reseller_admin_update on public.menu_items;
create policy menu_items_reseller_admin_update on public.menu_items
  for update to authenticated
  using (is_reseller_for(restaurant_id) or is_platform_admin())
  with check (is_reseller_for(restaurant_id) or is_platform_admin());

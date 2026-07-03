-- Menu item photos + category button colors + portal access to menu tables.
-- menu_items.image_url exists in the POS frontend's type model but no backend
-- ever defined the column; menu_categories.color is new (the POS currently
-- colors categories device-side — storing the color here is the shared source
-- it can adopt later). menu_items' only owner policies are legacy
-- auth.jwt()->>'restaurant_id' claims that portal sessions don't carry, so
-- direct owner writes (image_url) need the portal policies below.
-- Run manually in the Supabase SQL editor (repo convention).

alter table public.menu_items
  add column if not exists image_url text;

alter table public.menu_categories
  add column if not exists color text;

-- Same helper the modifier-groups migration defines; repeated so these two
-- files can run in either order.
create or replace function public.can_manage_store_menu(rid uuid)
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
  or exists (
    select 1 from restaurant_members rm
    where rm.restaurant_id = rid
      and rm.user_id = auth.uid()
      and rm.status = 'active'
      and rm.role in ('owner', 'admin', 'manager')
  )
  or is_reseller_for(rid)
  or is_platform_admin();
$$;

-- Portal reads/writes on menu_items are select + update only (create/archive
-- go through the ML backend API, which connects directly to Postgres).
drop policy if exists menu_items_portal_select on public.menu_items;
create policy menu_items_portal_select on public.menu_items
  for select to authenticated
  using (can_manage_store_menu(restaurant_id));

drop policy if exists menu_items_portal_update on public.menu_items;
create policy menu_items_portal_update on public.menu_items
  for update to authenticated
  using (can_manage_store_menu(restaurant_id))
  with check (can_manage_store_menu(restaurant_id));

drop policy if exists menu_categories_portal_select on public.menu_categories;
create policy menu_categories_portal_select on public.menu_categories
  for select to authenticated
  using (can_manage_store_menu(restaurant_id));

drop policy if exists menu_categories_portal_update on public.menu_categories;
create policy menu_categories_portal_update on public.menu_categories
  for update to authenticated
  using (can_manage_store_menu(restaurant_id))
  with check (can_manage_store_menu(restaurant_id));

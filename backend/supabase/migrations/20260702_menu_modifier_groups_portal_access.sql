-- Menu modifier groups: portal access + nesting columns.
-- The POS backend created menu_modifier_groups / _items / _options (its
-- migration 0013) with service-role-only policies; the POS bootstrap already
-- reads type/prompt_mode/critical/included_count/overage_price/pre_modifiers
-- on groups and overage_price/child_group_id on options, but no repo
-- migration defines those columns — they exist only in the live DB. This
-- migration (a) backfills the column definitions idempotently so the schema
-- is reproducible, and (b) opens the tables to the portal (owner / active
-- manager member / reseller / platform admin) so the dashboard Menu tab can
-- manage modifier groups directly via Supabase, same pattern as
-- pos_daily_specials.
-- Run manually in the Supabase SQL editor (repo convention).

-- ---------------------------------------------------------------------------
-- 1. Nesting + prompt/pricing columns (no-ops where the live DB already has
--    them). child_group_id on an option is what makes "mods of mods" work:
--    selecting that option prompts the child group, recursively.
-- ---------------------------------------------------------------------------
alter table public.menu_modifier_groups
  add column if not exists type text,
  add column if not exists prompt_mode text,
  add column if not exists critical boolean not null default false,
  add column if not exists included_count integer not null default 0,
  add column if not exists overage_price numeric(12,2),
  add column if not exists pre_modifiers text[];

alter table public.menu_modifier_group_options
  add column if not exists overage_price numeric(12,2),
  add column if not exists child_group_id uuid references public.menu_modifier_groups(id) on delete set null;

create index if not exists idx_menu_modifier_group_options_child_group
  on public.menu_modifier_group_options (child_group_id)
  where child_group_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Who can manage a store's menu from the portal: owner, active
--    owner/admin/manager member, reseller, or platform admin.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. Grants + policies. Tables have RLS enabled with service-role-only
--    policies today; add portal policies alongside them. Junction tables are
--    scoped through the owning group.
-- ---------------------------------------------------------------------------
revoke all on table public.menu_modifier_groups from anon;
revoke all on table public.menu_modifier_group_items from anon;
revoke all on table public.menu_modifier_group_options from anon;
grant select, insert, update, delete on table public.menu_modifier_groups to authenticated;
grant select, insert, update, delete on table public.menu_modifier_group_items to authenticated;
grant select, insert, update, delete on table public.menu_modifier_group_options to authenticated;

drop policy if exists menu_modifier_groups_portal_all on public.menu_modifier_groups;
create policy menu_modifier_groups_portal_all on public.menu_modifier_groups
  for all to authenticated
  using (can_manage_store_menu(restaurant_id))
  with check (can_manage_store_menu(restaurant_id));

drop policy if exists menu_modifier_group_items_portal_all on public.menu_modifier_group_items;
create policy menu_modifier_group_items_portal_all on public.menu_modifier_group_items
  for all to authenticated
  using (exists (
    select 1 from public.menu_modifier_groups g
    where g.id = menu_modifier_group_items.group_id
      and can_manage_store_menu(g.restaurant_id)
  ))
  with check (exists (
    select 1 from public.menu_modifier_groups g
    where g.id = menu_modifier_group_items.group_id
      and can_manage_store_menu(g.restaurant_id)
  ));

drop policy if exists menu_modifier_group_options_portal_all on public.menu_modifier_group_options;
create policy menu_modifier_group_options_portal_all on public.menu_modifier_group_options
  for all to authenticated
  using (exists (
    select 1 from public.menu_modifier_groups g
    where g.id = menu_modifier_group_options.group_id
      and can_manage_store_menu(g.restaurant_id)
  ))
  with check (exists (
    select 1 from public.menu_modifier_groups g
    where g.id = menu_modifier_group_options.group_id
      and can_manage_store_menu(g.restaurant_id)
  ));

-- ---------------------------------------------------------------------------
-- 4. The portal Menu tab also reads menu_modifiers directly when composing
--    group option rows (names/prices come from the ML-backend API, but the
--    Supabase reads keep the tree self-contained if that API is unreachable).
--    menu_modifiers may have no portal policies (POS-owned table); add
--    read-only access.
-- ---------------------------------------------------------------------------
grant select on table public.menu_modifiers to authenticated;

drop policy if exists menu_modifiers_portal_select on public.menu_modifiers;
create policy menu_modifiers_portal_select on public.menu_modifiers
  for select to authenticated
  using (can_manage_store_menu(restaurant_id));

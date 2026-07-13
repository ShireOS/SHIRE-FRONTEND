-- Menu questions overhaul: category-level question inheritance, per-item
-- question overrides (defaults / opt-out / order), no-print flags, and
-- per-item modifier price + print overrides.
-- Run manually in the Supabase SQL editor (repo convention).
--
-- Model:
--  * menu_category_modifier_groups links a question (modifier group) to a
--    CATEGORY. Every item in that category inherits the question — including
--    items created later. Items opt out (or override behavior/defaults) via
--    menu_item_modifier_group_overrides.
--  * menu_item_modifier_group_overrides grows: prompt_mode becomes nullable
--    (a row may exist only to opt out or override defaults), plus
--    default_modifier_ids (per-item pre-selected options — Pretzels default
--    Beer Cheese without touching other items sharing the question),
--    opted_out (suppress an inherited/attached question on this item), and
--    display_order (per-item question ordering for inherited questions).
--  * menu_item_modifier_overrides: per (item, modifier) price override and
--    kitchen-print override.
--  * no_print on menu_modifier_groups: nothing in the question prints.
--    menu_modifiers.print_on_kitchen_ticket (exists in live DB / ML backend)
--    is the global per-modifier flag; guarded here for reproducibility.

-- ---------------------------------------------------------------------------
-- 1. No-print flags
-- ---------------------------------------------------------------------------
alter table public.menu_modifier_groups
  add column if not exists no_print boolean not null default false;

alter table public.menu_modifiers
  add column if not exists print_on_kitchen_ticket boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. Per-item question overrides: defaults / opt-out / order
-- ---------------------------------------------------------------------------
alter table public.menu_item_modifier_group_overrides
  add column if not exists default_modifier_ids uuid[],
  add column if not exists opted_out boolean not null default false,
  add column if not exists display_order integer;

-- A row may now exist purely to opt out or to override defaults/order.
alter table public.menu_item_modifier_group_overrides
  alter column prompt_mode drop not null;

-- ---------------------------------------------------------------------------
-- 3. Category-level question inheritance
-- ---------------------------------------------------------------------------
create table if not exists public.menu_category_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  group_id uuid not null references public.menu_modifier_groups(id) on delete cascade,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (category_id, group_id)
);

create index if not exists idx_menu_category_modifier_groups_restaurant
  on public.menu_category_modifier_groups (restaurant_id);
create index if not exists idx_menu_category_modifier_groups_group
  on public.menu_category_modifier_groups (group_id);

alter table public.menu_category_modifier_groups enable row level security;

revoke all on table public.menu_category_modifier_groups from anon;
grant select, insert, update, delete on table public.menu_category_modifier_groups to authenticated;

drop policy if exists menu_category_modifier_groups_portal_all on public.menu_category_modifier_groups;
create policy menu_category_modifier_groups_portal_all on public.menu_category_modifier_groups
  for all to authenticated
  using (
    exists (
      select 1
      from public.menu_categories c
      join public.menu_modifier_groups g on g.id = menu_category_modifier_groups.group_id
      where c.id = menu_category_modifier_groups.category_id
        and c.restaurant_id = menu_category_modifier_groups.restaurant_id
        and g.restaurant_id = menu_category_modifier_groups.restaurant_id
        and can_manage_store_menu(c.restaurant_id)
    )
  )
  with check (
    exists (
      select 1
      from public.menu_categories c
      join public.menu_modifier_groups g on g.id = menu_category_modifier_groups.group_id
      where c.id = menu_category_modifier_groups.category_id
        and c.restaurant_id = menu_category_modifier_groups.restaurant_id
        and g.restaurant_id = menu_category_modifier_groups.restaurant_id
        and can_manage_store_menu(c.restaurant_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Per-item modifier overrides (price on THIS item, print on THIS item)
-- ---------------------------------------------------------------------------
create table if not exists public.menu_item_modifier_overrides (
  item_id uuid not null references public.menu_items(id) on delete cascade,
  modifier_id uuid not null references public.menu_modifiers(id) on delete cascade,
  restaurant_id uuid not null,
  price_delta numeric(12,2),  -- null = modifier's normal price
  no_print boolean,           -- null = inherit modifier/question flags
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, modifier_id)
);

create index if not exists idx_menu_item_modifier_overrides_restaurant
  on public.menu_item_modifier_overrides (restaurant_id);
create index if not exists idx_menu_item_modifier_overrides_modifier
  on public.menu_item_modifier_overrides (modifier_id, item_id);

alter table public.menu_item_modifier_overrides enable row level security;

revoke all on table public.menu_item_modifier_overrides from anon;
grant select, insert, update, delete on table public.menu_item_modifier_overrides to authenticated;

drop policy if exists menu_item_modifier_overrides_portal_all on public.menu_item_modifier_overrides;
create policy menu_item_modifier_overrides_portal_all on public.menu_item_modifier_overrides
  for all to authenticated
  using (
    exists (
      select 1
      from public.menu_items i
      join public.menu_modifiers m on m.id = menu_item_modifier_overrides.modifier_id
      where i.id = menu_item_modifier_overrides.item_id
        and i.restaurant_id = menu_item_modifier_overrides.restaurant_id
        and m.restaurant_id = menu_item_modifier_overrides.restaurant_id
        and can_manage_store_menu(i.restaurant_id)
    )
  )
  with check (
    exists (
      select 1
      from public.menu_items i
      join public.menu_modifiers m on m.id = menu_item_modifier_overrides.modifier_id
      where i.id = menu_item_modifier_overrides.item_id
        and i.restaurant_id = menu_item_modifier_overrides.restaurant_id
        and m.restaurant_id = menu_item_modifier_overrides.restaurant_id
        and can_manage_store_menu(i.restaurant_id)
    )
  );

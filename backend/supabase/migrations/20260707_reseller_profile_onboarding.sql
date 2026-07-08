alter type public.restaraunt_role add value if not exists 'reseller_employee';

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('owner', 'reseller', 'reseller_employee', 'admin'));

create table if not exists public.reseller_profiles (
  reseller_id uuid primary key references public.profiles(id) on delete cascade,
  organization_name text not null default '',
  legal_business_name text,
  business_email text,
  phone text,
  website text,
  logo_url text,
  default_general_propagation text not null default 'current_group'
    check (default_general_propagation in ('current_group', 'current_restaurant', 'ask_every_time')),
  default_specified_propagation text not null default 'current_restaurant'
    check (default_specified_propagation in ('current_restaurant', 'ask_every_time')),
  onboarding_step integer not null default 1,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reseller_employees (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid unique references public.profiles(id) on delete set null,
  name text not null,
  email text,
  username text not null unique,
  auth_email text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  permissions jsonb not null default '{"view_analytics":true,"edit_setup":false,"propagate_changes":false,"manage_groups":false}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reseller_employee_restaurants (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.reseller_employees(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (employee_id, restaurant_id)
);

create index if not exists idx_reseller_employees_reseller_id on public.reseller_employees(reseller_id);
create index if not exists idx_reseller_employee_restaurants_employee_id on public.reseller_employee_restaurants(employee_id);
create index if not exists idx_reseller_employee_restaurants_restaurant_id on public.reseller_employee_restaurants(restaurant_id);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_reseller_profiles_updated_at on public.reseller_profiles;
create trigger update_reseller_profiles_updated_at
  before update on public.reseller_profiles
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_reseller_employees_updated_at on public.reseller_employees;
create trigger update_reseller_employees_updated_at
  before update on public.reseller_employees
  for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_account_type text;
begin
  requested_account_type := coalesce(new.raw_user_meta_data ->> 'account_type', 'owner');
  if requested_account_type not in ('owner', 'reseller', 'reseller_employee', 'admin') then
    requested_account_type := 'owner';
  end if;

  insert into public.profiles (
    id,
    first_name,
    last_name,
    account_type,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    requested_account_type,
    now(),
    now()
  )
  on conflict (id) do update
    set account_type = excluded.account_type,
        first_name = coalesce(public.profiles.first_name, excluded.first_name),
        last_name = coalesce(public.profiles.last_name, excluded.last_name),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_reseller_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select re.reseller_id
      from public.reseller_employees re
      where re.user_id = auth.uid()
        and re.status = 'active'
      limit 1
    ),
    auth.uid()
  );
$$;

create or replace function public.is_reseller_staff_for(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reseller_restaurants rr
    where rr.restaurant_id = target_restaurant_id
      and rr.status = 'active'
      and rr.reseller_id = auth.uid()
  )
  or exists (
    select 1
    from public.reseller_employees re
    join public.reseller_employee_restaurants rer on rer.employee_id = re.id
    where re.user_id = auth.uid()
      and re.status = 'active'
      and rer.restaurant_id = target_restaurant_id
  )
  or public.is_platform_admin();
$$;

create or replace function public.can_reseller_staff_edit(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reseller_restaurants rr
    where rr.restaurant_id = target_restaurant_id
      and rr.status = 'active'
      and rr.reseller_id = auth.uid()
  )
  or exists (
    select 1
    from public.reseller_employees re
    join public.reseller_employee_restaurants rer on rer.employee_id = re.id
    where re.user_id = auth.uid()
      and re.status = 'active'
      and rer.restaurant_id = target_restaurant_id
      and coalesce((re.permissions ->> 'edit_setup')::boolean, false)
  )
  or public.is_platform_admin();
$$;

create or replace function public.can_reseller_staff_manage_groups(target_reseller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reseller_employees re
    where re.reseller_id = target_reseller_id
      and re.user_id = auth.uid()
      and re.status = 'active'
      and coalesce((re.permissions ->> 'manage_groups')::boolean, false)
  ) or public.is_platform_admin();
$$;

create or replace function public.is_reseller_for(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_reseller_staff_edit(target_restaurant_id);
$$;

create or replace function public.resolve_reseller_employee_login(login_identifier text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select re.auth_email
  from public.reseller_employees re
  where re.status = 'active'
    and (
      lower(re.username) = lower(trim(login_identifier))
      or lower(coalesce(re.email, '')) = lower(trim(login_identifier))
      or lower(re.auth_email) = lower(trim(login_identifier))
    )
  limit 1;
$$;

alter table public.reseller_profiles enable row level security;
alter table public.reseller_employees enable row level security;
alter table public.reseller_employee_restaurants enable row level security;

drop policy if exists "Resellers manage own profile" on public.reseller_profiles;
create policy "Resellers manage own profile"
  on public.reseller_profiles
  for all
  to authenticated
  using (reseller_id = public.current_reseller_id() or public.is_platform_admin())
  with check (reseller_id = public.current_reseller_id() or public.is_platform_admin());

drop policy if exists "Resellers manage own employees" on public.reseller_employees;
create policy "Resellers manage own employees"
  on public.reseller_employees
  for all
  to authenticated
  using (reseller_id = auth.uid() or user_id = auth.uid() or public.is_platform_admin())
  with check (reseller_id = auth.uid() or public.is_platform_admin());

drop policy if exists "Resellers manage employee restaurant access" on public.reseller_employee_restaurants;
create policy "Resellers manage employee restaurant access"
  on public.reseller_employee_restaurants
  for all
  to authenticated
  using (
    exists (
      select 1 from public.reseller_employees re
      where re.id = reseller_employee_restaurants.employee_id
        and (re.reseller_id = auth.uid() or re.user_id = auth.uid() or public.is_platform_admin())
    )
  )
  with check (
    exists (
      select 1 from public.reseller_employees re
      where re.id = reseller_employee_restaurants.employee_id
        and (re.reseller_id = auth.uid() or public.is_platform_admin())
    )
  );

drop policy if exists "Reseller staff can read assigned restaurants" on public.restaurants;
create policy "Reseller staff can read assigned restaurants"
  on public.restaurants
  for select
  to authenticated
  using (public.is_reseller_staff_for(id));

drop policy if exists "Reseller employees view parent groups" on public.reseller_restaurant_groups;
create policy "Reseller employees view parent groups"
  on public.reseller_restaurant_groups
  for select
  to authenticated
  using (reseller_id = public.current_reseller_id() or public.is_platform_admin());

drop policy if exists "Reseller employees view parent group members" on public.reseller_restaurant_group_members;
create policy "Reseller employees view parent group members"
  on public.reseller_restaurant_group_members
  for select
  to authenticated
  using (reseller_id = public.current_reseller_id() or public.is_platform_admin());

drop policy if exists "Reseller employees manage parent groups" on public.reseller_restaurant_groups;
create policy "Reseller employees manage parent groups"
  on public.reseller_restaurant_groups
  for all
  to authenticated
  using (public.can_reseller_staff_manage_groups(reseller_id))
  with check (public.can_reseller_staff_manage_groups(reseller_id));

drop policy if exists "Reseller employees manage parent group members" on public.reseller_restaurant_group_members;
create policy "Reseller employees manage parent group members"
  on public.reseller_restaurant_group_members
  for all
  to authenticated
  using (public.can_reseller_staff_manage_groups(reseller_id))
  with check (
    public.can_reseller_staff_manage_groups(reseller_id)
    and public.is_reseller_staff_for(restaurant_id)
    and exists (
      select 1
      from public.reseller_restaurant_groups g
      where g.id = reseller_restaurant_group_members.group_id
        and g.reseller_id = reseller_restaurant_group_members.reseller_id
    )
  );

grant select, insert, update, delete on public.reseller_profiles to authenticated;
grant select, insert, update, delete on public.reseller_employees to authenticated;
grant select, insert, update, delete on public.reseller_employee_restaurants to authenticated;
grant execute on function public.current_reseller_id() to authenticated;
grant execute on function public.is_reseller_staff_for(uuid) to authenticated;
grant execute on function public.can_reseller_staff_edit(uuid) to authenticated;
grant execute on function public.can_reseller_staff_manage_groups(uuid) to authenticated;
grant execute on function public.resolve_reseller_employee_login(text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reseller-assets', 'reseller-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create table if not exists public.reseller_employee_groups (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.reseller_employees(id) on delete cascade,
  group_id uuid not null references public.reseller_restaurant_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (employee_id, group_id)
);

create index if not exists idx_reseller_employee_groups_employee_id on public.reseller_employee_groups(employee_id);
create index if not exists idx_reseller_employee_groups_group_id on public.reseller_employee_groups(group_id);

alter table public.reseller_employee_groups enable row level security;

drop policy if exists "Resellers manage employee groups" on public.reseller_employee_groups;
create policy "Resellers manage employee groups"
  on public.reseller_employee_groups
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.reseller_employees re
      where re.id = reseller_employee_groups.employee_id
        and (re.reseller_id = auth.uid() or public.is_platform_admin())
    )
  )
  with check (
    exists (
      select 1
      from public.reseller_employees re
      join public.reseller_restaurant_groups g on g.id = reseller_employee_groups.group_id
      where re.id = reseller_employee_groups.employee_id
        and g.reseller_id = re.reseller_id
        and (re.reseller_id = auth.uid() or public.is_platform_admin())
    )
  );

drop policy if exists "Reseller employees view assigned groups" on public.reseller_employee_groups;
create policy "Reseller employees view assigned groups"
  on public.reseller_employee_groups
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.reseller_employees re
      where re.id = reseller_employee_groups.employee_id
        and re.user_id = auth.uid()
        and re.status = 'active'
    )
  );

grant select, insert, update, delete on public.reseller_employee_groups to authenticated;

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
  or exists (
    select 1
    from public.reseller_employees re
    join public.reseller_employee_groups reg on reg.employee_id = re.id
    join public.reseller_restaurant_group_members rgm on rgm.group_id = reg.group_id
    where re.user_id = auth.uid()
      and re.status = 'active'
      and rgm.restaurant_id = target_restaurant_id
      and rgm.reseller_id = re.reseller_id
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
  or exists (
    select 1
    from public.reseller_employees re
    join public.reseller_employee_groups reg on reg.employee_id = re.id
    join public.reseller_restaurant_group_members rgm on rgm.group_id = reg.group_id
    where re.user_id = auth.uid()
      and re.status = 'active'
      and rgm.restaurant_id = target_restaurant_id
      and rgm.reseller_id = re.reseller_id
      and coalesce((re.permissions ->> 'edit_setup')::boolean, false)
  )
  or public.is_platform_admin();
$$;

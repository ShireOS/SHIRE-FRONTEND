-- Reseller employees need to read the parent reseller's assignment row so the
-- dashboard can apply the owner-controlled per-store permissions. Limit that
-- visibility to active assignments for restaurants the employee can already
-- reach directly or through an assigned reseller group.
drop policy if exists "Reseller employees view accessible assignments"
  on public.reseller_restaurants;
drop policy if exists "Reseller employees view parent assignments"
  on public.reseller_restaurants;

create policy "Reseller employees view accessible assignments"
  on public.reseller_restaurants
  for select
  to authenticated
  using (
    status = 'active'
    and reseller_id = public.current_reseller_id()
    and public.is_reseller_staff_for(restaurant_id)
  );

-- Resolve reseller employees through reseller_employees.user_id -> reseller_id,
-- then require both their direct/group store assignment and the owner's
-- per-store Devices permission. Direct resellers keep the same behavior.
create or replace function public.can_manage_store_devices(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurants r
    where r.id = rid
      and r.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.reseller_restaurants rr
    where rr.restaurant_id = rid
      and rr.reseller_id = public.current_reseller_id()
      and rr.status = 'active'
      and coalesce((rr.permissions ->> 'devices')::boolean, true)
      and public.is_reseller_staff_for(rid)
  )
  or public.is_platform_admin();
$$;

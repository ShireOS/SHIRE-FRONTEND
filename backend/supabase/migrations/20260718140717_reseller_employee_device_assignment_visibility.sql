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

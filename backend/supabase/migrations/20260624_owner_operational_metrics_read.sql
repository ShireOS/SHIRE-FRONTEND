revoke select on table public.pos_orders from anon;
revoke select on table public.pos_time_clock_entries from anon;

grant select on table public.pos_orders to authenticated;
grant select on table public.pos_time_clock_entries to authenticated;

drop policy if exists "Owners can read restaurant POS orders" on public.pos_orders;
create policy "Owners can read restaurant POS orders"
on public.pos_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.restaurant_members rm
    where rm.restaurant_id = pos_orders.restaurant_id
      and rm.user_id = (select auth.uid())
      and rm.status in ('accepted', 'active')
      and lower(rm.role) in ('owner', 'admin', 'developer')
  )
);

drop policy if exists "Owners can read restaurant time clock entries" on public.pos_time_clock_entries;
create policy "Owners can read restaurant time clock entries"
on public.pos_time_clock_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.restaurant_members rm
    where rm.restaurant_id = pos_time_clock_entries.restaurant_id
      and rm.user_id = (select auth.uid())
      and rm.status in ('accepted', 'active')
      and lower(rm.role) in ('owner', 'admin', 'developer')
  )
);

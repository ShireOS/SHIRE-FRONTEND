-- Qualify the outer storage.objects path. Inside the restaurants subquery,
-- unqualified `name` otherwise resolves to restaurants.name.
drop policy if exists "Restaurant editors can read image object metadata" on storage.objects;
drop policy if exists "Restaurant editors can upload image objects" on storage.objects;
drop policy if exists "Restaurant editors can update image objects" on storage.objects;
drop policy if exists "Restaurant editors can delete image objects" on storage.objects;

create policy "Restaurant editors can read image object metadata"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('floor-plans', 'menu-images', 'restaurant-assets')
  and exists (
    select 1
    from public.restaurants r
    where r.id::text = (storage.foldername(storage.objects.name))[1]
      and (
        r.owner_id = (select auth.uid())
        or public.can_reseller_staff_edit(r.id)
        or public.is_platform_admin()
      )
  )
);

create policy "Restaurant editors can upload image objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('floor-plans', 'menu-images', 'restaurant-assets')
  and exists (
    select 1
    from public.restaurants r
    where r.id::text = (storage.foldername(storage.objects.name))[1]
      and (
        r.owner_id = (select auth.uid())
        or public.can_reseller_staff_edit(r.id)
        or public.is_platform_admin()
      )
  )
);

create policy "Restaurant editors can update image objects"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('floor-plans', 'menu-images', 'restaurant-assets')
  and exists (
    select 1
    from public.restaurants r
    where r.id::text = (storage.foldername(storage.objects.name))[1]
      and (
        r.owner_id = (select auth.uid())
        or public.can_reseller_staff_edit(r.id)
        or public.is_platform_admin()
      )
  )
)
with check (
  bucket_id in ('floor-plans', 'menu-images', 'restaurant-assets')
  and exists (
    select 1
    from public.restaurants r
    where r.id::text = (storage.foldername(storage.objects.name))[1]
      and (
        r.owner_id = (select auth.uid())
        or public.can_reseller_staff_edit(r.id)
        or public.is_platform_admin()
      )
  )
);

create policy "Restaurant editors can delete image objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('floor-plans', 'menu-images', 'restaurant-assets')
  and exists (
    select 1
    from public.restaurants r
    where r.id::text = (storage.foldername(storage.objects.name))[1]
      and (
        r.owner_id = (select auth.uid())
        or public.can_reseller_staff_edit(r.id)
        or public.is_platform_admin()
      )
  )
);

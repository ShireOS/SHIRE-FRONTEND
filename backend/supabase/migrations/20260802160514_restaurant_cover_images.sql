-- Restaurant cover images are public presentation assets. Writes stay scoped
-- to the restaurant owner, an assigned reseller editor, or a platform admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-assets',
  'restaurant-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- These legacy policies were created through the Storage policy editor and
-- unintentionally granted every role access to every bucket, including the
-- private model-artifacts bucket. Replace them with restaurant-scoped writes.
drop policy if exists "public access 1676dm1_0" on storage.objects;
drop policy if exists "public access 1676dm1_1" on storage.objects;
drop policy if exists "public access 1676dm1_2" on storage.objects;
drop policy if exists "public access 1676dm1_3" on storage.objects;

create policy "Restaurant editors can read image object metadata"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('floor-plans', 'menu-images', 'restaurant-assets')
  and exists (
    select 1
    from public.restaurants r
    where r.id::text = (storage.foldername(name))[1]
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
    where r.id::text = (storage.foldername(name))[1]
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
    where r.id::text = (storage.foldername(name))[1]
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
    where r.id::text = (storage.foldername(name))[1]
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
    where r.id::text = (storage.foldername(name))[1]
      and (
        r.owner_id = (select auth.uid())
        or public.can_reseller_staff_edit(r.id)
        or public.is_platform_admin()
      )
  )
);

create policy "Resellers can read their asset metadata"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'reseller-assets'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_platform_admin()
  )
);

create policy "Resellers can upload their assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'reseller-assets'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_platform_admin()
  )
);

create policy "Resellers can update their assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'reseller-assets'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_platform_admin()
  )
)
with check (
  bucket_id = 'reseller-assets'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_platform_admin()
  )
);

create policy "Resellers can delete their assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'reseller-assets'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_platform_admin()
  )
);

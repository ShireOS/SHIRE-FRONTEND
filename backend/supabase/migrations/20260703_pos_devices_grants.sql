-- Portal reads of pos_devices fail with "permission denied for table
-- pos_devices": the POS device/routing tables were created without the
-- table-level GRANTs Supabase normally applies, so the `authenticated` role
-- can't touch them at all — RLS policies (20260702) never even get evaluated.
-- Grants are the coarse gate; the existing RLS policies still scope rows.
-- Run manually in the Supabase SQL editor (repo convention).

grant select, insert, update on public.pos_devices to authenticated;
grant select, insert, update, delete on public.pos_device_printers to authenticated;
grant select, insert, delete on public.pos_device_pairing_codes to authenticated;
grant select, insert, update on public.pos_routing_targets to authenticated;
grant select, insert, update, delete on public.pos_station_targets to authenticated;
grant select, insert, update on public.kitchen_stations to authenticated;
grant select, update on public.pos_kitchen_routing_settings to authenticated;

-- Answer ordering for menu questions: each question (modifier group) can show
-- its answers alphabetically or in a hand-arranged order.
-- Run manually in the Supabase SQL editor (repo convention).
--
-- Model: modifier_sort_mode on menu_modifier_groups is a dashboard-side flag.
-- The dashboard always PERSISTS the effective order into
-- menu_modifier_group_options.display_order (alpha mode physically rewrites
-- display_order alphabetically, and re-normalizes when answers are added), so
-- the POS keeps reading ORDER BY display_order and needs no changes.
--
-- Question ordering itself (per-item link order, per-item override order, and
-- category-link order) already exists from 20260712_menu_questions_overhaul —
-- this build only adds drag-and-drop UI over those columns.

alter table public.menu_modifier_groups
  add column if not exists modifier_sort_mode text not null default 'custom';

alter table public.menu_modifier_groups
  drop constraint if exists menu_modifier_groups_modifier_sort_mode_check;
alter table public.menu_modifier_groups
  add constraint menu_modifier_groups_modifier_sort_mode_check
  check (modifier_sort_mode in ('custom', 'alpha'));

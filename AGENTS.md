# SHIRE Frontend — Agent Instructions

## Roles, Permissions & Back-Office Access (KEEP THIS UPDATED)

> **Maintenance rule:** any change that touches staff roles, permission checks, or
> back-office (dashboard) access — in this repo, `~/Shire_POS_backend`, or
> `~/Documents/Restuarant_ML-Backend` — MUST update this section in the same commit.
> This is the single source of truth for how access works across the three repos.

### The model
- **Staff live in the shared Supabase `waiters` table** (one row per employee per
  restaurant). `waiters.role` is the primary/default role; `waiters.roles text[]`
  (POS migration `0018_pos_waiter_roles_v1.sql`) is the full set of roles an
  employee is allowed to work. At clock-in the employee (or manager) picks one of
  their allowed roles; that role is snapshotted onto `pos_time_clock_entries.role`
  and is what payroll/tip-out groups by.
- **POS-side auth:** PIN identify → staff token (`get_current_waiter` →
  `WaiterContext` in Shire_POS_backend). Manager-gated routes check `is_manager(ctx)`.
  Day-close permissions are separate: `can_close_day` closes the current day,
  while `can_reopen_business_day` authorizes the audited reopen workflow and
  defaults to owner-only until explicitly granted to another role.
- **Dashboard-side auth:** Supabase auth (owner account today). Dynamic role
  permissions live in ML backend migration `0049_dynamic_role_permissions.sql`,
  surfaced in `apps/web/src/dashboard/components/team/RolePermissionsPanel.jsx`.
- **Back-office access by invite (being built):** an owner/manager can grant any
  employee dashboard access by entering their email. This sends an invite email
  backed by the existing `staff_invitations` table (ML migration
  `0002_integrations_jobs_invitations.sql`: email, token, status, restaurant_id).
  Accepting creates a Supabase auth user linked to their `waiters` row; what they
  see in the dashboard is gated by the dynamic role permission system, configured
  by the owner. TeamPage currently shows a "Member invites — coming soon"
  placeholder where this lands.
- **Time clock adjustments** are manager/owner actions. POS backend already has
  the manager CRUD (`/manager/timeclock/entries` GET/POST/PATCH + `/void`) and
  records `manager_id`, `manager_name`, `reason` as the audit trail. The dashboard
  Team hub reuses these endpoints via a second base URL (POS backend), not the ML
  backend.

### Planned two-layer back-office permissions (design agreed 2026-07-08)
- Role defaults: `back_office_permissions jsonb` on `pos_role_permissions`;
  per-person diffs: `permission_overrides jsonb` on `restaurant_members`
  (store only keys that differ from the role). Effective permissions = role
  defaults merged with overrides, computed in ONE shared helper (`can(key)`)
  used by both sidebar gating and API guards.
- Permission keys are grouped strings (`menu.edit_prices`, `team.adjust_timeclock`,
  `payroll.run`, `reports.view`, `settings.edit`, ...). Curated set (~12), not
  per-button toggles. Presets (Manager / Shift Lead / View only) are canned
  jsonb blobs applied client-side.
- A member can never grant a permission they don't hold themselves.
- UI gating is courtesy only — every mutating endpoint must check the effective
  permission map server-side.

### When you code in this area (STANDING RULES)
- **Every new back-office feature, page, tab, or mutating endpoint MUST be wired
  into the permission system in the same PR/commit:** assign an existing
  permission key or add a new one, gate its nav/UI via `can(key)`, add the
  server-side guard, and list the key in the "Permission keys" registry below.
  No back-office functionality ships permission-unaware. This applies to ALL
  future work, not just the Team hub build.
- New permission-gated features must respect the dynamic role permission system —
  never hardcode role names in UI checks when a permission key exists.
- Any new manager mutation on POS data must record who/when/why (follow the
  timeclock `manager_id`/`manager_name`/`reason` pattern).
- Update this section + the matching notes in the other repos' CLAUDE/AGENTS files
  as the invite flow and Team hub ship.

### Permission keys registry
Canonical definitions live in `apps/web/src/shared/permissions.ts`
(PERMISSION_GROUPS / PERMISSION_PRESETS / TAB_PERMISSIONS) — that file and this
list must stay in sync.
- `menu.view` / `menu.edit_items` / `menu.edit_prices`
- `team.view` / `team.edit_employees` / `team.adjust_timeclock`
- `payroll.view` / `payroll.run` / `payroll.adjust_tips` / `payroll.export`
- `reports.view`
- `settings.edit`

### Implementation map (2026-07-08 build)
- Frontend: `shared/permissions.ts` (keys/presets/merge/can/TAB_PERMISSIONS),
  `shared/hooks/useBackOfficeAccess.ts` (effective access; owners/admins/resellers
  bypass), `shared/api/posClient.ts` (2nd base URL → POS backend, env
  `VITE_POS_API_BASE_URL`, sends Supabase JWT + `X-Restaurant-Id`),
  `shared/api/backOfficeApi.ts` (ML back-office endpoints). Sidebar Team group +
  tab gating in `dashboard/shell/DashboardShell.jsx`; deep-link gating in
  `AuthenticatedDashboardApp.jsx` (RestaurantWorkspace); `/invite` route →
  `pages/AcceptInvitePage.jsx`; Time Clock tab → `pages/TimeClockPage.jsx`;
  Labor Cost tab → `pages/LaborCostPage.jsx` and existing `payroll.view`.
  Payroll exports/email actions use existing `payroll.export`; the frontend posts
  email requests to `/restaurants/:id/payroll/email` and falls back to download
  when the email service endpoint is not configured. Menu item price-allocation
  changes use `menu.edit_prices`; members with only `menu.view` retain read-only
  visibility, while the ML backend enforces the same permission on writes.
  Menu-category and item-level
  tipout configuration uses existing `payroll.adjust_tips`: item overrides replace
  category rules, category rules replace restaurant defaults, and configuration
  is stored on the shared tips/payroll settings contract using stable menu IDs.
- Reseller UI editing is store-scoped at `/reseller/restaurants/:restaurantId/ui`.
  Resellers, reseller employees, and admins see **UI Editor** in the selected
  store sidebar; admins entering through `/restaurants/:restaurantId/*` are
  routed to that canonical reseller editor path. Editor mutation authorization
  remains enforced by the existing reseller backend guards.
- Migrations (manual run): ML `supabase/migrations/0055_team_hub_access.sql`
  (restaurant_members + back_office_permissions + invitations alter), POS repo
  `0022_pos_timeclock_breaks_v1.sql` (pos_time_clock_breaks).
- POS backend: portal Supabase-JWT auth for `/manager/timeclock*` validates
  sessions through Supabase Auth (including asymmetric signing keys; legacy
  `SUPABASE_JWT_SECRET` fallback), breaks on entries.
- ML backend: `app/api/back_office.py` (members/invites/my-access/accept),
  `app/services/back_office_access.py` (merge + require_back_office_permission),
  guards on tips_payroll + waiters mutations.
- Printer outage protection uses existing `settings.edit`. The Devices page reads
  the POS backend's canonical `/restaurants/:id/printer-failover` surface, makes
  every active printer choose Hold & alert or an explicit backup, and exposes
  one-tap reroute/restore. Policy lives inside existing
  `kitchen_output_targets.config`; no new schema is required.
- Terminal hardware and cash-drawer configuration uses the reseller-aware
  `devices.manage` / `settings.edit` POS guards. Changes are sent through audited
  POS-backend endpoints with a required reason; direct Supabase writes remain
  protected by `can_manage_store_devices()` RLS but are not used for these controls.
  Portfolio device visibility also honors each store's owner-controlled reseller
  `devices` permission. Reseller employees may read only their parent reseller's
  active assignment rows for restaurants they can already access directly or
  through an assigned group (migration
  `20260718140717_reseller_employee_device_assignment_visibility.sql`).
- End-of-day report delivery is configured with `eod_email_on_close` and
  `eod_email_formats` (`pdf` / `xlsx`). Reopening a closed business day requires
  the POS role permission `can_reopen_business_day` and records the acting manager.
- Supabase-direct menu writes use `can_manage_store_menu()` RLS. Category-question
  and item-modifier override policies also verify that every referenced row
  belongs to the submitted restaurant, preventing cross-tenant record links.
- Server Quick Menu, Fast Bar, department ranking, and bartender home preferences
  use existing `menu.view` for Back Office visibility and `menu.edit_items` for
  mutation. Owners and authorized resellers share the audited POS-backend
  `/reseller/pos-menu-workspace` contract; the browser never writes these tables
  directly. Fast Bar and Server Menu always retain access to every department.

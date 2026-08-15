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
- **Server and Waiter are one working role.** `waiter` is a legacy alias that the
  dashboard renders as `Server`; new assignments prefer the active `server` job
  code while waiter-only restaurants remain compatible. `waiters.pos_role` is a
  POS permission tier and must never be used as the employee's primary job.
  Restaurant-defined custom job codes remain distinct and selectable alongside
  the built-in roles.
- **POS-side auth:** PIN identify → staff token (`get_current_waiter` →
  `WaiterContext` in Shire_POS_backend). Manager-gated routes check `is_manager(ctx)`.
  Day-close permissions are separate: `can_close_day` closes the current day,
  while `can_reopen_business_day` authorizes the audited reopen workflow and
  defaults to owner-only until explicitly granted to another role.
- **Dashboard-side auth:** Supabase auth (owner account today). Dynamic role
  permissions live in ML backend migration `0049_dynamic_role_permissions.sql`,
  surfaced in `apps/web/src/dashboard/components/team/RolePermissionsPanel.jsx`.
- **Role-management authority is hierarchical:** staff < manager < owner <
  platform admin. A caller may create, assign, edit, or remove only parallel or
  lower roles. Platform admins may delegate admin, but `profiles.is_superuser`
  marks the immutable founding account and is never accepted from browser writes
  or signup metadata. These checks are enforced by both ML and POS APIs; UI
  disabling is only a convenience.
- **POS positions are archived, not deleted.** Team -> Employees -> Members owns
  the position catalog editor. A position can be archived only when no employee
  is assigned through either `waiters.job_code_id` or `employee_job_codes`;
  recreating the same code reactivates the existing row and preserves history.
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
- `operations.close_day`
- `payments.refund`
- `settings.edit`

### POS-owned tip domain (2026-07-28)

- Dashboard tip settings, previews, runs, payouts, pay periods, and job-code
  calls use `shared/api/posClient.ts`, including the Supabase bearer token and
  `X-Restaurant-Id`. Restaurant ML remains a reporting reader and temporary
  compatibility proxy only.
- Tip reads use `payroll.view`; settings/payout edits use
  `payroll.adjust_tips`; run create/finalize/void uses `payroll.run`.
- Receiving-role tipouts default to an even split. Optional Monday-Sunday
  exceptions are saved in `weekday_tipout_overrides`: missing days inherit the
  restaurant default, while a day may disable tipouts or replace only its
  tipout rules. Weekday exceptions with pooling require a daily pool reset.
- Unallocated tip-out exceptions render only while open. Listing uses
  `payroll.view`; assigning a worked recipient or keeping the money with its
  source requires `payroll.adjust_tips`, a manager reason, and a POS audit row.

The universal manager action inbox uses `team.view` for visibility,
`team.edit_employees` for schedule-request and shift-transfer decisions, and
`team.adjust_timeclock` for missed-clock-out corrections. Owners retain the
existing bypass; the frontend resolves effective access and hides each mutation
surface independently, while every mutation is also guarded by the ML backend.

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
  Owners and back-office members with `settings.edit` can open **UI Editor**
  from `/restaurants/:restaurantId/ui`; resellers, reseller employees, and
  admins see the same editor in the selected store sidebar. Admins entering
  through `/restaurants/:restaurantId/*` are routed to the canonical reseller
  editor path. Editor mutation authorization remains enforced by the existing
  backend guards. Admin portfolio
  scope loads all admin-visible reseller groups instead of treating the admin's
  profile ID as a reseller ID; the scope picker is always dismissible and shows
  theme-loading failures inside the dialog.
  Reseller sidebar visibility comes from one grant-to-route map used by every
  store route, including the specialized Setup and UI Editor shells. The
  owner-controlled `setup` grant covers conditional Setup, Store Information,
  Marketing, Store Settings, Integrations, UI Editor, POS Settings, and Printing
  & Routing; `team` covers Members, Time Clock, and Alerts; report,
  check, labor-cost, and payroll/tip surfaces remain mandatory. Route changes
  reuse the resolved store grants so the sidebar does not change composition.
  POS Settings reason-preset reads and mutations use the same portal-aware
  `settings.edit` guard as the rest of that setup surface; valid dashboard
  Supabase sessions must never be parsed only as native POS staff tokens.
  POS-backed pages preserve HTTP status on load failures: authentication or
  permission errors must not be presented as a network/backend outage.
  POS requests refresh Supabase sessions through one single-flight coordinator:
  refresh before expiry, retry once after `401`, and never treat `403` as a
  token failure. Signing out clears restaurant-scoped query state.
  UI previews default to the same-origin Expo exports under
  `apps/web/public/previews`; environment URLs may explicitly override them.
  Never add an implicit localhost or developer-machine fallback.
- Store setup completeness (2026-08-11) is derived by the ML backend from the
  canonical restaurant, POS, menu, hours, floor, and staffing records. Setup is
  a recovery route and is shown only while a required domain is incomplete;
  `onboarding_completed_at` remains historical metadata and is not the source
  of truth. Permanent configuration ownership is Store Information (Basics and
  Goals), Marketing (Branding), Store Settings (Legal, Payments, Cash/Closeout,
  Check Workflow, Hours), Integrations (current tools/service model and
  reservations), Menu (menu data, discounts, routing, and admin-only tax UI),
  Team (members/roles and Manager Controls), UI Editor (appearance, sections,
  floor plan), and Payroll & Tips. All of these pages reuse the Setup editor's
  canonical save contracts. Discount reads require `menu.view`; writes require
  `menu.edit_items`. Taxes remain editable from onboarding/recovery Setup, but
  their permanent Menu surface is shown only to platform admins (including the
  configured Cameron admin account).
- Migrations (manual run): ML `supabase/migrations/0055_team_hub_access.sql`
  (restaurant_members + back_office_permissions + invitations alter), POS repo
  `0022_pos_timeclock_breaks_v1.sql` (pos_time_clock_breaks).
- POS backend: portal Supabase-JWT auth for `/manager/timeclock*` validates
  sessions through Supabase Auth (including asymmetric signing keys; legacy
  `SUPABASE_JWT_SECRET` fallback), breaks on entries. All portal-owned POS
  routes use the same resolver for owners, platform admins, restaurant members,
  direct resellers, and assigned reseller employees. Unlinked legacy members
  use `restaurant_members.role` only as the role-default lookup key; explicit
  permission overrides still win and no waiter link is guessed. Reseller store
  grants are translated to the canonical permission keys in that resolver;
  printing/check-workflow routes must not maintain a private owner/member check.
- ML backend: `app/api/back_office.py` (members/invites/my-access/accept),
  `app/services/back_office_access.py` (merge + require_back_office_permission),
  guards on tips_payroll + waiters mutations. ML-owned employee, invite, alert,
  and settings endpoints mirror the same reseller store/employee grant
  translation; reseller read access does not imply mutation access.
- Manager alerts: the store bell and Alerts page merge existing scheduling
  requests with durable missed-clock-out alerts. Desktop and mobile call the
  same ML-backend action API; time corrections write the existing POS
  time-clock adjustment audit trail.
- Printer outage protection uses existing `settings.edit`. The Devices page reads
  the POS backend's canonical `/restaurants/:id/printer-failover` surface, makes
  every active printer choose Hold & alert or an explicit backup, and exposes
  one-tap reroute/restore. Policy lives inside existing
  `kitchen_output_targets.config`; no new schema is required.
- Terminal hardware and cash-drawer configuration uses the reseller-aware
  `devices.manage` / `settings.edit` POS guards. Changes are sent through audited
  POS-backend endpoints with a required reason; direct Supabase writes remain
  protected by `can_manage_store_devices()` RLS but are not used for these controls.
  Receipt-printer and cash-drawer selectors read active receipt-capable
  `kitchen_output_targets` and persist through the audited
  `/devices/:deviceId/printer-assignment` route; stale `pos_routing_targets`
  compatibility rows are never shown as physical printer choices.
  Portfolio device visibility also honors each store's owner-controlled reseller
  `devices` permission. Reseller employees may read only their parent reseller's
  active assignment rows for restaurants they can already access directly or
  through an assigned group (migration
  `20260718140717_reseller_employee_device_assignment_visibility.sql`).
- Operational pricing uses one versioned `pos_restaurant_configs.pricing_policy`
  record per store. Setup and enterprise Rates both read/write it through the ML
  backend under existing `settings.edit`/reseller authorization; the browser must
  not write `restaurant_rate_plans` as a parallel current truth. Listed-price
  basis controls payment math, while display order controls only POS/receipt order.
- End-of-day report delivery is configured with `eod_email_on_close` and
  `eod_email_formats` (`pdf` / `xlsx`). Reopening a closed business day requires
  the POS role permission `can_reopen_business_day` and records the acting manager.
- Cash accountability remains POS-owned: paid-in, paid-out, cash-drop, drawer
  delivery, performer, approver, review, and reversal mutations are audited by
  the POS backend. Back Office exposes the resulting read-only daily/Z/PDF/XLSX/
  email reporting under the existing `reports.view` permission; it never writes
  cash ledger rows directly.
- The full POS check ledger appears both on the store Home page below analytics
  widgets and on the dedicated Checks route. Both locations reuse
  `CheckLedgerSection`, including Active/Closed/History, detail and activity-log
  views, and the existing `reports.view` read boundary; refund actions retain
  their separate `payments.refund` guard.
- Opening cash is a `settings.edit` restaurant policy on the existing
  `pos_closeout_settings` row: zero, fixed, or the latest finalized
  `pos_cash_reconciliations.retained_bank` with a configured fallback. Staff are
  never asked to confirm an opening amount before taking cash. Close Day displays
  backend-resolved lineage and keeps ledger-derived cash totals read-only.
- Server checkout receipt templates are configured only from Back Office's
  Server Reports panel. `reports.view` authorizes reading and production-rendered
  previews, while `settings.edit` authorizes the restaurant-wide template update
  through the POS backend. Native POS remains view/print only, and the required
  cash-settlement lines and their existing math are not configurable.
- Cash drawer access is role-first: No Sale requires `can_no_sale` plus
  `can_open_cash_drawer`; movements require `can_paid_in_out` plus
  `can_open_cash_drawer`. The restaurant-wide
  `require_manager_for_drawer_open` and role-level
  `require_manager_pin_for_approval` each force manager approval. Paid Out is
  always manager-approved, while Cash Drop also respects its configured
  threshold. Employee add/edit surfaces preview inherited behavior; the POS
  backend remains authoritative and posts movements only after drawer delivery.
- Back-office Close Day uses the canonical POS close operation. Open checks are
  never overrideable; clocked-in employees require an explicit confirmation and
  retain the manager adjustment audit. Owner access uses
  `operations.close_day`; reseller stores additionally require the owner-granted
  `reseller_restaurants.permissions.close_day`, and reseller employees require
  their own `permissions.close_day` plus restaurant/group access.
- Portfolio email recipient schedules are shared reseller setup: the reseller
  account and its active employees see the same recipient list, and the same
  scope is enforced for edit, delete, test-send, and delivery history. Platform
  admins can manage all portfolio schedules. Ordinary owner/member portfolios
  remain creator-scoped because overlapping restaurant membership is not a safe
  ownership boundary. The portfolio Email reports tab also lists existing
  store-level report recipients for every restaurant in the viewer's authorized
  portfolio; those schedules remain managed from the individual store Reports
  page and are not silently converted into consolidated rollups.
- Supabase-direct menu writes use `can_manage_store_menu()` RLS. Category-question,
  item-modifier override, and item price-allocation policies also verify that every
  referenced row belongs to the submitted restaurant, preventing cross-tenant
  record links. Item-level recurring price rules are read and written through
  the ML pricing API under `menu.view` / `menu.edit_prices`; rule and
  actor-attributed audit writes commit transactionally, while browser roles
  cannot access those tables directly. The POS backend remains authoritative for
  the effective price charged to a check.
- The store Menu workspace exposes Kitchen Routing only to members with
  `settings.edit`; the existing POS-backend routing guards remain authoritative.
  Setup keeps the same routing editor while setup is incomplete, so completing
  onboarding changes navigation placement rather than the persisted contract.
- Server Quick Menu, Fast Bar, department ranking, and bartender home preferences
  use existing `menu.view` for Back Office visibility and `menu.edit_items` for
  mutation. Owners and authorized resellers share the audited POS-backend
  `/reseller/pos-menu-workspace` contract; the browser never writes these tables
  directly. The reseller store-tab resolver maps the existing owner-controlled
  `menu` grant to both Menu and POS Menus, and reseller employees resolve through
  their active parent reseller assignment before those tabs are shown. Fast Bar
  and Server Menu always retain access to every department.
- Production behavior configuration uses the same `menu.view` visibility and
  `menu.edit_items` mutation boundary. The audited POS-backend
  `/reseller/pos-production-workflow` contract owns beverage workflow plus
  role/employee/item/station overrides; browser code never writes those tables
  directly. Permanent station-scoped rules are distinct from shift-scoped
  bartender production-area assignments.
- The production workflow editor also owns beverage-role membership and
  manager-controlled terminal-to-production-station access. Shift assignments
  are created by the POS timeclock and may change queue scope during the active
  shift, but they never replace item/section routing or employee production
  behavior overrides.

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
- **One active employee owns one unique POS PIN per restaurant.** Team creation
  requires an explicit four-digit PIN, and both staff backends reject a PIN that
  is already assigned to another active employee rather than relying on a shared
  default that makes PIN identification ambiguous. POS authentication rejects
  legacy duplicates instead of selecting an arbitrary employee; Team marks those
  rows so an authorized manager can assign distinct PINs. The creation lock uses
  a string-normalized restaurant UUID so the typed database bind cannot crash
  employee creation before the duplicate-PIN check runs.
- **Pay is per employee-position assignment.** `job_codes.default_hourly_rate`
  is the restaurant default and `employee_job_codes.hourly_rate_override` is an
  optional employee-specific rate for that one position. Team -> Employees ->
  Members edits the structured assignment set; a legacy `waiters.hourly_rate`
  value mirrors only the primary position and must never be spread across all
  assigned jobs. Clock-in snapshots the selected job code and effective rate so
  later configuration changes do not rewrite historical labor or payroll.
- **Server and Waiter are one working role.** `waiter` is a legacy alias that the
  dashboard renders as `Server`; new assignments prefer the active `server` job
  code while waiter-only restaurants remain compatible. `waiters.pos_role` is
  the durable person-level POS authority (`normal`, `waiter`, or `manager`) and
  must never be used as the employee's primary job. Job-code assignment writes
  may promote it to a position's minimum tier but never lower it. A linked
  Manager/Owner account requires `manager` POS authority.
  Restaurant-defined custom job codes remain distinct and selectable alongside
  the built-in roles.
- **POS-side auth:** PIN identify → staff token (`get_current_waiter` →
  `WaiterContext` in Shire_POS_backend). One employee has one PIN and may choose
  any assigned position at clock-in. The selected position controls workflow,
  pay, tips, and the time-clock snapshot; POS capabilities use the highest
  person authority independently. Manager-gated routes check `is_manager(ctx)`.
  The read-only `/offline/sync-status` safety probe accepts either current staff
  auth or a paired active device token so PIN-screen close-day update checks can
  inspect conflict and receipt/kitchen print queues; offline mutations remain
  staff-authenticated.
  Per-check gratuity overrides use the distinct `can_adjust_gratuity` role
  permission; they never reuse voluntary-tip permission `can_adjust_tips`.
  Add/change/remove mutations require an unpaid editable check and write the
  durable manager-action audit with actor, reason, and before/after amounts.
  New gift-card stored-value issuance requires manager authority, a stable
  request ID, a reason, and an immutable requester/approver audit event. After
  that mutation commits, an exact idempotent replay may be read by the original
  requesting staff member or a current manager; this recovery exception cannot
  create value or change the original code/amount fingerprint.
  Day-close permissions are separate: `can_close_day` closes the current day,
  while `can_reopen_business_day` authorizes the audited reopen workflow and
  defaults to owner-only until explicitly granted to another role.
- **Dashboard-side auth:** Supabase auth (owner account today). Dynamic role
  permissions live in ML backend migration `0049_dynamic_role_permissions.sql`,
  surfaced in `apps/web/src/dashboard/components/team/RolePermissionsPanel.jsx`.
  Local dashboard requests carrying a real asymmetric Supabase session must be
  validated by the ML backend through Supabase JWKS even when the legacy
  `SUPABASE_JWT_SECRET` is absent; development fallback is only for HS256 tokens.
- **EIN/bank/signature data is a separate non-delegable boundary:** complete
  EIN, routing/account numbers, and signatures are write-only after save and
  never belong in `restaurants.config`, browser-local onboarding drafts, or
  generic restaurant responses. Back Office reads masked metadata from
  `/restaurants/:id/sensitive-settings`; writes use guarded service endpoints
  (the compatibility `/setup-config` route securely extracts the same fields).
  Only the primary `restaurants.owner_id`, `profiles.is_superuser`, or active
  direct `reseller_restaurants.reseller_id` principal may cross this boundary.
  Ordinary admins, restaurant members (even membership-role owners), and
  reseller employees remain denied regardless of configurable permissions.
- **Back Office image ingestion is server-owned:** menu uploads/extraction require
  `menu.edit_items`; floor-plan uploads/analysis require `settings.edit`.
  Onboarding sends the authenticated upload's opaque `asset_id` to analysis,
  never a caller-selected URL. Public `image_url` values remain display-only for
  floor-plan previews and menu-item photos. The ML backend validates and
  normalizes bytes, owns storage names, enforces tenant binding and quotas, and
  never follows an arbitrary image URL.
- **Operating-hours replacement is atomic and backend-owned:** Back Office setup,
  onboarding, scheduled publication, and multi-store copy send a complete seven-day
  payload to `PUT /restaurants/:id/operating-hours`. Browser code must never delete,
  insert, or upsert `operating_hours` directly. Empty or incomplete copy sources are
  failures, never successful no-ops.
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
- **Account access is invitation-only and email-bound:** Restaurant Team is the
  single surface for inviting employees, managers, owners, and reseller
  connections according to the caller's authority. Reseller principals can
  invite scoped reseller employees; and platform admins can invite owner,
  reseller, or admin accounts. All four use ML-owned `access_invitations`, store
  only a SHA-256 token hash, expire after seven days, and recheck inviter authority,
  grant caps, target hierarchy, and the accepting Supabase account email inside
  the acceptance transaction. `restaurant_members`, `reseller_restaurants`, and
  `reseller_employees` remain operational truth. Raw links are returned only when
  created/resend so local deployments without Resend can share them manually.
  The ML service resolves invite links to localhost only in development; every
  non-development deployment defaults to `https://app.shireintelligence.com`
  and replaces accidental loopback configuration with that canonical origin.
  Accepting a restaurant invitation returns to the invite after authentication
  and opens the existing restaurant in the portal for the accepting account
  type (`/restaurants` for owner/employee accounts and `/reseller/restaurants`
  for reseller, reseller-employee, and admin accounts); only New Restaurant
  starts onboarding. The cross-account invite error must offer both sign-in and
  account creation for the invited email, and the invite token must survive the
  signup/email-verification callback rather than relying only on browser-local
  storage. The canonical portfolio/store overview is `/enterprise/stores` for
  every account type; `/reseller` is compatibility/onboarding only, while
  reseller store-detail workspaces remain under `/reseller/restaurants/:id/*`.
  Store-owner claims remain in `store_invites`, are also email-bound, and use the
  same mail provider. Temporary-password account creation is not a supported UI path.
  Guided onboarding keeps POS staffing and account access explicit: POS Team
  persists and reloads waiter profiles, structured position/pay assignments,
  PINs, and person-level POS authority; the final Accounts & Access step reuses
  Team's invitation composer for employee, manager, owner, and reseller access,
  including permission caps, presentation policy, email delivery, manual links,
  resend, revoke, and the same existing-member Account & View editor available
  in Team. Manager Controls presents each position as a responsive card, labels
  the legacy `waiter` authority tier as Server, and makes tipped-payroll
  participation an explicit Tipped/Not tipped choice without changing the
  persisted tier or `is_tipped` contracts. A POS-profile email by itself never
  sends an invitation.
- **Permanent employee deletion is an audited privacy scrub, not a historical
  cascade.** Team may offer Delete permanently only after the employee is
  deactivated and under existing `team.edit_employees` hierarchy checks. The
  request requires the normalized full current name (case and repeated
  surrounding whitespace are ignored) and a manager reason, blocks the
  primary owner and unauthorized self-removal, revokes linked restaurant access
  and pending invites, erases personal/PIN/login/current-pay data, and hides the
  employee from Team. The anonymous waiter UUID remains solely so checks,
  timecards, payroll, cash, and audit history continue to reconcile.
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

### Back Office presentation granularity (2026-08-20)
- Presentation is independent from authorization. Per-user, per-restaurant
  policies live in ML-owned `back_office_view_assignments`; reusable versioned
  snapshots live in `back_office_view_templates`; every assignment change is
  recorded in `back_office_view_audit`. These rows never grant data or mutation
  access, and POS/Host services do not consume them.
- Policies use stable capability IDs from
  `apps/web/src/shared/backOfficeView.ts`, a Simple/Medium/Advanced base, and
  optional `hidden`/`summary`/`standard`/`full` overrides. Navigation, deep-link
  handling, nested tabs, and control groups must all use the same resolver.
  Incomplete Setup and critical operational blockers remain reachable.
- Team -> Users and restaurant connections configures an existing owner or
  member's view. New restaurant-member invitations snapshot
  `access_invitations.back_office_view_policy` and apply it on acceptance.
  Every authorized user can change their own view; a reseller needs both the
  store's Team and Setup grants to configure another person's view. Hiding a
  surface must never suppress its server permission check or alter POS data.
- Existing accounts without an assignment resolve to Advanced for compatibility;
  newly created restaurant owners receive an explicit Simple assignment.
  Restaurant Basics remains Standard in Simple view so authorized users can
  always update the restaurant name and core contact information.
- Printing & Routing uses stable child capabilities for Overview, Routing, KDS,
  Receipts, and advanced ticket layout. `printing.kds` gates both the Kitchen
  Displays sidebar section and direct `#kds` rendering; presentation never
  replaces the existing `settings.edit` authorization check.
- KDS profile saves and iPad assignments require one manager reason and use
  the POS backend KDS APIs; do not write KDS configuration directly. A
  restaurant change must clear the previous restaurant's draft immediately,
  and the 15-second health/metric refresh must not overwrite active edits.
- New KDS profiles require an active non-Expo production station. Expo remains
  a view/supervision role and must never be silently substituted as a prep
  profile's default station.
- `settings.lifecycle` is the stable presentation capability for Store Settings
  -> Danger Zone. It is visible in Simple, Medium, and Advanced, but presentation
  never grants lifecycle authority. The page continues to use `settings.edit`
  for Store Settings entry and requires `restaurants.owner_id = auth.uid()` for
  deletion; the primary-owner check is repeated by the ML API under lock. The
  nested Danger Zone tab is also omitted from incomplete Setup and Store Settings
  for every non-primary owner; rendering an empty nested-tab set must never fall
  through to a hidden child surface.

### Recoverable restaurant lifecycle (2026-08-24)
- Cancel in guided onboarding is a distinct immediate draft cleanup. Only the
  primary owner may permanently remove a restaurant that remains `onboarding`,
  has never completed, has an active lifecycle, and has no operational order,
  payment, business-day, cash, time-clock, gift-card, tip-pool, visit,
  reservation, or webhook history. ML rechecks those conditions under lock and
  deletes all tenant setup rows atomically. Completed or operational stores must
  use the recoverable Danger Zone lifecycle; clearing browser state is not Cancel.
  The canonical Stores overview exposes the same primary-owner-only distinction:
  an eligible unfinished onboarding card opens an exact-name permanent-deletion
  confirmation, while a completed store card links to Store Settings -> Danger
  Zone and never bypasses readiness, password, recovery, or audit safeguards.
- Store deletion is a service-owned lifecycle, never a browser DELETE. The
  Danger Zone accepts only the exact case-sensitive store name plus the primary
  owner's Supabase password and performs a final POS-owned readiness recheck
  after quiescing. Managers, owner-role members, resellers, and admins who do not
  own the row cannot initiate deletion.
- Account Settings owns the Deleted Stores recovery surface. The original owner
  may restore before the exact database deadline; platform admins may restore
  any recoverable store with their own password and a mandatory support reason.
  Password setup/reset is available for OAuth-only accounts. Recovery preserves
  the restaurant UUID and slugs but increments the lifecycle epoch, so every POS
  device must be paired again and stale offline work never auto-replays.
  In-flight restore tracking is session-persisted and also reconstructed from
  backend `restoring` rows, so an Account Settings reload still refreshes the
  portfolio and exposes Open Store only after an explicit verified result or the
  documented disappearance of an accepted/observed restore after verification.
  A retrying provider failure remains Restoring, a recoverable failed restore is
  shown as retryable, and purging never becomes a restoration success. Owners
  whose portfolio contains only deleted stores route to Account Settings rather
  than onboarding; lookup failures also fail toward that recoverable surface.
- Only lifecycle state `active` is operational. Public routes hide quarantined
  stores, authenticated clients receive structured `410 restaurant_deleted`,
  and restaurant-scoped UI/query state is cleared after deletion. Public assets
  are quarantined before deletion is accepted. Archive, restore, and exact-30-day
  purge continue through the ML durable outbox polled by every web deployment
  using Postgres leases; no separate Celery worker is required, and cleanup
  remains available even if new deletion requests are disabled during rollback.
  Restore mutations replay the same idempotency key after ambiguous 5xx/network
  responses, and the UI uses the backend clock for the countdown while leaving
  the exact deadline decision to the database. A transient `suspending` state
  never causes navigation until the backend confirms archiving/recovery or an
  active rollback. Ambiguous deletion requests persist their idempotency key in
  session storage, survive transient reconciliation failures, and are retried by
  both background polling and Check again; only an authoritative non-active
  state navigates away.

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
- `devices.manage` (legacy fallback to `settings.edit` only when this key is absent;
  an explicit `false` always denies device and update management)

### POS-owned tip domain (2026-07-28)

- Dashboard tip settings, previews, runs, payouts, pay periods, and job-code
  calls use `shared/api/posClient.ts`, including the Supabase bearer token and
  `X-Restaurant-Id`. Restaurant ML remains a reporting reader and temporary
  compatibility proxy only.
- Tip reads use `payroll.view`; settings/payout edits use
  `payroll.adjust_tips`; run create/finalize/void uses `payroll.run`.
- Payroll & Tips -> Overview uses `payroll.view` for its daily employee-gratuity
  ledger. It keeps earned gratuity, cash already kept, noncash funding, payroll
  still due, and unattributed amounts separate for the restaurant and every
  returned employee. Employee gratuity remains excluded from pooling and
  tip-outs until the POS-owned engine implements an explicit audited policy.
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
The shell badge polls the count-only `/manager-action-inbox/count` contract; it
must never fetch full inbox rows or trigger missed-clock-out detection. Opening
Alerts still loads the full authorized inbox and refreshes the shared count.
Both the sidebar Alerts entry and the top-bar bell use the same `team.view`
gate; the bell remains disabled while access is unresolved or denied.

### Implementation map (2026-07-08 build)
- Frontend: `shared/permissions.ts` (keys/presets/merge/can/TAB_PERMISSIONS),
  `shared/hooks/useBackOfficeAccess.ts` (effective access; owners/admins/resellers
  bypass), `shared/api/posClient.ts` (2nd base URL → POS backend, env
  `VITE_POS_API_BASE_URL`, sends Supabase JWT + `X-Restaurant-Id`),
  `shared/api/backOfficeApi.ts` (ML back-office endpoints). Sidebar Team group +
  tab gating in `dashboard/shell/DashboardShell.jsx`; deep-link gating in
  `AuthenticatedDashboardApp.jsx` (RestaurantWorkspace); `/invite` route →
  `pages/AcceptInvitePage.jsx`. The Team sidebar keeps Members, Alerts, and
  Scheduling as separate destinations and consolidates the former Time Clock,
  Labor Cost, and Payroll & Tips entries under Workforce & Pay. That workspace
  composes the existing `pages/TimeClockPage.jsx`, `pages/LaborCostPage.jsx`, and
  `pages/TipPoolingPage.jsx` without changing their API or persistence contracts;
  Timecards retain `team.view`, while labor, overview, runs, rules, and setup
  retain their existing payroll permissions. Legacy Time Clock and Labor Cost
  deep links redirect into the matching Workforce & Pay section. Timecards stay
  reachable when any of entries, manager adjustments, or labor totals is visible.
  Self-service view recovery reveals both the selected child and its parent nav
  capability so an explicitly hidden parent cannot strand the workspace.
  Payroll exports/email actions use existing `payroll.export`; the frontend posts
  email requests to `/restaurants/:id/payroll/email` and falls back to download
  when the email service endpoint is not configured. Menu item price-allocation
  changes use `menu.edit_prices`; members with only `menu.view` retain read-only
  visibility, while the ML backend enforces the same permission on writes.
  Menu -> Organization owns Overall Group and Department assignment, while
  Menu -> POS Menus and the existing POS Menus sidebar destination share the
  same navigation/shortcut workspace. These surfaces use `menu.view` for entry
  and `menu.edit_items` for changes.
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
  Marketing, Store Settings, Integrations, Reservations, UI Editor, POS Settings,
  and Printing & Routing; `team` covers Members, Time Clock, and Alerts; report,
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
  After account type resolves, auth hydration loads independent owned-store,
  membership, and reseller-portfolio scopes concurrently; each query keeps its
  existing RLS boundary and error handling before results are deduplicated. It
  also merges the ML-owned `/account/restaurants` canonical scope so a newly
  accepted membership is immediately available even when a nested Data API
  relationship is stale or unavailable; the service response may add access but
  never remove the direct RLS fallbacks.
  Admin hydration excludes closed restaurants so the visible operational
  portfolio matches the ML portfolio resolver and batched store metrics never
  request an unauthorized historical store.
  A reseller principal's owned onboarding restaurants remain valid portfolio
  scope before a `reseller_restaurants` assignment exists; ML portfolio and
  store-card analytics resolvers must include that `restaurants.owner_id` path
  so legitimate draft stores do not appear as failed metrics.
  Account-scoped hydration is generation-guarded and aborts superseded requests,
  so an old account cannot repopulate restaurant or loading state after an
  account switch or sign-out. A direct user-to-user session replacement clears
  the shared query cache and restaurant state before the new account hydrates;
  delayed initial-session reads cannot overwrite a newer auth event.
  UI previews default to the same-origin Expo exports under
  `apps/web/public/previews`; environment URLs may explicitly override them.
  Never add an implicit localhost or developer-machine fallback.
- Store setup completeness (2026-08-11) is derived by the ML backend from the
  canonical restaurant, POS, menu, hours, floor, and staffing records. Setup is
  a recovery route and is shown only while a required domain is incomplete;
  `onboarding_completed_at` remains historical metadata and is not the source
  of truth. The Stores card itself opens normal configuration. Its Finish setup
  action resumes guided onboarding only when the saved step precedes the final
  guided step and more than two canonical setup domains remain incomplete;
  its resume route carries the exact restaurant ID, bypasses reseller-profile
  onboarding redirects only after that restaurant is found in the authorized
  portfolio, and never derives a mutation target from the dashboard's selected
  restaurant. New Store has no existing mutation target and always creates
  through `POST /restaurants`; after creation it resumes through the new row's
  explicit ID. Browser drafts are accepted only when they are unbound new-store
  drafts or match that exact resumable restaurant. Guided Basics updates use the
  ML backend's `/restaurants/:id/onboarding-profile` endpoint, which rejects
  completed or active restaurants before changing any profile field. Ordinary
  Store Information continues to use `setup-profile` so intentional edits to an
  existing restaurant remain supported.
  Otherwise it opens targeted Setup recovery for the isolated gaps. Permanent
  configuration ownership is Store Information (Basics and
  Goals), Marketing (Branding), Store Settings (Legal, Payments, Taxes & Charges,
  Cash/Closeout, Check Workflow, Hours), Integrations (current tools/service model
  and provider connections), Reservations (booking page/timing, restaurant-level
  guest SMS timing, and AI phone provisioning), Menu (menu data, discounts, routing),
  Team (members/roles and Manager Controls), UI Editor (appearance, sections,
  floor plan), and Payroll & Tips. All of these pages reuse the Setup editor's
  canonical save contracts. Discount reads require `menu.view`; writes require
  `menu.edit_items`. Taxes & Charges is visible from Store Settings to owners and
  authorized managers through `settings.edit`; service charges and large-party
  auto-gratuity tiers are editable there. Tax percentages remain address-derived
  and read-only for restaurant users: they select semantic sales classes and
  explicitly classify every menu category when multiple classes are enabled.
  Because onboarding creates menu categories after its tax stage, a sole class
  is assigned automatically while mixed-class restaurants choose a semantic
  class in Menu Categories; that selector never exposes a percentage.
  Any assigned reseller principal or employee, plus platform admins, has a
  dedicated restaurant-scoped Taxes route and may make a reasoned audited manual
  percentage override regardless of the broader reseller Setup grant. A reseller
  or reseller-employee account keeps this tax-only classification when it owns
  the onboarding restaurant, so the same editor appears during initial setup and
  later configuration without granting access to unrelated stores. Initial and
  existing Basics use the same structured location search: the no-key U.S. Census
  geocoder supplies ordinary state/county/place geography; retained official SST
  rows supply nationwide special/product boundaries and a full fallback only for
  explicitly proven Census gaps (currently Arkansas). No match preserves explicit
  manual entry and leaves tax coverage unresolved. The `settings.edit`/reseller-
  aware ML resolver uses SHIRE's versioned official SST catalog first and AvaTax
  only as a configured fallback before
  atomically updating `tax_rates`, category assignments, the POS default rate,
  normalized location, pricing jurisdiction, and an audited jurisdiction snapshot.
  It rechecks address/category state under lock; provider, precision, mapping, or
  stale-state failures change nothing. An unverified 0% bootstrap row is never valid
  setup. Missing official product classes stay blank, never 0. POS continues to
  consume the shared tables and snapshots, selecting on/off-premise contextual
  category rates from fulfillment while retaining its manager-editable fallback.
  POS applies the largest
  restaurant-wide auto-gratuity tier whose minimum party size is met, unless a
  section/table service-charge rule overrides it.
  Setup -> Basics also owns the restaurant's Workweek Start Day under existing
  `settings.edit`. It is stored as `restaurants.config.workweek_start_weekday`
  using Monday=0 through Sunday=6 (default Monday) and is saved only through the
  guarded setup-profile API. Clock-out receipts may use it to calculate a
  read-only week-to-date total; changing it must never rewrite time entries,
  payroll results, or historical hours.
- Migrations (manual run): ML `supabase/migrations/0055_team_hub_access.sql`
  (restaurant_members + back_office_permissions + invitations alter) and
  `supabase/migrations/20260831143000_waiter_forget_audit.sql` (audited employee
  privacy scrub marker), plus
  `supabase/migrations/20260901163000_tax_jurisdiction_catalog.sql` (official tax
  catalog, semantic category profiles, and contextual POS tax metadata) and
  `supabase/migrations/20260901174500_tax_catalog_preserve_official_duplicate_rows.sql`
  (lossless SST source ingestion), plus
  `supabase/migrations/20260902231500_expand_restaurant_onboarding_steps.sql`
  (the 21-stage guided-onboarding lifecycle constraint); POS repo
  `0022_pos_timeclock_breaks_v1.sql`
  (pos_timeclock_breaks).
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
  Team loads use the authorized `/restaurants/:id/team-workspace` aggregate so
  employees, positions, permissions, drawer policy, members, and invites share
  one access resolution and one data query; individual endpoints remain the
  compatibility fallback. Employee-position writes bulk-sync assignments.
- Manager alerts: the store bell and Alerts page merge existing scheduling
  requests with durable missed-clock-out alerts. Desktop and mobile call the
  same ML-backend action API; time corrections write the existing POS
  time-clock adjustment audit trail.
- Printer outage protection uses existing `settings.edit`. The Devices page reads
  the POS backend's canonical `/restaurants/:id/printer-failover` surface, makes
  every active printer choose Hold & alert or an explicit backup, and exposes
  one-tap reroute/restore. Policy lives inside existing
  `kitchen_output_targets.config`; no new schema is required.
- Automatic paid-receipt behavior is a restaurant-wide `settings.edit` policy
  stored in `restaurants.config.pos.printing.auto_print_after_payment`. It
  defaults on, is edited from Printing & Routing -> Receipts & Tickets, requires
  a reason when changed, and is audited by the POS backend. Turning it off skips
  only the automatic post-payment print; payment completion and manual reprints
  remain available.
- The Menu item Kitchen card may update its base printed alias through the
  existing whole-document printing-config contract. It requires `settings.edit`,
  an operator reason, a durable before/after audit, and a fresh read before the
  write. Bulk aliases, ticket-wide behavior, and station-specific overrides stay
  in Printing & Routing.
- External-card signed tip slips use a single default-off toggle within Back
  Office's existing Suggested Tips receipt section and persist at
  `restaurants.config.pos.printing.customer.signed_tip_slip.external_card`.
  Integrated-card slip behavior is not configurable here and remains unchanged.
  The external option renders Tip, Total, and Signature lines only while the
  tender's tip decision is pending; recorded tips and finalized No Tip decisions
  suppress blank lines. Saving uses existing `settings.edit`, requires a reason,
  and writes the POS print-config audit trail.
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
- The per-store `Device Updates` tab is a lazy Back Office workspace beside
  Devices and POS Settings. It uses `devices.manage`, with `settings.edit` only
  as a compatibility fallback when the new key is absent; an explicit
  `devices.manage: false` always denies access. Assigned resellers receive it
  through the owner-controlled `devices` grant. The browser calls only
  the audited POS-backend update APIs and never writes update tables directly.
  Owners/resellers may deploy approved releases with ASAP-safe, one hour after
  successful Close Day, scheduled, next-launch, or download-only policies; only
  platform admins may approve immutable release artifacts. No clock-out trigger
  exists. A mandatory rollout never bypasses the POS-local payment, order,
  printing, or unsynced-work safety gates, and activation is complete only after
  the restarted device acknowledges the exact approved update ID.
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
- Interactive POS Reports keeps the versioned receipt-v3 content contract, but
  Restaurant ML owns Back Office digital snapshots, PDF/XLSX artifacts, and
  immediate email when `VITE_DIRECT_POS_REPORTS_ENABLED=true`. Every artifact
  and email uses the opaque, restaurant-bound Redis snapshot currently visible
  in the page; expiry requires an explicit Refresh and client operational facts
  are never authoritative. Snapshot loads have a bounded deadline, preserve the
  previous receipt while refreshing, and retain restaurant/context-generation
  fencing. CSV remains browser-rendered from that snapshot. Physical thermal
  preview/printing and native POS compatibility remain on the POS Report Hub.
  Roll back the digital cutover by disabling the frontend flag. Release order is
  Restaurant ML dark deploy, enable and verify
  `back_office_pos_reports.direct.v1`, then the flagged frontend; keep the POS
  compatibility operations throughout the rollout. Weekly Long preview p95
  must remain under 3 seconds and cached PDF p95 under 1 second.
- The full POS check ledger appears both on the store Home page below analytics
  widgets and on the dedicated Checks route. Both locations reuse
  `CheckLedgerSection`, including Active/Closed/History, detail and activity-log
  views, and the existing `reports.view` read boundary; refund actions retain
  their separate `payments.refund` guard. Home defers that ledger until it is
  near the viewport; the dedicated Checks route remains immediate.
- Restaurant Home hydrates saved view and widget preferences through the
  authorized `/reports/homepage/bootstrap` aggregate. Sales is the critical
  first widget request, ordinary cards follow as a separately keyed request,
  and activity review remains the final/heaviest request. Each group sends only
  its own settings, keeps stale data only within the same store and group while
  refreshing, and shows explicit skeleton/error/retry states. Reporting
  dimensions remain modal-only, and incomplete-setup polling runs only while
  the Setup route is active. Store-card and Home-nav intent warm the exact
  bootstrap cache key used by the destination page.
- Opening cash is a `settings.edit` restaurant policy on the existing
  `pos_closeout_settings` row: zero, fixed, or the latest finalized
  `pos_cash_reconciliations.retained_bank` with a configured fallback. New
  restaurants default to prior retained cash, while existing explicit zero/fixed
  choices remain authoritative. Staff are never asked to confirm an opening
  amount before taking cash. Close Day asks how much cash is being left only for
  the prior-retained policy; fixed and zero modes derive it automatically, and a
  tracked deposit is calculated from the drawer count. Close Day displays
  backend-resolved lineage and keeps ledger-derived cash totals read-only.
- Server checkout receipt templates are configured only from Back Office's
  Server Reports panel. `reports.view` authorizes reading and production-rendered
  previews, while `settings.edit` authorizes the restaurant-wide template update
  through the POS backend. Native POS remains view/print only, and the required
  cash-settlement lines and their existing math are not configurable.
- Cash drawer access is role-first: No Sale requires `can_no_sale` plus
  `can_open_cash_drawer`; employee `pos_permissions_override` may explicitly
  allow or deny those two keys. Movements require `can_paid_in_out` plus
  `can_open_cash_drawer`. Bartender role defaults grant both drawer-open and No
  Sale; the one-time POS rollout changes only untouched legacy/missing rows, so
  later restaurant role edits and employee overrides still win. The
  restaurant-wide `require_manager_for_drawer_open`
  forces manager approval for No Sale; the generic role approval flag continues
  to protect movements and other sensitive actions. Every pulse still requires
  a drawer assigned directly to the requesting terminal, even after manager
  approval. Paid Out is always manager-approved, while Cash Drop also respects
  its configured threshold. The POS backend remains authoritative and posts
  movements only after drawer delivery.
- Back-office Close Day uses the canonical POS close operation. Open checks are
  never overrideable; clocked-in employees require an explicit confirmation and
  retain the manager adjustment audit. Owner access uses
  `operations.close_day`; reseller stores additionally require the owner-granted
  `reseller_restaurants.permissions.close_day`, and reseller employees require
  their own `permissions.close_day` plus restaurant/group access. Page entry
  requests the compact POS readiness contract and loads report-service
  reconciliation independently; a slow reconciliation may enter the existing
  explicit unverified-reason flow but must never block the authoritative POS
  close. Client attempt state is scoped to the numbered close period, and a
  successful close removes alternate active/date preview cache entries. The
  browser presents the existing contract as a four-stage Readiness, Cash, Team,
  and Review flow using the existing `close_day.readiness`, `close_day.cash`,
  `close_day.clockouts`, and `close_day.finalize` view capabilities. Closeout
  configuration remains separately gated by `settings.edit`; the staged UI does
  not add, remove, or reorder any server mutation. Cash entry stays reachable
  whenever Finalize is visible, and recent activity or an open employee clock
  entry keeps the Team stage reachable, because those are required operational
  safeguards even when their presentation capabilities are hidden; this does
  not grant any additional mutation authority.
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

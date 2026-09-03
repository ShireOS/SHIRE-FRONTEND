import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(
  new URL('./DeviceUpdatesPage.jsx', import.meta.url),
  'utf8',
)
const data = await readFile(
  new URL('../data/deviceUpdates.js', import.meta.url),
  'utf8',
)
const app = await readFile(
  new URL('../AuthenticatedDashboardApp.jsx', import.meta.url),
  'utf8',
)
const shell = await readFile(
  new URL('../shell/DashboardShell.jsx', import.meta.url),
  'utf8',
)
const loaders = await readFile(
  new URL('../workspaceModuleLoaders.js', import.meta.url),
  'utf8',
)
const permissions = await readFile(
  new URL('../../shared/permissions.ts', import.meta.url),
  'utf8',
)
const views = await readFile(
  new URL('../../shared/backOfficeView.ts', import.meta.url),
  'utf8',
)

test('Device Updates is reachable through every permission-aware workspace registry', () => {
  assert.match(shell, /id: 'device-updates', label: 'Device Updates'/)
  assert.match(app, /id: 'device-updates', label: 'Device Updates'/)
  assert.match(app, /activeTab === 'device-updates'.*<DeviceUpdatesPage/s)
  assert.match(
    loaders,
    /loadDeviceUpdates = \(\) => import\('\.\/pages\/DeviceUpdatesPage'\)/,
  )
  assert.match(loaders, /'device-updates': loadDeviceUpdates/)
  assert.match(permissions, /'device-updates': 'devices\.manage'/)
  assert.match(views, /'device-updates': 'nav\.device-updates'/)
})

test('rollout policies preserve Close Day and terminal safety', () => {
  for (const policy of [
    'asap_safe',
    'after_close_day',
    'scheduled',
    'next_launch',
    'download_only',
  ]) {
    assert.ok(
      page.includes(`id: "${policy}"`) || page.includes(`id: '${policy}'`),
    )
  }
  assert.match(page, /1 hour after Close Day/)
  assert.match(page, /Clock-out state is\s+not\s+consulted/)
  assert.match(page, /never bypasses terminal safety/)
  assert.doesNotMatch(page, /everyone clocked out/i)
})

test('fleet selection is authorized, filterable, and exclusion-aware', () => {
  for (const value of [
    'release_family_id',
    'platform',
    'runtime_version',
    'protocol_version',
    'online',
    'capability_fresh',
    'eligible',
    'current_release',
  ]) {
    assert.match(page, new RegExp(value))
  }
  assert.match(page, /Authorized reseller group/)
  assert.match(page, /Select all eligible/)
  assert.match(page, /Exclusions remain visible with server\s+reason codes/)
  assert.match(
    page,
    /Online status and 30-day capability eligibility are\s+intentionally separate/,
  )
})

test('rollout creation requires an authoritative preview and stable replay identity', () => {
  assert.match(data, /\$\{V2_BASE\}\/rollouts\/preview/)
  assert.match(page, /preview_token: preview\.preview_token/)
  assert.match(page, /requestIdForDeploymentIntent\(requestIdRef, intent\)/)
  assert.match(page, /PREVIEW_STALE/)
  assert.match(
    page,
    /exact devices, platform\/runtime cohorts,\s+exclusions, and four manual waves/i,
  )
  assert.match(
    page,
    /Creating this rollout does\s+not publish or command a terminal/,
  )
  assert.match(page, /preview\.eligible_count > 0/)
  assert.match(page, /release\.artifacts\.every/)
})

test('rollout detail exposes preparation, manual waves, rollback, and target controls', () => {
  for (const action of [
    'prepare-delivery',
    'pause',
    'resume',
    'advance',
    'cancel',
    'rollback',
    'retry',
    'defer',
  ]) {
    assert.match(page, new RegExp(action))
  }
  assert.match(page, /Required audit reason/)
  assert.match(
    page,
    /Wave one is released only after the signed callback validates both platform artifacts/,
  )
  assert.match(
    page,
    /Cancellation never silently changes code that is already running/,
  )
  assert.match(
    page,
    /Rollback republishes historical code as a new immutable EAS delivery/,
  )
  assert.match(
    page,
    /queryKey: \['device-updates-v2', 'rollout', restaurantId, rolloutId\]/,
  )
  assert.match(page, /setReason\(''\).*setDeferredUntil\(''\)/s)
  assert.match(page, /\['blocked', countStates\('waiting_safe_point'\)\]/)
  assert.match(
    page,
    /state === 'active'[\s\S]*'Running update ID:'[\s\S]*'Last acknowledged update ID:'/,
  )
})

test('release administration separates approval, revocation, LKG proof, and native installers', () => {
  assert.match(
    page,
    /Platform admins approve, revoke, and mark\s+last-known-good only after exact activation proof/,
  )
  assert.match(page, /Verified active command ID/)
  assert.match(page, /Verified LKG/)
  assert.match(page, /Managed installer\/MDM required/)
  assert.match(page, /has no OTA\s+rollout action/)
  assert.match(
    page,
    /Revoked, draft, native-only, and legacy artifacts[\s\S]*never selectable/,
  )
})

test('V2 operations use authenticated backend APIs and retain only explicit V1 compatibility reads', () => {
  assert.match(data, /const V2_BASE = ["']\/device-updates\/v2["']/)
  assert.match(data, /fetchManagedUpdateFleet/)
  assert.match(data, /mutateManagedUpdateTarget/)
  assert.match(data, /mutateManagedUpdateRelease/)
  assert.doesNotMatch(data, /supabase\.from/)
  assert.match(data, /createDeviceUpdateDeployment/)
  assert.match(data, /cancelDeviceUpdateDeployment/)
  assert.match(data, /createDeviceUpdateRelease/)
  assert.match(page, /V1 compatibility audit/)
  assert.match(
    page,
    /default_activation_policy: policy,[\s\S]*reason: reason\.trim\(\)/,
  )
})

test('Device Updates stays lazy and avoids page-wide polling', () => {
  assert.match(app, /lazy\(loadDeviceUpdates\)/)
  assert.doesNotMatch(page, /refetchInterval/)
  assert.doesNotMatch(page, /setInterval/)
})

test('an owner-granted reseller device route is not hidden by member permissions', () => {
  assert.match(
    shell,
    /const resellerRouteGranted = Boolean\(allowedStoreTabs\?\.includes\(id\)\)/,
  )
  assert.match(
    app,
    /const resellerRouteGranted = Boolean\(allowedStoreTabs\?\.includes\(activeTab\)\)/,
  )
})

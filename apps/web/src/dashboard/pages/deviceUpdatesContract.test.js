import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('./DeviceUpdatesPage.jsx', import.meta.url), 'utf8')
const app = await readFile(new URL('../AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const shell = await readFile(new URL('../shell/DashboardShell.jsx', import.meta.url), 'utf8')
const loaders = await readFile(new URL('../workspaceModuleLoaders.js', import.meta.url), 'utf8')
const permissions = await readFile(new URL('../../shared/permissions.ts', import.meta.url), 'utf8')
const views = await readFile(new URL('../../shared/backOfficeView.ts', import.meta.url), 'utf8')
const eligibility = await readFile(new URL('../data/deviceUpdateEligibility.js', import.meta.url), 'utf8')

test('Device Updates is reachable through every workspace registry', () => {
  assert.match(shell, /id: 'device-updates', label: 'Device Updates'/)
  assert.match(app, /id: 'device-updates', label: 'Device Updates'/)
  assert.match(app, /activeTab === 'device-updates'.*<DeviceUpdatesPage/s)
  assert.match(loaders, /loadDeviceUpdates = \(\) => import\('\.\/pages\/DeviceUpdatesPage'\)/)
  assert.match(loaders, /'device-updates': loadDeviceUpdates/)
  assert.match(permissions, /'device-updates': 'settings\.edit'/)
  assert.match(views, /'device-updates': 'nav\.device-updates'/)
})

test('rollout choices use Close Day and never clock-out state', () => {
  for (const policy of ['asap_safe', 'after_close_day', 'scheduled', 'next_launch', 'download_only']) {
    assert.match(page, new RegExp(`id: '${policy}'`))
  }
  assert.match(page, /1 hour after Close Day/)
  assert.match(page, /Clock-out state is not consulted/)
  assert.doesNotMatch(page, /everyone clocked out/i)
})

test('Back Office cannot present an unsafe force-update promise', () => {
  assert.match(page, /cannot bypass the local payment, order, printing, or offline-queue gates/)
  assert.match(page, /refuse to restart during payment, order persistence, required print delivery, or unsynced work/)
  assert.match(page, /exact Expo update ID/i)
})

test('release and rollout identity is platform-specific and retry-stable', () => {
  assert.doesNotMatch(page, /All platforms/)
  assert.match(page, /separate iOS and Android release records/)
  assert.match(page, /requestIdRef = useRef\(null\)/)
  assert.match(page, /requestIdForDeploymentIntent\(requestIdRef, deploymentIntent\)/)
  assert.match(page, /Incompatible or unreported devices are never sent the command/)
  assert.match(eligibility, /update_channel/)
  assert.match(eligibility, /update_capabilities_reported_at/)
})

test('native EAS builds are not presented as silently installable', () => {
  assert.match(page, /EAS Build artifact only/i)
  assert.match(page, /MDM or managed app-store installer/i)
  assert.match(page, /cannot be sent as an OTA rollout/i)
})

test('Device Updates stays lazy and avoids page-wide polling', () => {
  assert.match(app, /lazy\(loadDeviceUpdates\)/)
  assert.doesNotMatch(page, /refetchInterval/)
  assert.doesNotMatch(page, /setInterval/)
})

test('an owner-granted reseller device route is not hidden by member permissions', () => {
  assert.match(shell, /const resellerRouteGranted = Boolean\(allowedStoreTabs\?\.includes\(id\)\)/)
  assert.match(app, /const resellerRouteGranted = Boolean\(allowedStoreTabs\?\.includes\(activeTab\)\)/)
})

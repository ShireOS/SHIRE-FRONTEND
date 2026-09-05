import assert from 'node:assert/strict'
import test from 'node:test'

import { allowedTabsForResellerPermissions, normalizeResellerPermissions, RESELLER_TOGGLEABLE_TABS } from './resellerTabs.js'

test('setup grant exposes every related configuration surface', () => {
  const tabs = allowedTabsForResellerPermissions({
    devices: false,
    setup: true,
    menu: false,
    feedback: false,
  })

  for (const tab of ['setup', 'store-information', 'marketing', 'settings', 'integrations', 'reservations', 'ui', 'pos-settings', 'printing-routing']) {
    assert.ok(tabs.includes(tab), tab)
  }
  assert.ok(!tabs.includes('devices'))
  assert.ok(!tabs.includes('device-updates'))
  assert.ok(!tabs.includes('menu'))
})

test('team grant covers members, clock, and alerts while payroll stays mandatory', () => {
  const tabs = allowedTabsForResellerPermissions({ team: true })

  for (const tab of ['team', 'time-clock', 'alerts', 'labor-cost', 'tip-pooling']) {
    assert.ok(tabs.includes(tab), tab)
  }
})

test('all store grants produce every implemented store route', () => {
  const tabs = new Set(allowedTabsForResellerPermissions({
    devices: true,
    setup: true,
    menu: true,
    feedback: true,
    team: true,
    scheduling: true,
    messaging: true,
    payments: true,
    close_day: true,
  }))
  const expected = [
    'analytics', 'reports', 'checks', 'close-day', 'setup', 'store-information',
    'marketing', 'settings', 'integrations', 'reservations', 'ui', 'menu',
    'menu-workspace', 'taxes', 'feedback', 'devices', 'device-updates', 'pos-settings',
    'printing-routing', 'team', 'time-clock', 'alerts', 'labor-cost',
    'tip-pooling', 'scheduling', 'messaging', 'payments',
  ]

  assert.deepEqual([...tabs].sort(), expected.sort())
})

test('taxes remain available when every optional reseller grant is disabled', () => {
  const tabs = allowedTabsForResellerPermissions({
    devices: false,
    setup: false,
    menu: false,
    feedback: false,
    team: false,
  })

  assert.ok(tabs.includes('taxes'))
  assert.ok(!tabs.includes('settings'))
})

test('recovery grant defaults off and cannot open the Devices route on its own', () => {
  assert.equal(normalizeResellerPermissions({ devices: true }).force_sync, false)
  assert.ok(RESELLER_TOGGLEABLE_TABS.includes('force_sync'))
  assert.ok(!allowedTabsForResellerPermissions({ devices: false, force_sync: true }).includes('devices'))
  assert.deepEqual(
    allowedTabsForResellerPermissions({ devices: true, force_sync: true }),
    allowedTabsForResellerPermissions({ devices: true, force_sync: false }),
  )
})

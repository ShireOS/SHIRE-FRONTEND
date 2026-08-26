import assert from 'node:assert/strict'
import test from 'node:test'

import { allowedTabsForResellerPermissions } from './resellerTabs.js'

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
    'menu-workspace', 'feedback', 'devices', 'device-updates', 'pos-settings',
    'printing-routing', 'team', 'time-clock', 'alerts', 'labor-cost',
    'tip-pooling', 'scheduling', 'messaging', 'payments',
  ]

  assert.deepEqual([...tabs].sort(), expected.sort())
})

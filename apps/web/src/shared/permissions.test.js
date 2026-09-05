import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PERMISSION_KEYS,
  TAB_PERMISSIONS,
  allowedTabsFor,
  can,
  diffPermissionOverrides,
  mergePermissions,
} from './permissions.ts'

test('member saves preserve independently chosen settings and device access', () => {
  for (const roleSettings of [false, true]) {
    for (const roleDevices of [undefined, false, true]) {
      const defaults = { 'settings.edit': roleSettings }
      if (roleDevices !== undefined) defaults['devices.manage'] = roleDevices
      for (const settings of [false, true]) {
        for (const devices of [false, true]) {
          const requested = { 'settings.edit': settings, 'devices.manage': devices }
          const saved = diffPermissionOverrides(requested, defaults)
          const reloaded = mergePermissions(defaults, saved)
          assert.equal(reloaded['settings.edit'], settings)
          assert.equal(reloaded['devices.manage'], devices)
        }
      }
    }
  }
})

test('legacy settings grants retain an explicit device denial in member overrides', () => {
  assert.deepEqual(diffPermissionOverrides(
    { 'settings.edit': true, 'devices.manage': false },
    { 'settings.edit': false },
  ), { 'settings.edit': true, 'devices.manage': false })
  assert.deepEqual(diffPermissionOverrides(
    { 'settings.edit': false, 'devices.manage': true },
    { 'settings.edit': true },
  ), { 'settings.edit': false, 'devices.manage': true })
})

test('devices.manage is canonical and gates device workspaces', () => {
  assert.ok(PERMISSION_KEYS.includes('devices.manage'))
  assert.equal(TAB_PERMISSIONS.devices, 'devices.manage')
  assert.equal(TAB_PERMISSIONS['device-updates'], 'devices.manage')
})

test('legacy settings.edit grants device management only while the key is absent', () => {
  assert.equal(can({ 'settings.edit': true }, 'devices.manage'), true)
  assert.equal(can({ 'settings.edit': false }, 'devices.manage'), false)
  assert.equal(can({ 'settings.edit': true, 'devices.manage': false }, 'devices.manage'), false)
  assert.equal(can({ 'settings.edit': false, 'devices.manage': true }, 'devices.manage'), true)
})

test('permission merging preserves explicit device overrides and legacy inheritance', () => {
  assert.equal(mergePermissions({ 'settings.edit': true }, {})['devices.manage'], true)
  assert.equal(
    mergePermissions({ 'settings.edit': true }, { 'devices.manage': false })['devices.manage'],
    false,
  )
  assert.equal(
    mergePermissions({ 'settings.edit': true }, { 'settings.edit': false })['devices.manage'],
    false,
  )
  assert.equal(
    mergePermissions({ 'settings.edit': false, 'devices.manage': false }, { 'settings.edit': true })['devices.manage'],
    false,
  )
})

test('device tabs honor the compatibility fallback and explicit deny', () => {
  const tabs = ['home', 'devices', 'device-updates']

  assert.deepEqual(allowedTabsFor({ 'settings.edit': true }, false, tabs), tabs)
  assert.deepEqual(
    allowedTabsFor({ 'settings.edit': true, 'devices.manage': false }, false, tabs),
    ['home'],
  )
})

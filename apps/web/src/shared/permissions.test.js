import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PERMISSION_KEYS,
  PERMISSION_PRESETS,
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

test('scheduling permissions are canonical and gate the scheduling workspace', () => {
  assert.ok(PERMISSION_KEYS.includes('scheduling.view'))
  assert.ok(PERMISSION_KEYS.includes('scheduling.edit'))
  assert.equal(TAB_PERMISSIONS.scheduling, 'scheduling.view')
})

test('legacy team grants retain scheduling access only while new keys are absent', () => {
  assert.equal(can({ 'team.view': true }, 'scheduling.view'), true)
  assert.equal(can({ 'team.edit_employees': true }, 'scheduling.edit'), true)
  assert.equal(can({ 'team.view': true, 'scheduling.view': false }, 'scheduling.view'), false)
  assert.equal(can({ 'team.edit_employees': false, 'scheduling.edit': true }, 'scheduling.edit'), true)
})

test('scheduling merge preserves legacy member denials during rollout', () => {
  const merged = mergePermissions(
    { 'team.view': true, 'team.edit_employees': true, 'scheduling.view': true, 'scheduling.edit': true },
    { 'team.view': false, 'team.edit_employees': false },
  )
  assert.equal(merged['scheduling.view'], false)
  assert.equal(merged['scheduling.edit'], false)
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

test('sync recovery is an explicit opt-in permission with no legacy inheritance', () => {
  assert.ok(PERMISSION_KEYS.includes('devices.force_sync'))
  const ordinaryDeviceAccess = { 'settings.edit': true, 'devices.manage': true }
  assert.equal(can(ordinaryDeviceAccess, 'devices.force_sync'), false)
  assert.equal(mergePermissions(ordinaryDeviceAccess, {})['devices.force_sync'], false)
  assert.equal(mergePermissions(ordinaryDeviceAccess, { 'devices.force_sync': true })['devices.force_sync'], true)
  assert.equal(mergePermissions({ 'devices.force_sync': true }, { 'devices.force_sync': false })['devices.force_sync'], false)
  for (const preset of PERMISSION_PRESETS) assert.equal(can(preset.permissions, 'devices.force_sync'), false)
})

test('member recovery grants and denials survive save and reload', () => {
  for (const granted of [false, true]) {
    for (const roleGranted of [false, true]) {
      const defaults = { 'devices.manage': true, 'devices.force_sync': roleGranted }
      const requested = { ...defaults, 'devices.force_sync': granted }
      const saved = diffPermissionOverrides(requested, defaults)
      assert.equal(mergePermissions(defaults, saved)['devices.force_sync'], granted)
    }
  }
})

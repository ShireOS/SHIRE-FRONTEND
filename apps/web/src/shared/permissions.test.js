import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PERMISSION_KEYS,
  TAB_PERMISSIONS,
  allowedTabsFor,
  can,
  mergePermissions,
} from './permissions.ts'

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

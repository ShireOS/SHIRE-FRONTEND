import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assignedStaffRoles,
  buildStaffRoleUpdate,
  canManageJobCode,
  canManageStaffMember,
  defaultStaffRole,
  jobCodeAuthority,
  manageableTeamAccountTypes,
  normalizeRoleCode,
  normalizeStaffRoleOptions,
  primaryStaffRole,
} from './staffRoles.js'

const jobCodes = [
  { id: 'owner-id', code: 'owner', label: 'Owner' },
  { id: 'waiter-id', code: 'waiter', label: 'Waiter' },
  { id: 'server-id', code: 'server', label: 'Server' },
  { id: 'expo-id', code: 'expo', label: 'Expo' },
]

test('Waiter and Server normalize to one Server role', () => {
  assert.equal(normalizeRoleCode('Waiter'), 'server')
  assert.equal(normalizeRoleCode('server'), 'server')

  const options = normalizeStaffRoleOptions(jobCodes)
  assert.deepEqual(options.map(option => option.code), ['owner', 'server', 'expo'])
  assert.equal(options.find(option => option.code === 'server')?.label, 'Server')
  assert.equal(defaultStaffRole(jobCodes), 'server')
})

test('the legacy POS permission tier does not become an employee role', () => {
  const waiter = {
    pos_role: 'waiter',
    role: 'owner',
    roles: ['owner'],
  }

  assert.deepEqual(assignedStaffRoles(waiter, jobCodes), ['owner'])
  assert.equal(primaryStaffRole(waiter, jobCodes), 'owner')
})

test('a selected non-Server role is saved without silently adding Server', () => {
  assert.deepEqual(buildStaffRoleUpdate('owner', ['owner'], jobCodes), {
    role: 'owner',
    roles: ['owner'],
    job_code_id: 'owner-id',
  })
})

test('waiter-only restaurants remain compatible while displaying Server', () => {
  const waiterOnlyCodes = [{ id: 'waiter-id', code: 'waiter', label: 'Waiter' }]

  assert.equal(defaultStaffRole(waiterOnlyCodes), 'server')
  assert.deepEqual(buildStaffRoleUpdate('server', ['server'], waiterOnlyCodes), {
    role: 'waiter',
    roles: ['waiter'],
    job_code_id: 'waiter-id',
  })
})

test('custom roles remain distinct and can become primary', () => {
  assert.deepEqual(buildStaffRoleUpdate('expo', ['expo', 'server'], jobCodes), {
    role: 'expo',
    roles: ['expo', 'server'],
    job_code_id: 'expo-id',
  })
})

test('removing the current primary promotes the next selected role', () => {
  assert.deepEqual(buildStaffRoleUpdate('expo', ['expo'], jobCodes), {
    role: 'expo',
    roles: ['expo'],
    job_code_id: 'expo-id',
  })
})

test('staff authority permits parallel roles but blocks higher roles', () => {
  assert.equal(canManageJobCode('manager', { code: 'manager', permission_tier: 'manager' }), true)
  assert.equal(canManageJobCode('manager', { code: 'admin' }), true)
  assert.equal(canManageJobCode('manager', { code: 'owner', permission_tier: 'owner' }), false)
  assert.equal(canManageJobCode('owner', { code: 'owner', permission_tier: 'owner' }), true)
  assert.equal(jobCodeAuthority({ code: 'server', permission_tier: 'waiter' }), 0)
})

test('staff authority uses the highest assigned role, not only the primary role', () => {
  const waiter = { role: 'manager', roles: ['manager', 'owner'] }
  assert.equal(canManageStaffMember('manager', waiter, jobCodes), false)
  assert.equal(canManageStaffMember('owner', waiter, jobCodes), true)
})

test('team account types follow peer-or-below authority', () => {
  assert.deepEqual(manageableTeamAccountTypes('manager'), ['employee', 'manager'])
  assert.deepEqual(manageableTeamAccountTypes('owner'), ['employee', 'manager', 'owner', 'reseller'])
  assert.deepEqual(
    manageableTeamAccountTypes('manager', { isDirectReseller: true, canManageMembers: true }),
    ['employee', 'manager', 'owner', 'reseller'],
  )
  assert.deepEqual(
    manageableTeamAccountTypes('manager', { isDirectReseller: false, canManageMembers: true }),
    ['employee', 'manager'],
  )
})

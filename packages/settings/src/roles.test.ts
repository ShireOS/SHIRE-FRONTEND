import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultRolePermission, normalizeRolePermissions } from './roles'

test('manager-tier roles can adjust gratuity by default without inheriting tip edits', () => {
  const manager = defaultRolePermission('shift_lead', 'manager')
  assert.equal(manager.can_adjust_gratuity, true)

  const normalized = normalizeRolePermissions([
    {
      ...manager,
      can_adjust_gratuity: true,
      can_adjust_tips: false,
    },
  ], [{ code: 'shift_lead', label: 'Shift Lead', permission_tier: 'manager', is_active: true }])

  assert.equal(normalized[0].can_adjust_gratuity, true)
  assert.equal(normalized[0].can_adjust_tips, false)
})

test('ordinary staff cannot adjust gratuity by default', () => {
  assert.equal(defaultRolePermission('server', 'normal').can_adjust_gratuity, false)
})

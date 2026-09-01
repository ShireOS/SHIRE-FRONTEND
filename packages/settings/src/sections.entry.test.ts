import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeSectionProfiles, taxesChargesEntryError, taxesChargesPayload } from './sections.ts'

test('service-charge percentages are rejected instead of clamped', () => {
  const error = taxesChargesEntryError([
    { name: 'Large party', charge_type: 'percentage', amount: '101', is_active: true },
  ], { enabled: false })
  assert.match(error, /cannot exceed 100/)
})

test('auto-gratuity relationships remain exact in the payload', () => {
  const payload = taxesChargesPayload([], [], {
    enabled: true,
    party_threshold: '6',
    percent: '18.5',
    label: 'Gratuity',
    assigned_to_employee: true,
    rules: [{ party_threshold: '6', percent: '18.5' }],
  })
  assert.equal(payload.auto_gratuity.percent, 18.5)
  assert.throws(() => taxesChargesPayload([], [], {
    enabled: true,
    party_threshold: '6',
    percent: '120',
    label: 'Gratuity',
    assigned_to_employee: true,
    rules: [{ party_threshold: '6', percent: '120' }],
  }), /cannot exceed 100/)
})

test('section behavior survives whitespace cleanup in its section name', () => {
  const section = normalizeSectionProfiles(
    [{ name: '  Main   Dining ', auto_gratuity_enabled: true, auto_gratuity_value: '20' }],
    ['Main Dining'],
  ).find(item => item.name === 'Main Dining')
  assert.ok(section)
  assert.equal(section.name, 'Main Dining')
  assert.equal(section.auto_gratuity_enabled, true)
  assert.equal(section.auto_gratuity_value, '20')
})

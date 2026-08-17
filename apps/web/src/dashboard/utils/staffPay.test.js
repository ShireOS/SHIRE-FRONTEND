import assert from 'node:assert/strict'
import test from 'node:test'

import {
  effectiveStaffPayRate,
  newStaffPayDrafts,
  staffPayDrafts,
  staffPayPayload,
  validateStaffPayDrafts,
} from './staffPay.js'

const jobCodes = [
  { id: 'cook-id', code: 'cook', label: 'Cook', default_hourly_rate: 18, permission_tier: 'normal' },
  { id: 'dish-id', code: 'dishwasher', label: 'Dishwasher', default_hourly_rate: 14, permission_tier: 'normal' },
]

test('structured employee assignments retain a different rate for every position', () => {
  const rows = staffPayDrafts({
    role: 'cook',
    roles: ['cook', 'dishwasher'],
    hourly_rate: 20,
    job_assignments: [
      { job_code_id: 'cook-id', code: 'cook', is_primary: true, default_hourly_rate: 18, hourly_rate_override: 20 },
      { job_code_id: 'dish-id', code: 'dishwasher', is_primary: false, default_hourly_rate: 14, hourly_rate_override: 15 },
    ],
  }, jobCodes)

  assert.deepEqual(rows.map(row => effectiveStaffPayRate(row)), [20, 15])
  assert.deepEqual(staffPayPayload(rows), [
    { job_code_id: 'cook-id', code: 'cook', is_primary: true, hourly_rate_override: 20 },
    { job_code_id: 'dish-id', code: 'dishwasher', is_primary: false, hourly_rate_override: 15 },
  ])
})

test('turning off a custom rate restores the position default', () => {
  const [cook] = staffPayDrafts({
    role: 'cook',
    roles: ['cook'],
    job_assignments: [
      { job_code_id: 'cook-id', code: 'cook', is_primary: true, default_hourly_rate: 18, hourly_rate_override: 20 },
    ],
  }, jobCodes)

  const inherited = { ...cook, use_custom_rate: false, hourly_rate_override: '' }
  assert.equal(effectiveStaffPayRate(inherited), 18)
  assert.equal(staffPayPayload([inherited])[0].hourly_rate_override, null)
})

test('legacy scalar pay is treated as the primary position override only', () => {
  const rows = staffPayDrafts({
    role: 'cook',
    roles: ['cook', 'dishwasher'],
    hourly_rate: 20,
  }, jobCodes)

  assert.equal(rows[0].hourly_rate_override, '20')
  assert.equal(rows[1].hourly_rate_override, '')
})

test('new employees with a preferred role start with one primary position and inherited pay', () => {
  const rows = newStaffPayDrafts(jobCodes, 'dishwasher')
  assert.deepEqual(rows.map(row => [row.selected, row.is_primary]), [[false, false], [true, true]])
  assert.equal(validateStaffPayDrafts(rows), null)
})

test('new employees without a preferred role must choose a position', () => {
  const rows = newStaffPayDrafts(jobCodes)
  assert.deepEqual(rows.map(row => [row.selected, row.is_primary]), [[false, false], [false, false]])
  assert.equal(validateStaffPayDrafts(rows), 'Choose at least one position.')
})

test('pay drafts reject missing primary and invalid custom rates', () => {
  const rows = newStaffPayDrafts(jobCodes, 'cook')
  assert.equal(validateStaffPayDrafts(rows.map(row => ({ ...row, is_primary: false }))), 'Choose exactly one primary position.')
  assert.equal(
    validateStaffPayDrafts(rows.map(row => row.selected
      ? { ...row, use_custom_rate: true, hourly_rate_override: '-1' }
      : row)),
    'Enter a valid custom hourly rate.',
  )
  assert.equal(
    validateStaffPayDrafts(rows.map(row => row.selected
      ? { ...row, use_custom_rate: true, hourly_rate_override: '20.123' }
      : row)),
    'Enter a valid custom hourly rate.',
  )
})

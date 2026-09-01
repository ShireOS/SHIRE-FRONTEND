import assert from 'node:assert/strict'
import test from 'node:test'

import {
  bankAccountError,
  dateRangeError,
  duplicateName,
  emailListError,
  formatEinInput,
  formatUsPhoneInput,
  isValidAbaRoutingNumber,
  modifierGroupRuleError,
  normalizeEmailInput,
  normalizeUsPhoneE164,
  numberRangeError,
  printerHostError,
  parseEmailList,
  reservationTimingError,
  sanitizeMoneyInput,
  sanitizePercentInput,
} from './entry.ts'

test('phone entry formats pasted and incremental US numbers', () => {
  assert.equal(formatUsPhoneInput('5'), '(5')
  assert.equal(formatUsPhoneInput('5551234'), '(555) 123-4')
  assert.equal(formatUsPhoneInput('+1 (555) 123-4567'), '(555) 123-4567')
  assert.equal(normalizeUsPhoneE164('(555) 123-4567'), '+15551234567')
  assert.equal(normalizeUsPhoneE164('55512'), null)
})

test('email lists parse separators even while the form stores draft array entries', () => {
  assert.deepEqual(parseEmailList(['Owner@Example.COM; chef@example.com', 'owner@example.com']), [
    'Owner@example.com',
    'chef@example.com',
  ])
})

test('EIN entry inserts its separator and caps at nine digits', () => {
  assert.equal(formatEinInput('1234567890'), '12-3456789')
})

test('email normalization preserves the local part and normalizes the domain', () => {
  assert.equal(normalizeEmailInput(' Owner+Ops@Example.COM '), 'Owner+Ops@example.com')
  assert.deepEqual(parseEmailList('a@example.com; A@example.com, b@example.com'), ['a@example.com', 'b@example.com'])
  assert.match(emailListError('a@example.com, broken'), /broken/)
})

test('money and percent inputs stay editable and enforce precision', () => {
  assert.equal(sanitizeMoneyInput('$12.345.6'), '12.34')
  assert.equal(sanitizeMoneyInput('.5'), '0.5')
  assert.equal(sanitizeMoneyInput('-12.50'), '-12.50')
  assert.equal(sanitizePercentInput('100.999'), '100.99')
})

test('ABA routing checksum catches malformed routing numbers', () => {
  assert.equal(isValidAbaRoutingNumber('021000021'), true)
  assert.equal(isValidAbaRoutingNumber('021000022'), false)
  assert.equal(isValidAbaRoutingNumber('000000000'), false)
})

test('range, account, duplicate, and date validators reject invalid relationships', () => {
  assert.match(bankAccountError('123'), /4 to 17/)
  assert.match(numberRangeError('2.5', 'Seats', { integer: true, min: 1, max: 20 }), /whole number/)
  assert.equal(duplicateName(['Bar', 'Patio'], ' bar ', 1), true)
  assert.match(dateRangeError('2026-09-02', '2026-09-01'), /end on or after/)
})

test('modifier question rules reject contradictory limits', () => {
  assert.match(modifierGroupRuleError({ is_required: true, min_selections: 0 }), /at least 1/)
  assert.match(modifierGroupRuleError({ min_selections: 2, max_selections: 1 }), /below the minimum/)
  assert.match(modifierGroupRuleError({ min_selections: 0, max_selections: 2, included_count: 3 }), /exceed the maximum/)
})

test('reservation timing rejects out-of-range and contradictory values', () => {
  const valid = {
    reservation_timing_same_for_channels: true,
    reservation_online_booking_horizon_days: '30',
    reservation_online_lead_time_minutes: '120',
    reservation_online_grace_period_minutes: '15',
    reservation_slot_interval_minutes: '15',
    reservation_min_party_size: '1',
    reservation_max_party_size: '10',
    reservation_default_duration_minutes: '90',
  }
  assert.equal(reservationTimingError(valid), '')
  assert.match(reservationTimingError({ ...valid, reservation_max_party_size: '0' }), /at least 1/)
  assert.match(reservationTimingError({ ...valid, reservation_min_party_size: '8', reservation_max_party_size: '4' }), /at least the minimum/)
  assert.match(reservationTimingError({ ...valid, reservation_slot_interval_minutes: '17' }), /5-minute/)
})

test('printer hosts accept local addresses and reject URLs and public IPs', () => {
  assert.equal(printerHostError('192.168.1.25', true), '')
  assert.equal(printerHostError('kitchen-printer.local', true), '')
  assert.match(printerHostError('https://192.168.1.25', true), /only/)
  assert.match(printerHostError('8.8.8.8', true), /private/)
})

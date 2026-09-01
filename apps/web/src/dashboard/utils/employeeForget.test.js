import assert from 'node:assert/strict'
import test from 'node:test'

import {
  employeeNameConfirmationMatches,
  normalizeEmployeeNameConfirmation,
} from './employeeForget.js'

test('employee deletion confirmation ignores casing and surrounding whitespace', () => {
  assert.equal(
    employeeNameConfirmationMatches('  veera sai harshith guduru  ', 'Veera Sai Harshith Guduru'),
    true,
  )
})

test('employee deletion confirmation collapses repeated whitespace but still requires the name', () => {
  assert.equal(normalizeEmployeeNameConfirmation('Veera   Sai\nGuduru'), 'veera sai guduru')
  assert.equal(employeeNameConfirmationMatches('Veera Sai', 'Veera Sai Guduru'), false)
})

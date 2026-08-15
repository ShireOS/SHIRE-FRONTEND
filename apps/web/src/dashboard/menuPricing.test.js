import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateSpecialPrice, specialPricePreview } from './menuPricing.js'

test('percent-off previews the final customer price', () => {
  assert.equal(calculateSpecialPrice(20, 'percent_off', 25), 15)
  assert.equal(specialPricePreview(12.99, 'percent_off', 25), '9.74')
})

test('amount-off previews the final price without going below zero', () => {
  assert.equal(calculateSpecialPrice(10, 'amount_off', 3), 7)
  assert.equal(calculateSpecialPrice(2, 'amount_off', 3), 0)
})

test('fixed rules use the entered special price', () => {
  assert.equal(calculateSpecialPrice(10, 'fixed', 6.5), 6.5)
})

test('existing increase rules still preview correctly', () => {
  assert.equal(calculateSpecialPrice(10, 'percent_up', 25), 12.5)
  assert.equal(calculateSpecialPrice(10, 'amount_up', 2.75), 12.75)
})

test('incomplete or unsupported rules have no preview', () => {
  assert.equal(calculateSpecialPrice(10, '', 25), null)
  assert.equal(calculateSpecialPrice(10, 'percent_off', ''), null)
  assert.equal(calculateSpecialPrice(10, 'percent_off', -1), null)
})

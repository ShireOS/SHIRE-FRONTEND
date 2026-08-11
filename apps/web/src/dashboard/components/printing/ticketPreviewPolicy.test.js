import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isKitchenPreviewItemLine,
  isKitchenPreviewLocationLine,
  isKitchenPreviewModifierLine,
} from './ticketPreviewPolicy.js'

test('all renderer location forms receive ticket-top presentation', () => {
  for (const line of [
    'Table 12',
    'Tab Alex',
    'TO GO — Alex',
    'DELIVERY — Alex',
    'PHONE TO GO — Alex',
    'PHONE DELIVERY — Alex',
    'DRIVE THRU — Alex',
    'BAR — Alex',
    'ORDER — Alex',
  ]) {
    assert.equal(isKitchenPreviewLocationLine(line), true, line)
  }
  assert.equal(isKitchenPreviewLocationLine('Kitchen · Marcus'), false)
})

test('ingredient and flush-left side lines are both modifiers', () => {
  const lines = [
    '1  OMELET  S2',
    '   + EXTRA CHEESE',
    'HOME FRIES',
    '   ** GLUTEN ALLERGY **',
    '--------------------------------',
    '1  PANCAKES  S1',
  ]

  assert.equal(isKitchenPreviewItemLine(lines[0]), true)
  assert.equal(isKitchenPreviewModifierLine(lines, 1), true)
  assert.equal(isKitchenPreviewModifierLine(lines, 2), true)
  assert.equal(isKitchenPreviewModifierLine(lines, 3), false)
  assert.equal(isKitchenPreviewModifierLine(lines, 4), false)
  assert.equal(isKitchenPreviewModifierLine(lines, 5), false)
})

test('ticket-top text before the first item is not mistaken for a side', () => {
  const lines = ['DINE IN', 'Kitchen · Marcus', 'Table 12', '1  OMELET  S2']
  assert.equal(isKitchenPreviewModifierLine(lines, 0), false)
  assert.equal(isKitchenPreviewModifierLine(lines, 1), false)
  assert.equal(isKitchenPreviewModifierLine(lines, 2), false)
})

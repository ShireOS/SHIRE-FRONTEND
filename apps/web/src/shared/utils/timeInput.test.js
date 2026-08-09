import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatTimeLabel,
  getTimeSuggestions,
  isTimeOnStep,
  parseTimeQuery,
  snapTimeToStep,
} from './timeInput.js'

test('parses common natural time shorthand into canonical values', () => {
  assert.equal(parseTimeQuery('230pm'), '14:30')
  assert.equal(parseTimeQuery('2:30 p.m.'), '14:30')
  assert.equal(parseTimeQuery('2 p'), '14:00')
  assert.equal(parseTimeQuery('1430'), '14:30')
  assert.equal(parseTimeQuery('12am'), '00:00')
  assert.equal(parseTimeQuery('noon'), '12:00')
})

test('rejects malformed or impossible time shorthand', () => {
  assert.equal(parseTimeQuery('25:00'), null)
  assert.equal(parseTimeQuery('2:75pm'), null)
  assert.equal(parseTimeQuery('lunch'), null)
})

test('formats stored 24-hour values for people', () => {
  assert.equal(formatTimeLabel('00:00'), '12:00 AM')
  assert.equal(formatTimeLabel('14:30'), '2:30 PM')
  assert.equal(formatTimeLabel('23:45:00'), '11:45 PM')
})

test('quarter-hour suggestions preselect the closest clean value', () => {
  const suggestions = getTimeSuggestions({ query: '202pm', minuteStep: 15 })
  assert.equal(suggestions[0].value, '14:00')
  assert.equal(isTimeOnStep(suggestions[0].value, 15), true)
  assert.equal(snapTimeToStep('14:08', 15), '14:15')
})

test('exact mode preserves a typed minute while browsing uses clean anchors', () => {
  const suggestions = getTimeSuggestions({ query: '202pm', minuteStep: 1 })
  assert.equal(suggestions[0].value, '14:02')
  assert.equal(isTimeOnStep(suggestions[0].value, 1), true)
})

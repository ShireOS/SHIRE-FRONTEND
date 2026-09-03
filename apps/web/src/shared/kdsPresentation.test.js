import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_TICKET_AGE_COLORS, isRushRed, normalizeTicketAgeColors, ticketTimingError } from './kdsPresentation.js'

test('KDS ticket timing uses deliberate safe defaults', () => {
  assert.deepEqual(normalizeTicketAgeColors(null), DEFAULT_TICKET_AGE_COLORS)
  assert.equal(ticketTimingError(DEFAULT_TICKET_AGE_COLORS, 900), '')
})

test('KDS ticket timing requires ordered stages and a red rush header', () => {
  assert.match(ticketTimingError({ ...DEFAULT_TICKET_AGE_COLORS, late: { after_seconds: 901, color: '#D97845' } }, 900), /before Rush/)
  assert.match(ticketTimingError({ ...DEFAULT_TICKET_AGE_COLORS, rush: '#22AA55' }, 900), /must use a red/)
  assert.equal(isRushRed('#C93632'), true)
  assert.equal(isRushRed('#22AA55'), false)
})

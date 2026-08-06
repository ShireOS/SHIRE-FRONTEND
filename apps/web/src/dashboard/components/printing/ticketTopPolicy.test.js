import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TICKET_TOP_STARTER,
  buildTicketTopPatch,
  ticketTopEditorRows,
  ticketTopRowsMatch,
} from './ticketTopPolicy.js'

test('legacy-to-custom starter retains every operational legacy field', () => {
  const fields = [...TICKET_TOP_STARTER.header, ...TICKET_TOP_STARTER.info]
    .map(row => row.field)
  assert.deepEqual(fields, [
    'check_number',
    'order_type',
    'course',
    'table',
    'server',
    'time',
  ])
  // The check number leads, at double height rather than double width — the
  // latter spaces characters out and wraps a long number across lines.
  assert.equal(TICKET_TOP_STARTER.header[0].field, 'check_number')
  assert.equal(TICKET_TOP_STARTER.header[0].size, 'large')
})

test('configured layouts keep an absent zone empty instead of inventing starter rows', () => {
  const header = [{ type: 'field', field: 'order_type' }]
  assert.deepEqual(ticketTopEditorRows(header, undefined, true), { header, info: [] })
  assert.equal(ticketTopEditorRows(undefined, undefined, false), TICKET_TOP_STARTER)
})

test('external rows are compared without local drag ids', () => {
  const external = {
    header: [{ type: 'field', field: 'order_type' }],
    info: [{ type: 'field', field: 'server' }],
  }
  const local = {
    header: [{ id: 'header-1', ...external.header[0] }],
    info: [{ id: 'info-1', ...external.info[0] }],
  }
  assert.equal(ticketTopRowsMatch(local, external), true)
  assert.equal(ticketTopRowsMatch(local, { ...external, info: [] }), false)
})

test('a one-zone station edit does not materialize the other inherited zone', () => {
  const zones = {
    header: [{ id: 'header-1', type: 'field', field: 'order_type', bold: true }],
    info: [{ id: 'info-1', type: 'field', field: 'server' }],
  }
  assert.deepEqual(buildTicketTopPatch(zones, ['header']), {
    header: [{ type: 'field', field: 'order_type', bold: true }],
  })
  assert.deepEqual(buildTicketTopPatch(zones, ['header', 'info']), {
    header: [{ type: 'field', field: 'order_type', bold: true }],
    info: [{ type: 'field', field: 'server' }],
  })
})

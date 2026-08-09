import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  TICKET_TOP_STARTER,
  buildTicketTopPatch,
  ticketTopEditorRows,
  ticketTopRowsMatch,
  ticketTopSideLabel,
  ticketTopSideParts,
} from './ticketTopPolicy.js'

// The starter must stay a faithful copy of what the POS already prints. Its
// previous version was an approximation — the schema could not express a
// two-column row, so opening the builder replaced a two-line heading with six
// one-field-per-line rows and made the ticket worse.
//
// ticketTopDefault.json is mirrored from the backend, which renders it as
// DEFAULT_KITCHEN_TICKET_TOP. Both suites pin the same checksum, so a change on
// one side that is not mirrored fails a build rather than quietly making the
// first ticket a restaurant customizes worse than the one it replaced.
const DEFAULT_PATH = new URL('./ticketTopDefault.json', import.meta.url)

// Mirror of this file in the backend repo: Shire_POS_backend/tests/ticket_top_default.json
// Update both, then update this digest and DEFAULT_SHA256 there.
const EXPECTED_SHA256 = '9c47cd6210594d3686606e2d4f860ddf5fcd4dd1364ec91d54771965dbd82e97'

test('the starter is exactly what the printer renders by default', () => {
  const shipped = JSON.parse(readFileSync(DEFAULT_PATH, 'utf8'))
  assert.deepEqual(TICKET_TOP_STARTER, shipped)
})

test('default checksum is pinned', () => {
  const digest = createHash('sha256').update(readFileSync(DEFAULT_PATH)).digest('hex')
  assert.equal(
    digest,
    EXPECTED_SHA256,
    `ticketTopDefault.json changed (sha256=${digest}). Copy it from `
      + 'Shire_POS_backend/tests/ticket_top_default.json, update EXPECTED_SHA256 here '
      + 'and DEFAULT_SHA256 in the backend, then re-run both suites.',
  )
})
test('the starter reproduces the printed two-column heading', () => {
  const [heading] = TICKET_TOP_STARTER.header
  assert.equal(heading.type, 'pair')
  assert.equal(heading.right_width, 10)
  // Check number, falling back to the table when a ticket has no number yet.
  assert.equal(heading.left.mode, 'first')
  assert.deepEqual(heading.left.parts.map(part => part.field), ['check_number', 'location'])
  assert.equal(heading.left.size, 'large')
  assert.equal(heading.right.parts[0].field, 'order_type')
})

test('the starter info line joins location and server opposite the time', () => {
  const [info] = TICKET_TOP_STARTER.info
  assert.equal(info.type, 'pair')
  assert.deepEqual(info.left.parts.map(part => part.field), ['location', 'server_name'])
  // The header may already have fallen back to the table; repeating it here
  // would print "Table 7" twice.
  assert.equal(info.left.parts[0].hide_if_duplicate, true)
  assert.equal(info.right.parts[0].field, 'time_only')
  assert.equal(info.right_width, 7)
})

test('the course banner and the rule under it appear and vanish together', () => {
  const conditional = TICKET_TOP_STARTER.info.filter(row => row.requires === 'course_banner')
  assert.deepEqual(conditional.map(row => row.type), ['field', 'divider'])
})

test('ordinary check memos start as a compact customizable row with their own rule', () => {
  const conditional = TICKET_TOP_STARTER.info.filter(row => row.requires === 'check_memo')
  assert.deepEqual(conditional.map(row => row.type), ['field', 'divider'])
  assert.deepEqual(conditional[0], {
    type: 'field',
    field: 'check_memo',
    align: 'left',
    size: 'standard',
    bold: true,
    color: 'red',
    requires: 'check_memo',
  })
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

test('a bare field is read as a one-part column', () => {
  assert.deepEqual(ticketTopSideParts({ field: 'server_name' }), [{ field: 'server_name' }])
  assert.deepEqual(ticketTopSideParts(undefined), [])
  assert.deepEqual(ticketTopSideParts({}), [])
})

test('a column summarises as join or fallback so the row reads at a glance', () => {
  const label = field => field.toUpperCase()
  assert.equal(
    ticketTopSideLabel({ parts: [{ field: 'location' }, { field: 'server_name' }], join: ' · ' }, label),
    'LOCATION · SERVER_NAME',
  )
  assert.equal(
    ticketTopSideLabel({ parts: [{ field: 'check_number' }, { field: 'location' }], mode: 'first' }, label),
    'CHECK_NUMBER or LOCATION',
  )
  assert.equal(ticketTopSideLabel({ parts: [{ text: 'RUSH' }] }, label), '"RUSH"')
  assert.equal(ticketTopSideLabel(null, label), '—')
})

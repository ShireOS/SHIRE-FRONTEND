import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  TICKET_TOP_STARTER,
  buildTicketTopPatch,
  ticketTopEditorRows,
  ticketTopFieldPresentation,
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
const EXPECTED_SHA256 = '82d84b6d58a7e0a545ff40e673018426ec79a783ad6ccfc70126684229c5febd'

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
test('the starter centers the method and narrower table above the item hierarchy', () => {
  const [method, identity, beforeTable, table, afterTable] = TICKET_TOP_STARTER.header
  assert.deepEqual(
    [method.type, method.field, method.align, method.size, method.bold, method.color],
    ['field', 'order_type', 'center', 'double', true, 'red'],
  )
  assert.equal(identity.type, 'pair')
  assert.deepEqual(identity.left.parts.map(part => part.field), ['station_name', 'server_name'])
  assert.equal(identity.left.join, ' · ')
  assert.equal(identity.left.size, 'large')
  assert.equal(identity.right.parts[0].field, 'time_only')
  assert.equal(identity.right.size, 'large')
  assert.equal(identity.right_width, 9)
  assert.deepEqual([beforeTable.type, table.field, table.align, table.size, table.bold, afterTable.type], ['divider', 'location', 'center', 'large', true, 'divider'])
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

test('preview presentation follows stock and customized field sizing', () => {
  assert.deepEqual(ticketTopFieldPresentation(TICKET_TOP_STARTER.header, 'order_type'), {
    type: 'field', field: 'order_type', align: 'center', size: 'double', bold: true, color: 'red', pair: false,
  })
  assert.deepEqual(ticketTopFieldPresentation(TICKET_TOP_STARTER.header, 'location'), {
    type: 'field', field: 'location', align: 'center', size: 'large', bold: true, pair: false,
  })
  assert.deepEqual(
    ticketTopFieldPresentation([{
      type: 'pair', bold: true,
      left: { parts: [{ field: 'server_name' }], size: 'large' },
      right: { parts: [{ field: 'time_only' }] },
    }], 'server_name'),
    {
      type: 'pair', bold: true, pair: true,
      left: { parts: [{ field: 'server_name' }], size: 'large' },
      right: { parts: [{ field: 'time_only' }] },
      parts: [{ field: 'server_name' }], size: 'large',
    },
  )
  assert.equal(ticketTopFieldPresentation([], 'order_type'), null)
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

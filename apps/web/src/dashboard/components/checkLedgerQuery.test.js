import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCheckLedgerQuery, ledgerCheckCount } from './checkLedgerQuery.js'

const base = {
  businessDate: '',
  dateFrom: '2026-08-06',
  dateTo: '2026-08-12',
  historyStatus: '',
  search: '',
  page: 1,
}

test('active checks use the full POS lifecycle metric instead of only open', () => {
  const query = buildCheckLedgerQuery({ ...base, tab: 'active' })
  assert.equal(query.metric, 'active_checks')
  assert.equal(query.status, undefined)
})

test('closed includes paid checks that have not reached their terminal status yet', () => {
  const query = buildCheckLedgerQuery({ ...base, tab: 'closed' })
  assert.equal(query.metric, 'sales')
  assert.equal(query.status, undefined)
})

test('history retains its explicit status filter', () => {
  assert.deepEqual(buildCheckLedgerQuery({ ...base, tab: 'history', historyStatus: 'voided' }), {
    date_from: base.dateFrom,
    date_to: base.dateTo,
    status: 'voided',
    search: undefined,
    page: 1,
    page_size: 25,
  })
})

test('check count follows the filtered ledger even when a stale summary disagrees', () => {
  assert.equal(ledgerCheckCount({ total: 4, summary: { checks: 0 }, items: [{}, {}, {}, {}] }), 4)
  assert.equal(ledgerCheckCount({ summary: { checks: 2 }, items: [{}, {}] }), 2)
})

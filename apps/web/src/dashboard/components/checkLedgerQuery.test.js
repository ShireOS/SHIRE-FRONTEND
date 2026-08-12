import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCheckLedgerQuery } from './checkLedgerQuery.js'

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

test('closed and history retain their explicit filters', () => {
  assert.equal(buildCheckLedgerQuery({ ...base, tab: 'closed' }).status, 'closed')
  assert.deepEqual(buildCheckLedgerQuery({ ...base, tab: 'history', historyStatus: 'voided' }), {
    date_from: base.dateFrom,
    date_to: base.dateTo,
    status: 'voided',
    search: undefined,
    page: 1,
    page_size: 25,
  })
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  receiptSnapshotContextKey,
  reportOutputContextKey,
  reportOutputRequestIsCurrent,
  shouldForceReportSnapshotRefresh,
  snapshotIsFreshForOutput,
  snapshotIsReadyForPhysicalPrint,
} from './reportSnapshotState.js'

const payload = {
  start_date: '2026-08-17',
  end_date: '2026-08-23',
  start_time: '00:00',
  end_time: '23:59',
  receipt_group_ids: ['revenue'],
  scope_dimension: 'none',
  scope_mode: 'cumulative',
  scope_ids: [],
}

const snapshot = {
  print_snapshot_id: 'snapshot-1',
  _restaurant_id: 'restaurant-1',
  _request_context_key: receiptSnapshotContextKey(payload),
  groups: [{ id: 'revenue' }],
}

test('a failed forced refresh invalidates same-context report output', () => {
  const invalidated = reportOutputContextKey('restaurant-1', payload)

  assert.equal(snapshotIsFreshForOutput(snapshot, payload, 'restaurant-1', []), true)
  assert.equal(snapshotIsFreshForOutput(snapshot, payload, 'restaurant-1', [invalidated]), false)
})

test('an invalidation does not suppress a different current report context', () => {
  const otherPayload = { ...payload, start_date: '2026-08-16' }
  const invalidated = reportOutputContextKey('restaurant-1', otherPayload)

  assert.equal(snapshotIsFreshForOutput(snapshot, payload, 'restaurant-1', [invalidated]), true)
})

test('output still requires every requested receipt group', () => {
  assert.equal(snapshotIsFreshForOutput(
    snapshot,
    { ...payload, receipt_group_ids: ['revenue', 'tender_mix'] },
    'restaurant-1',
    [],
  ), false)
})

test('output rejects a broader snapshot when the selected profile requests fewer groups', () => {
  const broaderSnapshot = {
    ...snapshot,
    groups: [{ id: 'revenue' }, { id: 'tender_mix' }],
  }

  assert.equal(snapshotIsFreshForOutput(
    broaderSnapshot,
    payload,
    'restaurant-1',
    [],
  ), false)
})

test('a Restaurant ML snapshot token is valid without a POS print snapshot token', () => {
  const directSnapshot = {
    ...snapshot,
    print_snapshot_id: undefined,
    snapshot_id: 'ml-snapshot-1',
  }

  assert.equal(snapshotIsFreshForOutput(
    directSnapshot,
    payload,
    'restaurant-1',
    [],
  ), true)
})

test('physical printing still requires the POS token for the exact visible snapshot', () => {
  const directSnapshot = {
    ...snapshot,
    print_snapshot_id: undefined,
    snapshot_id: 'ml-snapshot-1',
  }

  assert.equal(snapshotIsReadyForPhysicalPrint(
    directSnapshot,
    payload,
    'restaurant-1',
    [],
  ), false)
  assert.equal(snapshotIsReadyForPhysicalPrint(
    snapshot,
    payload,
    'restaurant-1',
    [],
  ), true)
})

test('an invalidated context forces both cache and backend refresh on retry', () => {
  const contextKey = reportOutputContextKey('restaurant-1', payload)

  assert.equal(shouldForceReportSnapshotRefresh(false, [], contextKey), false)
  assert.equal(shouldForceReportSnapshotRefresh(true, [], contextKey), true)
  assert.equal(shouldForceReportSnapshotRefresh(false, [contextKey], contextKey), true)
  assert.equal(shouldForceReportSnapshotRefresh(false, new Set([contextKey]), contextKey), true)
})

test('successful refresh for one receipt-group set cannot clear another set', () => {
  const groupA = { ...payload, receipt_group_ids: ['revenue'] }
  const groupB = { ...payload, receipt_group_ids: ['tender_mix'] }
  const groupAKey = reportOutputContextKey('restaurant-1', groupA)
  const groupBKey = reportOutputContextKey('restaurant-1', groupB)
  const invalidated = new Set([groupAKey, groupBKey])

  assert.equal(receiptSnapshotContextKey(groupA), receiptSnapshotContextKey(groupB))
  assert.notEqual(groupAKey, groupBKey)
  invalidated.delete(groupBKey)

  assert.equal(shouldForceReportSnapshotRefresh(false, invalidated, groupAKey), true)
  assert.equal(shouldForceReportSnapshotRefresh(false, invalidated, groupBKey), false)
})

test('a same-context refresh epoch invalidates an in-flight output callback', () => {
  const request = {
    restaurantId: 'restaurant-1',
    generation: 4,
    contextKey: 'week:long',
    refreshEpoch: 8,
  }

  assert.equal(reportOutputRequestIsCurrent(request, { ...request }), true)
  assert.equal(reportOutputRequestIsCurrent(request, { ...request, refreshEpoch: 9 }), false)
})

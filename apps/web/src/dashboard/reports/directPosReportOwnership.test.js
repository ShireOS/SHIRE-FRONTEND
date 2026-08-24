import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const reportsPage = await readFile(new URL('./RestaurantReportsPage.jsx', import.meta.url), 'utf8')
const reportClient = await readFile(new URL('../../shared/api/restaurantReportClient.ts', import.meta.url), 'utf8')

test('digital snapshots, artifacts, and immediate email support the direct ML owner', () => {
  assert.match(reportsPage, /restaurantReportApi\.snapshot/)
  assert.match(reportsPage, /restaurantReportApi\.artifact/)
  assert.match(reportsPage, /restaurantReportApi\.emailNow/)
  assert.match(reportsPage, /DIRECT_POS_REPORTS_ENABLED/)
  assert.match(reportClient, /VITE_DIRECT_POS_REPORTS_ENABLED/)
  assert.match(reportClient, /reports\/pos-snapshots/)
})

test('physical receipt preview and delivery remain POS-owned', () => {
  assert.match(reportsPage, /fetchPosApi\(requestedRestaurantId, '\/manager\/report-hub\/receipt-preview'/)
  assert.match(reportsPage, /fetchPosApi\(restaurantId, '\/manager\/report-hub\/receipt'/)
  assert.match(reportsPage, /print_snapshot_id/)
})

test('CSV still renders from the visible snapshot without a backend round trip', () => {
  assert.match(reportsPage, /function downloadSnapshotCsv/)
  assert.match(reportsPage, /downloadSnapshotCsv\(snapshot, scopedGroupIds, activeProfile\.name\)/)
})

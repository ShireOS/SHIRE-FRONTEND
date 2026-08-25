import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const reportsPage = await readFile(new URL('./RestaurantReportsPage.jsx', import.meta.url), 'utf8')
const modal = await readFile(new URL('./ServerReceiptTemplateModal.jsx', import.meta.url), 'utf8')
const dashboardApp = await readFile(new URL('../AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const dashboardShell = await readFile(new URL('../shell/DashboardShell.jsx', import.meta.url), 'utf8')

test('server receipt configuration is exposed in POS report settings', () => {
  assert.match(reportsPage, />Server receipt</)
  assert.match(reportsPage, /<ServerReceiptTemplateModal restaurantId=/)
  assert.match(dashboardApp, /canConfigureServerReceipt=\{backOfficeAccess\.can\('settings\.edit'\)\}/)
})

test('preview and save use the canonical POS backend report template endpoints', () => {
  assert.match(modal, /\/manager\/report-hub\/server-receipt-preview/)
  assert.match(modal, /\/manager\/report-hub\/server-receipt-config/)
  assert.match(modal, /Cash Collected, Non-cash tips owed, and Cash Due to Restaurant/)
  assert.match(modal, /Save restaurant-wide/)
})

test('POS report profiles remain configurable before a snapshot loads', () => {
  assert.match(reportsPage, /const RECEIPT_GROUP_CATALOG = \[/)
  assert.match(reportsPage, /snapshot\?\.catalog\?\.length \? snapshot\.catalog : RECEIPT_GROUP_CATALOG/)
  assert.match(reportsPage, />Select all</)
  assert.match(reportsPage, />Clear</)
  assert.match(reportsPage, /id: 'long'.*group_ids: \['revenue', 'tender_mix', 'daily_sales', 'key_metrics', 'category_sales', 'item_sales'/s)
  for (const id of ['service_mode_sales', 'media_tip_detail', 'cash_reconciliation', 'department_detail', 'transaction_log']) {
    assert.match(reportsPage, new RegExp(`id: '${id}'`))
  }
  const longProfile = reportsPage.match(/\{ id: 'long'[^\n]+/)?.[0] || ''
  assert.doesNotMatch(longProfile, /service_mode_sales|media_tip_detail|cash_reconciliation|department_detail|transaction_log/)
  assert.match(reportsPage, /receipt_group_ids: scopedGroupIds/)
})

test('POS reports use a distinct analytics icon from the check ledger', () => {
  assert.match(dashboardShell, /\{ id: 'reports', label: 'POS Reports', icon: ChartNoAxesCombined \}/)
  assert.match(dashboardShell, /\{ id: 'checks', label: 'Checks', icon: ReceiptText \}/)
})

test('POS report range includes persisted local times in preview and exports', () => {
  assert.match(reportsPage, /type="datetime-local"/)
  assert.match(reportsPage, /start_time: times\.start/)
  assert.match(reportsPage, /end_time: times\.end/)
  assert.match(reportsPage, /minuteTime\(saved\.start_time, '00:00'\)/)
  assert.match(reportsPage, /Restaurant local time/)
})

test('POS reports expose employee scope with honest section semantics', () => {
  assert.match(reportsPage, /\['employee', 'Employees'\]/)
  assert.match(reportsPage, /dimensions\.employees/)
  assert.match(reportsPage, /Sales and menu activity follow checks assigned to each employee/)
  assert.match(reportsPage, /Excluded from employee-scoped reports/)
  assert.match(reportsPage, /snapshot\.scope\.values/)
})

test('POS report printing previews thermal output and follows physical delivery', () => {
  assert.match(reportsPage, /\/manager\/report-hub\/receipt-preview/)
  assert.match(reportsPage, /\/manager\/report-hub\/receipt'/)
  assert.match(reportsPage, /\/manager\/report-hub\/receipt-jobs\//)
  assert.match(reportsPage, /crypto\.randomUUID\(\)/)
  assert.match(reportsPage, /snapshot_id: physicalPrintIsReady \? snapshot\.print_snapshot_id : null/)
  assert.match(reportsPage, /printer_context_id: preview\?\.printer_context_id/)
  assert.match(reportsPage, /render_token: preview\?\.render_token/)
  assert.match(reportsPage, /setPreloadedReceiptPreviews/)
  assert.match(reportsPage, /preloadReceiptPreview/)
  assert.match(reportsPage, /onIntent=\{\(\) => \{ void preloadReceiptPreview\(\) \}\}/)
  assert.match(reportsPage, /queryKeys\.reportReceiptPreview/)
  assert.doesNotMatch(reportsPage, /profiles\.filter\(\(candidate\) => candidate\.built_in\)/)
  assert.match(reportsPage, /let pollDelay = 500/)
  assert.match(reportsPage, /Math\.min\(Math\.round\(pollDelay \* 1\.5\), 2000\)/)
  assert.match(reportsPage, /snapshotCoversReceiptRequest/)
  assert.match(reportsPage, /snapshotIsReadyForPhysicalPrint/)
  assert.match(reportsPage, /loadRequestRef\.current !== requestId/)
  assert.match(reportsPage, /controller\.abort\(\)/)
  assert.match(reportsPage, /Confirm long receipt/)
  assert.match(reportsPage, /No report rows will be silently removed/)
  assert.doesNotMatch(reportsPage, /192\.168\./)
})

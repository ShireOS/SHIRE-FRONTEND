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
})

test('POS reports use a distinct analytics icon from the check ledger', () => {
  assert.match(dashboardShell, /\{ id: 'reports', label: 'POS Reports', icon: ChartNoAxesCombined \}/)
  assert.match(dashboardShell, /\{ id: 'checks', label: 'Checks', icon: ReceiptText \}/)
})

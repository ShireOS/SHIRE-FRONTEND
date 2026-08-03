import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const reportsPage = await readFile(new URL('./RestaurantReportsPage.jsx', import.meta.url), 'utf8')
const modal = await readFile(new URL('./ServerReceiptTemplateModal.jsx', import.meta.url), 'utf8')
const dashboardApp = await readFile(new URL('../AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')

test('server receipt configuration is exposed in Back Office Server Reports', () => {
  assert.match(reportsPage, /Configure receipt/)
  assert.match(reportsPage, /<ServerReceiptTemplateModal restaurantId=/)
  assert.match(dashboardApp, /canConfigureServerReceipt=\{backOfficeAccess\.can\('settings\.edit'\)\}/)
})

test('preview and save use the canonical POS backend report template endpoints', () => {
  assert.match(modal, /\/manager\/report-hub\/server-receipt-preview/)
  assert.match(modal, /\/manager\/report-hub\/server-receipt-config/)
  assert.match(modal, /Cash Collected, Non-cash tips owed, and Cash Due to Restaurant/)
  assert.match(modal, /Save restaurant-wide/)
})

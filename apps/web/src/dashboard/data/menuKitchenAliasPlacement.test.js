import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const menuPanel = await readFile(new URL('../MenuPanel.jsx', import.meta.url), 'utf8')
const itemDetail = await readFile(new URL('../MenuItemDetail.jsx', import.meta.url), 'utf8')
const app = await readFile(new URL('../AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')

test('the item Kitchen card edits only the base alias and preserves the advanced editor path', () => {
  assert.match(itemDetail, /Kitchen ticket name/)
  assert.match(itemDetail, /Use full POS name/)
  assert.match(itemDetail, /Use a shorter kitchen alias/)
  assert.match(itemDetail, /Station-specific overrides still win/)
  assert.match(itemDetail, /Advanced printing options/)
  assert.match(itemDetail, /Why is this printed name changing\?/)
  assert.match(menuPanel, /canEditKitchenAlias=\{canEditPrinting\}/)
  assert.match(menuPanel, /cache: 'no-store'/)
  assert.match(menuPanel, /withKitchenItemAlias\(fresh, itemId, alias\)/)
  assert.match(menuPanel, /change_reason: reason\.trim\(\)/)
})

test('item alias editing reuses Store Settings permission', () => {
  assert.match(app, /canEditPrinting=\{backOfficeAccess\.can\('settings\.edit'\)\}/)
})

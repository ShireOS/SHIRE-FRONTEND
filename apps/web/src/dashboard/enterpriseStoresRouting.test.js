import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const dashboardSource = readFileSync(new URL('./AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const resellerSource = readFileSync(new URL('../reseller/ResellerApp.jsx', import.meta.url), 'utf8')
const storesSource = readFileSync(new URL('./pages/StoresPage.jsx', import.meta.url), 'utf8')

test('reseller account landings use the shared enterprise stores overview', () => {
  assert.match(
    dashboardSource,
    /accountType === 'reseller'[\s\S]*accountType === 'reseller_employee'[\s\S]*Navigate to="\/enterprise\/stores"/,
  )
  assert.match(resellerSource, /stores: '\/enterprise\/stores'/)
  assert.match(resellerSource, /return <Navigate to="\/enterprise\/stores" replace \/>/)
})

test('reseller store workspaces return to the canonical store overview', () => {
  assert.match(resellerSource, /restaurantListPath="\/enterprise\/stores"/)
  assert.match(storesSource, /\['reseller', 'reseller_employee'\][\s\S]*'\/reseller\/restaurants'/)
  assert.match(storesSource, /navigate\(`\$\{restaurantBase\}\/\$\{restaurant\.id\}\/analytics`\)/)
  assert.match(dashboardSource, /settings: '\/reseller\/profile'/)
  assert.doesNotMatch(resellerSource, /restaurantListPath="\/reseller"/)
  assert.doesNotMatch(resellerSource, /fallbackPath="\/reseller"/)
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { routeForOwnerWithoutOperationalStores } from './deletedStoreRouting.ts'

const authHooks = await readFile(new URL('./useRequireAuth.ts', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../../dashboard/AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')

test('owners with only deleted stores are routed to account recovery', () => {
  assert.equal(routeForOwnerWithoutOperationalStores(undefined), null)
  assert.equal(routeForOwnerWithoutOperationalStores([{ restaurant_id: 'deleted-1' }]), '/enterprise/settings')
  assert.equal(routeForOwnerWithoutOperationalStores([], true), '/enterprise/settings')
  assert.equal(routeForOwnerWithoutOperationalStores([]), '/onboarding')
})

test('deleted-store lookup is limited to truly empty operational portfolios', () => {
  assert.match(authHooks, /auth\.accountType === 'owner'[\s\S]{0,160}auth\.restaurant\.restaurants\.length === 0/)
  assert.match(dashboard, /const emptyOwnerPortfolio = Boolean\([\s\S]{0,260}auth\.restaurant\.restaurants\.length === 0/)
  assert.match(dashboard, /queryFn: \(\) => backOfficeApi\.deletedRestaurants\(\)[\s\S]{0,100}enabled: emptyOwnerPortfolio/)
})

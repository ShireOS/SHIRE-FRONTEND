import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { storeLifecycleAction } from './pages/storeLifecycleActions.js'

const stores = await readFile(new URL('./pages/StoresPage.jsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('./AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../shared/api/backOfficeApi.ts', import.meta.url), 'utf8')

test('only the primary owner receives the correct store deletion entry point', () => {
  const incomplete = { owner_id: 'owner-1', status: 'onboarding', onboarding_completed_at: null }
  const completed = { owner_id: 'owner-1', status: 'active', onboarding_completed_at: '2026-09-02T00:00:00Z' }

  assert.equal(storeLifecycleAction(incomplete, 'owner-1'), 'delete-incomplete')
  assert.equal(storeLifecycleAction(completed, 'owner-1'), 'manage-deletion')
  assert.equal(storeLifecycleAction(incomplete, 'member-1'), null)
  assert.equal(storeLifecycleAction({ ...incomplete, status: 'draft' }, 'owner-1'), null)
})

test('unfinished cards use guarded cancellation and completed cards open Danger Zone', () => {
  assert.match(stores, /lifecycleAction === 'delete-incomplete'[\s\S]*Delete permanently/)
  assert.match(stores, /cancelOnboardingRestaurant\(restaurant\.id\)/)
  assert.match(stores, /confirmation === restaurantName/)
  assert.match(stores, /lifecycleAction === 'manage-deletion'[\s\S]*Delete store…/)
  assert.match(stores, /settings#lifecycle/)
  assert.match(api, /onboarding-cancellation/)
  assert.match(dashboard, /initialTab=\{activeSection === 'lifecycle' \? 'lifecycle' : null\}/)
})

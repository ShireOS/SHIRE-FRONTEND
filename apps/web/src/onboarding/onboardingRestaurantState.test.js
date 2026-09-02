import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { isResumableOnboardingRestaurant } from './onboardingRestaurantState.js'

const hook = await readFile(new URL('./hooks/useOnboarding.ts', import.meta.url), 'utf8')

test('only unfinished draft and onboarding restaurants can resume guided setup', () => {
  assert.equal(isResumableOnboardingRestaurant({ status: 'draft', onboarding_completed_at: null }), true)
  assert.equal(isResumableOnboardingRestaurant({ status: 'onboarding', onboarding_completed_at: null }), true)
  assert.equal(isResumableOnboardingRestaurant({ status: 'active', onboarding_completed_at: null }), false)
  assert.equal(isResumableOnboardingRestaurant({ status: 'onboarding', onboarding_completed_at: '2026-09-02T00:00:00Z' }), false)
  assert.equal(isResumableOnboardingRestaurant(null), false)
})

test('new-store hydration validates stored restaurant identity before restoring its draft', () => {
  assert.match(hook, /isResumableOnboardingRestaurant\(currentRestaurant\)/)
  assert.match(hook, /isResumableOnboardingRestaurant\(fetchedNewFlowDraftRestaurant\)/)
  assert.match(hook, /onboardingRestaurant\?\.id === localDraft\.restaurantId/)
  assert.doesNotMatch(hook, /newFlowSelectedRestaurant/)
})

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

test('new-store and resume flows cannot inherit another restaurant identity', () => {
  assert.match(hook, /isResumableOnboardingRestaurant\(currentRestaurant\)/)
  assert.match(hook, /isNewRestaurantFlow[\s\S]*\? !localDraft\.restaurantId/)
  assert.match(hook, /isRestaurantSetupResume[\s\S]*\? resumeRestaurant/)
  assert.match(hook, /isNewRestaurantFlow[\s\S]*\? null[\s\S]*isRestaurantSetupResume/)
  assert.doesNotMatch(hook, /fetchDraftRestaurant/)
  assert.doesNotMatch(hook, /newFlowSelectedRestaurant/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  onboardingResumePath,
  readOnboardingRoute,
  resolveOnboardingTargetId,
} from './onboardingRoute.js'

test('resume URLs carry the exact restaurant identity', () => {
  assert.equal(
    onboardingResumePath('restaurant-2'),
    '/onboarding?resume=1&restaurantId=restaurant-2',
  )
  assert.deepEqual(
    readOnboardingRoute('/onboarding', '?resume=1&restaurantId=restaurant-2'),
    {
      isNewRestaurantFlow: false,
      isRestaurantSetupResume: true,
      requestedRestaurantId: 'restaurant-2',
    },
  )
})

test('an unscoped legacy resume URL has no mutation target', () => {
  assert.deepEqual(readOnboardingRoute('/onboarding', '?resume=1'), {
    isNewRestaurantFlow: false,
    isRestaurantSetupResume: true,
    requestedRestaurantId: null,
  })
})

test('new-store mode never inherits a restaurant identity from the URL', () => {
  assert.deepEqual(
    readOnboardingRoute('/onboarding', '?new=1&restaurantId=existing-store'),
    {
      isNewRestaurantFlow: true,
      isRestaurantSetupResume: false,
      requestedRestaurantId: null,
    },
  )
})

test('resuming Blueberries never mutates the currently selected Matthews restaurant', () => {
  assert.equal(resolveOnboardingTargetId({
    isNewRestaurantFlow: false,
    isRestaurantSetupResume: true,
    requestedRestaurantId: 'blueberries-id',
    validatedResumeRestaurantId: 'blueberries-id',
    stateRestaurantId: 'matthews-id',
    currentRestaurantId: 'matthews-id',
  }), 'blueberries-id')
})

test('new-store and invalid resume flows have no existing mutation target', () => {
  assert.equal(resolveOnboardingTargetId({
    isNewRestaurantFlow: true,
    isRestaurantSetupResume: false,
    requestedRestaurantId: null,
    validatedResumeRestaurantId: null,
    stateRestaurantId: 'stale-matthews-id',
    currentRestaurantId: 'matthews-id',
  }), null)

  assert.equal(resolveOnboardingTargetId({
    isNewRestaurantFlow: false,
    isRestaurantSetupResume: true,
    requestedRestaurantId: null,
    validatedResumeRestaurantId: null,
    stateRestaurantId: 'stale-matthews-id',
    currentRestaurantId: 'matthews-id',
  }), null)

  assert.equal(resolveOnboardingTargetId({
    isNewRestaurantFlow: false,
    isRestaurantSetupResume: true,
    requestedRestaurantId: 'completed-matthews-id',
    validatedResumeRestaurantId: null,
    stateRestaurantId: 'completed-matthews-id',
    currentRestaurantId: 'completed-matthews-id',
  }), null)
})

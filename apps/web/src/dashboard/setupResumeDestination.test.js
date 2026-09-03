import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { setupResumeDestination } from './pages/setupResumeDestination.js'

const onboardingGuard = await readFile(
  new URL('../auth/hooks/useRequireAuth.ts', import.meta.url),
  'utf8',
)

const restaurant = {
  id: 'restaurant-1',
  status: 'onboarding',
  onboarding_completed_at: null,
  onboarding_step: 9,
}

const destination = (overrides = {}, missingCount = 7) => setupResumeDestination({
  restaurant: { ...restaurant, ...overrides },
  setupStatus: { missing_count: missingCount },
  restaurantBase: '/reseller/restaurants',
  finalGuidedStep: 21,
})

test('unfinished stores with untouched later pages resume guided onboarding', () => {
  assert.equal(destination(), '/onboarding?resume=1&restaurantId=restaurant-1')
})

test('stores with only one or two isolated gaps open targeted configuration', () => {
  assert.equal(destination({}, 1), '/reseller/restaurants/restaurant-1/setup')
  assert.equal(destination({}, 2), '/reseller/restaurants/restaurant-1/setup')
})

test('stores that reached the final guided page open targeted configuration', () => {
  assert.equal(destination({ onboarding_step: 21 }, 6), '/reseller/restaurants/restaurant-1/setup')
})

test('completed stores never re-enter guided onboarding', () => {
  assert.equal(
    destination({ onboarding_completed_at: '2026-09-02T00:00:00Z' }, 8),
    '/reseller/restaurants/restaurant-1/setup',
  )
})

test('a transient setup-status failure still honors saved guided progress', () => {
  assert.equal(
    setupResumeDestination({
      restaurant,
      setupStatus: null,
      restaurantBase: '/restaurants',
      finalGuidedStep: 21,
    }),
    '/onboarding?resume=1&restaurantId=restaurant-1',
  )
})

test('the explicit restaurant resume survives reseller account routing', () => {
  assert.match(onboardingGuard, /readOnboardingRoute/)
  assert.match(onboardingGuard, /requestedRestaurantId/)
  assert.match(onboardingGuard, /validResumeRestaurant/)
  assert.match(
    onboardingGuard,
    /if \(isRestaurantSetupResume\)[\s\S]*switchRestaurant\(validResumeRestaurant\.id\)/,
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { setupResumeDestination } from './pages/setupResumeDestination.js'

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
  assert.equal(destination(), '/onboarding')
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
    '/onboarding',
  )
})

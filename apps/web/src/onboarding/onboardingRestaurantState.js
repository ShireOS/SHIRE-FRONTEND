const RESUMABLE_ONBOARDING_STATUSES = new Set(['draft', 'onboarding'])

export function isResumableOnboardingRestaurant(restaurant) {
  return Boolean(
    restaurant
    && RESUMABLE_ONBOARDING_STATUSES.has(restaurant.status)
    && !restaurant.onboarding_completed_at,
  )
}

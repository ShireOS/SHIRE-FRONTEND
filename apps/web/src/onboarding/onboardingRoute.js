export function readOnboardingRoute(pathname, search) {
  const isOnboarding = pathname === '/onboarding'
  const params = new URLSearchParams(search)
  const isNewRestaurantFlow = isOnboarding && params.get('new') === '1'
  const isRestaurantSetupResume = isOnboarding && params.get('resume') === '1'
  const requestedRestaurantId = isRestaurantSetupResume
    ? params.get('restaurantId')?.trim() || null
    : null

  return {
    isNewRestaurantFlow,
    isRestaurantSetupResume,
    requestedRestaurantId,
  }
}

export function onboardingResumePath(restaurantId) {
  const normalizedId = String(restaurantId || '').trim()
  if (!normalizedId) {
    throw new Error('A restaurant ID is required to resume onboarding.')
  }
  return `/onboarding?resume=1&restaurantId=${encodeURIComponent(normalizedId)}`
}

export function resolveOnboardingTargetId({
  isNewRestaurantFlow,
  isRestaurantSetupResume,
  requestedRestaurantId,
  validatedResumeRestaurantId,
  stateRestaurantId,
  currentRestaurantId,
}) {
  if (isNewRestaurantFlow) return null
  if (isRestaurantSetupResume) {
    return requestedRestaurantId && requestedRestaurantId === validatedResumeRestaurantId
      ? requestedRestaurantId
      : null
  }
  return stateRestaurantId || currentRestaurantId || null
}

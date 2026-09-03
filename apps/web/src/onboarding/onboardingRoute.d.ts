export interface OnboardingRoute {
  isNewRestaurantFlow: boolean
  isRestaurantSetupResume: boolean
  requestedRestaurantId: string | null
}

export function readOnboardingRoute(pathname: string, search: string): OnboardingRoute
export function onboardingResumePath(restaurantId: string): string
export function resolveOnboardingTargetId(input: {
  isNewRestaurantFlow: boolean
  isRestaurantSetupResume: boolean
  requestedRestaurantId: string | null
  validatedResumeRestaurantId: string | null
  stateRestaurantId: string | null
  currentRestaurantId: string | null
}): string | null

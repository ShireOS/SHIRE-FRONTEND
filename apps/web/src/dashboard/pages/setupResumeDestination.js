export function setupResumeDestination({
  restaurant,
  setupStatus,
  restaurantBase,
  finalGuidedStep,
}) {
  const savedStep = Number(restaurant?.onboarding_step)
  const missingCount = Number(setupStatus?.missing_count)
  const hasUnvisitedGuidedPages = Number.isFinite(savedStep)
    ? savedStep < finalGuidedStep
    : true
  const hasSubstantialSetupRemaining = Number.isFinite(missingCount)
    ? missingCount > 2
    : true
  const canResumeGuidedSetup = restaurant?.status === 'onboarding'
    && !restaurant?.onboarding_completed_at
    && hasUnvisitedGuidedPages
    && hasSubstantialSetupRemaining

  return canResumeGuidedSetup
    ? '/onboarding?resume=1'
    : `${restaurantBase}/${restaurant.id}/setup`
}

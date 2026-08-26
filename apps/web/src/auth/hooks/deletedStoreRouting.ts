export function routeForOwnerWithoutOperationalStores(
  deletedStores: unknown[] | undefined,
  lookupFailed = false,
): '/enterprise/settings' | '/onboarding' | null {
  if (!deletedStores && !lookupFailed) return null
  // Account Settings is the safe recovery surface when lookup fails too: it
  // can retry the lifecycle request and still links to new-store onboarding.
  return lookupFailed || deletedStores?.length
    ? '/enterprise/settings'
    : '/onboarding'
}

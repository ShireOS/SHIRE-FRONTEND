export function storeLifecycleAction(restaurant, userId) {
  if (!restaurant || !userId || restaurant.owner_id !== userId) return null
  if (restaurant.status === 'onboarding' && !restaurant.onboarding_completed_at) return 'delete-incomplete'
  if (restaurant.onboarding_completed_at) return 'manage-deletion'
  return null
}

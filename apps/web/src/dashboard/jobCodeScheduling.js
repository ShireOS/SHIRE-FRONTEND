export function buildScheduledJobCodeUpdate({ restaurantId, jobCodeId, payload }) {
  const scopedRestaurantId = String(restaurantId || '').trim()
  const scopedJobCodeId = String(jobCodeId || '').trim()
  if (!scopedRestaurantId) throw new Error('Restaurant is required to schedule a role update.')
  if (!scopedJobCodeId) throw new Error('An existing role is required to schedule an update.')

  return {
    method: 'PATCH',
    path: `/restaurants/${scopedRestaurantId}/job-codes/${scopedJobCodeId}`,
    body: payload,
    target_type: 'restaurant',
    target_id: scopedRestaurantId,
  }
}

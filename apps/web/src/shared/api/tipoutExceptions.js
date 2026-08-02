import { fetchPosApi } from './posClient'

export function fetchTipoutExceptions(restaurantId) {
  return fetchPosApi(
    restaurantId,
    `/restaurants/${restaurantId}/tipout-exceptions?status=open`,
  )
}

export function resolveTipoutException(restaurantId, alertId, resolution) {
  return fetchPosApi(
    restaurantId,
    `/restaurants/${restaurantId}/tipout-exceptions/${alertId}/resolve`,
    {
      method: 'POST',
      body: JSON.stringify(resolution),
    },
  )
}

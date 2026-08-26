import { fetchPosApi } from '../../shared/api/posClient'

const base = (restaurantId) => `/restaurants/${restaurantId}/device-updates`

export const fetchDeviceUpdateOverview = (restaurantId, signal) =>
  fetchPosApi(restaurantId, `${base(restaurantId)}/overview`, { signal, timeoutMs: 10_000 })

export const fetchDeviceUpdateAudit = (restaurantId, signal) =>
  fetchPosApi(restaurantId, `${base(restaurantId)}/audit?limit=100`, { signal, timeoutMs: 10_000 })

export const createDeviceUpdateDeployment = (restaurantId, input) =>
  fetchPosApi(restaurantId, `${base(restaurantId)}/deployments`, {
    method: 'POST',
    body: JSON.stringify(input),
    timeoutMs: 15_000,
  })

export const cancelDeviceUpdateDeployment = (restaurantId, deploymentId, reason) =>
  fetchPosApi(restaurantId, `${base(restaurantId)}/deployments/${deploymentId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })

export const saveDeviceUpdatePolicy = (restaurantId, input) =>
  fetchPosApi(restaurantId, `${base(restaurantId)}/policy`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })

export const createDeviceUpdateRelease = (restaurantId, input) =>
  fetchPosApi(restaurantId, `${base(restaurantId)}/releases`, {
    method: 'POST',
    body: JSON.stringify(input),
  })

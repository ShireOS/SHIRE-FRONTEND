import { fetchPosApi } from './posClient'

export const fetchKdsConfiguration = (restaurantId, signal) =>
  fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kds`, { signal, cache: 'no-store' })

export const createKdsProfile = (restaurantId, profile) =>
  fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kds/profiles`, {
    method: 'POST',
    body: JSON.stringify(profile),
  })

export const updateKdsProfile = (restaurantId, profileId, profile) =>
  fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kds/profiles/${profileId}`, {
    method: 'PUT',
    body: JSON.stringify(profile),
  })

export const assignKdsDevice = (restaurantId, deviceId, profileId, reason) =>
  fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kds/devices/assignment`, {
    method: 'PUT',
    body: JSON.stringify({ device_id: deviceId, profile_id: profileId, platform: 'ios', reason }),
  })

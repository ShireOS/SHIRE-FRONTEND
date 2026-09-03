import { fetchPosApi } from '../../shared/api/posClient'

const legacyBase = (restaurantId) =>
  `/restaurants/${restaurantId}/device-updates`
const V2_BASE = '/device-updates/v2'

function appendMany(params, key, values = []) {
  for (const value of values) {
    if (value) params.append(key, String(value))
  }
}

function scopeQuery(scope = {}) {
  const params = new URLSearchParams()
  appendMany(params, 'restaurant_id', scope.restaurant_ids)
  appendMany(params, 'reseller_group_id', scope.reseller_group_ids)
  appendMany(params, 'device_id', scope.included_device_ids)
  appendMany(params, 'exclude_device_id', scope.excluded_device_ids)
  return params
}

function withQuery(path, params) {
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

const postJson = (restaurantId, path, input, timeoutMs = 15_000) =>
  fetchPosApi(restaurantId, path, {
    method: 'POST',
    body: JSON.stringify(input),
    timeoutMs,
  })

export const fetchManagedUpdateFleet = (
  restaurantId,
  scope,
  filters = {},
  signal,
) => {
  const params = scopeQuery(scope)
  const filterKeys = [
    'release_family_id',
    'platform',
    'runtime_version',
    'protocol_version',
    'online',
    'capability_fresh',
    'eligible',
  ]
  for (const key of filterKeys) {
    const value = filters[key]
    if (value !== undefined && value !== null && value !== '')
      params.set(key, String(value))
  }
  return fetchPosApi(restaurantId, withQuery(`${V2_BASE}/fleet`, params), {
    signal,
    timeoutMs: 15_000,
  })
}

export const fetchManagedUpdateReleases = (
  restaurantId,
  { includeDrafts = false } = {},
  signal,
) => {
  const params = new URLSearchParams({ restaurant_id: restaurantId })
  if (includeDrafts) params.set('include_drafts', 'true')
  return fetchPosApi(restaurantId, withQuery(`${V2_BASE}/releases`, params), {
    signal,
    timeoutMs: 15_000,
  })
}

export const fetchManagedUpdateRollouts = (restaurantId, scope, signal) => {
  const params = scopeQuery(scope)
  params.set('limit', '100')
  return fetchPosApi(restaurantId, withQuery(`${V2_BASE}/rollouts`, params), {
    signal,
    timeoutMs: 15_000,
  })
}

export const fetchManagedUpdateRollout = (restaurantId, rolloutId, signal) =>
  fetchPosApi(
    restaurantId,
    `${V2_BASE}/rollouts/${encodeURIComponent(rolloutId)}`,
    {
      signal,
      timeoutMs: 15_000,
    },
  )

export const previewManagedUpdateRollout = (restaurantId, input, signal) =>
  fetchPosApi(restaurantId, `${V2_BASE}/rollouts/preview`, {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
    timeoutMs: 20_000,
  })

export const createManagedUpdateRollout = (restaurantId, input) =>
  postJson(restaurantId, `${V2_BASE}/rollouts`, input, 20_000)

export const mutateManagedUpdateRollout = (
  restaurantId,
  rolloutId,
  action,
  input,
) =>
  postJson(
    restaurantId,
    `${V2_BASE}/rollouts/${encodeURIComponent(rolloutId)}/${encodeURIComponent(action)}`,
    input,
    action === 'prepare-delivery' ? 30_000 : 15_000,
  )

export const mutateManagedUpdateTarget = (
  restaurantId,
  rolloutId,
  targetId,
  action,
  input,
) =>
  postJson(
    restaurantId,
    `${V2_BASE}/rollouts/${encodeURIComponent(rolloutId)}/targets/${encodeURIComponent(targetId)}/${encodeURIComponent(action)}`,
    input,
  )

export const mutateManagedUpdateRelease = (
  restaurantId,
  releaseFamilyId,
  action,
  input,
) =>
  postJson(
    restaurantId,
    `${V2_BASE}/releases/${encodeURIComponent(releaseFamilyId)}/${encodeURIComponent(action)}`,
    input,
  )

// V1 compatibility surfaces stay available while protocol bootstrap completes.
export const fetchDeviceUpdateOverview = (restaurantId, signal) =>
  fetchPosApi(restaurantId, `${legacyBase(restaurantId)}/overview`, {
    signal,
    timeoutMs: 10_000,
  })

export const fetchDeviceUpdateAudit = (restaurantId, signal) =>
  fetchPosApi(restaurantId, `${legacyBase(restaurantId)}/audit?limit=100`, {
    signal,
    timeoutMs: 10_000,
  })

export const createDeviceUpdateDeployment = (restaurantId, input) =>
  postJson(restaurantId, `${legacyBase(restaurantId)}/deployments`, input)

export const cancelDeviceUpdateDeployment = (
  restaurantId,
  deploymentId,
  reason,
) =>
  postJson(
    restaurantId,
    `${legacyBase(restaurantId)}/deployments/${encodeURIComponent(deploymentId)}/cancel`,
    { reason },
  )

export const saveDeviceUpdatePolicy = (restaurantId, input) =>
  fetchPosApi(restaurantId, `${legacyBase(restaurantId)}/policy`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })

export const createDeviceUpdateRelease = (restaurantId, input) =>
  postJson(restaurantId, `${legacyBase(restaurantId)}/releases`, input)

export { scopeQuery }

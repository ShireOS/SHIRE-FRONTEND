import { fetchPosApi } from '../../shared/api/posClient'

const base = (restaurantId) => `/restaurants/${encodeURIComponent(restaurantId)}/device-sync`
const post = (restaurantId, path, body, signal) => fetchPosApi(restaurantId, path, {
  method: 'POST', body: JSON.stringify(body), signal, timeoutMs: 20_000,
})

// Every recovery operation is POS-owned and bound to the explicit store.
export const deviceSyncApi = {
  overview: (restaurantId, signal) => fetchPosApi(restaurantId, `${base(restaurantId)}/overview`, { signal, timeoutMs: 15_000 }),
  run: (restaurantId, runId, signal) => fetchPosApi(restaurantId, `${base(restaurantId)}/runs/${encodeURIComponent(runId)}`, { signal, timeoutMs: 15_000 }),
  inspect: (restaurantId, body, signal) => post(restaurantId, `${base(restaurantId)}/runs`, body, signal),
  confirm: (restaurantId, runId, body, signal) => post(restaurantId, `${base(restaurantId)}/runs/${encodeURIComponent(runId)}/confirm`, body, signal),
  cancel: (restaurantId, runId, body, signal) => post(restaurantId, `${base(restaurantId)}/runs/${encodeURIComponent(runId)}/cancel`, body, signal),
}

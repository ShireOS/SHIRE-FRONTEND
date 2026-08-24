export const ANALYTICS_SUMMARY_BATCH_SIZE = 50

const CARD_METRICS = ['net_sales', 'order_count', 'covers', 'tips']

export function normalizeRestaurantIds(restaurantIds) {
  return [...new Set((restaurantIds || []).filter(Boolean))].sort()
}

export function chunkRestaurantIds(restaurantIds, size = ANALYTICS_SUMMARY_BATCH_SIZE) {
  const ids = normalizeRestaurantIds(restaurantIds)
  const chunks = []
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size))
  }
  return chunks
}

export function validateAnalyticsSummaryPayload(payload, requestedIds) {
  if (!payload || typeof payload !== 'object' || !payload.restaurants || typeof payload.restaurants !== 'object') {
    throw new Error('Restaurant metrics response is unavailable')
  }

  const restaurants = {}
  for (const restaurantId of requestedIds) {
    const summary = payload.restaurants[restaurantId]
    if (!summary || typeof summary !== 'object') {
      throw new Error('Restaurant metrics response is incomplete')
    }
    const normalized = {}
    for (const metric of CARD_METRICS) {
      const rawValue = summary[metric]
      const value = rawValue === null || rawValue === '' ? Number.NaN : Number(rawValue)
      if (!Number.isFinite(value)) {
        throw new Error('Restaurant metrics response is incomplete')
      }
      normalized[metric] = value
    }
    restaurants[restaurantId] = normalized
  }

  return { ...payload, restaurants }
}

export function combineAnalyticsSummaryQueries(chunks, queries) {
  const restaurants = {}
  const restaurantStates = {}
  let firstPayload

  chunks.forEach((chunk, index) => {
    const query = queries[index] || {}
    const payload = query.data
    if (payload && !firstPayload) firstPayload = payload

    for (const restaurantId of chunk) {
      const data = payload?.restaurants?.[restaurantId]
      if (data) {
        restaurants[restaurantId] = data
        restaurantStates[restaurantId] = {
          status: 'success',
          data,
          isUpdating: Boolean(query.isFetching),
          updateFailed: Boolean(query.isError),
        }
      } else if (query.isError) {
        restaurantStates[restaurantId] = {
          status: 'error',
          data: null,
          isUpdating: false,
          updateFailed: false,
        }
      } else {
        restaurantStates[restaurantId] = {
          status: 'loading',
          data: null,
          isUpdating: false,
          updateFailed: false,
        }
      }
    }
  })

  const hasData = Object.keys(restaurants).length > 0
  return {
    data: hasData ? { ...(firstPayload || {}), restaurants } : undefined,
    restaurantStates,
    hasData,
    isPending: queries.some((query) => query.isPending),
    isFetching: queries.some((query) => query.isFetching),
    isError: queries.some((query) => query.isError),
    error: queries.find((query) => query.error)?.error || null,
  }
}

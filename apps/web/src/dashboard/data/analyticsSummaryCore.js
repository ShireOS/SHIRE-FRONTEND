export const ANALYTICS_SUMMARY_BATCH_SIZE = 50

const CARD_METRICS = ['net_sales', 'order_count', 'covers', 'tips']
const INCOMPLETE_METRICS_ERROR = new Error('Some restaurant metrics are unavailable')

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
  const unavailableRestaurantIds = []
  for (const restaurantId of requestedIds) {
    const summary = payload.restaurants[restaurantId]
    if (!summary || typeof summary !== 'object') {
      unavailableRestaurantIds.push(restaurantId)
      continue
    }
    const normalized = {}
    let complete = true
    for (const metric of CARD_METRICS) {
      const rawValue = summary[metric]
      const value = rawValue === null || rawValue === '' ? Number.NaN : Number(rawValue)
      if (!Number.isFinite(value)) {
        complete = false
        break
      }
      normalized[metric] = value
    }
    if (complete) {
      restaurants[restaurantId] = normalized
    } else {
      unavailableRestaurantIds.push(restaurantId)
    }
  }

  return { ...payload, restaurants, unavailableRestaurantIds }
}

export function analyticsSummaryQueryNeedsRetry(restaurantIds, query) {
  if (query?.isError) return true
  if (!query?.data || query.isPlaceholderData) return false
  return restaurantIds.some((restaurantId) => !query.data.restaurants?.[restaurantId])
}

export function combineAnalyticsSummaryQueries(chunks, queries) {
  const restaurants = {}
  const restaurantStates = {}
  let hasIncompleteData = false
  let firstPayload

  chunks.forEach((chunk, index) => {
    const query = queries[index] || {}
    const payload = query.data
    if (payload && !firstPayload) firstPayload = payload
    const unavailableIds = new Set(payload?.unavailableRestaurantIds || [])

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
      } else if (query.isError || unavailableIds.has(restaurantId)) {
        hasIncompleteData = true
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
  const queryError = queries.find((query) => query.error)?.error || null
  return {
    data: hasData ? { ...(firstPayload || {}), restaurants } : undefined,
    restaurantStates,
    hasData,
    isPending: queries.some((query) => query.isPending),
    isFetching: queries.some((query) => query.isFetching),
    isError: hasIncompleteData || queries.some((query) => query.isError),
    error: queryError || (hasIncompleteData ? INCOMPLETE_METRICS_ERROR : null),
  }
}

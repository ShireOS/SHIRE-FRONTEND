import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQueries } from '@tanstack/react-query'
import { fetchWithSupabaseAuth, queryClient, queryKeys, STALE_TIMES } from '../../shared/query'
import {
  analyticsSummaryQueryNeedsRetry,
  chunkRestaurantIds,
  combineAnalyticsSummaryQueries,
  normalizeRestaurantIds,
  validateAnalyticsSummaryPayload,
} from './analyticsSummaryCore'

/**
 * Period selection that survives navigation and reloads. One key per surface
 * so Overview and a store's Home can hold different periods.
 */
export function usePersistedPeriod(storageKey, fallback = 'week') {
  const [period, setPeriod] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    return ['day', 'week', 'month', 'year', 'full'].includes(saved) ? saved : fallback
  })
  useEffect(() => {
    localStorage.setItem(storageKey, period)
  }, [storageKey, period])
  return [period, setPeriod]
}

/**
 * One optimized request per 50 stores. Each response is validated before it is
 * cached so a truncated or partial response can never masquerade as zero data.
 */
export function analyticsSummaryQueryOptions(restaurantIds, period) {
  const ids = normalizeRestaurantIds(restaurantIds)
  const params = new URLSearchParams({
    restaurant_ids: ids.join(','),
    period,
    view: 'cards',
  })
  return {
    queryKey: queryKeys.analyticsSummary(ids, period),
    queryFn: async ({ signal } = {}) => {
      const payload = await fetchWithSupabaseAuth(
        `/owner-analytics/summary?${params.toString()}`,
        { signal },
      )
      return validateAnalyticsSummaryPayload(payload, ids)
    },
    staleTime: STALE_TIMES.analytics,
    retry: false,
    placeholderData: keepPreviousData,
  }
}

export function prefetchAnalyticsSummary(restaurantIds, period = 'week') {
  return Promise.all(
    chunkRestaurantIds(restaurantIds).map((ids) =>
      queryClient.prefetchQuery(analyticsSummaryQueryOptions(ids, period))
    ),
  )
}

export function useAnalyticsSummary(restaurantIds, period) {
  const idsKey = (restaurantIds || []).filter(Boolean).join(',')
  const chunks = useMemo(
    () => chunkRestaurantIds(restaurantIds),
    // The caller owns the array; the serialized IDs make the dependency stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey],
  )
  const queries = useQueries({
    queries: chunks.map((ids) => analyticsSummaryQueryOptions(ids, period)),
  })
  const combined = combineAnalyticsSummaryQueries(chunks, queries)

  return {
    ...combined,
    refetch: () => Promise.all(
      queries
        .filter((query, index) => analyticsSummaryQueryNeedsRetry(chunks[index], query))
        .map((query) => query.refetch()),
    ),
  }
}

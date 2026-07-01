import { useQuery } from '@tanstack/react-query'
import { fetchWithSupabaseAuth, STALE_TIMES } from '../../shared/query'

/**
 * Batch KPI summary for many stores in ONE request (vs. a full owner-analytics
 * payload per store — 8 sequential section builders each). Callers should fall
 * back to per-store queries when this errors (older deployed backend).
 */
export function useAnalyticsSummary(restaurantIds, period) {
  const ids = [...(restaurantIds || [])].sort()
  return useQuery({
    queryKey: ['analytics-summary', ids.join(','), period],
    queryFn: () =>
      fetchWithSupabaseAuth(
        `/owner-analytics/summary?restaurant_ids=${ids.join(',')}&period=${period}`
      ),
    enabled: ids.length > 0,
    staleTime: STALE_TIMES.analytics,
    retry: false,
  })
}

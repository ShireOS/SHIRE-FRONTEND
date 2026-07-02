import { useEffect, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchWithSupabaseAuth, STALE_TIMES } from '../../shared/query'

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
    // Keep the previous period's numbers on screen while the next loads —
    // no flash of zeros/dashes when switching Day/Week/Month/Year.
    placeholderData: keepPreviousData,
  })
}

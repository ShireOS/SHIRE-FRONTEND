// Hook for fetching individual waiter dashboard

import { useCallback } from 'react'
import { useApiQuery } from './useApiQuery'
import { waiterApi } from '../api/waiterApi'
import { transformWaiterDashboard } from '../utils/dataTransformers'
import type { StaffMember } from '../types/api'

/**
 * Fetch full dashboard data for a single waiter
 */
export function useWaiterDashboard(waiterId: string | undefined) {
  const fetchFn = useCallback(async (): Promise<StaffMember | null> => {
    if (!waiterId) return null
    const data = await waiterApi.getDashboard(waiterId)
    return transformWaiterDashboard(data)
  }, [waiterId])

  return useApiQuery(fetchFn, [waiterId])
}

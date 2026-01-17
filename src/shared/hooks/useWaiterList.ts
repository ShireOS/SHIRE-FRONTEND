// Hook for fetching waiter list

import { useCallback } from 'react'
import { useApiQuery } from './useApiQuery'
import { restaurantApi } from '../api/waiterApi'
import { transformWaiterListItem, transformToStaffToday } from '../utils/dataTransformers'
import type { StaffMember } from '../types/api'

/**
 * Fetch all waiters for the restaurant and transform to frontend format
 */
export function useWaiterList() {
  const fetchFn = useCallback(async (): Promise<StaffMember[]> => {
    const data = await restaurantApi.getWaiters()
    return data.map(transformWaiterListItem)
  }, [])

  return useApiQuery(fetchFn, [])
}

/**
 * Fetch waiters formatted for the leaderboard/staffToday display
 */
export function useStaffToday() {
  const fetchFn = useCallback(async () => {
    const data = await restaurantApi.getWaiters()
    return transformToStaffToday(data)
  }, [])

  return useApiQuery(fetchFn, [])
}

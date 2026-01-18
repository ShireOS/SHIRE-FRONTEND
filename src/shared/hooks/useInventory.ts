// Hooks for fetching inventory/shopping list data

import { useCallback } from 'react'
import { useApiQuery } from './useApiQuery'
import { inventoryApi } from '../api/inventoryApi'

/**
 * Fetch shopping list with forecasted ingredient needs
 */
export function useShoppingList(
  restaurantId?: string,
  forecastDays = 7,
  lookbackDays = 30
) {
  const fetchFn = useCallback(async () => {
    return inventoryApi.getShoppingList(restaurantId, forecastDays, lookbackDays)
  }, [restaurantId, forecastDays, lookbackDays])

  return useApiQuery(fetchFn, [restaurantId, forecastDays, lookbackDays])
}

/**
 * Fetch stock alerts for items below par level
 */
export function useStockAlerts(restaurantId?: string) {
  const fetchFn = useCallback(async () => {
    return inventoryApi.getStockAlerts(restaurantId)
  }, [restaurantId])

  return useApiQuery(fetchFn, [restaurantId])
}

// Hooks for fetching menu analytics data

import { useCallback } from 'react'
import { useApiQuery } from './useApiQuery'
import { menuApi, restaurantApi } from '../api/menuApi'

/**
 * Fetch top performing menu items
 */
export function useMenuTopRankings(
  restaurantId?: string,
  lookbackDays = 30,
  limit = 10
) {
  const fetchFn = useCallback(async () => {
    return menuApi.getTopRankings(restaurantId, lookbackDays, limit)
  }, [restaurantId, lookbackDays, limit])

  return useApiQuery(fetchFn, [restaurantId, lookbackDays, limit])
}

/**
 * Fetch worst performing menu items
 */
export function useMenuBottomRankings(
  restaurantId?: string,
  lookbackDays = 30,
  limit = 10
) {
  const fetchFn = useCallback(async () => {
    return menuApi.getBottomRankings(restaurantId, lookbackDays, limit)
  }, [restaurantId, lookbackDays, limit])

  return useApiQuery(fetchFn, [restaurantId, lookbackDays, limit])
}

/**
 * Fetch 86 recommendations
 */
export function useMenu86Recommendations(
  restaurantId?: string,
  lookbackDays = 30,
  scoreThreshold = 25.0
) {
  const fetchFn = useCallback(async () => {
    return menuApi.get86Recommendations(
      restaurantId,
      lookbackDays,
      scoreThreshold
    )
  }, [restaurantId, lookbackDays, scoreThreshold])

  return useApiQuery(fetchFn, [restaurantId, lookbackDays, scoreThreshold])
}

/**
 * Fetch currently 86'd items
 */
export function useMenu86dItems(restaurantId?: string) {
  const fetchFn = useCallback(async () => {
    return menuApi.get86dItems(restaurantId)
  }, [restaurantId])

  return useApiQuery(fetchFn, [restaurantId])
}

/**
 * Fetch all restaurants
 */
export function useRestaurants() {
  const fetchFn = useCallback(async () => {
    return restaurantApi.getAll()
  }, [])

  return useApiQuery(fetchFn, [])
}

/**
 * Fetch pricing optimization recommendations
 */
export function usePricingRecommendations(
  restaurantId?: string,
  lookbackDays = 30
) {
  const fetchFn = useCallback(async () => {
    return menuApi.getPricingRecommendations(restaurantId, lookbackDays)
  }, [restaurantId, lookbackDays])

  return useApiQuery(fetchFn, [restaurantId, lookbackDays])
}

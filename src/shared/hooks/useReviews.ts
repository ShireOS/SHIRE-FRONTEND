// Custom hooks for Review Management
// Follows established useApiQuery pattern from existing hooks

import { useCallback, useState } from 'react'
import { reviewApi } from '../api/reviewApi'
import { useApiQuery } from './useApiQuery'
import type {
  ReviewStats,
  ReviewSummary,
  ReviewRead,
  CategorizationResult,
  ApiError,
} from '../types/api'

/**
 * Fetch review statistics with optional polling
 * @param restaurantId - Optional restaurant ID
 * @param enabled - Whether to fetch (default: true)
 */
export function useReviewStats(restaurantId?: string, enabled = true) {
  const fetchFn = useCallback(async (): Promise<ReviewStats | null> => {
    if (!enabled) return null
    return reviewApi.getStats(restaurantId)
  }, [restaurantId, enabled])

  return useApiQuery(fetchFn, [restaurantId, enabled])
}

/**
 * Fetch AI-generated review summary
 * @param restaurantId - Optional restaurant ID
 */
export function useReviewSummary(restaurantId?: string) {
  const fetchFn = useCallback(async (): Promise<ReviewSummary> => {
    return reviewApi.getSummary(restaurantId)
  }, [restaurantId])

  return useApiQuery(fetchFn, [restaurantId])
}

/**
 * Fetch paginated reviews
 * @param restaurantId - Optional restaurant ID
 * @param skip - Pagination offset
 * @param limit - Results per page
 */
export function useReviewsList(
  restaurantId?: string,
  skip = 0,
  limit = 50
) {
  const fetchFn = useCallback(async (): Promise<ReviewRead[]> => {
    return reviewApi.getReviews(restaurantId, skip, limit)
  }, [restaurantId, skip, limit])

  return useApiQuery(fetchFn, [restaurantId, skip, limit])
}

/**
 * Manual categorization trigger
 * Returns mutation function for triggering AI re-processing
 */
export function useCategorizeTrigger(restaurantId?: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [result, setResult] = useState<CategorizationResult | null>(null)

  const trigger = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await reviewApi.triggerCategorization(restaurantId)
      setResult(data)
      return data
    } catch (err) {
      const apiError = err as ApiError
      setError(apiError)
      throw apiError
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  return { trigger, loading, error, result }
}

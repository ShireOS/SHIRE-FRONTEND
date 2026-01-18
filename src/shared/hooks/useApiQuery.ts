// Generic API Query Hook
// Handles loading, error, and refetch states
// NO SILENT FALLBACK - errors are displayed to help debug backend

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ApiError } from '../types/api'
import { API_CONFIG } from '../api/config'

export interface UseApiQueryResult<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
  refetch: () => void
}

export function useApiQuery<T>(
  fetchFn: () => Promise<T>,
  deps: unknown[] = []
): UseApiQueryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async () => {
    // If mock data mode, skip API calls entirely
    if (API_CONFIG.useMockData) {
      console.log('[useApiQuery] Mock mode enabled, skipping API call')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetchFn()
      if (mountedRef.current) {
        setData(result)
        setError(null)

        // ENHANCED LOGGING - Log successful queries
        if (import.meta.env.DEV) {
          console.group('[useApiQuery] ✅ Query succeeded')
          console.log('Data Type:', Array.isArray(result) ? 'array' : typeof result)

          // CRITICAL: Log count for array responses (staff data)
          if (Array.isArray(result)) {
            console.log('🔢 Count:', result.length)
            if (result.length > 0 && result.length <= 3) {
              console.log('Items:', result)
            } else if (result.length > 0) {
              console.log('First 3 Items:', result.slice(0, 3))
            }
          } else {
            console.log('Data:', result)
          }

          console.groupEnd()
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        const apiError = err as ApiError
        setError(apiError)
        // DO NOT fall back to mock data - show the error
        console.error('[useApiQuery] ❌ API call failed:', apiError)
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [fetchFn])

  useEffect(() => {
    mountedRef.current = true
    fetchData()
    return () => {
      mountedRef.current = false
    }
  }, [...deps, fetchData])

  return { data, loading, error, refetch: fetchData }
}

/**
 * Hook that returns data OR falls back to provided fallback data
 * Use this when you want graceful degradation
 */
export function useApiQueryWithFallback<T>(
  fetchFn: () => Promise<T>,
  fallbackData: T,
  deps: unknown[] = []
): UseApiQueryResult<T> & { usingFallback: boolean } {
  const result = useApiQuery(fetchFn, deps)

  const usingFallback = result.error !== null || (API_CONFIG.useMockData && result.data === null)

  return {
    ...result,
    data: result.data ?? (usingFallback ? fallbackData : null),
    usingFallback,
  }
}

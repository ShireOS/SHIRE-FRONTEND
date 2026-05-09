// Hooks for reservation configuration management
// Provides settings, blackouts, and mutation hooks

import { useState, useCallback } from 'react'
import { useApiQuery } from './useApiQuery'
import { reservationApi } from '../api/reservationApi'
import type { ReservationChannelConnection } from '../api/reservationApi'
import type {
  ReservationSettings,
  ReservationBlackout,
  ReservationBlackoutCreate,
  ReservationBlackoutUpdate,
  ApiError,
} from '../types/api'

/**
 * Fetch reservation settings for a location
 */
export function useReservationSettings(locationId?: string) {
  const fetchFn = useCallback(
    () => reservationApi.getSettings(locationId),
    [locationId]
  )
  return useApiQuery<ReservationSettings>(fetchFn, [locationId])
}

/**
 * Update reservation settings (service periods, pacing, channels, defaults)
 */
export function useUpdateReservationSettings(locationId?: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const save = useCallback(
    async (settings: Partial<ReservationSettings>) => {
      setLoading(true)
      setError(null)
      try {
        const result = await reservationApi.updateSettings(settings, locationId)
        return result
      } catch (err) {
        setError(err as ApiError)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [locationId]
  )

  return { save, loading, error }
}

/**
 * Fetch reservation blackouts for a location
 */
export function useReservationBlackouts(locationId?: string) {
  const fetchFn = useCallback(
    () => reservationApi.getBlackouts(locationId),
    [locationId]
  )
  return useApiQuery<ReservationBlackout[]>(fetchFn, [locationId])
}

/**
 * Create a new blackout
 */
export function useCreateBlackout(locationId?: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const create = useCallback(
    async (blackout: ReservationBlackoutCreate) => {
      setLoading(true)
      setError(null)
      try {
        const result = await reservationApi.createBlackout(blackout, locationId)
        return result
      } catch (err) {
        setError(err as ApiError)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [locationId]
  )

  return { create, loading, error }
}

/**
 * Update/cancel a blackout
 */
export function useUpdateBlackout(locationId?: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const update = useCallback(
    async (blackoutId: string, updates: ReservationBlackoutUpdate) => {
      setLoading(true)
      setError(null)
      try {
        const result = await reservationApi.updateBlackout(blackoutId, updates, locationId)
        return result
      } catch (err) {
        setError(err as ApiError)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [locationId]
  )

  return { update, loading, error }
}

export function useGoogleReservationConnection(locationId?: string) {
  const fetchFn = useCallback(
    () => {
      if (!locationId) {
        return Promise.resolve(null)
      }
      return reservationApi.getGoogleConnection(locationId)
    },
    [locationId]
  )

  return useApiQuery<ReservationChannelConnection | null>(fetchFn, [locationId])
}

export function useUpdateGoogleReservationConnection(locationId?: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const save = useCallback(
    async (connection: ReservationChannelConnection) => {
      if (!locationId) {
        throw new Error('No restaurant is selected.')
      }

      setLoading(true)
      setError(null)
      try {
        return await reservationApi.updateGoogleConnection(locationId, connection)
      } catch (err) {
        setError(err as ApiError)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [locationId]
  )

  return { save, loading, error }
}

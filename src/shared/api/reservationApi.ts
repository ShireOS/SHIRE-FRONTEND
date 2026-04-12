// Reservation Configuration API Functions
// Handles service periods, pacing rules, booking channels, and blackouts

import { apiClient } from './client'
import { ENDPOINTS } from './endpoints'
import { API_CONFIG } from './config'
import type {
  ReservationSettings,
  ReservationBlackout,
  ReservationBlackoutCreate,
  ReservationBlackoutUpdate,
} from '../types/api'

export const reservationApi = {
  /**
   * Get reservation settings for a location
   */
  getSettings: async (locationId?: string): Promise<ReservationSettings> => {
    const id = locationId || API_CONFIG.restaurantId
    return apiClient.get<ReservationSettings>(ENDPOINTS.reservationSettings(id))
  },

  /**
   * Update reservation settings (full replace)
   */
  updateSettings: async (
    settings: Partial<ReservationSettings>,
    locationId?: string
  ): Promise<ReservationSettings> => {
    const id = locationId || API_CONFIG.restaurantId
    return apiClient.put<ReservationSettings>(
      ENDPOINTS.reservationSettings(id),
      settings
    )
  },

  /**
   * Get all blackouts for a location
   */
  getBlackouts: async (locationId?: string): Promise<ReservationBlackout[]> => {
    const id = locationId || API_CONFIG.restaurantId
    return apiClient.get<ReservationBlackout[]>(ENDPOINTS.reservationBlackouts(id))
  },

  /**
   * Create a new blackout
   */
  createBlackout: async (
    blackout: ReservationBlackoutCreate,
    locationId?: string
  ): Promise<ReservationBlackout> => {
    const id = locationId || API_CONFIG.restaurantId
    return apiClient.post<ReservationBlackout>(
      ENDPOINTS.reservationBlackouts(id),
      blackout
    )
  },

  /**
   * Update a blackout (e.g. cancel it)
   */
  updateBlackout: async (
    blackoutId: string,
    updates: ReservationBlackoutUpdate,
    locationId?: string
  ): Promise<ReservationBlackout> => {
    const id = locationId || API_CONFIG.restaurantId
    return apiClient.patch<ReservationBlackout>(
      ENDPOINTS.reservationBlackout(id, blackoutId),
      updates
    )
  },
}

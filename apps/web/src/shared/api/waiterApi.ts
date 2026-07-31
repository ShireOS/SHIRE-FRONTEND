// Waiter & Restaurant API Functions

import { apiClient } from './client'
import { ENDPOINTS } from './endpoints'
import { API_CONFIG } from './config'
import type { WaiterListItem } from '../types/api'

export const restaurantApi = {
  /**
   * Fetch all waiters for a restaurant
   */
  getWaiters: (restaurantId?: string): Promise<WaiterListItem[]> => {
    const id = restaurantId || API_CONFIG.restaurantId
    return apiClient.get<WaiterListItem[]>(ENDPOINTS.restaurantWaiters(id))
  },
}

// Re-export for convenience
export { API_CONFIG } from './config'

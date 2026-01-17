// Waiter & Restaurant API Functions

import { apiClient } from './client'
import { ENDPOINTS } from './endpoints'
import { API_CONFIG } from './config'
import type {
  WaiterDashboard,
  WaiterStats,
  TrendDataPoint,
  WaiterInsights,
  RecentShift,
  WaiterListItem,
} from '../types/api'

export const waiterApi = {
  /**
   * Fetch complete dashboard data for a single waiter
   */
  getDashboard: (waiterId: string): Promise<WaiterDashboard> => {
    return apiClient.get<WaiterDashboard>(ENDPOINTS.waiterDashboard(waiterId))
  },

  /**
   * Fetch waiter statistics for a given period
   */
  getStats: (waiterId: string, period = 'month'): Promise<WaiterStats> => {
    return apiClient.get<WaiterStats>(ENDPOINTS.waiterStats(waiterId, period))
  },

  /**
   * Fetch historical trend data
   */
  getTrends: (waiterId: string, months = 6): Promise<TrendDataPoint[]> => {
    return apiClient.get<TrendDataPoint[]>(ENDPOINTS.waiterTrends(waiterId, months))
  },

  /**
   * Fetch AI-generated insights
   */
  getInsights: (waiterId: string): Promise<WaiterInsights> => {
    return apiClient.get<WaiterInsights>(ENDPOINTS.waiterInsights(waiterId))
  },

  /**
   * Fetch recent shifts
   */
  getShifts: (waiterId: string, limit = 10): Promise<RecentShift[]> => {
    return apiClient.get<RecentShift[]>(ENDPOINTS.waiterShifts(waiterId, limit))
  },
}

export const restaurantApi = {
  /**
   * Fetch all waiters for a restaurant
   */
  getWaiters: (restaurantId?: string): Promise<WaiterListItem[]> => {
    const id = restaurantId || API_CONFIG.restaurantId
    return apiClient.get<WaiterListItem[]>(ENDPOINTS.restaurantWaiters(id))
  },

  /**
   * Seed default test data (development only)
   */
  seedDefaultData: (): Promise<{ restaurant_id: string; message: string }> => {
    return apiClient.post(ENDPOINTS.seedDefaultData())
  },

  /**
   * Seed sample data for a restaurant (development only)
   */
  seedSampleData: (
    restaurantId: string,
    daysBack = 30
  ): Promise<{ message: string }> => {
    return apiClient.post(ENDPOINTS.seedSampleData(restaurantId, daysBack))
  },
}

// Re-export for convenience
export { API_CONFIG } from './config'

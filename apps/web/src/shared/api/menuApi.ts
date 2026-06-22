// Menu & Restaurant API Functions

import { apiClient } from './client'
import { ENDPOINTS } from './endpoints'
import { API_CONFIG } from './config'
import type {
  MenuItemRankingResponse,
  MenuItem86RecommendationResponse,
  MenuItem86Response,
  MenuItem86dListResponse,
  Restaurant,
} from '../types/api'

export const menuApi = {
  /**
   * Get top performing menu items
   */
  getTopRankings: (
    restaurantId?: string,
    lookbackDays = 30,
    limit = 10
  ): Promise<MenuItemRankingResponse> => {
    const id = restaurantId || API_CONFIG.restaurantId
    console.log(`[menuApi] Fetching top rankings for restaurant ${id}`)
    return apiClient.get<MenuItemRankingResponse>(
      ENDPOINTS.menuRankingsTop(id, lookbackDays, limit)
    )
  },

  /**
   * Get worst performing menu items
   */
  getBottomRankings: (
    restaurantId?: string,
    lookbackDays = 30,
    limit = 10
  ): Promise<MenuItemRankingResponse> => {
    const id = restaurantId || API_CONFIG.restaurantId
    console.log(`[menuApi] Fetching bottom rankings for restaurant ${id}`)
    return apiClient.get<MenuItemRankingResponse>(
      ENDPOINTS.menuRankingsBottom(id, lookbackDays, limit)
    )
  },

  /**
   * Get 86 recommendations (items that should be removed)
   */
  get86Recommendations: (
    restaurantId?: string,
    lookbackDays = 30,
    scoreThreshold = 25.0
  ): Promise<MenuItem86RecommendationResponse> => {
    const id = restaurantId || API_CONFIG.restaurantId
    console.log(`[menuApi] Fetching 86 recommendations for restaurant ${id}`)
    return apiClient.get<MenuItem86RecommendationResponse>(
      ENDPOINTS.menu86Recommendations(id, lookbackDays, scoreThreshold)
    )
  },

  /**
   * 86 (mark unavailable) a menu item
   */
  mark86: (
    restaurantId: string,
    itemId: string
  ): Promise<MenuItem86Response> => {
    console.log(`[menuApi] Marking item ${itemId} as 86'd`)
    return apiClient.post<MenuItem86Response>(
      ENDPOINTS.menu86Item(restaurantId, itemId)
    )
  },

  /**
   * Un-86 (restore) a menu item
   */
  markUn86: (
    restaurantId: string,
    itemId: string
  ): Promise<MenuItem86Response> => {
    console.log(`[menuApi] Restoring item ${itemId} from 86'd status`)
    return apiClient.post<MenuItem86Response>(
      ENDPOINTS.menuUn86Item(restaurantId, itemId)
    )
  },

  /**
   * Get list of all currently 86'd items
   */
  get86dItems: (restaurantId?: string): Promise<MenuItem86dListResponse> => {
    const id = restaurantId || API_CONFIG.restaurantId
    console.log(`[menuApi] Fetching 86'd items for restaurant ${id}`)
    return apiClient.get<MenuItem86dListResponse>(ENDPOINTS.menu86dItems(id))
  },

  /**
   * Get pricing optimization recommendations
   */
  getPricingRecommendations: (restaurantId?: string, lookbackDays = 30) => {
    const id = restaurantId || API_CONFIG.restaurantId
    console.log(`[menuApi] Fetching pricing recommendations for restaurant ${id}`)
    return apiClient.get(ENDPOINTS.menuPricingRecommendations(id, lookbackDays))
  },
}

export const restaurantApi = {
  /**
   * Get all restaurants
   */
  getAll: (): Promise<Restaurant[]> => {
    console.log('[restaurantApi] Fetching all restaurants')
    return apiClient.get<Restaurant[]>(ENDPOINTS.restaurants())
  },
}

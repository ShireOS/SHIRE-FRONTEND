// Review Management API Functions
// Handles Yelp review statistics, AI summaries, and categorization

import { apiClient } from './client'
import { ENDPOINTS } from './endpoints'
import { API_CONFIG } from './config'
import type {
  ReviewStats,
  ReviewSummary,
  ReviewRead,
  IngestResponse,
  CategorizationResult,
} from '../types/api'

export const reviewApi = {
  /**
   * Get aggregate review statistics
   * Returns overall average, total count, monthly count, rating distribution
   */
  getStats: async (restaurantId?: string): Promise<ReviewStats> => {
    const id = restaurantId || API_CONFIG.restaurantId
    return apiClient.get<ReviewStats>(ENDPOINTS.reviewStats(id))
  },

  /**
   * Get AI-generated review summary with category insights
   * Returns category opinions, overall summary, needs_attention flag
   */
  getSummary: async (restaurantId?: string): Promise<ReviewSummary> => {
    const id = restaurantId || API_CONFIG.restaurantId
    return apiClient.get<ReviewSummary>(ENDPOINTS.reviewSummary(id))
  },

  /**
   * Get paginated list of reviews
   * @param restaurantId - Restaurant ID (optional, uses config default)
   * @param skip - Number of reviews to skip (for pagination)
   * @param limit - Number of reviews to return (max 200)
   */
  getReviews: async (
    restaurantId?: string,
    skip = 0,
    limit = 50
  ): Promise<ReviewRead[]> => {
    const id = restaurantId || API_CONFIG.restaurantId
    return apiClient.get<ReviewRead[]>(ENDPOINTS.reviewsList(id, skip, limit))
  },

  /**
   * Upload JSON file with scraped reviews
   * @param restaurantId - Restaurant ID
   * @param file - JSON file with ReviewCreate[] array
   */
  ingestReviews: async (
    file: File,
    restaurantId?: string
  ): Promise<IngestResponse> => {
    const id = restaurantId || API_CONFIG.restaurantId
    const formData = new FormData()
    formData.append('file', file)

    const url = `${API_CONFIG.baseUrl}${ENDPOINTS.reviewsIngest(id)}`

    if (import.meta.env.DEV) {
      console.log(`[API] POST ${url}`)
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      // No Content-Type header - browser sets multipart/form-data automatically
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw {
        status: response.status,
        message: errorData.detail || 'Upload failed',
        endpoint: ENDPOINTS.reviewsIngest(id),
      }
    }

    return response.json()
  },

  /**
   * Manually trigger AI categorization of pending reviews
   * Synchronous operation - waits for all batches to complete
   */
  triggerCategorization: async (
    restaurantId?: string
  ): Promise<CategorizationResult> => {
    const id = restaurantId || API_CONFIG.restaurantId
    return apiClient.post<CategorizationResult>(
      ENDPOINTS.reviewsCategorize(id)
    )
  },
}

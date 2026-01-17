// API Client with Error Handling
// NO SILENT FALLBACK - errors are shown to help debug backend

import { API_CONFIG, getApiUrl } from './config'
import type { ApiError } from '../types/api'

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = getApiUrl(endpoint)

    // Log request in dev
    if (import.meta.env.DEV) {
      console.log(`[API] ${options.method || 'GET'} ${url}`)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        let errorDetails: unknown = undefined

        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorData.message || errorMessage
          errorDetails = errorData
        } catch {
          // Response wasn't JSON
        }

        const error: ApiError = {
          status: response.status,
          message: errorMessage,
          details: errorDetails,
          endpoint: endpoint,
        }

        // Log error clearly
        console.error(`[API ERROR] ${endpoint}:`, error)

        throw error
      }

      const data = await response.json()

      // Log successful response in dev
      if (import.meta.env.DEV) {
        console.log(`[API] Response from ${endpoint}:`, data)
      }

      return data
    } catch (error) {
      clearTimeout(timeoutId)

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError: ApiError = {
          status: 408,
          message: `Request timeout after ${API_CONFIG.timeout / 1000}s - is the backend running?`,
          endpoint: endpoint,
        }
        console.error(`[API TIMEOUT] ${endpoint}:`, timeoutError)
        throw timeoutError
      }

      // Handle network errors (backend not running)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError: ApiError = {
          status: 0,
          message: `Cannot connect to ${API_CONFIG.baseUrl} - is the backend running?`,
          endpoint: endpoint,
          details: error.message,
        }
        console.error(`[API NETWORK ERROR] ${endpoint}:`, networkError)
        throw networkError
      }

      // Re-throw ApiError as-is
      if ((error as ApiError).status !== undefined) {
        throw error
      }

      // Unknown error
      const unknownError: ApiError = {
        status: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
        endpoint: endpoint,
        details: error,
      }
      console.error(`[API ERROR] ${endpoint}:`, unknownError)
      throw unknownError
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const apiClient = new ApiClient()

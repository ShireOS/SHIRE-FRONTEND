// API Configuration
// Reads from environment variables set in .env.development or .env.production

export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 10000, // 10 seconds
  useMockData: import.meta.env.VITE_USE_MOCK_DATA === 'true',
  restaurantId: import.meta.env.VITE_RESTAURANT_ID || 'default',
}

export const getApiUrl = (endpoint: string): string => {
  const url = `${API_CONFIG.baseUrl}${endpoint}`
  return url
}

// Log config on startup (only in dev)
if (import.meta.env.DEV) {
  console.log('[API Config]', {
    baseUrl: API_CONFIG.baseUrl,
    useMockData: API_CONFIG.useMockData,
    restaurantId: API_CONFIG.restaurantId,
  })
}

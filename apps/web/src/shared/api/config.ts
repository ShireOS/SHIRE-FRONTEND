// API Configuration
// Reads from environment variables set in .env.development or .env.production

export const API_CONFIG = {
  // Keep dashboard traffic same-origin by default. Vite and Vercel proxy this
  // mount to Restaurant ML, avoiding browser CORS and localhost build leaks.
  baseUrl: import.meta.env.VITE_API_BASE_URL || '/ml-api',
  publicSiteUrl: import.meta.env.VITE_PUBLIC_SITE_URL || '',
  timeout: 10000, // 10 seconds
  useMockData: import.meta.env.VITE_USE_MOCK_DATA === 'true',
  restaurantId: import.meta.env.VITE_RESTAURANT_ID || 'default',
  // Debug mode - always true in dev
  debug: import.meta.env.DEV,
}

export const getApiUrl = (endpoint: string): string => {
  const url = `${API_CONFIG.baseUrl}${endpoint}`
  return url
}

// ===========================================
// DEBUG LOGGING - Check your browser console!
// ===========================================
if (import.meta.env.DEV) {
  console.log('%c=== SHIRE API CONFIG ===', 'background: #3B82F6; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;')
  console.log('%cAPI Base URL:', 'color: #10B981; font-weight: bold;', API_CONFIG.baseUrl)
  console.log('%cRestaurant ID:', 'color: #10B981; font-weight: bold;', API_CONFIG.restaurantId)
  console.log('%cMock Data Mode:', 'color: #10B981; font-weight: bold;', API_CONFIG.useMockData ? 'ON (no API calls)' : 'OFF (calling real API)')
  console.log('%cDebug Mode:', 'color: #10B981; font-weight: bold;', API_CONFIG.debug ? 'ON' : 'OFF')
  console.log('')
  console.log('%c⚠️  If you see "Failed to fetch" errors:', 'color: #F59E0B; font-weight: bold;')
  console.log('%c   1. Make sure your backend is running at:', 'color: #6B7280;', API_CONFIG.baseUrl)
  console.log('%c   2. Or set VITE_USE_MOCK_DATA=true in .env.development to use mock data', 'color: #6B7280;')
  console.log('%c=============================', 'background: #3B82F6; color: white; padding: 4px 8px; border-radius: 4px;')
}

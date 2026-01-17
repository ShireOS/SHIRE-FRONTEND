// API Endpoint Definitions
// All endpoints for the Waiter Intelligence Backend

export const ENDPOINTS = {
  // Waiter endpoints
  waiterDashboard: (waiterId: string) => `/waiters/${waiterId}/dashboard`,
  waiterStats: (waiterId: string, period = 'month') =>
    `/waiters/${waiterId}/stats?period=${period}`,
  waiterTrends: (waiterId: string, months = 6) =>
    `/waiters/${waiterId}/trends?months=${months}`,
  waiterInsights: (waiterId: string) => `/waiters/${waiterId}/insights`,
  waiterShifts: (waiterId: string, limit = 10) =>
    `/waiters/${waiterId}/shifts?limit=${limit}`,

  // Restaurant endpoints
  restaurantWaiters: (restaurantId: string) =>
    `/restaurants/${restaurantId}/waiters`,

  // Seeding endpoints (for development)
  seedDefaultData: () => '/seed/default-data',
  seedSampleData: (restaurantId: string, daysBack = 30) =>
    `/restaurants/${restaurantId}/seed/sample-data?days_back=${daysBack}`,

  // Health check
  health: () => '/healthz',
}

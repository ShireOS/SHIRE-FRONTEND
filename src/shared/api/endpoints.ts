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
  restaurants: () => '/restaurants',
  restaurantWaiters: (restaurantId: string) =>
    `/restaurants/${restaurantId}/waiters`,

  // Menu rankings
  menuRankingsTop: (restaurantId: string, lookbackDays = 30, limit = 10) =>
    `/restaurants/${restaurantId}/menu/rankings/top?lookback_days=${lookbackDays}&limit=${limit}`,
  menuRankingsBottom: (restaurantId: string, lookbackDays = 30, limit = 10) =>
    `/restaurants/${restaurantId}/menu/rankings/bottom?lookback_days=${lookbackDays}&limit=${limit}`,

  // Menu optimization
  menuPricingRecommendations: (restaurantId: string, lookbackDays = 30) =>
    `/restaurants/${restaurantId}/menu/pricing-recommendations?lookback_days=${lookbackDays}`,

  // 86 Management
  menu86Recommendations: (
    restaurantId: string,
    lookbackDays = 30,
    scoreThreshold = 25.0
  ) =>
    `/restaurants/${restaurantId}/menu/86-recommendations?lookback_days=${lookbackDays}&score_threshold=${scoreThreshold}`,
  menu86Item: (restaurantId: string, itemId: string) =>
    `/restaurants/${restaurantId}/menu/items/${itemId}/86`,
  menuUn86Item: (restaurantId: string, itemId: string) =>
    `/restaurants/${restaurantId}/menu/items/${itemId}/un-86`,
  menu86dItems: (restaurantId: string) =>
    `/restaurants/${restaurantId}/menu/items/86d`,

  // Seeding endpoints (for development)
  seedDefaultData: () => '/seed/default-data',
  seedDemo: () => '/seed/demo',  // Creates full demo data with waiters, sections, tables relationships
  seedSampleData: (restaurantId: string, daysBack = 30) =>
    `/restaurants/${restaurantId}/seed/sample-data?days_back=${daysBack}`,

  // Scheduling endpoints
  schedules: (restaurantId: string, weekStart?: string) =>
    `/restaurants/${restaurantId}/schedules${weekStart ? `?week_start=${weekStart}` : ''}`,
  scheduleById: (scheduleId: string) => `/schedules/${scheduleId}`,
  scheduleItems: (scheduleId: string) => `/schedules/${scheduleId}/items`,
  createScheduleItem: (scheduleId: string) => `/schedules/${scheduleId}/items`,
  updateScheduleItem: (itemId: string) => `/schedule-items/${itemId}`,
  deleteScheduleItem: (itemId: string) => `/schedule-items/${itemId}`,
  publishSchedule: (scheduleId: string) => `/schedules/${scheduleId}/publish`,
  runScheduler: (restaurantId: string) => `/restaurants/${restaurantId}/schedules/run`,
  schedulerStatus: (runId: string) => `/schedule-runs/${runId}`,
  staffingRequirements: (restaurantId: string) =>
    `/restaurants/${restaurantId}/staffing-requirements`,
  staffAvailability: (waiterId: string) => `/staff/${waiterId}/availability`,
  staffPreferences: (waiterId: string) => `/staff/${waiterId}/preferences`,

  // Review Management endpoints
  reviewStats: (restaurantId: string) =>
    `/reviews/${restaurantId}/stats`,
  reviewSummary: (restaurantId: string) =>
    `/reviews/${restaurantId}/summary`,
  reviewsList: (restaurantId: string, skip = 0, limit = 50) =>
    `/reviews/${restaurantId}/reviews?skip=${skip}&limit=${limit}`,
  reviewsIngest: (restaurantId: string) =>
    `/reviews/${restaurantId}/ingest`,
  reviewsCategorize: (restaurantId: string) =>
    `/reviews/${restaurantId}/categorize`,
  // Inventory endpoints
  inventoryShoppingList: (restaurantId: string, forecastDays = 7, lookbackDays = 30) =>
    `/restaurants/${restaurantId}/inventory/shopping-list?forecast_days=${forecastDays}&lookback_days=${lookbackDays}`,
  inventoryStockAlerts: (restaurantId: string) =>
    `/restaurants/${restaurantId}/inventory/stock-alerts`,

  // Chat endpoints
  chatMessage: (restaurantId: string) => `/chat/${restaurantId}/message`,

  // Health check
  health: () => '/healthz',

  // Demo endpoints
  demoInitiate: () => '/demo/initiate',
  demoStop: () => '/demo/stop',
  demoStatus: () => '/demo/status',
  demoSummary: (restaurantId: string, minCapacity = 1) =>
    `/restaurants/${restaurantId}/demo/summary?min_capacity=${minCapacity}`,

  // Host app endpoints
  restaurantTables: (restaurantId: string) =>
    `/restaurants/${restaurantId}/tables`,
  restaurantSections: (restaurantId: string) =>
    `/restaurants/${restaurantId}/sections`,
  restaurantServers: (restaurantId: string) =>
    `/restaurants/${restaurantId}/servers`,
  routingRecommend: (restaurantId: string) =>
    `/restaurants/${restaurantId}/routing/recommend`,
}

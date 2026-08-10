// API Endpoint Definitions
// All endpoints for the Waiter Intelligence Backend

export const ENDPOINTS = {
  // Restaurant endpoints
  restaurants: () => '/restaurants',
  restaurantWaiters: (restaurantId: string) =>
    `/restaurants/${restaurantId}/waiters`,

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

  // Reservation configuration endpoints
  reservationSettings: (locationId: string) =>
    `/locations/${locationId}/reservation-settings`,
  reservationBlackouts: (locationId: string) =>
    `/locations/${locationId}/reservation-blackouts`,
  reservationBlackout: (locationId: string, blackoutId: string) =>
    `/locations/${locationId}/reservation-blackouts/${blackoutId}`,
  reservationChannelConnection: (locationId: string, channel: string) =>
    `/locations/${locationId}/reservation-channel-connections/${channel}`,
  publicSlug: (locationId: string) =>
    `/locations/${locationId}/public-slug`,
  publicBookableLocation: (slug: string) =>
    `/public/bookable-locations/${encodeURIComponent(slug)}`,
  publicBookingConfig: (locationId: string) =>
    `/public/locations/${locationId}/booking-config`,
  publicAvailability: (locationId: string, serviceDate: string, partySize: number, channel = 'google') =>
    `/public/locations/${locationId}/availability?service_date=${encodeURIComponent(serviceDate)}&party_size=${partySize}&channel=${encodeURIComponent(channel)}`,
  publicReservations: (locationId: string) =>
    `/public/locations/${locationId}/reservations`,
}

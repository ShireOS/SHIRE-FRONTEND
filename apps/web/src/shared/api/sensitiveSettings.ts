import { fetchWithSupabaseAuth } from '../query/fetchWithSupabaseAuth'

export type RestaurantSensitiveSettings = {
  ein_configured: boolean
  ein_last4: string | null
  signature_configured: boolean
  tos_signed_at: string | null
  bank_account_holder: string
  bank_name: string
  bank_routing_configured: boolean
  bank_routing_last4: string | null
  bank_account_configured: boolean
  bank_account_last4: string | null
}

export const fetchRestaurantSensitiveSettings = (restaurantId: string) =>
  fetchWithSupabaseAuth<RestaurantSensitiveSettings>(`/restaurants/${restaurantId}/sensitive-settings`)

export const saveRestaurantSensitiveSettings = (
  restaurantId: string,
  patch: Record<string, unknown>,
) => fetchWithSupabaseAuth<RestaurantSensitiveSettings>(`/restaurants/${restaurantId}/sensitive-settings`, {
  method: 'PATCH',
  body: JSON.stringify({ patch }),
})

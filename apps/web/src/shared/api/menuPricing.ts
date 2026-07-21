import { fetchWithSupabaseAuth } from '../query/fetchWithSupabaseAuth'

export type PricingTiming = 'now' | 'scheduled' | 'window' | 'weekly'
export type PricingScope = 'item' | 'category' | 'all'
export type PricingAdjustment = 'percent_off' | 'amount_off' | 'percent_up' | 'amount_up' | 'fixed'

export type PricingChangeInput = {
  name: string
  restaurant_ids: string[]
  scope_type: PricingScope
  item_ids: string[]
  category_ids: string[]
  adjustment_type: PricingAdjustment
  adjustment_value: number
  timing: PricingTiming
  start_date?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  days_of_week?: number[]
  priority?: number
}

const base = (restaurantId: string) => `/restaurants/${restaurantId}/menu/pricing`

export const getPricingWorkspace = (restaurantId: string) =>
  fetchWithSupabaseAuth<any>(base(restaurantId))

export const previewPricingChange = (restaurantId: string, body: PricingChangeInput) =>
  fetchWithSupabaseAuth<any>(`${base(restaurantId)}/preview`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const applyPricingChange = (restaurantId: string, body: PricingChangeInput) =>
  fetchWithSupabaseAuth<any>(`${base(restaurantId)}/apply`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const updatePricingBatch = (
  restaurantId: string,
  batchId: string,
  restaurantIds: string[],
  action: 'pause' | 'resume' | 'archive',
) => fetchWithSupabaseAuth<any>(`${base(restaurantId)}/batches/${batchId}`, {
  method: 'PATCH',
  body: JSON.stringify({ restaurant_ids: restaurantIds, action }),
})

export const getPricingSpecials = (restaurantId: string) =>
  fetchWithSupabaseAuth<any[]>(`${base(restaurantId)}/specials`)

export const createPricingSpecial = (restaurantId: string, body: Record<string, unknown>) =>
  fetchWithSupabaseAuth<any>(`${base(restaurantId)}/specials`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const updatePricingSpecial = (restaurantId: string, specialId: string, body: Record<string, unknown>) =>
  fetchWithSupabaseAuth<any>(`${base(restaurantId)}/specials/${specialId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const archivePricingSpecial = (restaurantId: string, specialId: string) =>
  fetchWithSupabaseAuth<any>(`${base(restaurantId)}/specials/${specialId}`, { method: 'DELETE' })

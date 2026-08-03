import { supabase } from '../../shared/lib/supabase'
import { queryClient, queryKeys, fetchWithSupabaseAuth } from '../../shared/query'

export const PRICING_MODES = [
  { value: 'dual_pricing_posted_electronic', label: 'Dual pricing' },
  { value: 'cash_discount', label: 'Cash discount' },
  { value: 'credit_surcharge', label: 'Credit surcharge' },
  { value: 'none', label: 'No adjustment' },
]

export const TENDER_OPTIONS = [
  { value: 'card', label: 'Card' },
  { value: 'credit', label: 'Credit' },
  { value: 'debit', label: 'Debit' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'gift_card', label: 'Gift card' },
  { value: 'standalone', label: 'Standalone' },
  { value: 'external', label: 'External card terminal' },
]

export const DEFAULT_RATE_PLAN = {
  card_rate: 0.035,
  pricing_mode: 'dual_pricing_posted_electronic',
  dual_pricing_enabled: true,
  listed_price_basis: 'electronic',
  display_order: 'electronic_first',
  applies_to: ['card', 'credit', 'debit', 'terminal', 'gift_card', 'standalone', 'external'],
  basis: 'subtotal_plus_tax',
  version: 0,
}

const pricingCopyForMode = (mode, listedPriceBasis = 'electronic') => {
  if (mode === 'cash_discount') {
    return {
      label: 'Cash discount',
      disclosure: 'Posted total is shown before payment. Cash payments receive the listed cash discount.',
    }
  }
  if (mode === 'credit_surcharge') {
    return {
      label: 'Credit surcharge',
      disclosure: 'A card fee applies only to eligible card payments and is shown before payment.',
    }
  }
  if (mode === 'none') return { label: 'Pricing adjustment', disclosure: '' }
  return listedPriceBasis === 'cash'
    ? {
        label: 'Dual pricing',
        disclosure: 'Cash price is listed. Eligible electronic payments include the configured price adjustment.',
      }
    : {
        label: 'Dual pricing',
        disclosure: 'Electronic price is listed. The corresponding cash price is calculated using inverse dual-pricing math.',
      }
}

export const formatRate = (rate) =>
  rate === null || rate === undefined ? '—' : `${(Number(rate) * 100).toFixed(2).replace(/\.?0+$/, '')}%`

export function pricingPolicyToRatePlan(restaurantId, policy = {}) {
  const listed = ['cash', 'electronic'].includes(policy.listed_price_basis)
    ? policy.listed_price_basis
    : ['credit_surcharge', 'service_fee_all', 'none'].includes(policy.mode) ? 'cash' : 'electronic'
  return {
    id: policy.id,
    restaurant_id: restaurantId,
    card_rate: Number(policy.rate) || 0,
    pricing_mode: policy.mode || 'none',
    dual_pricing_enabled: policy.enabled !== false,
    listed_price_basis: listed,
    display_order: ['cash_first', 'electronic_first'].includes(policy.display_order)
      ? policy.display_order
      : `${listed}_first`,
    applies_to: policy.applies_to || DEFAULT_RATE_PLAN.applies_to,
    basis: policy.basis || DEFAULT_RATE_PLAN.basis,
    version: Number(policy.version) || 0,
    label: policy.label,
    disclosure: policy.disclosure,
  }
}

function ratePlanToPolicy(plan) {
  return {
    enabled: plan.pricing_mode !== 'none' && plan.dual_pricing_enabled !== false,
    mode: plan.pricing_mode,
    rate: Number(plan.card_rate) || 0,
    basis: plan.basis || 'subtotal_plus_tax',
    listed_price_basis: plan.listed_price_basis || DEFAULT_RATE_PLAN.listed_price_basis,
    display_order: plan.display_order || `${plan.listed_price_basis || DEFAULT_RATE_PLAN.listed_price_basis}_first`,
    applies_to: plan.applies_to || DEFAULT_RATE_PLAN.applies_to,
    expected_version: Number.isFinite(Number(plan.version)) ? Number(plan.version) : undefined,
    ...pricingCopyForMode(plan.pricing_mode, plan.listed_price_basis),
  }
}

export async function fetchRatePlans(restaurantIds) {
  if (!restaurantIds?.length) return {}
  const entries = await Promise.all(restaurantIds.map(async (restaurantId) => {
    const policy = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/pricing-policy`)
    queryClient.setQueryData(queryKeys.pricingPolicy(restaurantId), policy)
    return [restaurantId, pricingPolicyToRatePlan(restaurantId, policy)]
  }))
  return Object.fromEntries(entries)
}

export async function fetchPendingRateRequests(restaurantIds) {
  if (!restaurantIds?.length) return []
  const { data, error } = await supabase
    .from('rate_change_requests')
    .select('*')
    .in('restaurant_id', restaurantIds)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function upsertRatePlan(restaurantId, plan) {
  const saved = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/pricing-policy`, {
    method: 'PUT',
    body: JSON.stringify(ratePlanToPolicy(plan)),
  })
  queryClient.setQueryData(queryKeys.pricingPolicy(restaurantId), saved)
  return pricingPolicyToRatePlan(restaurantId, saved)
}

export async function createRateChangeRequest({ restaurantId, currentRate, proposedPlan, userId, message }) {
  const { data, error } = await supabase
    .from('rate_change_requests')
    .insert({
      restaurant_id: restaurantId,
      requested_by: userId,
      current_rate: currentRate,
      proposed_rate: proposedPlan.card_rate,
      proposed_changes: proposedPlan,
      message: message || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function resolveRateChangeRequest(request, status) {
  const result = await fetchWithSupabaseAuth(
    `/restaurants/${request.restaurant_id}/pricing-policy/rate-change-requests/${request.id}/resolve`,
    { method: 'POST', body: JSON.stringify({ status }) },
  )
  if (result?.pricing_policy) {
    queryClient.setQueryData(queryKeys.pricingPolicy(request.restaurant_id), result.pricing_policy)
  }
  return result
}

export async function cancelRateChangeRequest(requestId) {
  const { error } = await supabase
    .from('rate_change_requests')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw error
}

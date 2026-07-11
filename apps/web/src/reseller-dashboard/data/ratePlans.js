import { supabase } from '../../shared/lib/supabase'
import { queryClient, queryKeys, fetchWithSupabaseAuth } from '../../shared/query'

export const PRICING_MODES = [
  { value: 'dual_pricing_posted_electronic', label: 'Dual pricing (posted electronic)' },
  { value: 'cash_discount', label: 'Cash discount' },
  { value: 'credit_surcharge', label: 'Credit surcharge' },
  { value: 'none', label: 'No adjustment' },
]

export const TENDER_OPTIONS = [
  { value: 'credit', label: 'Credit' },
  { value: 'debit', label: 'Debit' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'gift_card', label: 'Gift card' },
  { value: 'standalone', label: 'Standalone' },
]

export const DEFAULT_RATE_PLAN = {
  card_rate: 0.035,
  pricing_mode: 'dual_pricing_posted_electronic',
  dual_pricing_enabled: true,
  applies_to: ['credit', 'debit', 'terminal', 'gift_card'],
  basis: 'subtotal_plus_tax',
}

const pricingCopyForMode = (mode) => {
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
  if (mode === 'none') {
    return { label: 'Pricing adjustment', disclosure: '' }
  }
  return {
    label: 'Dual pricing',
    disclosure: 'Cash and electronic prices are shown before payment. The final receipt reflects the selected payment method.',
  }
}

export const formatRate = (rate) =>
  rate === null || rate === undefined ? '—' : `${(Number(rate) * 100).toFixed(2).replace(/\.?0+$/, '')}%`

export async function fetchRatePlans(restaurantIds) {
  if (!restaurantIds?.length) return {}
  const { data, error } = await supabase
    .from('restaurant_rate_plans')
    .select('*')
    .in('restaurant_id', restaurantIds)
  if (error) throw error
  return Object.fromEntries((data || []).map((plan) => [plan.restaurant_id, plan]))
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

/**
 * Rate plans are the single source of truth; the POS-facing pricing policy is
 * a projection of them. Push the equivalent policy so dual pricing, labels,
 * and disclosures update everywhere without re-entry. Non-fatal on failure —
 * the plan row is saved regardless and the policy re-syncs on next save.
 */
export async function pushRatePlanToPricingPolicy(restaurantId, plan) {
  try {
    const saved = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/pricing-policy`, {
      method: 'PUT',
      body: JSON.stringify({
        enabled: plan.pricing_mode !== 'none' && plan.dual_pricing_enabled !== false,
        mode: plan.pricing_mode,
        rate: Number(plan.card_rate) || 0,
        basis: plan.basis || 'subtotal_plus_tax',
        applies_to: plan.applies_to || DEFAULT_RATE_PLAN.applies_to,
        ...pricingCopyForMode(plan.pricing_mode),
      }),
    })
    queryClient.setQueryData(queryKeys.pricingPolicy(restaurantId), saved)
    return true
  } catch {
    return false
  }
}

export async function upsertRatePlan(restaurantId, plan, userId) {
  const { data, error } = await supabase
    .from('restaurant_rate_plans')
    .upsert(
      {
        restaurant_id: restaurantId,
        card_rate: plan.card_rate,
        pricing_mode: plan.pricing_mode,
        dual_pricing_enabled: plan.dual_pricing_enabled,
        applies_to: plan.applies_to,
        basis: plan.basis,
        updated_by: userId,
      },
      { onConflict: 'restaurant_id' }
    )
    .select()
    .single()
  if (error) throw error
  void pushRatePlanToPricingPolicy(restaurantId, plan)
  return data
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

export async function resolveRateChangeRequest(request, status, userId) {
  const { error } = await supabase
    .from('rate_change_requests')
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq('id', request.id)
  if (error) throw error

  if (status === 'approved') {
    const proposed = request.proposed_changes || {}
    await upsertRatePlan(
      request.restaurant_id,
      {
        ...DEFAULT_RATE_PLAN,
        ...proposed,
        card_rate: request.proposed_rate,
      },
      userId
    )
  }
}

/**
 * Reverse sync: when an owner edits pricing in Setup, mirror it into the rate
 * plan so the reseller's Rates page reads the same numbers. Direct write (no
 * policy push-back) to avoid a sync loop. Silent if the table isn't migrated.
 */
export async function syncRatePlanFromPricingPolicy(restaurantId, policy, userId) {
  try {
    await supabase
      .from('restaurant_rate_plans')
      .upsert(
        {
          restaurant_id: restaurantId,
          card_rate: Number(policy.rate) || 0,
          pricing_mode: policy.mode || 'none',
          dual_pricing_enabled: policy.enabled !== false,
          applies_to: policy.applies_to || DEFAULT_RATE_PLAN.applies_to,
          basis: policy.basis || 'subtotal_plus_tax',
          updated_by: userId || null,
        },
        { onConflict: 'restaurant_id' }
      )
  } catch {
    // Rate plan table not migrated yet — pricing policy still saved.
  }
}

export async function cancelRateChangeRequest(requestId) {
  const { error } = await supabase
    .from('rate_change_requests')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw error
}

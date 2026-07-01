import { supabase } from '../../shared/lib/supabase'
import { DEFAULT_RATE_PLAN, formatRate } from './ratePlans'

export const PENDING_CLAIM_STORAGE_KEY = 'shire_pending_claim_token'

export const claimUrl = (token) => `${window.location.origin}/claim/${token}`

const rateSummary = (ratePlan) =>
  `${formatRate(ratePlan.card_rate)} · ${ratePlan.pricing_mode === 'none' ? 'no adjustment' : ratePlan.pricing_mode.replace(/_/g, ' ')}`

export async function fetchMyInvites(userId) {
  const { data, error } = await supabase
    .from('store_invites')
    .select('*')
    .eq('invited_by', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createQuickInvite({ userId, email, restaurantName, ratePlan }) {
  const plan = { ...DEFAULT_RATE_PLAN, ...ratePlan }
  const { data, error } = await supabase
    .from('store_invites')
    .insert({
      invited_by: userId,
      email: email || null,
      kind: 'quick',
      restaurant_name: restaurantName || null,
      default_rate_plan: plan,
      summary: {
        restaurant_name: restaurantName || 'Your restaurant',
        rate_summary: rateSummary(plan),
        payout_schedule: ratePlan?.payout_schedule || 'daily',
      },
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createDraftInvite({ userId, email, draft, ratePlan }) {
  const plan = { ...DEFAULT_RATE_PLAN, ...ratePlan }

  // Draft store belongs to the reseller until claimed; claim_store() transfers it.
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .insert({
      name: draft.name,
      owner_id: userId,
      status: 'draft',
      type: draft.type || null,
      city: draft.city || null,
      state: draft.state || null,
      config: {
        legal_business_name: draft.legal_business_name || null,
        payout_schedule: draft.payout_schedule || 'daily',
      },
    })
    .select()
    .single()
  if (restaurantError) throw restaurantError

  const { error: planError } = await supabase
    .from('restaurant_rate_plans')
    .upsert(
      {
        restaurant_id: restaurant.id,
        card_rate: plan.card_rate,
        pricing_mode: plan.pricing_mode,
        dual_pricing_enabled: plan.dual_pricing_enabled,
        applies_to: plan.applies_to,
        basis: plan.basis,
        updated_by: userId,
      },
      { onConflict: 'restaurant_id' }
    )
  if (planError) throw planError

  const { data: invite, error: inviteError } = await supabase
    .from('store_invites')
    .insert({
      invited_by: userId,
      email: email || null,
      kind: 'draft',
      restaurant_name: draft.name,
      draft_restaurant_id: restaurant.id,
      summary: {
        restaurant_name: draft.name,
        legal_business_name: draft.legal_business_name || null,
        city: draft.city || null,
        state: draft.state || null,
        type: draft.type || null,
        payout_schedule: draft.payout_schedule || 'daily',
        rate_summary: rateSummary(plan),
        rate_plan: plan,
      },
    })
    .select()
    .single()
  if (inviteError) throw inviteError

  return { restaurant, invite }
}

export async function revokeInvite(inviteId) {
  const { error } = await supabase
    .from('store_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
  if (error) throw error
}

export async function fetchInviteByToken(token) {
  const { data, error } = await supabase
    .from('store_invites')
    .select('id, token, kind, email, restaurant_name, summary, status, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function claimStore(token) {
  const { data, error } = await supabase.rpc('claim_store', { invite_token: token })
  if (error) throw error
  return data // claimed restaurant id
}

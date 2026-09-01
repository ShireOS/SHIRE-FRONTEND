import { supabase } from '../../shared/lib/supabase'
import { DEFAULT_RATE_PLAN, fetchRatePlans, formatRate, upsertRatePlan } from './ratePlans'

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
  const restaurantId = crypto.randomUUID()

  // Draft store belongs to the reseller until claimed; claim_store() transfers it.
  // Do not request the row in the INSERT response. The operational SELECT RLS
  // guard depends on an AFTER INSERT lifecycle trigger, so it can only see the
  // new lifecycle row in a subsequent statement.
  const { error: restaurantError } = await supabase
    .from('restaurants')
    .insert({
      id: restaurantId,
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
  if (restaurantError) throw restaurantError

  const { data: restaurant, error: restaurantReadError } = await supabase
    .from('restaurants')
    .select()
    .eq('id', restaurantId)
    .single()
  if (restaurantReadError) throw restaurantReadError

  // Restaurant creation seeds a default pricing-policy version. Read that
  // authoritative version before replacing the defaults so optimistic locking
  // does not reject the initial reseller rate plan.
  const currentRatePlans = await fetchRatePlans([restaurant.id])
  await upsertRatePlan(restaurant.id, {
    ...plan,
    version: currentRatePlans[restaurant.id]?.version,
  })

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
    .rpc('get_store_invite_by_token', { invite_token: token })
    .maybeSingle()
  if (error) throw error
  return data
}

export async function claimStore(token) {
  const { data, error } = await supabase.rpc('claim_store', { invite_token: token })
  if (error) throw error
  return data // claimed restaurant id
}

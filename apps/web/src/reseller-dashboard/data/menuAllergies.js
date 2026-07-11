import { supabase } from '../../shared/lib/supabase'

// Allergy pills live in the POS-owned modifier tables: one restaurant-wide
// modifier group with type='allergy' whose options (zero-price modifiers) are
// the pills servers can flag on any item. Per-item narrowing is a row in
// menu_item_allergy_exclusions (row present = pill hidden on that item), so
// new pills and new items auto-enroll everywhere by default. The POS reads all
// of this on its next bootstrap — no POS-backend API involved.

export async function fetchAllergyGroup(restaurantId) {
  const { data, error } = await supabase
    .from('menu_modifier_groups')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('type', 'allergy')
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

export async function ensureAllergyGroup(restaurantId) {
  const existing = await fetchAllergyGroup(restaurantId)
  if (existing) return existing
  const { data, error } = await supabase
    .from('menu_modifier_groups')
    .insert({
      restaurant_id: restaurantId,
      name: 'Allergies',
      type: 'allergy',
      min_selections: 0,
      max_selections: null,
      is_required: false,
      prompt_on_order: true,
      display_order: 999,
      is_available: true,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

/** Pills for the group, joined to their modifier rows (name/availability). */
export async function fetchAllergyPills(groupId) {
  const { data: options, error } = await supabase
    .from('menu_modifier_group_options')
    .select('modifier_id, display_order')
    .eq('group_id', groupId)
    .order('display_order', { ascending: true })
  if (error) throw error
  const modifierIds = (options || []).map(option => option.modifier_id)
  if (modifierIds.length === 0) return []
  const { data: modifiers, error: modifierError } = await supabase
    .from('menu_modifiers')
    .select('id, name, is_available, archived_at')
    .in('id', modifierIds)
  if (modifierError) throw modifierError
  const byId = Object.fromEntries((modifiers || []).map(modifier => [modifier.id, modifier]))
  return (options || [])
    .map(option => {
      const modifier = byId[option.modifier_id]
      if (!modifier || modifier.archived_at) return null
      return {
        id: modifier.id,
        name: modifier.name,
        is_available: modifier.is_available,
        display_order: option.display_order,
      }
    })
    .filter(Boolean)
}

export async function addAllergyPill(restaurantId, groupId, name, displayOrder = 0) {
  const { data: modifier, error } = await supabase
    .from('menu_modifiers')
    .insert({
      restaurant_id: restaurantId,
      name,
      price_delta: 0,
      is_available: true,
      group_name: 'Allergies',
    })
    .select('id, name, is_available')
    .single()
  if (error) throw error
  const { error: optionError } = await supabase
    .from('menu_modifier_group_options')
    .insert({ group_id: groupId, modifier_id: modifier.id, is_default: false, display_order: displayOrder })
  if (optionError) throw optionError
  return modifier
}

export async function renameAllergyPill(modifierId, name) {
  const { error } = await supabase
    .from('menu_modifiers')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', modifierId)
  if (error) throw error
}

export async function setAllergyPillActive(modifierId, isAvailable) {
  const { error } = await supabase
    .from('menu_modifiers')
    .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
    .eq('id', modifierId)
  if (error) throw error
}

export async function fetchAllergyExclusions(restaurantId) {
  const { data, error } = await supabase
    .from('menu_item_allergy_exclusions')
    .select('item_id, modifier_id')
    .eq('restaurant_id', restaurantId)
  if (error) throw error
  return data || []
}

/** excluded=true hides the pill on that item; false restores the default (shown). */
export async function setItemPillExcluded(restaurantId, itemId, modifierId, excluded) {
  if (excluded) {
    const { error } = await supabase
      .from('menu_item_allergy_exclusions')
      .insert({ restaurant_id: restaurantId, item_id: itemId, modifier_id: modifierId })
    if (error && error.code !== '23505') throw error // already excluded is fine
  } else {
    const { error } = await supabase
      .from('menu_item_allergy_exclusions')
      .delete()
      .eq('item_id', itemId)
      .eq('modifier_id', modifierId)
    if (error) throw error
  }
}

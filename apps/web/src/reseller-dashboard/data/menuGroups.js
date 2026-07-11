import { supabase } from '../../shared/lib/supabase'

// Modifier groups live in POS-owned tables (menu_modifier_groups + junctions)
// that the portal reaches directly through Supabase RLS — see the
// 20260702_menu_modifier_groups_portal_access.sql migration. The POS reads the
// same rows on its next bootstrap, so no POS-backend API is involved.

export async function fetchModifierGroups(restaurantId) {
  const { data: groups, error } = await supabase
    .from('menu_modifier_groups')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .is('archived_at', null)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  const groupIds = (groups || []).map(group => group.id)
  if (groupIds.length === 0) return []

  const [itemLinks, optionLinks, itemOverrides] = await Promise.all([
    supabase
      .from('menu_modifier_group_items')
      .select('group_id, item_id, display_order')
      .in('group_id', groupIds),
    supabase
      .from('menu_modifier_group_options')
      .select('group_id, modifier_id, is_default, display_order, overage_price, child_group_id, default_pre_modifier, pre_modifier_price_overrides')
      .in('group_id', groupIds)
      .order('display_order', { ascending: true }),
    supabase
      .from('menu_item_modifier_group_overrides')
      .select('group_id, item_id, prompt_mode')
      .in('group_id', groupIds),
  ])
  if (itemLinks.error) throw itemLinks.error
  if (optionLinks.error) throw optionLinks.error
  if (itemOverrides.error) throw itemOverrides.error

  const itemsByGroup = {}
  for (const row of itemLinks.data || []) {
    ;(itemsByGroup[row.group_id] ||= []).push(row.item_id)
  }
  const optionsByGroup = {}
  for (const row of optionLinks.data || []) {
    ;(optionsByGroup[row.group_id] ||= []).push({
      modifier_id: row.modifier_id,
      is_default: Boolean(row.is_default),
      display_order: Number(row.display_order || 0),
      overage_price: row.overage_price == null ? null : Number(row.overage_price),
      child_group_id: row.child_group_id || null,
      default_pre_modifier: row.default_pre_modifier || null,
      pre_modifier_price_overrides: row.pre_modifier_price_overrides || {},
    })
  }
  const promptsByGroup = {}
  for (const row of itemOverrides.data || []) {
    ;(promptsByGroup[row.group_id] ||= {})[row.item_id] = row.prompt_mode
  }

  return (groups || []).map(group => ({
    ...group,
    item_ids: itemsByGroup[group.id] || [],
    item_prompt_modes: promptsByGroup[group.id] || {},
    options: optionsByGroup[group.id] || [],
  }))
}

export async function createModifierGroup(restaurantId, draft) {
  const { data, error } = await supabase
    .from('menu_modifier_groups')
    .insert({
      restaurant_id: restaurantId,
      name: draft.name,
      min_selections: draft.min_selections,
      max_selections: draft.max_selections,
      is_required: draft.is_required,
      prompt_on_order: draft.is_required ? true : draft.prompt_on_order,
      display_order: draft.display_order ?? 0,
      is_available: true,
      included_count: draft.included_count ?? 0,
      overage_price: draft.overage_price ?? null,
      prompt_mode: draft.prompt_mode || 'ask',
      pre_modifiers: draft.pre_modifiers || [],
      pre_modifier_prices: draft.pre_modifier_prices || {},
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateModifierGroup(groupId, patch) {
  const { data, error } = await supabase
    .from('menu_modifier_groups')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', groupId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function archiveModifierGroup(groupId) {
  const { error } = await supabase
    .from('menu_modifier_groups')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', groupId)
  if (error) throw error
}

export async function replaceGroupItems(groupId, itemIds) {
  const { error: deleteError } = await supabase
    .from('menu_modifier_group_items')
    .delete()
    .eq('group_id', groupId)
  if (deleteError) throw deleteError
  if (itemIds.length === 0) return
  const { error } = await supabase
    .from('menu_modifier_group_items')
    .insert(itemIds.map((itemId, index) => ({ group_id: groupId, item_id: itemId, display_order: index })))
  if (error) throw error
}

export async function attachGroupToItem(groupId, itemId, displayOrder = 0) {
  const { error } = await supabase
    .from('menu_modifier_group_items')
    .insert({ group_id: groupId, item_id: itemId, display_order: displayOrder })
  if (error && error.code !== '23505') throw error // ignore already-attached
}

export async function detachGroupFromItem(groupId, itemId) {
  const { error } = await supabase
    .from('menu_modifier_group_items')
    .delete()
    .eq('group_id', groupId)
    .eq('item_id', itemId)
  if (error) throw error
}

export async function setItemGroupPromptMode(groupId, itemId, promptMode) {
  if (!promptMode) {
    const { error } = await supabase
      .from('menu_item_modifier_group_overrides')
      .delete()
      .eq('group_id', groupId)
      .eq('item_id', itemId)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('menu_item_modifier_group_overrides')
    .upsert({ group_id: groupId, item_id: itemId, prompt_mode: promptMode, updated_at: new Date().toISOString() })
  if (error) throw error
}

// "Customize for this item only": deep-clone a question and its entire
// follow-up chain, then move this item's link from the shared original to the
// private copy. Other items keep the original untouched.
export async function cloneGroupChainForItem(restaurantId, groups, groupId, itemId) {
  const byId = Object.fromEntries(groups.map(group => [group.id, group]))
  const cloneIds = {}

  const cloneGroup = async (sourceId, seen) => {
    if (cloneIds[sourceId]) return cloneIds[sourceId]
    if (seen.has(sourceId)) return null // cycle in existing data — cut it
    seen.add(sourceId)
    const source = byId[sourceId]
    if (!source) return null
    const { data, error } = await supabase
      .from('menu_modifier_groups')
      .insert({
        restaurant_id: restaurantId,
        name: sourceId === groupId ? `${source.name} (custom)` : source.name,
        min_selections: source.min_selections,
        max_selections: source.max_selections,
        is_required: source.is_required,
        prompt_on_order: source.prompt_on_order,
        display_order: source.display_order,
        is_available: source.is_available,
        included_count: source.included_count ?? 0,
        overage_price: source.overage_price ?? null,
        prompt_mode: source.prompt_mode || 'ask',
        pre_modifiers: source.pre_modifiers || [],
        pre_modifier_prices: source.pre_modifier_prices || {},
      })
      .select('*')
      .single()
    if (error) throw error
    cloneIds[sourceId] = data.id
    for (const option of source.options || []) {
      const childCloneId = option.child_group_id ? await cloneGroup(option.child_group_id, seen) : null
      const { error: optionError } = await supabase
        .from('menu_modifier_group_options')
        .insert({
          group_id: data.id,
          modifier_id: option.modifier_id,
          is_default: option.is_default,
          display_order: option.display_order,
          overage_price: option.overage_price,
          child_group_id: childCloneId,
          default_pre_modifier: option.default_pre_modifier || null,
          pre_modifier_price_overrides: option.pre_modifier_price_overrides || {},
        })
      if (optionError) throw optionError
    }
    return data.id
  }

  const newRootId = await cloneGroup(groupId, new Set())
  if (!newRootId) throw new Error('Could not copy this question.')
  await attachGroupToItem(newRootId, itemId)
  await detachGroupFromItem(groupId, itemId)
  return newRootId
}

export async function addGroupOption(groupId, modifierId, extra = {}) {
  const { error } = await supabase
    .from('menu_modifier_group_options')
    .insert({
      group_id: groupId,
      modifier_id: modifierId,
      is_default: extra.is_default ?? false,
      display_order: extra.display_order ?? 0,
      overage_price: extra.overage_price ?? null,
      child_group_id: extra.child_group_id ?? null,
      default_pre_modifier: extra.default_pre_modifier ?? null,
      pre_modifier_price_overrides: extra.pre_modifier_price_overrides ?? {},
    })
  if (error) throw error
}

export async function updateGroupOption(groupId, modifierId, patch) {
  const { error } = await supabase
    .from('menu_modifier_group_options')
    .update(patch)
    .eq('group_id', groupId)
    .eq('modifier_id', modifierId)
  if (error) throw error
}

export async function removeGroupOption(groupId, modifierId) {
  const { error } = await supabase
    .from('menu_modifier_group_options')
    .delete()
    .eq('group_id', groupId)
    .eq('modifier_id', modifierId)
  if (error) throw error
}

// Nesting an option under `hostGroupId` pointing at `childGroupId` adds the
// edge host → child. That is a cycle iff host is reachable from child.
export function wouldCreateCycle(groups, hostGroupId, childGroupId) {
  if (!childGroupId) return false
  if (hostGroupId === childGroupId) return true
  const edges = {}
  for (const group of groups) {
    edges[group.id] = (group.options || [])
      .map(option => option.child_group_id)
      .filter(Boolean)
  }
  const queue = [childGroupId]
  const seen = new Set()
  while (queue.length > 0) {
    const current = queue.pop()
    if (current === hostGroupId) return true
    if (seen.has(current)) continue
    seen.add(current)
    for (const next of edges[current] || []) queue.push(next)
  }
  return false
}

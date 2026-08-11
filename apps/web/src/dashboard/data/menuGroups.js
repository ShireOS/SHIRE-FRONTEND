import { supabase } from '../../shared/lib/supabase'
import {
  clonedModifierGroupRow,
  isMissingColumnError,
  runWithMissingColumnFallbacks,
  withoutColumns,
} from './menuGroupsPolicy'

// Modifier groups ("questions") live in POS-owned tables (menu_modifier_groups
// + junctions) that the portal reaches directly through Supabase RLS — see the
// 20260702_menu_modifier_groups_portal_access.sql and
// 20260712_menu_questions_overhaul.sql migrations. The POS reads the same rows
// on its next bootstrap, so no POS-backend API is involved.
//
// A question reaches an item two ways:
//   * directly (menu_modifier_group_items), or
//   * by CATEGORY inheritance (menu_category_modifier_groups) — every item in
//     the category asks it, including items created later.
// Either way, menu_item_modifier_group_overrides carries the per-item layer:
// prompt_mode (ask / skip_defaults / hidden), default_modifier_ids (this
// item's pre-selected options), opted_out (suppress the question here), and
// display_order (per-item ordering).

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

  const [itemLinks, optionLinksResult, itemOverridesResult, categoryLinks] = await Promise.all([
    supabase
      .from('menu_modifier_group_items')
      .select('group_id, item_id, display_order')
      .in('group_id', groupIds),
    runWithMissingColumnFallbacks([
      () => supabase
        .from('menu_modifier_group_options')
        .select('group_id, modifier_id, is_default, display_order, overage_price, child_group_id, default_pre_modifier, pre_modifier_price_overrides, kitchen_display_role')
        .in('group_id', groupIds)
        .order('display_order', { ascending: true }),
      () => supabase
        .from('menu_modifier_group_options')
        .select('group_id, modifier_id, is_default, display_order, overage_price, child_group_id, default_pre_modifier, pre_modifier_price_overrides')
        .in('group_id', groupIds)
        .order('display_order', { ascending: true }),
    ]),
    runWithMissingColumnFallbacks([
      () => supabase
        .from('menu_item_modifier_group_overrides')
        .select('group_id, item_id, prompt_mode, default_modifier_ids, opted_out, display_order, kitchen_display_role')
        .in('group_id', groupIds),
      () => supabase
        .from('menu_item_modifier_group_overrides')
        .select('group_id, item_id, prompt_mode, default_modifier_ids, opted_out, display_order')
        .in('group_id', groupIds),
      () => supabase
        .from('menu_item_modifier_group_overrides')
        .select('group_id, item_id, prompt_mode')
        .in('group_id', groupIds),
    ]),
    supabase
      .from('menu_category_modifier_groups')
      .select('group_id, category_id, display_order')
      .in('group_id', groupIds),
  ])
  const optionLinks = optionLinksResult.result
  const itemOverrides = itemOverridesResult.result
  if (itemLinks.error) throw itemLinks.error
  if (optionLinks.error) throw optionLinks.error
  // Category links still predate some installations. Missing optional columns
  // in the option/override queries were already retried above from newest to
  // oldest shape without hiding permission or other database failures.
  if (itemOverrides.error) throw itemOverrides.error
  const overrideRows = itemOverrides.data || []
  if (categoryLinks.error && categoryLinks.error.code !== '42P01') throw categoryLinks.error
  const categoryLinkRows = categoryLinks.data || []

  const itemsByGroup = {}
  const itemOrderByGroup = {}
  for (const row of itemLinks.data || []) {
    ;(itemsByGroup[row.group_id] ||= []).push(row.item_id)
    ;(itemOrderByGroup[row.group_id] ||= {})[row.item_id] = Number(row.display_order || 0)
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
      kitchen_display_role: row.kitchen_display_role || null,
    })
  }
  const promptsByGroup = {}
  const overridesByGroup = {}
  for (const row of overrideRows) {
    if (row.prompt_mode) (promptsByGroup[row.group_id] ||= {})[row.item_id] = row.prompt_mode
    ;(overridesByGroup[row.group_id] ||= {})[row.item_id] = {
      prompt_mode: row.prompt_mode || null,
      default_modifier_ids: Array.isArray(row.default_modifier_ids) ? row.default_modifier_ids : null,
      opted_out: Boolean(row.opted_out),
      display_order: row.display_order == null ? null : Number(row.display_order),
      kitchen_display_role: row.kitchen_display_role || null,
    }
  }
  const categoriesByGroup = {}
  for (const row of categoryLinkRows) {
    ;(categoriesByGroup[row.group_id] ||= []).push({
      category_id: row.category_id,
      display_order: Number(row.display_order || 0),
    })
  }

  return (groups || []).map(group => ({
    ...group,
    item_ids: itemsByGroup[group.id] || [],
    item_display_orders: itemOrderByGroup[group.id] || {},
    item_prompt_modes: promptsByGroup[group.id] || {},
    item_overrides: overridesByGroup[group.id] || {},
    category_links: categoriesByGroup[group.id] || [],
    options: optionsByGroup[group.id] || [],
  }))
}

export async function createModifierGroup(restaurantId, draft) {
  return insertModifierGroupRow({
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
    ...(draft.no_print != null ? { no_print: draft.no_print } : {}),
    ...(draft.kitchen_display_role != null ? { kitchen_display_role: draft.kitchen_display_role } : {}),
  })
}

// Columns added by later manual-run migrations — stripped and retried on
// PostgreSQL 42703 / PostgREST PGRST204 so saves keep working before the
// migration is applied or while the Data API schema cache catches up.
const OPTIONAL_GROUP_COLUMNS = ['no_print', 'modifier_sort_mode', 'kitchen_display_role']

async function insertModifierGroupRow(row) {
  const { result } = await runWithMissingColumnFallbacks([
    () => supabase.from('menu_modifier_groups').insert(row).select('*').single(),
    () => supabase
      .from('menu_modifier_groups')
      .insert(withoutColumns(row, ['kitchen_display_role']))
      .select('*')
      .single(),
    () => supabase
      .from('menu_modifier_groups')
      .insert(withoutColumns(row, OPTIONAL_GROUP_COLUMNS))
      .select('*')
      .single(),
  ])
  if (result.error) throw result.error
  return result.data
}

export async function updateModifierGroup(groupId, patch) {
  const timestamped = { ...patch, updated_at: new Date().toISOString() }
  const { result } = await runWithMissingColumnFallbacks([
    () => supabase.from('menu_modifier_groups').update(timestamped).eq('id', groupId).select('*').single(),
    () => supabase
      .from('menu_modifier_groups')
      .update(withoutColumns(timestamped, ['kitchen_display_role']))
      .eq('id', groupId)
      .select('*')
      .single(),
    () => supabase
      .from('menu_modifier_groups')
      .update(withoutColumns(timestamped, OPTIONAL_GROUP_COLUMNS))
      .eq('id', groupId)
      .select('*')
      .single(),
  ])
  if (result.error) throw result.error
  return result.data
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

export async function setItemGroupLinkOrder(groupId, itemId, displayOrder) {
  const { error } = await supabase
    .from('menu_modifier_group_items')
    .update({ display_order: displayOrder })
    .eq('group_id', groupId)
    .eq('item_id', itemId)
  if (error) throw error
}

// ── Answer ordering within a question ───────────────────────────────────────

export const groupAnswerSortMode = (group) => (group?.modifier_sort_mode === 'alpha' ? 'alpha' : 'custom')

// Persist a hand-arranged answer order (display_order = array position). The
// POS reads options ORDER BY display_order, so persisting here is all it takes.
export async function reorderGroupOptions(groupId, orderedModifierIds) {
  for (let index = 0; index < orderedModifierIds.length; index += 1) {
    const { error } = await supabase
      .from('menu_modifier_group_options')
      .update({ display_order: index })
      .eq('group_id', groupId)
      .eq('modifier_id', orderedModifierIds[index])
    if (error) throw error
  }
}

// A–Z mode physically rewrites display_order alphabetically (by modifier
// name) instead of sorting at read time, so the POS needs no changes. Re-run
// after adding answers to an A–Z question.
export async function applyAlphaOrderToGroup(groupId) {
  const { data: options, error } = await supabase
    .from('menu_modifier_group_options')
    .select('modifier_id')
    .eq('group_id', groupId)
  if (error) throw error
  const ids = (options || []).map(row => row.modifier_id)
  if (ids.length < 2) return
  const { data: mods, error: modError } = await supabase
    .from('menu_modifiers')
    .select('id, name')
    .in('id', ids)
  if (modError) throw modError
  const nameById = Object.fromEntries((mods || []).map(mod => [mod.id, mod.name || '']))
  ids.sort((a, b) => (nameById[a] || '').localeCompare(nameById[b] || '', undefined, { sensitivity: 'base' }))
  await reorderGroupOptions(groupId, ids)
}

export async function setGroupAnswerSortMode(groupId, mode) {
  await updateModifierGroup(groupId, { modifier_sort_mode: mode })
  if (mode === 'alpha') await applyAlphaOrderToGroup(groupId)
}

// ── Category inheritance ─────────────────────────────────────────────────────

// Default question order for every item in a category (per-item overrides
// still win — see effectiveItemQuestions).
export async function reorderCategoryGroups(categoryId, orderedGroupIds) {
  for (let index = 0; index < orderedGroupIds.length; index += 1) {
    const { error } = await supabase
      .from('menu_category_modifier_groups')
      .update({ display_order: index })
      .eq('category_id', categoryId)
      .eq('group_id', orderedGroupIds[index])
    if (error) throw error
  }
}

export async function attachGroupToCategory(restaurantId, groupId, categoryId, displayOrder = 0) {
  const { error } = await supabase
    .from('menu_category_modifier_groups')
    .insert({ restaurant_id: restaurantId, group_id: groupId, category_id: categoryId, display_order: displayOrder })
  if (error && error.code !== '23505') throw error // ignore already-attached
}

export async function detachGroupFromCategory(groupId, categoryId) {
  const { error } = await supabase
    .from('menu_category_modifier_groups')
    .delete()
    .eq('group_id', groupId)
    .eq('category_id', categoryId)
  if (error) throw error
}

// ── Per-item question overrides ──────────────────────────────────────────────

const overrideIsEmpty = (row) =>
  !row.prompt_mode
  && (row.default_modifier_ids == null)
  && !row.opted_out
  && row.display_order == null
  && row.kitchen_display_role == null

// Merge-upsert the per-item layer of a question. Patch keys: prompt_mode
// (null = use question default), default_modifier_ids (null = use question
// defaults), opted_out, display_order. Rows that end up carrying nothing are
// deleted so "no override" stays the common case.
export async function setItemGroupOverride(groupId, itemId, patch) {
  const { result: existingResult, fallbackIndex } = await runWithMissingColumnFallbacks([
    () => supabase
      .from('menu_item_modifier_group_overrides')
      .select('group_id, item_id, prompt_mode, default_modifier_ids, opted_out, display_order, kitchen_display_role')
      .eq('group_id', groupId)
      .eq('item_id', itemId)
      .limit(1),
    () => supabase
      .from('menu_item_modifier_group_overrides')
      .select('group_id, item_id, prompt_mode, default_modifier_ids, opted_out, display_order')
      .eq('group_id', groupId)
      .eq('item_id', itemId)
      .limit(1),
    () => supabase
      .from('menu_item_modifier_group_overrides')
      .select('group_id, item_id, prompt_mode')
      .eq('group_id', groupId)
      .eq('item_id', itemId)
      .limit(1),
  ])
  const { data: existingRows, error: readError } = existingResult
  if (readError) throw readError
  const existing = existingRows?.[0] || {
    prompt_mode: null, default_modifier_ids: null, opted_out: false, display_order: null, kitchen_display_role: null,
  }
  const next = {
    prompt_mode: 'prompt_mode' in patch ? patch.prompt_mode : existing.prompt_mode,
    default_modifier_ids: 'default_modifier_ids' in patch ? patch.default_modifier_ids : existing.default_modifier_ids,
    opted_out: 'opted_out' in patch ? Boolean(patch.opted_out) : Boolean(existing.opted_out),
    display_order: 'display_order' in patch ? patch.display_order : existing.display_order,
    kitchen_display_role: 'kitchen_display_role' in patch ? patch.kitchen_display_role : existing.kitchen_display_role,
  }
  if (overrideIsEmpty(next)) {
    const { error } = await supabase
      .from('menu_item_modifier_group_overrides')
      .delete()
      .eq('group_id', groupId)
      .eq('item_id', itemId)
    if (error) throw error
    return
  }
  const row = { group_id: groupId, item_id: itemId, ...next, updated_at: new Date().toISOString() }
  const legacyColumns = fallbackIndex > 1
    ? ['default_modifier_ids', 'opted_out', 'display_order', 'kitchen_display_role']
    : ['kitchen_display_role']
  const { error } = await supabase
    .from('menu_item_modifier_group_overrides')
    .upsert(fallbackIndex > 0 ? withoutColumns(row, legacyColumns) : row)
  if (error) throw error
}

export async function setItemGroupPromptMode(groupId, itemId, promptMode) {
  await setItemGroupOverride(groupId, itemId, { prompt_mode: promptMode || null })
}

// ── Per-item modifier overrides (price / print on THIS item) ────────────────

// → { [itemId]: { [modifierId]: { price_delta, no_print } } }
export async function fetchItemModifierOverrides(restaurantId) {
  const { result } = await runWithMissingColumnFallbacks([
    () => supabase
      .from('menu_item_modifier_overrides')
      .select('item_id, modifier_id, price_delta, no_print, kitchen_display_role')
      .eq('restaurant_id', restaurantId),
    () => supabase
      .from('menu_item_modifier_overrides')
      .select('item_id, modifier_id, price_delta, no_print')
      .eq('restaurant_id', restaurantId),
  ])
  const { data, error } = result
  if (error) {
    // Fail soft until the original override-table migration is applied.
    if (error.code === '42P01') return {}
    throw error
  }
  const byItem = {}
  for (const row of data || []) {
    ;(byItem[row.item_id] ||= {})[row.modifier_id] = {
      price_delta: row.price_delta == null ? null : Number(row.price_delta),
      no_print: row.no_print == null ? null : Boolean(row.no_print),
      kitchen_display_role: row.kitchen_display_role || null,
    }
  }
  return byItem
}

export async function setItemModifierOverride(restaurantId, itemId, modifierId, patch) {
  const { result: existingResult, fallbackIndex } = await runWithMissingColumnFallbacks([
    () => supabase
      .from('menu_item_modifier_overrides')
      .select('price_delta, no_print, kitchen_display_role')
      .eq('item_id', itemId)
      .eq('modifier_id', modifierId)
      .limit(1),
    () => supabase
      .from('menu_item_modifier_overrides')
      .select('price_delta, no_print')
      .eq('item_id', itemId)
      .eq('modifier_id', modifierId)
      .limit(1),
  ])
  const { data: existingRows, error: readError } = existingResult
  if (readError) throw readError
  const existing = existingRows?.[0] || { price_delta: null, no_print: null, kitchen_display_role: null }
  const next = {
    price_delta: 'price_delta' in patch ? patch.price_delta : existing.price_delta,
    no_print: 'no_print' in patch ? patch.no_print : existing.no_print,
    kitchen_display_role: 'kitchen_display_role' in patch ? patch.kitchen_display_role : existing.kitchen_display_role,
  }
  if (next.price_delta == null && next.no_print == null && next.kitchen_display_role == null) {
    const { error } = await supabase
      .from('menu_item_modifier_overrides')
      .delete()
      .eq('item_id', itemId)
      .eq('modifier_id', modifierId)
    if (error) throw error
    return
  }
  const row = {
    restaurant_id: restaurantId,
    item_id: itemId,
    modifier_id: modifierId,
    ...next,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('menu_item_modifier_overrides')
    .upsert(fallbackIndex > 0 ? withoutColumns(row, ['kitchen_display_role']) : row)
  if (error) throw error
}

export async function setModifierKitchenDisplayRole(modifierId, kitchenDisplayRole) {
  const { error } = await supabase
    .from('menu_modifiers')
    .update({ kitchen_display_role: kitchenDisplayRole || null, updated_at: new Date().toISOString() })
    .eq('id', modifierId)
  if (error && !isMissingColumnError(error)) throw error
}

// ── Effective questions per item (direct + inherited) ───────────────────────

export const normalizedGroupPromptMode = mode =>
  (mode === 'skip_defaults' || mode === 'hidden' ? mode : 'ask')

// Everything the POS will ask on this item, in order: directly-attached
// questions plus questions inherited from the item's category, minus opt-outs.
// Returns [{ group, source: 'item' | 'category', override, order }] sorted by
// effective order (per-item override → link order → group order).
export function effectiveItemQuestions(item, groups, categoriesByName) {
  const category = categoriesByName?.[item.category || ''] || null
  const rows = []
  for (const group of groups) {
    const override = group.item_overrides?.[item.id] || null
    const direct = group.item_ids.includes(item.id)
    const categoryLink = category
      ? (group.category_links || []).find(link => link.category_id === category.id)
      : null
    if (!direct && !categoryLink) continue
    if (override?.opted_out) continue
    const linkOrder = direct
      ? (group.item_display_orders?.[item.id] ?? 0)
      : categoryLink.display_order
    rows.push({
      group,
      source: direct ? 'item' : 'category',
      override,
      order: override?.display_order ?? linkOrder ?? group.display_order ?? 0,
    })
  }
  return rows.sort((a, b) => a.order - b.order || a.group.name.localeCompare(b.group.name))
}

// Questions an item has explicitly opted out of (so the editor can offer to
// bring them back).
export function optedOutItemQuestions(item, groups, categoriesByName) {
  const category = categoriesByName?.[item.category || ''] || null
  return groups.filter(group => {
    const override = group.item_overrides?.[item.id]
    if (!override?.opted_out) return false
    return group.item_ids.includes(item.id)
      || (category && (group.category_links || []).some(link => link.category_id === category.id))
  })
}

// The option ids pre-selected when this item is ordered: the item's own
// default list when set, else the question's starred options.
export function effectiveDefaultModifierIds(group, override) {
  if (override && Array.isArray(override.default_modifier_ids)) return override.default_modifier_ids
  return (group.options || []).filter(option => option.is_default).map(option => option.modifier_id)
}

export function effectivePromptMode(group, override) {
  return normalizedGroupPromptMode(override?.prompt_mode || group.prompt_mode)
}

// Mirrors the POS quick-add decision (MenuPanel.beginItem in the POS app): an
// item taps straight onto the check when no visible question still needs the
// guest — required minimums are covered by defaults and nothing is left in
// "ask every time" mode with real choices.
export function itemOrderingBehavior(item, groups, categoriesByName, modifiersById = {}) {
  const questions = effectiveItemQuestions(item, groups, categoriesByName)
    .filter(({ group }) => group.type !== 'allergy' && group.is_available !== false)
  const asks = []
  const skipsWithDefaults = []
  let missingRequired = false
  for (const { group, override } of questions) {
    const mode = effectivePromptMode(group, override)
    const defaults = effectiveDefaultModifierIds(group, override)
    const minimum = Math.max(Number(group.min_selections) || 0, group.is_required ? 1 : 0)
    if (minimum > defaults.length) missingRequired = true
    if (mode === 'ask' && (group.options || []).length > 0) asks.push(group)
    else if (mode === 'skip_defaults' && defaults.length > 0) {
      skipsWithDefaults.push({
        group,
        defaultNames: defaults.map(id => modifiersById[id]?.name).filter(Boolean),
      })
    }
  }
  return {
    questions,
    asks,
    skipsWithDefaults,
    missingRequired,
    quickAdd: !missingRequired && asks.length === 0,
  }
}

// "Customize for this item only": deep-clone a question and its entire
// follow-up chain, then move this item's link from the shared original to the
// private copy. Other items keep the original untouched. Works for inherited
// questions too: the original is opted out on this item instead of detached.
export async function cloneGroupChainForItem(restaurantId, groups, groupId, itemId) {
  const byId = Object.fromEntries(groups.map(group => [group.id, group]))
  const cloneIds = {}

  const cloneGroup = async (sourceId, seen) => {
    if (cloneIds[sourceId]) return cloneIds[sourceId]
    if (seen.has(sourceId)) return null // cycle in existing data — cut it
    seen.add(sourceId)
    const source = byId[sourceId]
    if (!source) return null
    const data = await insertModifierGroupRow(clonedModifierGroupRow(restaurantId, source, groupId))
    cloneIds[sourceId] = data.id
    for (const option of source.options || []) {
      const childCloneId = option.child_group_id ? await cloneGroup(option.child_group_id, seen) : null
      await addGroupOption(data.id, option.modifier_id, {
        is_default: option.is_default,
        display_order: option.display_order,
        overage_price: option.overage_price,
        child_group_id: childCloneId,
        default_pre_modifier: option.default_pre_modifier || null,
        pre_modifier_price_overrides: option.pre_modifier_price_overrides || {},
        kitchen_display_role: option.kitchen_display_role || null,
      })
    }
    return data.id
  }

  const newRootId = await cloneGroup(groupId, new Set())
  if (!newRootId) throw new Error('Could not copy this question.')
  const source = byId[groupId]
  await attachGroupToItem(newRootId, itemId)
  if (source?.item_ids?.includes(itemId)) {
    await detachGroupFromItem(groupId, itemId)
  } else {
    // Inherited from the category — suppress the original on this item.
    await setItemGroupOverride(groupId, itemId, { opted_out: true })
  }
  return newRootId
}

export async function addGroupOption(groupId, modifierId, extra = {}) {
  const row = {
    group_id: groupId,
    modifier_id: modifierId,
    is_default: extra.is_default ?? false,
    display_order: extra.display_order ?? 0,
    overage_price: extra.overage_price ?? null,
    child_group_id: extra.child_group_id ?? null,
    default_pre_modifier: extra.default_pre_modifier ?? null,
    pre_modifier_price_overrides: extra.pre_modifier_price_overrides ?? {},
    kitchen_display_role: extra.kitchen_display_role ?? null,
  }
  const { result } = await runWithMissingColumnFallbacks([
    () => supabase.from('menu_modifier_group_options').insert(row),
    () => supabase
      .from('menu_modifier_group_options')
      .insert(withoutColumns(row, ['kitchen_display_role'])),
  ])
  if (result.error) throw result.error
}

export async function updateGroupOption(groupId, modifierId, patch) {
  let { error } = await supabase
    .from('menu_modifier_group_options')
    .update(patch)
    .eq('group_id', groupId)
    .eq('modifier_id', modifierId)
  if (isMissingColumnError(error) && 'kitchen_display_role' in patch) {
    const legacyPatch = withoutColumns(patch, ['kitchen_display_role'])
    if (Object.keys(legacyPatch).length === 0) return
    ;({ error } = await supabase
      .from('menu_modifier_group_options')
      .update(legacyPatch)
      .eq('group_id', groupId)
      .eq('modifier_id', modifierId))
  }
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

// Where a question is used as a follow-up: [{ group, option, modifier_id }]
// for every option whose child_group_id points at `groupId`.
export function followUpParents(groups, groupId) {
  const parents = []
  for (const group of groups) {
    for (const option of group.options || []) {
      if (option.child_group_id === groupId) parents.push({ group, option, modifier_id: option.modifier_id })
    }
  }
  return parents
}

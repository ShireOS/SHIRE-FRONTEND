import { supabase } from '../../shared/lib/supabase'
import { attachGroupToItem, setItemGroupOverride, setItemModifierOverride } from './menuGroups'
import { setItemPillExcluded } from './menuAllergies'

// "Save & duplicate": after the new item row exists, re-key everything that
// hangs off the source item's id onto the new one — question links (with
// order), per-item question overrides (defaults / opt-outs / prompt mode),
// per-item modifier price & print overrides, allergen narrowing, the tax
// split, specials, and happy-hour price rules. The photo is deliberately not
// copied. Each section fails soft (pre-migration tables, missing permission)
// and reports itself in the returned warnings list instead of sinking the
// whole duplicate.
export async function copyItemConfig({
  restaurantId,
  api,
  sourceItem,
  targetItem,
  groups,
  sourceModifierOverrides = {},
  sourceAllergyExclusions = [],
  sourceSpecials = [],
}) {
  const warnings = []

  try {
    for (const group of groups) {
      if (!group.item_ids.includes(sourceItem.id)) continue
      await attachGroupToItem(group.id, targetItem.id, group.item_display_orders?.[sourceItem.id] ?? 0)
    }
  } catch {
    warnings.push('questions')
  }

  // Overrides matter for inherited questions too, so scan every group — a row
  // pointing at a question the new item doesn't ask is inert.
  try {
    for (const group of groups) {
      const override = group.item_overrides?.[sourceItem.id]
      if (!override) continue
      await setItemGroupOverride(group.id, targetItem.id, override)
    }
  } catch {
    warnings.push('per-item question settings')
  }

  try {
    for (const [modifierId, patch] of Object.entries(sourceModifierOverrides)) {
      await setItemModifierOverride(restaurantId, targetItem.id, modifierId, patch)
    }
  } catch {
    warnings.push('modifier price/print overrides')
  }

  try {
    for (const row of sourceAllergyExclusions) {
      await setItemPillExcluded(restaurantId, targetItem.id, row.modifier_id, true)
    }
  } catch {
    warnings.push('allergen settings')
  }

  try {
    const roster = await api(`/restaurants/${restaurantId}/menu/price-allocations`)
    const entry = (roster?.items || []).find(candidate => candidate.item_id === sourceItem.id)
    if (entry?.allocations?.length) {
      await api(`/restaurants/${restaurantId}/menu/items/${targetItem.id}/price-allocations`, {
        method: 'PUT',
        body: JSON.stringify({
          allocations: entry.allocations.map(a => ({ category_id: a.category_id, amount: Number(a.amount) })),
        }),
      })
    }
  } catch {
    warnings.push('tax split')
  }

  try {
    for (const special of sourceSpecials) {
      const { id, created_at, updated_at, archived_at, ...rest } = special
      const displayName = !special.display_name || special.display_name === sourceItem.name
        ? targetItem.name
        : special.display_name
      const { data, error } = await supabase
        .from('pos_daily_specials')
        .insert({ ...rest, restaurant_id: restaurantId, menu_item_id: targetItem.id, display_name: displayName })
        .select('*')
        .single()
      if (error) throw error
      await supabase.from('pos_daily_special_events').insert({
        restaurant_id: restaurantId,
        daily_special_id: data.id,
        event_type: 'created',
        after_data: data,
      }).then(() => null, () => null)
    }
  } catch {
    warnings.push('specials')
  }

  try {
    await api(`/restaurants/${restaurantId}/menu/pricing/items/${sourceItem.id}/rules/copy`, {
      method: 'POST',
      body: JSON.stringify({ target_menu_item_id: targetItem.id }),
    })
  } catch {
    warnings.push('happy hour price rules')
  }

  return warnings
}

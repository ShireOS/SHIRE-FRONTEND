export const isMissingColumnError = error => ['42703', 'PGRST204'].includes(error?.code)

// Supabase query builders are promises that resolve to { data, error }. Keep
// rolling-deploy retries narrow: only a missing-column response advances to
// the next schema shape; authorization and all other failures return intact.
export async function runWithMissingColumnFallbacks(attempts) {
  let result = null
  for (let index = 0; index < attempts.length; index += 1) {
    result = await attempts[index]()
    if (!isMissingColumnError(result?.error) || index === attempts.length - 1) {
      return { result, fallbackIndex: index }
    }
  }
  return { result, fallbackIndex: Math.max(0, attempts.length - 1) }
}

export const withoutColumns = (row, columns) => {
  const next = { ...row }
  for (const column of columns) delete next[column]
  return next
}

export function clonedModifierGroupRow(restaurantId, source, rootGroupId) {
  return {
    restaurant_id: restaurantId,
    name: source.id === rootGroupId ? `${source.name} (custom)` : source.name,
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
    ...(source.no_print != null ? { no_print: source.no_print } : {}),
    ...(source.kitchen_display_role != null
      ? { kitchen_display_role: source.kitchen_display_role }
      : {}),
  }
}

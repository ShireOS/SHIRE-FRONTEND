const KITCHEN_ALIAS_MAX_LENGTH = 40

export function normalizeKitchenAlias(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, KITCHEN_ALIAS_MAX_LENGTH)
}

export function withKitchenItemAlias(config, itemId, value) {
  const current = config && typeof config === 'object' ? config : {}
  const aliases = current.aliases && typeof current.aliases === 'object' ? current.aliases : {}
  const items = aliases.items && typeof aliases.items === 'object' ? aliases.items : {}
  const nextItems = { ...items }
  const alias = normalizeKitchenAlias(value)

  if (alias) nextItems[itemId] = alias
  else delete nextItems[itemId]

  return {
    ...current,
    aliases: {
      ...aliases,
      items: nextItems,
      modifiers: aliases.modifiers && typeof aliases.modifiers === 'object' ? aliases.modifiers : {},
    },
  }
}

export { KITCHEN_ALIAS_MAX_LENGTH }

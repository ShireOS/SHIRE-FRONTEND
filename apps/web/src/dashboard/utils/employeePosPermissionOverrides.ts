export type NoSaleOverrideState = 'inherit' | 'allow' | 'deny'

type DrawerCapabilities = {
  can_no_sale?: boolean
  can_open_cash_drawer?: boolean
  [key: string]: unknown
}

export function noSaleOverrideState(overrides: unknown): NoSaleOverrideState {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return 'inherit'
  const value = overrides as DrawerCapabilities
  if (value.can_no_sale === true && value.can_open_cash_drawer === true) return 'allow'
  if (value.can_no_sale === false || value.can_open_cash_drawer === false) return 'deny'
  return 'inherit'
}

export function withNoSaleOverride(
  overrides: unknown,
  state: NoSaleOverrideState,
): DrawerCapabilities {
  const next: DrawerCapabilities = overrides && typeof overrides === 'object' && !Array.isArray(overrides)
    ? { ...(overrides as DrawerCapabilities) }
    : {}
  delete next.can_no_sale
  delete next.can_open_cash_drawer
  if (state !== 'inherit') {
    const enabled = state === 'allow'
    next.can_no_sale = enabled
    next.can_open_cash_drawer = enabled
  }
  return next
}

export function applyDrawerOverrides(
  role: DrawerCapabilities = {},
  overrides: unknown,
): DrawerCapabilities {
  const merged = { ...role }
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return merged
  const value = overrides as DrawerCapabilities
  if (typeof value.can_no_sale === 'boolean') merged.can_no_sale = value.can_no_sale
  if (typeof value.can_open_cash_drawer === 'boolean') merged.can_open_cash_drawer = value.can_open_cash_drawer
  return merged
}

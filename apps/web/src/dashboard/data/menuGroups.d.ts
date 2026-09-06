// Hand-written declarations for menuGroups.js so TypeScript surfaces
// (onboarding ModifierEditor) can use the questions data layer. Only the
// functions consumed from TS are declared — extend as needed.

export type ModifierGroupOption = {
  modifier_id: string
  is_default: boolean
  display_order: number
  overage_price: number | null
  child_group_id: string | null
  default_pre_modifier: string | null
  pre_modifier_price_overrides: Record<string, number>
}

export type ModifierGroup = {
  id: string
  restaurant_id: string
  name: string
  min_selections: number | null
  max_selections: number | null
  is_required: boolean
  prompt_on_order: boolean
  display_order: number | null
  included_count: number | null
  overage_price: number | null
  prompt_mode: string | null
  type?: string | null
  item_ids: string[]
  options: ModifierGroupOption[]
  category_links: Array<{ category_id: string; display_order: number }>
}

export type ModifierGroupDraft = {
  name: string
  min_selections?: number
  max_selections?: number | null
  is_required?: boolean
  prompt_on_order?: boolean
  display_order?: number
  included_count?: number
  overage_price?: number | null
  prompt_mode?: string
  pre_modifiers?: string[]
  pre_modifier_prices?: Record<string, number>
  no_print?: boolean
}

export function fetchModifierGroups(restaurantId: string): Promise<ModifierGroup[]>
export function createModifierGroup(restaurantId: string, draft: ModifierGroupDraft): Promise<ModifierGroup>
export function updateModifierGroup(groupId: string, patch: Partial<ModifierGroupDraft>): Promise<ModifierGroup>
export function archiveModifierGroup(groupId: string): Promise<void>
export function replaceGroupItems(
  restaurantId: string,
  groupId: string,
  itemIds: string[],
  expectedItemIds: string[],
): Promise<void>
export function addGroupOption(
  groupId: string,
  modifierId: string,
  extra?: Partial<Pick<ModifierGroupOption, 'is_default' | 'display_order' | 'overage_price' | 'child_group_id'>>,
): Promise<void>
export function updateGroupOption(
  groupId: string,
  modifierId: string,
  patch: Partial<Pick<ModifierGroupOption, 'is_default' | 'display_order' | 'overage_price' | 'child_group_id'>>,
): Promise<void>
export function removeGroupOption(groupId: string, modifierId: string): Promise<void>

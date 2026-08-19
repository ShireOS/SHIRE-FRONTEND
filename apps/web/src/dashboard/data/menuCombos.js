export const newComboSlot = (index = 0) => ({
  client_key: `slot-${Date.now()}-${index}`,
  name: index === 0 ? 'Choose item' : 'Choose option',
  min_selections: '1',
  max_selections: '1',
  display_order: index,
  items: [],
})

export const newComboSlotItem = (index = 0) => ({
  client_key: `slot-item-${Date.now()}-${index}`,
  menu_item_id: '',
  upcharge: '',
  display_order: index,
  is_available: true,
})

export const defaultComboDraft = (displayOrder = 0) => ({
  name: '',
  description: '',
  base_price: '',
  is_available: true,
  display_order: displayOrder,
  slots: [
    { ...newComboSlot(0), name: 'Choose entree' },
    { ...newComboSlot(1), name: 'Choose side' },
    { ...newComboSlot(2), name: 'Choose drink' },
  ],
})

export const comboDraftFromApi = (combo) => ({
  id: combo.id,
  name: combo.name || '',
  description: combo.description || '',
  base_price: combo.base_price == null ? '' : String(combo.base_price),
  is_available: combo.is_available !== false,
  display_order: Number(combo.display_order) || 0,
  slots: (combo.slots || []).map((slot, slotIndex) => ({
    id: slot.id,
    client_key: slot.id || `slot-${combo.id}-${slotIndex}`,
    name: slot.name || '',
    min_selections: String(slot.min_selections ?? 1),
    max_selections: String(slot.max_selections ?? 1),
    display_order: Number(slot.display_order) || slotIndex,
    items: (slot.items || []).map((item, itemIndex) => ({
      id: item.id,
      client_key: item.id || `slot-item-${slot.id}-${item.menu_item_id}-${itemIndex}`,
      menu_item_id: item.menu_item_id || '',
      upcharge: item.upcharge == null ? '' : String(item.upcharge),
      display_order: Number(item.display_order) || itemIndex,
      is_available: item.is_available !== false,
    })),
  })),
})

const intOrZero = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

const moneyOrZero = (value, label) => {
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a valid non-negative amount.`)
  return Math.round((parsed + Number.EPSILON) * 100) / 100
}

export const comboPayloadFromDraft = (draft, managerPasscode) => {
  const name = draft.name.trim()
  if (!name) throw new Error('Name the combo first.')
  if (!String(managerPasscode || '').trim()) throw new Error('Manager PIN is required to save combos.')
  const rawSlots = draft.slots || []
  if (rawSlots.length === 0) throw new Error('Add at least one combo choice path.')
  const slots = rawSlots.map((slot, slotIndex) => {
    const slotName = String(slot.name || '').trim()
    if (!slotName) throw new Error(`Path ${slotIndex + 1} needs a name.`)
    const min = Math.max(0, intOrZero(slot.min_selections))
    const max = Math.max(1, intOrZero(slot.max_selections))
    if (max < min) throw new Error(`${slotName} max selections must be at least min selections.`)
    const items = (slot.items || [])
      .filter(item => item.menu_item_id)
      .map((item, itemIndex) => ({
        menu_item_id: item.menu_item_id,
        upcharge: moneyOrZero(item.upcharge, `${slotName} upcharge`),
        display_order: Number.isFinite(Number(item.display_order)) ? intOrZero(item.display_order) : itemIndex,
        is_available: item.is_available !== false,
      }))
    if (new Set(items.map(item => item.menu_item_id)).size !== items.length) {
      throw new Error(`${slotName} cannot contain the same menu item more than once.`)
    }
    return {
      name: slotName,
      min_selections: min,
      max_selections: max,
      display_order: Number.isFinite(Number(slot.display_order)) ? intOrZero(slot.display_order) : slotIndex,
      items,
    }
  })
  for (const slot of slots) {
    if (slot.items.length < slot.min_selections) {
      throw new Error(`${slot.name} needs at least ${slot.min_selections} item option${slot.min_selections === 1 ? '' : 's'}.`)
    }
    const liveItems = slot.items.filter(item => item.is_available)
    if (draft.is_available !== false && liveItems.length < slot.min_selections) {
      throw new Error(`${slot.name} needs at least ${slot.min_selections} live item option${slot.min_selections === 1 ? '' : 's'}.`)
    }
  }
  return {
    manager_passcode: String(managerPasscode).trim(),
    name,
    description: String(draft.description || '').trim() || null,
    base_price: moneyOrZero(draft.base_price, 'Base price'),
    is_available: draft.is_available !== false,
    display_order: intOrZero(draft.display_order),
    slots,
  }
}

import { useEffect, useMemo, useState } from 'react'
import {
  defaultComboDraft,
  comboDraftFromApi,
  newComboSlot,
  newComboSlotItem,
} from './data/menuCombos.js'
import {
  Field,
  MenuEmptyState,
  SaveStatus,
  SectionShell,
  SelectInput,
  SmallButton,
  TextAreaInput,
  TextInput,
  cleanDecimal,
  cleanDigits,
  money,
} from './components/menuUi'

const sortItems = (items) => [...items].sort((a, b) => {
  const category = String(a.category || '').localeCompare(String(b.category || ''), undefined, { sensitivity: 'base' })
  return category || String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
})

function ComboSlotEditor({ slot, slotIndex, draft, setDraft, menuItems, disabled }) {
  const selectedIds = new Set(slot.items.map(item => item.menu_item_id).filter(Boolean))
  const patchSlot = (patch) => {
    setDraft(current => ({
      ...current,
      slots: current.slots.map((candidate, index) => index === slotIndex ? { ...candidate, ...patch } : candidate),
    }))
  }
  const patchSlotItem = (itemIndex, patch) => {
    patchSlot({
      items: slot.items.map((candidate, index) => index === itemIndex ? { ...candidate, ...patch } : candidate),
    })
  }
  const addSlotItem = () => {
    const nextItem = newComboSlotItem(slot.items.length)
    setDraft(current => ({
      ...current,
      slots: current.slots.map((candidate, index) => (
        index === slotIndex ? { ...candidate, items: [...candidate.items, nextItem] } : candidate
      )),
    }))
  }
  const removeSlotItem = (itemIndex) => {
    patchSlot({ items: slot.items.filter((_, index) => index !== itemIndex) })
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="grid gap-3 md:grid-cols-[1.5fr_0.7fr_0.7fr_auto]">
        <Field label="Path">
          <TextInput
            value={slot.name}
            disabled={disabled}
            onChange={event => patchSlot({ name: event.target.value })}
            placeholder="Choose side"
          />
        </Field>
        <Field label="Min">
          <TextInput
            inputMode="numeric"
            value={slot.min_selections}
            disabled={disabled}
            onChange={event => patchSlot({ min_selections: cleanDigits(event.target.value, 2) })}
          />
        </Field>
        <Field label="Max">
          <TextInput
            inputMode="numeric"
            value={slot.max_selections}
            disabled={disabled}
            onChange={event => patchSlot({ max_selections: cleanDigits(event.target.value, 2) })}
          />
        </Field>
        <div className="flex items-end">
          <SmallButton
            variant="danger"
            disabled={disabled || draft.slots.length <= 1}
            onClick={() => setDraft(current => ({ ...current, slots: current.slots.filter((_, index) => index !== slotIndex) }))}
          >
            Remove
          </SmallButton>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {slot.items.map((item, itemIndex) => (
          <div key={item.client_key || item.id || itemIndex} className="grid gap-2 md:grid-cols-[1fr_8rem_auto_auto]">
            <SelectInput
              value={item.menu_item_id}
              disabled={disabled}
              onChange={event => patchSlotItem(itemIndex, { menu_item_id: event.target.value })}
            >
              <option value="">Pick menu item...</option>
              {menuItems.map(menuItem => {
                const alreadySelected = selectedIds.has(menuItem.id) && item.menu_item_id !== menuItem.id
                return (
                  <option key={menuItem.id} value={menuItem.id} disabled={alreadySelected}>
                    {menuItem.name} · {menuItem.category || 'Other'} · {money(menuItem.price)}
                  </option>
                )
              })}
            </SelectInput>
            <TextInput
              inputMode="decimal"
              value={item.upcharge}
              disabled={disabled}
              onChange={event => patchSlotItem(itemIndex, { upcharge: cleanDecimal(event.target.value) })}
              placeholder="Upcharge"
              title="Extra amount charged only when this choice is selected"
            />
            <SmallButton
              variant={item.is_available === false ? 'secondary' : 'primary'}
              disabled={disabled}
              onClick={() => patchSlotItem(itemIndex, { is_available: item.is_available === false })}
              title="Unavailable choices stay configured but do not show on POS"
            >
              {item.is_available === false ? 'Hidden' : 'Live'}
            </SmallButton>
            <SmallButton variant="danger" disabled={disabled} onClick={() => removeSlotItem(itemIndex)}>Remove</SmallButton>
          </div>
        ))}
        <SmallButton onClick={addSlotItem} disabled={disabled}>+ Add choice</SmallButton>
      </div>
    </div>
  )
}

function ComboEditor({ mode, combo, initialDisplayOrder, menuItems, managerPasscode, busy, status, onSave, onArchive }) {
  const [draft, setDraft] = useState(() => combo ? comboDraftFromApi(combo) : defaultComboDraft(initialDisplayOrder))

  const disabled = Boolean(busy)
  const title = mode === 'create' ? 'New combo' : draft.name || 'Combo'
  const selectedItemCount = draft.slots.reduce((sum, slot) => sum + slot.items.filter(item => item.menu_item_id).length, 0)

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h4 className="text-lg font-semibold tracking-tight">{title}</h4>
          <p className="mt-1 text-sm text-dash-tertiary">
            {draft.slots.length} paths · {selectedItemCount} choices · {draft.is_available === false ? 'hidden from POS' : 'live on POS'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveStatus message={status} />
          <SmallButton
            variant={draft.is_available === false ? 'secondary' : 'primary'}
            disabled={disabled}
            onClick={() => setDraft(current => ({ ...current, is_available: current.is_available === false }))}
          >
            {draft.is_available === false ? 'Hidden' : 'Live'}
          </SmallButton>
          {mode === 'edit' && (
            <SmallButton
              variant="danger"
              disabled={disabled || !managerPasscode.trim()}
              onClick={() => onArchive(combo.id)}
            >
              Archive
            </SmallButton>
          )}
          <SmallButton variant="primary" disabled={disabled || !managerPasscode.trim()} onClick={() => onSave(draft)}>
            {mode === 'create' ? 'Create combo' : 'Save combo'}
          </SmallButton>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_8rem_7rem]">
        <Field label="Name">
          <TextInput
            value={draft.name}
            disabled={disabled}
            onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
            placeholder="Burger Combo"
          />
        </Field>
        <Field label="Base price">
          <TextInput
            inputMode="decimal"
            value={draft.base_price}
            disabled={disabled}
            onChange={event => setDraft(current => ({ ...current, base_price: cleanDecimal(event.target.value) }))}
            placeholder="0.00"
          />
        </Field>
        <Field label="Order">
          <TextInput
            inputMode="numeric"
            value={String(draft.display_order ?? 0)}
            disabled={disabled}
            onChange={event => setDraft(current => ({ ...current, display_order: cleanDigits(event.target.value, 3) }))}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Description">
          <TextAreaInput
            value={draft.description}
            disabled={disabled}
            onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
            placeholder="Optional internal/POS description"
            className="!min-h-16"
          />
        </Field>
      </div>

      <div className="mt-4 space-y-3">
        {draft.slots.map((slot, slotIndex) => (
          <ComboSlotEditor
            key={slot.client_key || slot.id || slotIndex}
            slot={slot}
            slotIndex={slotIndex}
            draft={draft}
            setDraft={setDraft}
            menuItems={menuItems}
            disabled={disabled}
          />
        ))}
      </div>
      <div className="mt-3">
        <SmallButton
          disabled={disabled}
          onClick={() => setDraft(current => ({ ...current, slots: [...current.slots, newComboSlot(current.slots.length)] }))}
        >
          + Add path
        </SmallButton>
      </div>
    </div>
  )
}

export function MenuCombosPanel({
  combos,
  menuItems,
  managerPasscode,
  onManagerPasscodeChange,
  busy,
  statusFor,
  onCreateCombo,
  onUpdateCombo,
  onArchiveCombo,
}) {
  const sortedItems = useMemo(() => sortItems(menuItems), [menuItems])
  const [showCreate, setShowCreate] = useState(() => combos.length === 0)

  useEffect(() => {
    if (combos.length === 0) setShowCreate(true)
  }, [combos.length])

  return (
    <SectionShell
      title="Combos"
      description="Combos use the POS combo engine: one parent combo price, then required choice paths with optional premium upcharges."
      actions={(
        <>
          <div className="w-40">
            <TextInput
              type="password"
              value={managerPasscode}
              onChange={event => onManagerPasscodeChange(event.target.value)}
              placeholder="Manager PIN"
              className="!py-2"
            />
          </div>
          <SmallButton variant="primary" onClick={() => setShowCreate(current => !current)}>
            {showCreate ? 'Close new combo' : '+ Add combo'}
          </SmallButton>
        </>
      )}
    >
      {sortedItems.length === 0 ? (
        <MenuEmptyState title="No menu items yet">
          Add menu items first, then build combos from those item choices.
        </MenuEmptyState>
      ) : (
        <div className="space-y-4">
          {showCreate && (
            <ComboEditor
              key="new-combo"
              mode="create"
              initialDisplayOrder={combos.length}
              menuItems={sortedItems}
              managerPasscode={managerPasscode}
              busy={busy}
              status={statusFor('combo:new')}
              onSave={async draft => {
                const saved = await onCreateCombo(draft)
                if (saved) setShowCreate(false)
              }}
            />
          )}

          {combos.map(combo => (
            <ComboEditor
              key={combo.id}
              mode="edit"
              combo={combo}
              menuItems={sortedItems}
              managerPasscode={managerPasscode}
              busy={busy}
              status={statusFor(`combo:${combo.id}`)}
              onSave={draft => onUpdateCombo(combo.id, draft)}
              onArchive={comboId => {
                if (window.confirm(`Archive ${combo.name}?`)) void onArchiveCombo(comboId)
              }}
            />
          ))}

          {combos.length === 0 && !showCreate && (
            <MenuEmptyState title="No combos yet">
              Create a combo to make it appear as a combo tile on POS.
            </MenuEmptyState>
          )}
        </div>
      )}
    </SectionShell>
  )
}

import assert from 'node:assert/strict'
import test from 'node:test'

import { comboDraftFromApi, comboPayloadFromDraft } from './menuCombos.js'

test('combo payload preserves the POS combo engine shape', () => {
  const payload = comboPayloadFromDraft({
    name: 'Burger Combo',
    description: 'Lunch combo',
    base_price: '12.50',
    is_available: true,
    display_order: '3',
    slots: [{
      name: 'Choose side',
      min_selections: '1',
      max_selections: '1',
      display_order: 0,
      items: [
        { menu_item_id: 'fries', upcharge: '', display_order: 0, is_available: true },
        { menu_item_id: 'rings', upcharge: '1.25', display_order: 1, is_available: false },
      ],
    }],
  }, '1234')

  assert.deepEqual(payload, {
    manager_passcode: '1234',
    name: 'Burger Combo',
    description: 'Lunch combo',
    base_price: 12.5,
    is_available: true,
    display_order: 3,
    slots: [{
      name: 'Choose side',
      min_selections: 1,
      max_selections: 1,
      display_order: 0,
      items: [
        { menu_item_id: 'fries', upcharge: 0, display_order: 0, is_available: true },
        { menu_item_id: 'rings', upcharge: 1.25, display_order: 1, is_available: false },
      ],
    }],
  })
})

test('combo payload blocks incomplete slots before hitting POS', () => {
  assert.throws(() => comboPayloadFromDraft({
    name: 'Empty Combo',
    base_price: '9',
    description: '',
    is_available: true,
    display_order: 0,
    slots: [{ name: 'Choose drink', min_selections: '2', max_selections: '2', items: [{ menu_item_id: 'cola' }] }],
  }, '1234'), /needs at least 2 item options/)
})

test('combo payload rejects paths that would disappear or be unusable on POS', () => {
  const base = {
    name: 'Lunch Combo',
    base_price: '9',
    description: '',
    is_available: true,
    display_order: 0,
  }

  assert.throws(() => comboPayloadFromDraft({
    ...base,
    slots: [{ name: '', min_selections: '1', max_selections: '1', items: [{ menu_item_id: 'cola' }] }],
  }, '1234'), /Path 1 needs a name/)

  assert.throws(() => comboPayloadFromDraft({
    ...base,
    slots: [{
      name: 'Choose drink',
      min_selections: '1',
      max_selections: '1',
      items: [{ menu_item_id: 'cola', is_available: false }],
    }],
  }, '1234'), /needs at least 1 live item option/)
})

test('combo payload rejects duplicate choices and malformed money', () => {
  const draft = {
    name: 'Lunch Combo',
    base_price: '9',
    description: '',
    is_available: true,
    display_order: 0,
    slots: [{
      name: 'Choose drink',
      min_selections: '1',
      max_selections: '1',
      items: [{ menu_item_id: 'cola' }, { menu_item_id: 'cola' }],
    }],
  }

  assert.throws(() => comboPayloadFromDraft(draft, '1234'), /same menu item more than once/)
  assert.throws(() => comboPayloadFromDraft({ ...draft, base_price: '1.2.3', slots: [{
    name: 'Choose drink',
    min_selections: '1',
    max_selections: '1',
    items: [{ menu_item_id: 'cola' }],
  }] }, '1234'), /Base price must be a valid non-negative amount/)
})

test('combo draft round-trips manager combo API rows', () => {
  const draft = comboDraftFromApi({
    id: 'combo-1',
    name: 'Taco Combo',
    description: null,
    base_price: 10,
    is_available: false,
    display_order: 2,
    slots: [{
      id: 'slot-1',
      name: 'Choose drink',
      min_selections: 1,
      max_selections: 1,
      display_order: 0,
      items: [{ id: 'row-1', menu_item_id: 'tea', upcharge: 0.5, display_order: 0, is_available: true }],
    }],
  })

  assert.equal(draft.id, 'combo-1')
  assert.equal(draft.description, '')
  assert.equal(draft.is_available, false)
  assert.equal(draft.slots[0].items[0].upcharge, '0.5')
})

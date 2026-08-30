import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeKitchenAlias, withKitchenItemAlias } from './menuPrintingAliases.js'

test('kitchen aliases are compact, trimmed, and ticket-length bounded', () => {
  assert.equal(normalizeKitchenAlias('  Chix   Parm  '), 'Chix Parm')
  assert.equal(normalizeKitchenAlias('x'.repeat(50)), 'x'.repeat(40))
})

test('updating one item alias preserves ticket policy and station overrides', () => {
  const current = {
    kitchen: { item_name_mode: 'alias' },
    aliases: { items: { burger: 'BGR' }, modifiers: { cheese: 'CHZ' } },
    stations: { grill: { aliases: { items: { burger: 'GRILL BGR' } } } },
  }

  assert.deepEqual(withKitchenItemAlias(current, 'salad', ' House   Sal '), {
    kitchen: { item_name_mode: 'alias' },
    aliases: { items: { burger: 'BGR', salad: 'House Sal' }, modifiers: { cheese: 'CHZ' } },
    stations: { grill: { aliases: { items: { burger: 'GRILL BGR' } } } },
  })
})

test('choosing the full POS name removes only that item alias', () => {
  const current = { aliases: { items: { burger: 'BGR', salad: 'SAL' }, modifiers: { cheese: 'CHZ' } } }
  assert.deepEqual(withKitchenItemAlias(current, 'burger', ''), {
    aliases: { items: { salad: 'SAL' }, modifiers: { cheese: 'CHZ' } },
  })
})

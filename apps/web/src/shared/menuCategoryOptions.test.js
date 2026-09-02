import assert from 'node:assert/strict'
import test from 'node:test'

import {
  effectiveFireModeLabel,
  kdsDisplayGroupOptions,
  normalizeCategoryOptionLabel,
} from './menuCategoryOptions.js'

test('category option labels collapse whitespace without changing human capitalization', () => {
  assert.equal(normalizeCategoryOptionLabel('  Cold   Line  '), 'Cold Line')
})

test('KDS display groups reuse existing capitalization case-insensitively', () => {
  assert.deepEqual(kdsDisplayGroupOptions(
    [{ kds_display_group: 'Bar' }, { kds_display_group: ' cold   line ' }],
    [{ kds_display_group: 'bar' }, { kds_display_group: 'Desserts' }],
  ), ['Bar', 'cold line', 'Desserts'])
})

test('the inherited order fire mode has an understandable effective label', () => {
  assert.equal(effectiveFireModeLabel('by_course'), 'By course')
  assert.equal(effectiveFireModeLabel(undefined), 'Immediate')
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clonedModifierGroupRow,
  runWithMissingColumnFallbacks,
  withoutColumns,
} from './menuGroupsPolicy.js'

test('missing-column responses advance to the legacy Supabase shape', async () => {
  const calls = []
  const { result, fallbackIndex } = await runWithMissingColumnFallbacks([
    async () => { calls.push('current'); return { data: null, error: { code: '42703' } } },
    async () => { calls.push('legacy'); return { data: [{ id: 'row' }], error: null } },
  ])

  assert.deepEqual(calls, ['current', 'legacy'])
  assert.equal(fallbackIndex, 1)
  assert.deepEqual(result.data, [{ id: 'row' }])
})

test('PostgREST schema-cache column misses use the same fallback', async () => {
  const { result, fallbackIndex } = await runWithMissingColumnFallbacks([
    async () => ({ data: null, error: { code: 'PGRST204' } }),
    async () => ({ data: [{ id: 'legacy-row' }], error: null }),
  ])

  assert.equal(fallbackIndex, 1)
  assert.deepEqual(result.data, [{ id: 'legacy-row' }])
})

test('non-schema Supabase errors are never swallowed or retried', async () => {
  let fallbackCalled = false
  const permissionError = { code: '42501', message: 'permission denied' }
  const { result, fallbackIndex } = await runWithMissingColumnFallbacks([
    async () => ({ data: null, error: permissionError }),
    async () => { fallbackCalled = true; return { data: [], error: null } },
  ])

  assert.equal(fallbackCalled, false)
  assert.equal(fallbackIndex, 0)
  assert.equal(result.error, permissionError)
})

test('column stripping leaves the original payload untouched', () => {
  const row = { name: 'Sides', no_print: true, kitchen_display_role: 'side' }
  assert.deepEqual(withoutColumns(row, ['kitchen_display_role']), { name: 'Sides', no_print: true })
  assert.equal(row.kitchen_display_role, 'side')
})

test('private question clones preserve their group-level kitchen hierarchy', () => {
  const row = clonedModifierGroupRow('restaurant-1', {
    id: 'group-1',
    name: 'Choose a side',
    min_selections: 1,
    max_selections: 1,
    is_required: true,
    prompt_on_order: true,
    display_order: 2,
    is_available: true,
    kitchen_display_role: 'side',
  }, 'group-1')

  assert.equal(row.name, 'Choose a side (custom)')
  assert.equal(row.kitchen_display_role, 'side')
})

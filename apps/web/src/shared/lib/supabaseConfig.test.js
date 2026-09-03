import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeSupabaseUrl } from './supabaseConfig.js'

test('Supabase startup accepts valid HTTP origins and normalizes whitespace', () => {
  assert.equal(
    normalizeSupabaseUrl('  https://example.supabase.co/  '),
    'https://example.supabase.co',
  )
  assert.equal(normalizeSupabaseUrl('http://127.0.0.1:54321'), 'http://127.0.0.1:54321')
})

test('Supabase startup rejects malformed deployment placeholders without throwing', () => {
  assert.equal(normalizeSupabaseUrl('[SENSITIVE]'), null)
  assert.equal(normalizeSupabaseUrl('not-a-url'), null)
  assert.equal(normalizeSupabaseUrl('javascript:alert(1)'), null)
  assert.equal(normalizeSupabaseUrl(''), null)
})

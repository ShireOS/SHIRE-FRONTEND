import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const onboarding = readFileSync(new URL('./hooks/useOnboarding.ts', import.meta.url), 'utf8')
const setupPanel = readFileSync(new URL('../dashboard/RestaurantSetupPanel.jsx', import.meta.url), 'utf8')
const ratesPage = readFileSync(new URL('../dashboard/pages/RatesPage.jsx', import.meta.url), 'utf8')

test('onboarding drafts explicitly remove every persisted sensitive value', () => {
  const sanitizer = onboarding.match(/const withoutSensitiveDraftValues[\s\S]*?\n\}\)/)?.[0] || ''
  for (const field of [
    'ein',
    'tos_signature_data_url',
    'bank_account_holder',
    'bank_name',
    'bank_routing_number',
    'bank_account_number',
  ]) {
    assert.match(sanitizer, new RegExp(`${field}:`))
  }
  assert.match(onboarding, /data: withoutSensitiveDraftValues\(draft\.data\)/)
})

test('completed onboarding no longer writes secrets into restaurant config', () => {
  const completion = onboarding.slice(onboarding.indexOf('// Complete onboarding'))
  const configWrite = completion.match(/config: \{[\s\S]*?reservation_timing_same_for_channels:/)?.[0] || ''
  for (const field of [
    'ein:',
    'tos_signature_data_url:',
    'bank_account_holder:',
    'bank_name:',
    'bank_routing_number:',
    'bank_account_number:',
  ]) {
    assert.doesNotMatch(configWrite, new RegExp(field))
  }
})

test('permanent setup and rates use the guarded sensitive-settings contract', () => {
  assert.match(setupPanel, /fetchRestaurantSensitiveSettings\(targetRestaurantId, \{ signal \}\)/)
  assert.match(setupPanel, /saveGuardedSetupConfig/)
  assert.match(ratesPage, /fetchRestaurantSensitiveSettings\(restaurant\.id\)/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { FORWARDING_PROVIDERS, forwardingProviderById } from './forwardingProviders.js'

test('every forwarding provider has instructions for both routing modes', () => {
  assert.ok(FORWARDING_PROVIDERS.length >= 5)
  assert.equal(new Set(FORWARDING_PROVIDERS.map((provider) => provider.id)).size, FORWARDING_PROVIDERS.length)
  for (const provider of FORWARDING_PROVIDERS) {
    assert.ok(provider.label)
    assert.ok(provider.product)
    assert.ok(provider.allCalls.length >= 3)
    assert.ok(provider.missedCalls.length >= 3)
    if (provider.accountUrl) assert.equal(new URL(provider.accountUrl).protocol, 'https:')
    if (provider.instructionsUrl) assert.equal(new URL(provider.instructionsUrl).protocol, 'https:')
  }
})

test('provider lookup fails closed for unknown stored values', () => {
  assert.equal(forwardingProviderById('verizon_business')?.label, 'Verizon Business')
  assert.equal(forwardingProviderById('not-a-provider'), null)
})

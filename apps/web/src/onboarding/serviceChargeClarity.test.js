import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const shared = await readFile(new URL('../../../../packages/settings/src/sections.ts', import.meta.url), 'utf8')
const onboarding = await readFile(new URL('./pages/steps/TaxesChargesStep.tsx', import.meta.url), 'utf8')
const setup = await readFile(new URL('../dashboard/RestaurantSetupPanel.jsx', import.meta.url), 'utf8')

test('new service charges use a faded example instead of pretending a name was entered', () => {
  assert.match(shared, /export function defaultServiceCharge[\s\S]*name: ''/)
  assert.match(onboarding, /placeholder="e\.g\. Large-party gratuity"/)
  assert.match(setup, /placeholder="e\.g\. Large-party gratuity"/)
  assert.doesNotMatch(onboarding, /name: index === 0 \? 'Service Charge'/)
  assert.doesNotMatch(setup, /name: index === 0 \? 'Service Charge'/)
})

test('onboarding and existing setup explain every service-charge field', () => {
  for (const source of [onboarding, setup]) {
    assert.match(source, /Charge name/)
    assert.match(source, /Calculated as/)
    assert.match(source, /Rate \(%\)/)
    assert.match(source, /Applies to/)
    assert.match(source, /appears to staff and on receipts/)
  }
})

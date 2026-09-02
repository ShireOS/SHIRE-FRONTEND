import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const onboarding = await readFile(new URL('./pages/steps/TipPayrollStep.tsx', import.meta.url), 'utf8')
const existingSetup = await readFile(new URL('../dashboard/RestaurantSetupPanel.jsx', import.meta.url), 'utf8')

test('drawer payout controls use explicit enabled and disabled labels in both editors', () => {
  for (const source of [onboarding, existingSetup]) {
    assert.match(source, /value: 'on', label: 'Enabled'/)
    assert.match(source, /value: 'off', label: 'Disabled'/)
  }
})

test('onboarding selected state uses a concrete contrasting color', () => {
  assert.match(onboarding, /bg-\[#d4a854\] text-\[#111111\]/)
  assert.doesNotMatch(onboarding, /bg-\[rgb\(var\(--gold\)\)\] text-black/)
})

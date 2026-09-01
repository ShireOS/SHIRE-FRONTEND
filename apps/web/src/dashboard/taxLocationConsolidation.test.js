import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

const setup = read('./RestaurantSetupPanel.jsx')
const menu = read('./MenuPanel.jsx')
const onboardingTaxes = read('../onboarding/pages/steps/TaxesChargesStep.tsx')
const onboardingCategories = read('../onboarding/pages/steps/MenuCategoriesStep.tsx')
const onboardingPayments = read('../onboarding/pages/steps/PaymentsStep.tsx')
const onboardingHook = read('../onboarding/hooks/useOnboarding.ts')

test('restaurant-facing tax configuration is read-only and address-derived', () => {
  for (const source of [setup, onboardingTaxes]) {
    assert.doesNotMatch(source, /Use Myrtle Beach/)
    assert.doesNotMatch(source, /Add tax rate|New tax/)
    assert.doesNotMatch(source, /onChange=.*tax\.rate/)
  }
  assert.match(setup, /Platform support verifies and updates them/)
  assert.match(onboardingTaxes, /restaurant users cannot override them/)
})

test('menu tax assignments are displayed without restaurant-facing selectors', () => {
  assert.doesNotMatch(menu, /onChange=\{event => updateCategory\(index, \{ tax_rate_id/)
  assert.doesNotMatch(menu, /onSetTaxRate=/)
  assert.doesNotMatch(onboardingCategories, /Tax override|tax_rate_id: event\.target\.value/)
  assert.match(menu, /support-managed tax/)
})

test('address and pricing jurisdiction use the canonical restaurant profile', () => {
  assert.match(onboardingHook, /\/restaurants\/\$\{existingRestaurantId\}\/setup-profile/)
  assert.match(onboardingHook, /delete pricingPayload\.jurisdiction_state/)
  assert.doesNotMatch(onboardingPayments, /jurisdiction_state.*onChange/)
  assert.doesNotMatch(setup, /jurisdiction_state.*onChange/)
})

test('restaurant saves omit support-owned tax rates and category assignments', () => {
  assert.match(onboardingHook, /tax_rates: _taxRates, category_assignments: _assignments/)
  assert.match(setup, /tax_rates, category_assignments, \.\.\.chargesOnlyPayload/)
})

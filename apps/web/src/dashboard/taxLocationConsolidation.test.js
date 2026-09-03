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
const taxJurisdiction = read('./components/TaxJurisdictionPanel.tsx')
const dashboardShell = read('./shell/DashboardShell.jsx')
const locationFields = read('../shared/components/RestaurantLocationFields.tsx')

test('restaurant tax percentages stay address-derived except for the audited reseller override', () => {
  for (const source of [setup, onboardingTaxes]) {
    assert.doesNotMatch(source, /Use Myrtle Beach/)
    assert.doesNotMatch(source, /Add tax rate|New tax/)
    assert.doesNotMatch(source, /onChange=.*tax\.rate/)
  }
  assert.match(setup, /canonical restaurant location/)
  assert.match(onboardingTaxes, /never type or override a percentage/)
  assert.match(taxJurisdiction, /can_override/)
  assert.match(taxJurisdiction, /Save audited tax override/)
  assert.match(taxJurisdiction, /tax_change_reason/)
  assert.match(dashboardShell, /\['reseller', 'reseller_employee', 'admin'\]\.includes\(accountType\)/)
})

test('menu editors cannot directly select a percentage-bearing tax row', () => {
  assert.doesNotMatch(menu, /onChange=\{event => updateCategory\(index, \{ tax_rate_id/)
  assert.doesNotMatch(menu, /onSetTaxRate=/)
  assert.doesNotMatch(onboardingCategories, /Tax override|tax_rate_id: event\.target\.value/)
  assert.match(menu, /support-managed tax/)
})

test('provider resolution sends semantic classes and requires explicit mixed-category mapping', () => {
  assert.match(taxJurisdiction, /taxes-charges\/resolve/)
  assert.match(taxJurisdiction, /enabled_tax_classes: enabledClasses/)
  assert.match(taxJurisdiction, /Classify every active menu category/)
  assert.doesNotMatch(taxJurisdiction, /\btax_rate\s*:/)
  assert.match(taxJurisdiction, /placeholder 0% rate is not treated as valid/)
  assert.match(onboardingCategories, /Sales tax class/)
  assert.match(onboardingCategories, /classifying what is sold—not entering a percentage/)
  assert.doesNotMatch(onboardingCategories, /tax\.rate|Rate %/)
})

test('authorized manual-tax editors can attempt verification before entering fallback rates', () => {
  assert.match(taxJurisdiction, /const verificationAvailable = providerConfigured \|\| canOverride/)
  assert.match(taxJurisdiction, /restaurantId[\s\S]*&& verificationAvailable[\s\S]*&& enabledClasses\.length/)
  assert.match(taxJurisdiction, /Try validation first; if SHIRE cannot resolve the selected taxes/)
  assert.match(taxJurisdiction, /enter every required tax percentage in the manual override below/)
})

test('address and pricing jurisdiction use the canonical restaurant profile', () => {
  assert.match(onboardingHook, /\/restaurants\/\$\{existingRestaurantId\}\/setup-profile/)
  assert.match(onboardingHook, /delete pricingPayload\.jurisdiction_state/)
  assert.doesNotMatch(onboardingPayments, /jurisdiction_state.*onChange/)
  assert.doesNotMatch(setup, /jurisdiction_state.*onChange/)
})

test('address lookup hides provider internals and ignores stale searches', () => {
  assert.doesNotMatch(locationFields, /source_version/)
  assert.match(locationFields, /Verified U\.S\. Census location/)
  assert.match(locationFields, /activeRequest\.current\?\.abort\(\)/)
  assert.match(locationFields, /requestSequence\.current !== sequence/)
})

test('address lookup always exposes an explicit manual-entry escape hatch', () => {
  assert.match(locationFields, /const useTypedAddress = \(\) =>/)
  assert.match(locationFields, /Stop and use typed address/)
  assert.match(locationFields, /Use typed address/)
  assert.match(locationFields, /cancelSearch\(\)[\s\S]*setUsingTypedAddress\(true\)/)
  assert.match(locationFields, /Using the address exactly as entered/)
  assert.match(locationFields, /correct the fields and retry, or use the complete typed address manually/)
})

test('restaurant saves omit support-owned tax rates and category assignments', () => {
  assert.match(onboardingHook, /tax_rates: _taxRates, category_assignments: _assignments/)
  assert.match(setup, /tax_rates, category_assignments, \.\.\.chargesOnlyPayload/)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MYRTLE_BEACH_CITY_LIMITS_TAX_PRESET,
  normalizeCategoryTaxAssignments,
  normalizeAutoGratuity,
  normalizeTaxRates,
  taxesChargesPayload,
  taxAppliesToOptions,
  taxPresetDraft,
} from './index.ts'

test('Myrtle Beach city-limits preset separates beer/wine from liquor', () => {
  const draft = taxPresetDraft(MYRTLE_BEACH_CITY_LIMITS_TAX_PRESET)

  assert.deepEqual(draft.tax_rates.map(rate => [rate.name, rate.rate, rate.applies_to]), [
    ['Food Tax', '11.5', 'food'],
    ['Beer/Wine Tax', '11.5', 'beer_wine'],
    ['Liquor Tax', '16.5', 'liquor'],
  ])
  assert.deepEqual(draft.category_assignments.slice(0, 2), [
    { category_name: 'Beer & Wine', tax_name: 'Beer/Wine Tax' },
    { category_name: 'Cocktails', tax_name: 'Liquor Tax' },
  ])
  assert.notEqual(draft.tax_rates, MYRTLE_BEACH_CITY_LIMITS_TAX_PRESET.rates)
  assert.notEqual(draft.category_assignments, MYRTLE_BEACH_CITY_LIMITS_TAX_PRESET.category_assignments)
})

test('auto gratuity payload preserves sorted tier thresholds', () => {
  const gratuity = normalizeAutoGratuity({
    enabled: true,
    label: 'Gratuity',
    assigned_to_employee: true,
    rules: [
      { party_threshold: 12, percent: 25 },
      { party_threshold: 6, percent: 20 },
    ],
  })

  assert.deepEqual(gratuity.rules, [
    { party_threshold: '6', percent: '20' },
    { party_threshold: '12', percent: '25' },
  ])

  const payload = taxesChargesPayload([], [], gratuity)
  assert.deepEqual(payload.auto_gratuity.rules, [
    { party_threshold: 6, percent: 20 },
    { party_threshold: 12, percent: 25 },
  ])
  assert.equal(payload.auto_gratuity.party_threshold, 6)
  assert.equal(payload.auto_gratuity.percent, 20)
})

test('legacy alcohol rows survive normalization until a restaurant splits them', () => {
  const [legacy] = normalizeTaxRates([{
    name: 'Alcohol Tax', rate: 10.25, applies_to: 'alcohol', is_default: true,
  }])

  assert.equal(legacy.applies_to, 'alcohol')
  assert.equal(taxAppliesToOptions('alcohol').at(-1)?.value, 'alcohol')
  assert.equal(taxAppliesToOptions('beer_wine').some(option => option.value === 'alcohol'), false)
})

test('category assignment payload deduplicates names and preserves explicit unassigns', () => {
  const assignments = normalizeCategoryTaxAssignments([
    { category_name: ' Cocktails ', tax_name: ' Liquor Tax ' },
    { category_name: 'cocktails', tax_name: null },
    { category_name: 'Beer & Wine', tax_name: 'Beer/Wine Tax' },
  ])
  assert.deepEqual(assignments, [
    { category_name: 'cocktails', tax_name: null },
    { category_name: 'Beer & Wine', tax_name: 'Beer/Wine Tax' },
  ])

  const payload = taxesChargesPayload([], [], undefined, assignments)
  assert.deepEqual(payload.category_assignments, assignments)
})

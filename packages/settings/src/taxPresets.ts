import type { CategoryTaxAssignmentData, TaxRateData } from './types'

export interface TaxJurisdictionPreset {
  id: string
  label: string
  description: string
  rates: TaxRateData[]
  category_assignments: CategoryTaxAssignmentData[]
}

export const MYRTLE_BEACH_CITY_LIMITS_TAX_PRESET: TaxJurisdictionPreset = {
  id: 'myrtle_beach_city_limits',
  label: 'Myrtle Beach city limits',
  description: 'Prepared food, beer, and wine at 11.5%; liquor by the drink at 16.5%.',
  rates: [
    { name: 'Food Tax', rate: '11.5', applies_to: 'food', is_default: true, is_inclusive: false, is_active: true },
    { name: 'Beer/Wine Tax', rate: '11.5', applies_to: 'beer_wine', is_default: false, is_inclusive: false, is_active: true },
    { name: 'Liquor Tax', rate: '16.5', applies_to: 'liquor', is_default: false, is_inclusive: false, is_active: true },
  ],
  category_assignments: [
    { category_name: 'Beer & Wine', tax_name: 'Beer/Wine Tax' },
    { category_name: 'Cocktails', tax_name: 'Liquor Tax' },
  ],
}

export function taxPresetDraft(preset: TaxJurisdictionPreset): {
  tax_rates: TaxRateData[]
  category_assignments: CategoryTaxAssignmentData[]
} {
  return {
    tax_rates: preset.rates.map(rate => ({ ...rate })),
    category_assignments: preset.category_assignments.map(assignment => ({ ...assignment })),
  }
}

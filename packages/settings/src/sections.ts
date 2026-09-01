import { isOptionValue, TAX_APPLIES_TO_VALUES, CHARGE_APPLIES_TO_OPTIONS } from './options'
import { sanitizeInteger, sanitizeNumber, asEnum } from './helpers'
import type { AutoGratuityData, AutoGratuityRuleData, CategoryTaxAssignmentData, SectionBehaviorData, ServiceChargeData, TaxRateData } from './types'

/**
 * 'Table' is always first and deduped case-insensitively; blank names drop.
 * Identical across all three surfaces before consolidation.
 */
export function normalizeSectionNames(sections: unknown): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  ;['Table', ...(Array.isArray(sections) ? sections : [])].forEach(raw => {
    const name = String(raw || '').trim().replace(/\s+/g, ' ')
    if (!name) return
    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(key === 'table' ? 'Table' : name)
  })
  return out.length > 0 ? out : ['Table']
}

const SECTION_SERVICE_MODES = ['standard', 'hibachi', 'bar', 'patio', 'counter', 'custom'] as const
const SECTION_TIP_PROMPT_MODES = ['normal', 'additional', 'disabled'] as const

/** Name-aware defaults: a section called "Hibachi" gets its service charge on. */
export function defaultSectionProfile(name: string): SectionBehaviorData {
  const key = String(name || '').toLowerCase()
  return {
    name,
    service_mode: key === 'hibachi' ? 'hibachi' : key === 'bar' ? 'bar' : ['patio', 'outdoor'].includes(key) ? 'patio' : String(name).startsWith('New Section') ? 'custom' : 'standard',
    auto_gratuity_enabled: key === 'hibachi',
    auto_gratuity_type: 'percentage',
    auto_gratuity_value: '18',
    auto_gratuity_label: key === 'hibachi' ? 'Hibachi Service Charge' : `${name} Service Charge`,
    auto_gratuity_taxable: false,
    assigned_to_employee: true,
    minimum_party_size: '',
    tip_prompt_mode: 'additional',
  }
}

export function normalizeSectionProfiles(rows: unknown, names: string[] = []): SectionBehaviorData[] {
  const source: any[] = Array.isArray(rows) ? rows : []
  const sectionNames = normalizeSectionNames(names.length ? names : source.map(row => row?.name))
  const byName = new Map(source.map(row => [String(row?.name || '').trim().toLowerCase(), row]))
  return sectionNames.map(name => {
    const row = byName.get(name.toLowerCase())
    const fallback = defaultSectionProfile(name)
    if (!row) return fallback
    return {
      ...fallback,
      ...row,
      name,
      service_mode: asEnum(row.service_mode, SECTION_SERVICE_MODES, fallback.service_mode),
      auto_gratuity_type: asEnum(row.auto_gratuity_type, ['percentage', 'fixed'] as const, 'percentage'),
      auto_gratuity_value: String(row.auto_gratuity_value ?? 18),
      assigned_to_employee: typeof row.assigned_to_employee === 'boolean' ? row.assigned_to_employee : fallback.assigned_to_employee,
      minimum_party_size: row.minimum_party_size == null ? '' : String(row.minimum_party_size),
      tip_prompt_mode: asEnum(row.tip_prompt_mode, SECTION_TIP_PROMPT_MODES, fallback.tip_prompt_mode),
    }
  })
}

// --- Taxes, service charges, auto-gratuity ---------------------------------

export function defaultTaxRate(): TaxRateData {
  return {
    name: 'Sales Tax',
    rate: '',
    applies_to: 'all',
    is_default: true,
    is_inclusive: false,
    is_active: true,
  }
}

export function normalizeTaxRates(rows: unknown): TaxRateData[] {
  const normalized = (Array.isArray(rows) ? rows : [])
    .map((row: any) => ({
      id: row?.id || null,
      name: String(row?.name || '').trim(),
      rate: row?.rate == null ? '' : sanitizeNumber(row.rate),
      applies_to: (TAX_APPLIES_TO_VALUES as readonly string[]).includes(row?.applies_to) ? row.applies_to : 'all',
      is_default: Boolean(row?.is_default),
      is_inclusive: Boolean(row?.is_inclusive),
      is_active: row?.is_active !== false,
      tax_class: row?.tax_class == null ? null : String(row.tax_class),
      fulfillment_context: (['any', 'on_premise', 'off_premise'].includes(row?.fulfillment_context)
        ? row.fulfillment_context
        : 'any') as TaxRateData['fulfillment_context'],
      source_type: row?.source_type == null ? null : String(row.source_type),
    }))
    .filter(row => row.name && row.is_active)
  if (normalized.length === 0) return [defaultTaxRate()]
  const hasDefault = normalized.some(row => row.is_default)
  return normalized.map((row, index) => ({ ...row, is_default: row.is_default || (!hasDefault && index === 0) }))
}

export function normalizeServiceCharges(rows: unknown): ServiceChargeData[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row: any) => ({
      id: row?.id || null,
      name: String(row?.name || '').trim(),
      charge_type: (row?.charge_type === 'fixed' ? 'fixed' : 'percentage') as ServiceChargeData['charge_type'],
      amount: row?.amount == null ? '' : sanitizeNumber(row.amount),
      applies_to: isOptionValue(CHARGE_APPLIES_TO_OPTIONS, row?.applies_to) ? row.applies_to : 'all',
      taxable: row?.taxable !== false,
      auto_apply: Boolean(row?.auto_apply),
      is_tip: Boolean(row?.is_tip),
      is_active: row?.is_active !== false,
    }))
    .filter(row => row.name && row.is_active)
}

export function defaultAutoGratuity(): AutoGratuityData {
  return {
    enabled: true,
    party_threshold: '6',
    percent: '18',
    label: 'Gratuity',
    assigned_to_employee: true,
    rules: [{ party_threshold: '6', percent: '18' }],
  }
}

export function normalizeAutoGratuityRules(rows: unknown, fallback: Pick<AutoGratuityData, 'party_threshold' | 'percent'> = { party_threshold: '6', percent: '18' }): AutoGratuityRuleData[] {
  const source = Array.isArray(rows) ? rows : []
  const normalized = new Map<string, AutoGratuityRuleData>()
  for (const row of source) {
    const threshold = sanitizeInteger((row as any)?.party_threshold ?? (row as any)?.threshold)
    const rawPercent = (row as any)?.percent
    const percent = rawPercent == null
      ? sanitizeNumber(Number((row as any)?.rate || 0) * 100)
      : sanitizeNumber(rawPercent)
    if (!threshold) continue
    normalized.set(String(Math.max(1, Number(threshold) || 1)), {
      party_threshold: String(Math.max(1, Number(threshold) || 1)),
      percent,
    })
  }
  if (normalized.size === 0) {
    normalized.set(String(Math.max(1, Number(fallback.party_threshold) || 6)), {
      party_threshold: String(Math.max(1, Number(fallback.party_threshold) || 6)),
      percent: sanitizeNumber(fallback.percent) || '18',
    })
  }
  return [...normalized.values()].sort((a, b) => Number(a.party_threshold) - Number(b.party_threshold))
}

export function normalizeAutoGratuity(row: unknown): AutoGratuityData {
  const fallback = defaultAutoGratuity()
  if (!row || typeof row !== 'object') return fallback
  const source = row as any
  const party_threshold = source.party_threshold == null ? fallback.party_threshold : sanitizeInteger(source.party_threshold) || fallback.party_threshold
  const percent = source.percent == null ? fallback.percent : sanitizeNumber(source.percent)
  const rules = normalizeAutoGratuityRules(source.rules, { party_threshold, percent })
  const [primaryRule] = rules
  return {
    enabled: source.enabled !== false,
    party_threshold: primaryRule?.party_threshold || party_threshold,
    percent: primaryRule?.percent || percent,
    label: String(source.label || '').trim() || fallback.label,
    assigned_to_employee: typeof source.assigned_to_employee === 'boolean'
      ? source.assigned_to_employee
      : typeof source.auto_gratuity_assigned_to_employee === 'boolean'
        ? source.auto_gratuity_assigned_to_employee
        : fallback.assigned_to_employee,
    rules,
  }
}

/** PUT /restaurants/:id/taxes-charges body. */
export function normalizeCategoryTaxAssignments(rows: unknown): CategoryTaxAssignmentData[] {
  const normalized = new Map<string, CategoryTaxAssignmentData>()
  for (const row of Array.isArray(rows) ? rows : []) {
    const categoryName = String(row?.category_name || '').trim().replace(/\s+/g, ' ')
    if (!categoryName) continue
    const taxName = row?.tax_name == null ? null : String(row.tax_name).trim().replace(/\s+/g, ' ') || null
    normalized.set(categoryName.toLowerCase(), { category_name: categoryName, tax_name: taxName })
  }
  return [...normalized.values()]
}

export function taxesChargesPayload(
  taxRates: unknown,
  serviceCharges: unknown,
  autoGratuity: unknown,
  categoryAssignments?: unknown,
) {
  const gratuity = normalizeAutoGratuity(autoGratuity)
  const [primaryRule] = gratuity.rules
  return {
    auto_gratuity: {
      enabled: gratuity.enabled,
      party_threshold: Math.max(1, Number(primaryRule?.party_threshold ?? gratuity.party_threshold) || 6),
      percent: Math.min(100, Number(primaryRule?.percent ?? gratuity.percent) || 0),
      label: gratuity.label,
      assigned_to_employee: gratuity.assigned_to_employee,
      rules: gratuity.rules.map(row => ({
        party_threshold: Math.max(1, Number(row.party_threshold) || 1),
        percent: Math.min(100, Number(row.percent) || 0),
      })),
    },
    tax_rates: normalizeTaxRates(taxRates).map(row => ({
      id: row.id || undefined,
      name: row.name,
      rate: row.rate === '' ? 0 : Number(row.rate),
      applies_to: row.applies_to,
      is_default: row.is_default,
      is_inclusive: row.is_inclusive,
      is_active: true,
    })),
    service_charges: normalizeServiceCharges(serviceCharges).map(row => ({
      id: row.id || undefined,
      name: row.name,
      charge_type: row.charge_type,
      amount: row.amount === '' ? 0 : Number(row.amount),
      applies_to: row.applies_to,
      taxable: row.taxable,
      auto_apply: row.auto_apply,
      is_tip: row.is_tip,
      is_active: true,
    })),
    ...(categoryAssignments !== undefined
      ? { category_assignments: normalizeCategoryTaxAssignments(categoryAssignments) }
      : {}),
  }
}

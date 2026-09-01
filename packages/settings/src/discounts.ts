import {
  DISCOUNT_TYPE_OPTIONS,
  DISCOUNT_APPLIES_TO_OPTIONS,
  DISCOUNT_VALUE_TYPE_OPTIONS,
  DISCOUNT_TAX_BEHAVIOR_OPTIONS,
  DISCOUNT_ROLE_OPTIONS,
  DISCOUNT_SERVICE_MODE_OPTIONS,
  isOptionValue,
} from './options'
import { sanitizeNumber } from './helpers'
import { collapseEntryWhitespace, duplicateName } from './entry'
import type { DiscountRuleData } from './types'

export function normalizeDiscountRules(rows: unknown): DiscountRuleData[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row: any) => ({
      id: row?.id || null,
      name: String(row?.name || '').trim(),
      discount_type: isOptionValue(DISCOUNT_TYPE_OPTIONS, row?.discount_type) ? row.discount_type : 'discount' as const,
      applies_to: isOptionValue(DISCOUNT_APPLIES_TO_OPTIONS, row?.applies_to) ? row.applies_to : 'check' as const,
      value_type: isOptionValue(DISCOUNT_VALUE_TYPE_OPTIONS, row?.value_type) ? row.value_type : 'percent' as const,
      default_value: row?.default_value == null ? '' : sanitizeNumber(row.default_value),
      editable_by_employee: Boolean(row?.editable_by_employee),
      min_value: row?.min_value == null ? '' : sanitizeNumber(row.min_value),
      max_value: row?.max_value == null ? '' : sanitizeNumber(row.max_value),
      allowed_roles: Array.from(new Set((Array.isArray(row?.allowed_roles) ? row.allowed_roles : ['owner', 'manager']).map(String).filter((role: string) => (DISCOUNT_ROLE_OPTIONS as readonly string[]).includes(role)))) as string[],
      requires_manager_approval: Boolean(row?.requires_manager_approval),
      tax_behavior: isOptionValue(DISCOUNT_TAX_BEHAVIOR_OPTIONS, row?.tax_behavior) ? row.tax_behavior : 'reduce_taxable_amount' as const,
      reason_required: Boolean(row?.reason_required),
      service_modes: Array.from(new Set((Array.isArray(row?.service_modes) ? row.service_modes : []).map(String).filter((mode: string) => isOptionValue(DISCOUNT_SERVICE_MODE_OPTIONS, mode)))) as string[],
      days_of_week: Array.from(new Set<number>((Array.isArray(row?.days_of_week) ? row.days_of_week : []).map(Number).filter((day: number) => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a, b) => a - b),
      is_active: row?.is_active !== false,
      suggested_tip_basis: (row?.suggested_tip_basis === 'after_discount' ? 'after_discount' : 'before_discount') as DiscountRuleData['suggested_tip_basis'],
    }))
    .map(row => ({ ...row, allowed_roles: row.allowed_roles.length > 0 ? row.allowed_roles : ['owner', 'manager'] }))
    .filter(row => row.is_active)
}

/** An open rule is an unbounded discount without a ceiling; the API requires one. */
export const discountRuleNeedsBounds = (rule: Pick<DiscountRuleData, 'value_type' | 'editable_by_employee'>): boolean =>
  rule.value_type === 'open' || rule.editable_by_employee

/** Mirrors the API validation so it surfaces before the save round-trip. */
export function discountRuleWarning(rule: DiscountRuleData): string {
  if (rule.value_type === 'open' && !String(rule.max_value ?? '').trim()) {
    return 'Staff enter this amount, so it needs a maximum.'
  }
  if (rule.value_type !== 'open' && !String(rule.default_value ?? '').trim()) {
    return 'Set a default value, or switch it to a custom amount.'
  }
  const defaultValue = String(rule.default_value ?? '').trim()
  const min = String(rule.min_value ?? '').trim()
  const max = String(rule.max_value ?? '').trim()
  if ([defaultValue, min, max].some(value => value && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
    return 'Discount values must be nonnegative numbers.'
  }
  if (min && max && Number(min) > Number(max)) return 'Minimum cannot exceed maximum.'
  if (defaultValue && min && Number(defaultValue) < Number(min)) return 'Default cannot be below the minimum.'
  if (defaultValue && max && Number(defaultValue) > Number(max)) return 'Default cannot exceed the maximum.'
  if (rule.value_type === 'percent' && [defaultValue, min, max].some(value => value && Number(value) > 100)) {
    return 'A percent discount cannot exceed 100%.'
  }
  return ''
}

export function discountRulesEntryError(discountRules: unknown): string {
  const rows: any[] = (Array.isArray(discountRules) ? discountRules : []).filter(row => row?.is_active !== false)
  const names = rows.map(row => collapseEntryWhitespace(row?.name))
  const blankIndex = names.findIndex(name => !name)
  if (blankIndex >= 0) return `Discount ${blankIndex + 1} needs a name before saving.`
  const duplicateIndex = names.findIndex((name, index) => duplicateName(names, name, index))
  if (duplicateIndex >= 0) return `“${names[duplicateIndex]}” appears more than once in discounts.`
  const normalized = normalizeDiscountRules(rows)
  for (const rule of normalized) {
    const warning = discountRuleWarning(rule)
    if (warning) return `${rule.name}: ${warning}`
  }
  return ''
}

/** PUT /restaurants/:id/discount-rules body. */
export function discountRulesPayload(discountRules: unknown, { includeIds = true }: { includeIds?: boolean } = {}) {
  const validationError = discountRulesEntryError(discountRules)
  if (validationError) throw new Error(validationError)
  return {
    discount_rules: normalizeDiscountRules(discountRules).map(row => ({
      id: includeIds && row.id ? row.id : undefined,
      name: row.name,
      discount_type: row.discount_type,
      applies_to: row.applies_to,
      value_type: row.value_type,
      default_value: row.default_value === '' ? null : Number(row.default_value),
      editable_by_employee: row.editable_by_employee,
      // Bounds are sent whenever they are set. Gating them on
      // editable_by_employee silently dropped the ceiling on a manager-only
      // custom-amount rule, which is exactly the rule that most needs one.
      min_value: row.min_value !== '' && row.min_value != null ? Number(row.min_value) : null,
      max_value: row.max_value !== '' && row.max_value != null ? Number(row.max_value) : null,
      allowed_roles: row.allowed_roles,
      requires_manager_approval: row.requires_manager_approval,
      tax_behavior: row.tax_behavior,
      reason_required: row.reason_required,
      service_modes: row.service_modes,
      days_of_week: row.days_of_week,
      is_active: true,
      suggested_tip_basis: row.suggested_tip_basis,
    })),
  }
}

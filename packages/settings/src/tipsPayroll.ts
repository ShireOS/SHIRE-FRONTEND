import {
  TIP_DISTRIBUTION_OPTIONS,
  CASH_TIP_OPTIONS,
  PAYROLL_EXPORT_OPTIONS,
  TIP_POOL_RESET_OPTIONS,
  TIPOUT_BASIS_OPTIONS,
  isOptionValue,
} from './options'
import { sanitizeNumber, slugRoleCode } from './helpers'
import { isValidIsoDate, numberRangeError } from './entry'
import { serializeTipRoleRules, serializeWeekdayTipoutOverrides, validateTipoutPolicy } from './tipsPolicy'
import type {
  CategoryTipProfileData,
  HeadcountPolicyData,
  JobCodeLike,
  TipoutWeekday,
  TipPayrollSettingsData,
  TipRoleRuleData,
  WeekdayTipoutOverridesData,
} from './types'

type RoleSource = JobCodeLike

export function defaultTipPayrollSettings(jobCodes: RoleSource[] = []): TipPayrollSettingsData {
  const roles: RoleSource[] = jobCodes.length > 0 ? jobCodes : [
    { code: 'server', is_tipped: true },
    { code: 'bartender', is_tipped: true },
    { code: 'host', is_tipped: false },
    { code: 'runner', is_tipped: true },
    { code: 'busser', is_tipped: true },
  ]
  return {
    tip_distribution_mode: 'individual',
    cash_tip_declaration_mode: 'declared_by_employee',
    credit_tip_payout_timing: 'payroll',
    expected_drawer_payouts_enabled: false,
    cash_tip_payout_timing: 'immediate',
    cash_employee_gratuity_payout_timing: 'immediate',
    card_employee_gratuity_payout_timing: 'payroll',
    tipout_payout_timing: 'nightly',
    payroll_provider: '',
    payroll_export_frequency: 'biweekly',
    payroll_period_start_weekday: 0,
    payroll_period_anchor_date: '',
    payroll_semimonthly_cutoff_day: 15,
    payroll_report_default_period: 'last_completed',
    tip_pooling_enabled: false,
    tip_pool_reset: 'day',
    tipout_basis: 'none',
    tipout_sales_includes_tax: false,
    tipout_include_managers: false,
    require_tipout_at_checkout: false,
    allow_manager_tip_adjustments: true,
    auto_withhold_credit_card_fees: false,
    credit_card_fee_percent: '',
    role_tip_rules: roles.map(role => ({
      role_key: role.code,
      tip_eligible: Boolean(role.is_tipped),
      contributes_to_pool: Boolean(role.is_tipped),
      receives_from_pool: Boolean(role.is_tipped),
      pool_points: role.is_tipped ? '1' : '',
      // Percent of this role's post-tipout tips put into the pool (rest kept).
      pool_contribution_percent: '100',
      // How a receiving role divides tipout dollars among its own people:
      // 'even' is the safe default; hours and custom weights are explicit.
      tipout_split_basis: 'even',
      tipout_split_weights: [],
      // This role's declared cut of the pool in role_shares mode.
      pool_share_percent: '',
      tipouts: [],
      tipout_percent: '',
      tipout_target_role: '',
      notes: '',
    })),
    // Optional menu-scoped policies. Category rules replace the default
    // tipouts for matching items; item overrides replace their category rule.
    category_tip_profiles: [],
    weekday_tipout_overrides: {},
    notes: '',
  }
}

function normalizeHeadcountPolicy(value: any): HeadcountPolicyData | null {
  if (!value || typeof value !== 'object' || !value.driver_role || !Array.isArray(value.tiers)) return null
  return {
    driver_role: slugRoleCode(value.driver_role),
    tiers: value.tiers.flatMap((tier: any) => {
      if (!tier || typeof tier !== 'object' || !Array.isArray(tier.allocations)) return []
      return [{
        min_count: Math.max(0, Number(tier.min_count) || 0),
        max_count: tier.max_count == null || tier.max_count === '' ? null : Math.max(0, Number(tier.max_count) || 0),
        allocations: tier.allocations.flatMap((allocation: any) => {
          if (!allocation || typeof allocation !== 'object') return []
          const unallocated = allocation.unallocated === true
          const targetRole = allocation.target_role ? slugRoleCode(allocation.target_role) : ''
          if (!unallocated && !targetRole) return []
          return [{
            target_role: unallocated ? '' : targetRole,
            unallocated,
            percent: allocation.percent == null ? '' : sanitizeNumber(allocation.percent),
          }]
        }),
      }]
    }),
  }
}

export function normalizeTipRoleRules(rows: unknown, jobCodes: RoleSource[] = []): TipRoleRuleData[] {
  const fallback = defaultTipPayrollSettings(jobCodes).role_tip_rules
  const byRole = new Map<string, TipRoleRuleData>()
  ;(Array.isArray(rows) ? rows : []).forEach((row: any) => {
    const roleKey = slugRoleCode(row?.role_key)
    // Granular tipouts: percent of a basis (tips or sales), always paid out of
    // the role's tips. A legacy single tipout_percent/target pair migrates
    // into the list so the editor only has to render one shape.
    let tipouts: TipRoleRuleData['tipouts'] = (Array.isArray(row?.tipouts) ? row.tipouts : [])
      .filter((item: any) => item && (item.target_role || item.headcount))
      .map((item: any) => ({
        target_role: item.target_role ? slugRoleCode(item.target_role) : '',
        percent: item.percent == null ? '' : sanitizeNumber(item.percent),
        basis: item.basis === 'sales' ? 'sales' as const : 'tips' as const,
        // Narrow the basis to one menu category ('' = all). Applies to both
        // bases: category sales, or tips attributed to the category.
        sales_category: item.sales_category ? String(item.sales_category).trim() : '',
        // 'own' = this waiter's numbers, 'restaurant' = house-wide totals.
        basis_scope: item.basis_scope === 'restaurant' ? 'restaurant' as const : 'own' as const,
        headcount: normalizeHeadcountPolicy(item.headcount),
      }))
    if (!tipouts.length && row?.tipout_percent != null && row?.tipout_target_role) {
      tipouts = [{
        target_role: slugRoleCode(row.tipout_target_role),
        percent: sanitizeNumber(row.tipout_percent),
        basis: 'tips',
        sales_category: '',
        basis_scope: 'own',
      }]
    }
    byRole.set(roleKey, {
      role_key: roleKey,
      tip_eligible: row?.tip_eligible !== false,
      contributes_to_pool: row?.contributes_to_pool !== false,
      receives_from_pool: row?.receives_from_pool !== false,
      pool_points: row?.pool_points == null ? '' : sanitizeNumber(row.pool_points),
      pool_contribution_percent: row?.pool_contribution_percent == null ? '100' : sanitizeNumber(row.pool_contribution_percent),
      tipout_split_basis: ['hours', 'weights'].includes(row?.tipout_split_basis) ? row.tipout_split_basis : 'even',
      tipout_split_weights: (Array.isArray(row?.tipout_split_weights) ? row.tipout_split_weights : []).flatMap((item: any) => {
        const staffId = String(item?.staff_id || '').trim()
        const weight = sanitizeNumber(item?.weight)
        return staffId && Number(weight) > 0 ? [{ staff_id: staffId, weight }] : []
      }),
      pool_share_percent: row?.pool_share_percent == null ? '' : sanitizeNumber(row.pool_share_percent),
      tipouts,
      tipout_percent: '',
      tipout_target_role: '',
      notes: row?.notes || '',
    })
  })
  return fallback.map(rule => byRole.get(rule.role_key) || rule)
}

export function normalizeScopedTipProfiles(rows: unknown, jobCodes: RoleSource[] = []): CategoryTipProfileData[] {
  const seenCategoryIds = new Set<string>()
  return (Array.isArray(rows) ? rows : []).flatMap((row: any, profileIndex: number) => {
    if (!row || typeof row !== 'object') return []
    const categoryIds = [...new Set((Array.isArray(row.category_ids) ? row.category_ids : [])
      .map((value: unknown) => String(value || '').trim()).filter(Boolean) as string[])]
      .filter((id) => {
        if (seenCategoryIds.has(id)) return false
        seenCategoryIds.add(id)
        return true
      })
    if (!categoryIds.length) return []
    const overrides: CategoryTipProfileData['item_overrides'] = []
    const seenItems = new Set<string>()
    ;(Array.isArray(row.item_overrides) ? row.item_overrides : []).forEach((override: any) => {
      const menuItemId = String(override?.menu_item_id || '').trim()
      if (!menuItemId || seenItems.has(menuItemId)) return
      seenItems.add(menuItemId)
      overrides.push({
        menu_item_id: menuItemId,
        menu_item_name: String(override?.menu_item_name || '').trim(),
        role_tip_rules: normalizeTipRoleRules(override?.role_tip_rules, jobCodes),
      })
    })
    return [{
      id: String(row.id || `category_profile_${profileIndex + 1}`),
      name: String(row.name || '').trim(),
      category_ids: categoryIds,
      category_names: [...new Set((Array.isArray(row.category_names) ? row.category_names : [])
        .map((value: unknown) => String(value || '').trim()).filter(Boolean) as string[])],
      role_tip_rules: normalizeTipRoleRules(row.role_tip_rules, jobCodes),
      item_overrides: overrides,
    }]
  })
}

const TIPOUT_WEEKDAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])

export function normalizeWeekdayTipoutOverrides(value: unknown, jobCodes: RoleSource[] = []): WeekdayTipoutOverridesData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value as Record<string, any>).flatMap(([weekday, override]): Array<[string, WeekdayTipoutOverridesData[TipoutWeekday]]> => {
    if (!TIPOUT_WEEKDAYS.has(weekday) || !override || typeof override !== 'object') return []
    if (override.mode === 'disabled') return [[weekday, { mode: 'disabled' }]]
    if (override.mode !== 'custom') return []
    return [[weekday, {
      mode: 'custom',
      role_tip_rules: normalizeTipRoleRules(override.role_tip_rules, jobCodes),
      category_tip_profiles: normalizeScopedTipProfiles(override.category_tip_profiles, jobCodes),
    }]]
  }))
}

export function normalizeTipPayrollSettings(row: unknown, jobCodes: RoleSource[] = []): TipPayrollSettingsData {
  const fallback = defaultTipPayrollSettings(jobCodes)
  const source: any = row && typeof row === 'object' ? row : {}
  return {
    ...fallback,
    ...source,
    tip_distribution_mode: isOptionValue(TIP_DISTRIBUTION_OPTIONS, source.tip_distribution_mode) ? source.tip_distribution_mode : fallback.tip_distribution_mode,
    cash_tip_declaration_mode: isOptionValue(CASH_TIP_OPTIONS, source.cash_tip_declaration_mode) ? source.cash_tip_declaration_mode : fallback.cash_tip_declaration_mode,
    credit_tip_payout_timing: source.credit_tip_payout_timing === 'nightly' ? 'nightly' : 'payroll',
    expected_drawer_payouts_enabled: source.expected_drawer_payouts_enabled === true,
    cash_tip_payout_timing: source.cash_tip_payout_timing === 'payroll' ? 'payroll' : 'immediate',
    cash_employee_gratuity_payout_timing: source.cash_employee_gratuity_payout_timing === 'payroll' ? 'payroll' : 'immediate',
    card_employee_gratuity_payout_timing: ['nightly', 'payroll'].includes(source.card_employee_gratuity_payout_timing)
      ? source.card_employee_gratuity_payout_timing
      : source.credit_tip_payout_timing === 'nightly' ? 'nightly' : 'payroll',
    tipout_payout_timing: source.tipout_payout_timing === 'payroll' ? 'payroll' : 'nightly',
    payroll_provider: source.payroll_provider || '',
    payroll_export_frequency: isOptionValue(PAYROLL_EXPORT_OPTIONS, source.payroll_export_frequency) ? source.payroll_export_frequency : fallback.payroll_export_frequency,
    payroll_period_start_weekday: Number.isInteger(Number(source.payroll_period_start_weekday)) ? Math.max(0, Math.min(6, Number(source.payroll_period_start_weekday))) : fallback.payroll_period_start_weekday,
    payroll_period_anchor_date: String(source.payroll_period_anchor_date || ''),
    payroll_semimonthly_cutoff_day: Number.isInteger(Number(source.payroll_semimonthly_cutoff_day)) ? Math.max(1, Math.min(27, Number(source.payroll_semimonthly_cutoff_day))) : fallback.payroll_semimonthly_cutoff_day,
    payroll_report_default_period: source.payroll_report_default_period === 'current_open' ? 'current_open' : 'last_completed',
    tip_pool_reset: isOptionValue(TIP_POOL_RESET_OPTIONS, source.tip_pool_reset) ? source.tip_pool_reset : fallback.tip_pool_reset,
    tipout_basis: isOptionValue(TIPOUT_BASIS_OPTIONS, source.tipout_basis) ? source.tipout_basis : fallback.tipout_basis,
    credit_card_fee_percent: source.credit_card_fee_percent == null ? '' : sanitizeNumber(source.credit_card_fee_percent),
    role_tip_rules: normalizeTipRoleRules(source.role_tip_rules, jobCodes),
    category_tip_profiles: normalizeScopedTipProfiles(source.category_tip_profiles, jobCodes),
    weekday_tipout_overrides: normalizeWeekdayTipoutOverrides(source.weekday_tipout_overrides, jobCodes),
    notes: source.notes || '',
  }
}

/** PUT /restaurants/:id/tips-payroll-settings body. */
export function tipPayrollPayload(settings: unknown, jobCodes: RoleSource[] = []) {
  const validationError = tipPayrollEntryError(settings)
  if (validationError) throw new Error(validationError)
  const normalized = normalizeTipPayrollSettings(settings, jobCodes)
  return {
    ...normalized,
    payroll_period_anchor_date: normalized.payroll_period_anchor_date || null,
    payroll_period_start_weekday: Number(normalized.payroll_period_start_weekday),
    payroll_semimonthly_cutoff_day: Number(normalized.payroll_semimonthly_cutoff_day),
    credit_card_fee_percent: normalized.credit_card_fee_percent === '' ? null : Number(normalized.credit_card_fee_percent),
    role_tip_rules: serializeTipRoleRules(normalized.role_tip_rules),
    category_tip_profiles: normalized.category_tip_profiles.map(profile => ({
      ...profile,
      role_tip_rules: serializeTipRoleRules(profile.role_tip_rules),
      item_overrides: profile.item_overrides.map(override => ({
        ...override,
        role_tip_rules: serializeTipRoleRules(override.role_tip_rules),
      })),
    })),
    weekday_tipout_overrides: serializeWeekdayTipoutOverrides(normalized.weekday_tipout_overrides),
  }
}

export function tipPayrollEntryError(settings: unknown): string {
  const source: any = settings && typeof settings === 'object' ? settings : {}
  const feeError = numberRangeError(source.credit_card_fee_percent, 'Credit-card fee percent', { min: 0, max: 100 })
  if (feeError) return feeError
  const weekdayError = numberRangeError(source.payroll_period_start_weekday ?? 0, 'Payroll week start', { required: true, min: 0, max: 6, integer: true })
  if (weekdayError) return weekdayError
  const cutoffError = numberRangeError(source.payroll_semimonthly_cutoff_day ?? 15, 'Semimonthly cutoff day', { required: true, min: 1, max: 27, integer: true })
  if (cutoffError) return cutoffError
  if (source.payroll_period_anchor_date) {
    const anchor = String(source.payroll_period_anchor_date)
    if (!isValidIsoDate(anchor)) {
      return 'Payroll anchor must be a valid date.'
    }
  }

  const validateRules = (rules: any[], context: string): string => {
    for (const rule of rules || []) {
      const label = String(rule?.role_key || context || 'Role').replace(/_/g, ' ')
      const fields: Array<[unknown, string, number | undefined]> = [
        [rule?.pool_points, `${label} pool points`, undefined],
        [rule?.pool_contribution_percent, `${label} pool contribution`, 100],
        [rule?.pool_share_percent, `${label} pool share`, 100],
      ]
      for (const [value, fieldLabel, max] of fields) {
        const error = numberRangeError(value, fieldLabel, { min: 0, max })
        if (error) return error
      }
      for (const tipout of Array.isArray(rule?.tipouts) ? rule.tipouts : []) {
        const error = numberRangeError(tipout?.percent, `${label} tipout percent`, { required: true, min: 0, max: 100 })
        if (error) return error
        for (const tier of Array.isArray(tipout?.headcount?.tiers) ? tipout.headcount.tiers : []) {
          const minError = numberRangeError(tier?.min_count, 'Headcount minimum', { required: true, min: 0, integer: true })
          const maxError = numberRangeError(tier?.max_count, 'Headcount maximum', { min: 0, integer: true })
          if (minError || maxError) return minError || maxError
          if (tier?.max_count != null && Number(tier.max_count) < Number(tier.min_count)) return 'Headcount maximum cannot be below its minimum.'
          for (const allocation of Array.isArray(tier?.allocations) ? tier.allocations : []) {
            const allocationError = numberRangeError(allocation?.percent, 'Headcount allocation percent', { required: true, min: 0, max: 100 })
            if (allocationError) return allocationError
          }
        }
      }
    }
    return ''
  }

  const directError = validateRules(source.role_tip_rules, 'Role')
  if (directError) return directError
  for (const profile of Array.isArray(source.category_tip_profiles) ? source.category_tip_profiles : []) {
    const profileError = validateRules(profile?.role_tip_rules, profile?.name || 'Category')
    if (profileError) return profileError
    for (const override of Array.isArray(profile?.item_overrides) ? profile.item_overrides : []) {
      const overrideError = validateRules(override?.role_tip_rules, override?.menu_item_name || 'Item')
      if (overrideError) return overrideError
    }
  }
  for (const override of Object.values(source.weekday_tipout_overrides || {}) as any[]) {
    if (override?.mode === 'custom') {
      const overrideError = validateRules(override.role_tip_rules, 'Weekday')
      if (overrideError) return overrideError
    }
  }
  const policyError = validateTipoutPolicy(source)[0]
  if (policyError) return policyError
  return ''
}

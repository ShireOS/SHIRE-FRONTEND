interface TipRoleRuleLike {
  pool_points: string | number | null
  pool_contribution_percent: string | number | null
  pool_share_percent: string | number | null
  tipout_split_basis: string
  tipout_split_weights?: Array<{ staff_id: string; weight: string | number }>
  tipouts?: Array<{
    target_role?: string | null
    percent: string | number
    basis?: string
    sales_category?: string | null
    basis_scope?: string
    headcount?: unknown
  }>
  tipout_percent: string | number | null
  tipout_target_role: string | null
  notes: string | null
}

export function serializeHeadcountPolicy(headcount: unknown): unknown
export function serializeTipRoleRules<T extends TipRoleRuleLike>(rules: T[]): Array<T & Record<string, unknown>>
export function serializeWeekdayTipoutOverrides(overrides: Record<string, unknown>): Record<string, unknown>
export function validateTipoutPolicy(settings: Record<string, any>): string[]
export function tipoutPolicyFingerprint(settings: Record<string, any>): string

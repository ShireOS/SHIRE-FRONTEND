export function serializeHeadcountPolicy(headcount) {
  if (!headcount) return null
  return {
    driver_role: headcount.driver_role,
    tiers: (headcount.tiers || []).map(tier => ({
      min_count: Number(tier.min_count),
      max_count: tier.max_count == null || tier.max_count === '' ? null : Number(tier.max_count),
      allocations: (tier.allocations || [])
        .filter(item => Number(item.percent) > 0 && (item.unallocated || item.target_role))
        .map(item => ({
          target_role: item.unallocated ? null : item.target_role,
          unallocated: Boolean(item.unallocated),
          percent: Number(item.percent),
        })),
    })),
  }
}

export function serializeTipRoleRules(rules) {
  return rules.map(rule => ({
    ...rule,
    pool_points: rule.pool_points === '' ? null : Number(rule.pool_points),
    pool_contribution_percent: rule.pool_contribution_percent === '' ? null : Number(rule.pool_contribution_percent),
    pool_share_percent: rule.pool_share_percent === '' || rule.pool_share_percent == null ? null : Number(rule.pool_share_percent),
    tipout_split_basis: ['hours', 'weights'].includes(rule.tipout_split_basis) ? rule.tipout_split_basis : 'even',
    tipout_split_weights: (rule.tipout_split_weights || [])
      .filter(item => item.staff_id && Number(item.weight) > 0)
      .map(item => ({ staff_id: item.staff_id, weight: Number(item.weight) })),
    tipouts: (rule.tipouts || [])
      .filter(item => (item.target_role || item.headcount) && item.percent !== '' && Number(item.percent) > 0)
      .map(item => ({
        target_role: item.headcount ? null : item.target_role,
        percent: Number(item.percent),
        basis: item.basis === 'sales' ? 'sales' : 'tips',
        sales_category: item.sales_category || null,
        basis_scope: item.basis_scope === 'restaurant' ? 'restaurant' : 'own',
        headcount: serializeHeadcountPolicy(item.headcount),
      })),
    tipout_percent: rule.tipout_percent === '' ? null : Number(rule.tipout_percent),
    tipout_target_role: rule.tipout_target_role || null,
    notes: rule.notes || null,
  }))
}

export function serializeWeekdayTipoutOverrides(overrides) {
  return Object.fromEntries(Object.entries(overrides || {}).flatMap(([weekday, override]) => {
    if (override?.mode === 'disabled') return [[weekday, { mode: 'disabled' }]]
    if (override?.mode !== 'custom') return []
    return [[weekday, {
      mode: 'custom',
      role_tip_rules: serializeTipRoleRules(override.role_tip_rules || []),
      category_tip_profiles: (override.category_tip_profiles || []).map(profile => ({
        ...profile,
        role_tip_rules: serializeTipRoleRules(profile.role_tip_rules || []),
        item_overrides: (profile.item_overrides || []).map(item => ({
          ...item,
          role_tip_rules: serializeTipRoleRules(item.role_tip_rules || []),
        })),
      })),
    }]]
  }))
}

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
    pool_points: rule.pool_points === '' || rule.pool_points == null ? null : Number(rule.pool_points),
    pool_contribution_percent: rule.pool_contribution_percent === '' || rule.pool_contribution_percent == null ? null : Number(rule.pool_contribution_percent),
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
    tipout_percent: rule.tipout_percent === '' || rule.tipout_percent == null ? null : Number(rule.tipout_percent),
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

function validateHeadcountPolicy(headcount, sourceRole, label, errors) {
  if (!headcount?.driver_role) errors.push(`${label} needs a headcount role.`)
  const tiers = Array.isArray(headcount?.tiers) ? headcount.tiers : []
  if (!tiers.length) {
    errors.push(`${label} needs at least one headcount bracket.`)
    return
  }

  const sorted = [...tiers].sort((a, b) => Number(a.min_count) - Number(b.min_count))
  let expectedMin = 0
  sorted.forEach((tier, tierIndex) => {
    const tierLabel = `${label}, bracket ${tierIndex + 1}`
    const min = Number(tier.min_count)
    const max = tier.max_count == null || tier.max_count === '' ? null : Number(tier.max_count)
    if (!Number.isInteger(min) || min !== expectedMin) errors.push(`${tierLabel} must start at ${expectedMin}.`)
    if (max != null && (!Number.isInteger(max) || max < min)) errors.push(`${tierLabel} has an invalid maximum.`)
    if (max == null && tierIndex !== sorted.length - 1) errors.push(`${tierLabel} cannot be open-ended before the final bracket.`)
    if (max != null) expectedMin = max + 1

    const allocations = Array.isArray(tier.allocations) ? tier.allocations : []
    if (!allocations.length) errors.push(`${tierLabel} needs at least one recipient.`)
    const recipients = new Set()
    let allocationTotal = 0
    allocations.forEach((allocation, allocationIndex) => {
      const allocationLabel = `${tierLabel}, recipient ${allocationIndex + 1}`
      const percent = Number(allocation.percent)
      if (!(percent > 0) || percent > 100) errors.push(`${allocationLabel} needs a percentage greater than 0 and no more than 100.`)
      else allocationTotal += percent
      const hasTarget = Boolean(allocation.target_role)
      const isUnallocated = allocation.unallocated === true
      if (hasTarget === isUnallocated) errors.push(`${allocationLabel} must choose one recipient or Unallocated.`)
      if (allocation.target_role === sourceRole) errors.push(`${allocationLabel} cannot send tips back to ${sourceRole}.`)
      const recipientKey = isUnallocated ? '__unallocated__' : allocation.target_role
      if (recipientKey && recipients.has(recipientKey)) errors.push(`${tierLabel} has the same recipient more than once.`)
      if (recipientKey) recipients.add(recipientKey)
    })
    if (Math.abs(allocationTotal - 100) > 0.001) errors.push(`${tierLabel} must allocate exactly 100%.`)
  })
  const finalMax = sorted[sorted.length - 1]?.max_count
  if (finalMax != null && finalMax !== '') errors.push(`${label} needs an open-ended final bracket.`)
}

function validateRoleRules(rules, scope, errors) {
  ;(Array.isArray(rules) ? rules : []).forEach((rule, ruleIndex) => {
    const sourceRole = rule?.role_key || `role ${ruleIndex + 1}`
    ;(Array.isArray(rule?.tipouts) ? rule.tipouts : []).forEach((tipout, tipoutIndex) => {
      const label = `${scope} tipout ${tipoutIndex + 1} from ${sourceRole}`
      const percent = Number(tipout?.percent)
      if (tipout?.percent === '' || tipout?.percent == null || !(percent > 0) || percent > 100) {
        errors.push(`${label} needs a percentage greater than 0 and no more than 100.`)
      }
      if (tipout?.headcount) validateHeadcountPolicy(tipout.headcount, sourceRole, label, errors)
      else if (!tipout?.target_role) errors.push(`${label} needs a recipient role.`)
      else if (tipout.target_role === sourceRole) errors.push(`${label} cannot send tips back to the same role.`)
    })
  })
}

function validateCategoryProfiles(profiles, scope, errors) {
  ;(Array.isArray(profiles) ? profiles : []).forEach((profile, profileIndex) => {
    const profileLabel = profile?.name || `menu group ${profileIndex + 1}`
    validateRoleRules(profile?.role_tip_rules, `${scope} ${profileLabel}`, errors)
    ;(Array.isArray(profile?.item_overrides) ? profile.item_overrides : []).forEach((override, overrideIndex) => {
      validateRoleRules(
        override?.role_tip_rules,
        `${scope} ${profileLabel}, item ${override?.menu_item_name || overrideIndex + 1}`,
        errors,
      )
    })
  })
}

export function validateTipoutPolicy(settings) {
  const errors = []
  validateRoleRules(settings?.role_tip_rules, 'Default', errors)
  validateCategoryProfiles(settings?.category_tip_profiles, 'Menu', errors)
  const weekdayOverrides = settings?.weekday_tipout_overrides || {}
  Object.entries(weekdayOverrides).forEach(([weekday, override]) => {
    if (override?.mode !== 'custom') return
    validateRoleRules(override.role_tip_rules, weekday, errors)
    validateCategoryProfiles(override.category_tip_profiles, `${weekday} menu`, errors)
  })
  if (
    Object.keys(weekdayOverrides).length > 0
    && settings?.tip_pooling_enabled
    && settings?.tip_distribution_mode !== 'individual'
    && settings?.tip_pool_reset !== 'day'
  ) {
    errors.push('Weekday tipout exceptions require the tip pool to reset daily.')
  }
  return [...new Set(errors)]
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]))
}

export function tipoutPolicyFingerprint(settings) {
  const policy = {
    role_tip_rules: serializeTipRoleRules(settings?.role_tip_rules || []),
    category_tip_profiles: (settings?.category_tip_profiles || []).map(profile => ({
      ...profile,
      role_tip_rules: serializeTipRoleRules(profile.role_tip_rules || []),
      item_overrides: (profile.item_overrides || []).map(item => ({
        ...item,
        role_tip_rules: serializeTipRoleRules(item.role_tip_rules || []),
      })),
    })),
    weekday_tipout_overrides: serializeWeekdayTipoutOverrides(settings?.weekday_tipout_overrides || {}),
  }
  return JSON.stringify(stableValue(policy))
}

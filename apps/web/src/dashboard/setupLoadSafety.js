const REMOTE_SETUP_SECTIONS = new Set([
  'capacity',
  'check_workflow',
  'closeout',
  'discounts',
  'employees',
  'hours',
  'legal',
  'manager_controls',
  'payments',
  'pricing_policy',
  'reservation_timing',
  'sections',
  'taxes_charges',
  'tips_payroll',
])

const normalizeRestaurantId = (restaurantId) => String(restaurantId || '')

export function nextSetupLoadScope(current, restaurantId) {
  return {
    restaurantId: normalizeRestaurantId(restaurantId),
    generation: Number(current?.generation || 0) + 1,
  }
}

export function isCurrentSetupLoad(current, candidate) {
  return Boolean(
    current &&
    candidate &&
    current.restaurantId === candidate.restaurantId &&
    current.generation === candidate.generation,
  )
}

export function initialSetupSectionStates(restaurantId, visibleSectionIds) {
  const scopedRestaurantId = normalizeRestaurantId(restaurantId)
  const sectionIds = new Set(Array.isArray(visibleSectionIds) ? visibleSectionIds : [])
  if (sectionIds.has('payments')) sectionIds.add('pricing_policy')
  return Object.fromEntries([...sectionIds].map(sectionId => [
    sectionId,
    {
      restaurantId: scopedRestaurantId,
      status: REMOTE_SETUP_SECTIONS.has(sectionId) ? 'loading' : 'ready',
      error: null,
    },
  ]))
}

export function setupReadOutcomeStates(restaurantId, results) {
  const scopedRestaurantId = normalizeRestaurantId(restaurantId)
  const bySection = new Map()

  for (const result of Array.isArray(results) ? results : []) {
    if (!result?.requested) continue
    for (const sectionId of result.sectionIds || []) {
      const entries = bySection.get(sectionId) || []
      entries.push(result)
      bySection.set(sectionId, entries)
    }
  }

  return Object.fromEntries([...bySection].map(([sectionId, entries]) => {
    const failures = entries.filter(entry => entry.error)
    return [sectionId, {
      restaurantId: scopedRestaurantId,
      status: failures.length > 0 ? 'error' : 'ready',
      error: failures.length > 0
        ? failures.map(entry => entry.label).filter(Boolean).join(', ')
        : null,
    }]
  }))
}

export function setupSaveBlockReason(sectionStates, sectionId, restaurantId) {
  const state = sectionStates?.[sectionId]
  const scopedRestaurantId = normalizeRestaurantId(restaurantId)
  if (!state || state.restaurantId !== scopedRestaurantId) {
    return 'This section has not loaded for the selected restaurant. Reload it before saving.'
  }
  if (state.status === 'loading') {
    return 'This section is still loading for the selected restaurant.'
  }
  if (state.status === 'error') {
    return `${state.error || 'This section'} failed to load. Retry before saving.`
  }
  return null
}

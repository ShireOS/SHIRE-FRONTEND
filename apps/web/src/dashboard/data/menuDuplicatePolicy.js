export function excludeQuestionId(excludedQuestionIds = [], questionId) {
  return [...new Set([...excludedQuestionIds, questionId])]
}

export function restoreQuestionId(excludedQuestionIds = [], questionId) {
  return excludedQuestionIds.filter(id => id !== questionId)
}

export function filterExcludedQuestionGroups(groups, excludedQuestionIds = []) {
  const excludedIds = new Set(excludedQuestionIds)
  return groups.filter(group => !excludedIds.has(group.id))
}

export function buildDuplicateQuestionCopyPlan(groups, sourceItemId, excludedQuestionIds = []) {
  const links = []
  const overrides = []

  for (const group of filterExcludedQuestionGroups(groups, excludedQuestionIds)) {
    if (group.item_ids.includes(sourceItemId)) {
      links.push({
        groupId: group.id,
        displayOrder: group.item_display_orders?.[sourceItemId] ?? 0,
      })
    }
    const override = group.item_overrides?.[sourceItemId]
    if (override) overrides.push({ groupId: group.id, override })
  }

  return { links, overrides }
}

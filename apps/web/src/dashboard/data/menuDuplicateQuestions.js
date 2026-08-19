const idSet = ids => new Set((Array.isArray(ids) ? ids : []).filter(Boolean))

export function setQuestionExclusion(questionIds, groupId, excluded) {
  const next = idSet(questionIds)
  if (excluded) next.add(groupId)
  else next.delete(groupId)
  return [...next]
}

export function directQuestionGroupsForItem(groups, itemId) {
  if (!itemId) return []
  return (Array.isArray(groups) ? groups : []).filter(group => (
    Array.isArray(group?.item_ids) && group.item_ids.includes(itemId)
  ))
}

export function copyableDirectQuestionGroups(groups, itemId, excludedQuestionIds = []) {
  const excluded = idSet(excludedQuestionIds)
  return directQuestionGroupsForItem(groups, itemId).filter(group => !excluded.has(group.id))
}

export function inheritedQuestionIdsToOptOut(groups, categoryId, excludedQuestionIds = []) {
  if (!categoryId) return []
  const excluded = idSet(excludedQuestionIds)
  return (Array.isArray(groups) ? groups : [])
    .filter(group => excluded.has(group?.id))
    .filter(group => (group.category_links || []).some(link => link.category_id === categoryId))
    .map(group => group.id)
}

export function categoryQuestionGroups(groups, categoryId) {
  if (!categoryId) return []
  return groups
    .filter(group => (group.category_links || []).some(link => link.category_id === categoryId))
    .sort((a, b) => {
      const orderA = (a.category_links || []).find(link => link.category_id === categoryId)?.display_order ?? 0
      const orderB = (b.category_links || []).find(link => link.category_id === categoryId)?.display_order ?? 0
      return Number(orderA) - Number(orderB) || a.name.localeCompare(b.name)
    })
}

export function nextCategoryQuestionOrder(groups, categoryId) {
  const orders = groups.flatMap(group =>
    (group.category_links || [])
      .filter(link => link.category_id === categoryId)
      .map(link => Number(link.display_order) || 0))
  return orders.length > 0 ? Math.max(...orders) + 1 : 0
}

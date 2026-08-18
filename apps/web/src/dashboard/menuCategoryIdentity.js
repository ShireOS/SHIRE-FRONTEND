const norm = value => String(value || '').trim().toLowerCase()

export const categoryKeyForCategory = category => (
  category?.id ? `id:${String(category.id)}` : `name:${norm(category?.name || 'Other')}`
)

export const categoryKeyForItem = (item, categoriesById = {}) => {
  const categoryId = item?.menu_category_id ? String(item.menu_category_id) : ''
  if (categoryId && categoriesById[categoryId]) return `id:${categoryId}`
  return `name:${norm(item?.category || 'Other')}`
}

export const effectiveItemCategoryName = (item, categoriesById = {}) => {
  const categoryId = item?.menu_category_id ? String(item.menu_category_id) : ''
  return (categoryId && categoriesById[categoryId]?.name) || item?.category || 'Other'
}

export const bucketItemsByCategoryIdentity = (items, categoriesById = {}) => {
  const buckets = {}
  for (const item of items || []) {
    const key = categoryKeyForItem(item, categoriesById)
    ;(buckets[key] ||= []).push(item)
  }
  return buckets
}

export const orphanCategoryBucketsFromIdentity = (items, categories = [], categoriesById = {}) => {
  const activeNameKeys = new Set((categories || []).map(category => `name:${norm(category.name)}`))
  const buckets = {}
  for (const item of items || []) {
    const categoryId = item?.menu_category_id ? String(item.menu_category_id) : ''
    if (categoryId && categoriesById[categoryId]) continue
    const name = item?.category || 'Other'
    if (categoryId) {
      ;(buckets[name] ||= []).push(item)
      continue
    }
    if (activeNameKeys.has(`name:${norm(name)}`)) continue
    ;(buckets[name] ||= []).push(item)
  }
  return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b))
}

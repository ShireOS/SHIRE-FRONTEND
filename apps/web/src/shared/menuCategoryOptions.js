export function normalizeCategoryOptionLabel(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function uniqueCategoryOptionLabels(values = []) {
  const labels = []
  const seen = new Set()
  for (const value of values) {
    const label = normalizeCategoryOptionLabel(value)
    const key = label.toLocaleLowerCase()
    if (!label || seen.has(key)) continue
    seen.add(key)
    labels.push(label)
  }
  return labels.sort((left, right) => left.localeCompare(right))
}

export function kdsDisplayGroupOptions(categories = [], items = []) {
  return uniqueCategoryOptionLabels([
    ...categories.map(category => category?.kds_display_group),
    ...items.map(item => item?.kds_display_group),
  ])
}

export function effectiveFireModeLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'by_course') return 'By course'
  if (normalized === 'manual') return 'Manual'
  if (normalized === 'hold') return 'Hold'
  return 'Immediate'
}

function weightedAverage(rows, valueId, weightId) {
  const weighted = rows.reduce((sum, row) => sum + Number(row[valueId] || 0) * Number(row[weightId] || 0), 0)
  const weight = rows.reduce((sum, row) => sum + Number(row[weightId] || 0), 0)
  return weight > 0 ? weighted / weight : 0
}

export const WHOLE_RESTAURANT_SCOPE = Object.freeze({
  scope_dimension: 'none',
  scope_mode: 'cumulative',
  scope_ids: [],
})

const CRITICAL_HOME_WIDGET_IDS = new Set(['sales_summary'])
const HEAVY_HOME_WIDGET_IDS = new Set(['discount_review'])

export function splitHomepageWidgetIds(widgetIds = []) {
  return {
    primary: widgetIds.filter((widgetId) => CRITICAL_HOME_WIDGET_IDS.has(widgetId)),
    secondary: widgetIds.filter((widgetId) => (
      !CRITICAL_HOME_WIDGET_IDS.has(widgetId) && !HEAVY_HOME_WIDGET_IDS.has(widgetId)
    )),
    deferred: widgetIds.filter((widgetId) => HEAVY_HOME_WIDGET_IDS.has(widgetId)),
  }
}

export function normalizeReportingScope(value = {}) {
  const dimension = ['revenue_center', 'device'].includes(value.scope_dimension)
    ? value.scope_dimension
    : 'none'
  return {
    scope_dimension: dimension,
    scope_mode: dimension !== 'none' && value.scope_mode === 'breakdown' ? 'breakdown' : 'cumulative',
    scope_ids: dimension === 'none'
      ? []
      : [...new Set((Array.isArray(value.scope_ids) ? value.scope_ids : []).map(String))],
  }
}

export function pruneReportingScope(value = {}, dimensions = {}) {
  const scope = normalizeReportingScope(value)
  if (scope.scope_dimension === 'none' || !scope.scope_ids.length) return scope
  const options = scope.scope_dimension === 'device' ? dimensions.devices : dimensions.sections
  if (!Array.isArray(options)) return scope
  const available = new Set(options.map((option) => String(option.id)))
  const scopeIds = scope.scope_ids.filter((id) => available.has(id))
  return scopeIds.length ? { ...scope, scope_ids: scopeIds } : { ...WHOLE_RESTAURANT_SCOPE }
}

export function effectiveHomepageWidgetSettings(widgetSettings = {}, widgetIds = [], dashboardScope = {}) {
  const globalScope = normalizeReportingScope(dashboardScope)
  return Object.fromEntries(widgetIds.map((widgetId) => {
    const saved = widgetSettings[widgetId] || {}
    // Older preferences had no explicit inheritance choice. Treating those as
    // global prevents a stale hidden widget filter from becoming a default.
    const scopeSource = saved.scope_source === 'widget' ? 'widget' : 'global'
    const scope = scopeSource === 'widget' ? normalizeReportingScope(saved) : globalScope
    return [widgetId, { ...saved, scope_source: scopeSource, ...scope }]
  }))
}

export function aggregateWidgetRows(rows = []) {
  const summary = {}
  rows.forEach((row) => Object.entries(row).forEach(([key, value]) => {
    const isNumeric = typeof value === 'number'
      || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
    if (isNumeric) summary[key] = Number(summary[key] || 0) + Number(value)
  }))
  if ('average_check' in summary) {
    const checks = Number(summary.orders || summary.receipts || 0)
    summary.average_check = checks > 0 ? summary.net_sales / checks : 0
  }
  if ('labor_percentage' in summary) summary.labor_percentage = summary.net_sales > 0 ? summary.labor_cost / summary.net_sales * 100 : null
  if ('profit_after_labor' in summary) summary.profit_after_labor = Number(summary.net_sales || 0) - Number(summary.labor_cost || 0)
  if ('average_discount' in summary) summary.average_discount = summary.discount_count > 0 ? summary.discounts / summary.discount_count : 0
  if ('discount_rate' in summary) summary.discount_rate = summary.gross_sales > 0 ? summary.discounts / summary.gross_sales * 100 : null
  if ('average_party_size' in summary) summary.average_party_size = summary.reservations > 0 ? summary.covers / summary.reservations : 0
  if ('average_turn_minutes' in summary) summary.average_turn_minutes = weightedAverage(rows, 'average_turn_minutes', 'completed_turns')
  if ('average_payment_to_clear_minutes' in summary) summary.average_payment_to_clear_minutes = weightedAverage(rows, 'average_payment_to_clear_minutes', 'completed_turns')
  if ('margin' in summary && 'revenue' in summary && 'cost' in summary) summary.margin = summary.revenue - summary.cost
  return summary
}

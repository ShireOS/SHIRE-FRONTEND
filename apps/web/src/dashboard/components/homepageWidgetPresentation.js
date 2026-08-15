export function widgetPurposeMeasure(widget, data) {
  const measures = data?.measure_columns?.length ? data.measure_columns : (widget?.columns || [])
  const purposeId = widget?.primary_column || widget?.default_columns?.[0]
  return measures.find((column) => column.id === purposeId)
    || (widget?.columns || []).find((column) => column.id === purposeId)
    || measures[0]
    || widget?.columns?.[0]
}

export function widgetSupportingMeasures(widget, data, limit = 2) {
  const purpose = widgetPurposeMeasure(widget, data)
  const measures = data?.measure_columns?.length ? data.measure_columns : (widget?.columns || [])
  return measures.filter((column) => column.id !== purpose?.id).slice(0, limit)
}

export function withWidgetPurposeColumn(widget, columns = []) {
  const purposeId = widget?.primary_column || widget?.default_columns?.[0]
  if (!purposeId) return [...columns]
  return [purposeId, ...columns.filter((id) => id !== purposeId)]
}

const DIMENSION_LABELS = Object.freeze({
  category: 'menu category',
  department: 'menu department',
  deposit_status: 'deposit status',
  device: 'POS device',
  discount_type: 'discount type',
  employee: 'employee',
  group: 'restaurant group',
  item: 'menu item',
  order_channel: 'order channel',
  payment_method: 'payment method',
  reason: 'reason code',
  restaurant: 'restaurant',
  revenue_center: 'section',
  role: 'employee role',
  source: 'reservation source',
  status: 'reservation status',
  table: 'table',
})

function lowerFirst(value) {
  return value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value
}

export function widgetDimensionLabel(dimension) {
  const normalized = String(dimension || 'category').trim().toLowerCase().replaceAll(' ', '_')
  return DIMENSION_LABELS[normalized] || normalized.replaceAll('_', ' ')
}

export function homepageWidgetChartCopy(widget, data, breakdown) {
  const measure = widgetPurposeMeasure(widget, data) || { id: 'value', label: 'Value' }
  const measureLabel = String(measure.label || measure.id || 'Value').trim()
  const widgetLabel = String(widget?.label || measureLabel).trim()
  const subject = widgetLabel.toLowerCase() === measureLabel.toLowerCase()
    ? measureLabel
    : `${widgetLabel}: ${lowerFirst(measureLabel)}`
  const dimension = widgetDimensionLabel(data?.breakdown || breakdown)

  return {
    measure,
    trend: {
      title: `${subject} by business day`,
      description: `${measureLabel} recorded for each business day in the selected date range.`,
    },
    breakdown: {
      title: `${subject} by ${dimension}`,
      description: `${measureLabel} totaled separately for each ${dimension}.`,
    },
  }
}

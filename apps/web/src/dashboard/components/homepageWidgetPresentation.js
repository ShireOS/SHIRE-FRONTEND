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

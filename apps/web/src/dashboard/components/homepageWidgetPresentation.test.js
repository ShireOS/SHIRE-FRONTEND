import assert from 'node:assert/strict'
import test from 'node:test'

import {
  widgetPurposeMeasure,
  widgetSupportingMeasures,
  withWidgetPurposeColumn,
} from './homepageWidgetPresentation.js'

const widget = {
  primary_column: 'profit_after_labor',
  default_columns: ['profit_after_labor', 'net_sales', 'labor_cost'],
  columns: [
    { id: 'net_sales', label: 'Net sales' },
    { id: 'labor_cost', label: 'Labor cost' },
    { id: 'profit_after_labor', label: 'Profit after labor' },
  ],
}

test('purpose metric is independent of response column order', () => {
  const data = { measure_columns: [widget.columns[0], widget.columns[2], widget.columns[1]] }
  assert.equal(widgetPurposeMeasure(widget, data).id, 'profit_after_labor')
})

test('supporting metrics exclude the purpose metric', () => {
  const data = { measure_columns: [widget.columns[0], widget.columns[2], widget.columns[1]] }
  assert.deepEqual(widgetSupportingMeasures(widget, data).map((column) => column.id), ['net_sales', 'labor_cost'])
})

test('purpose metric remains selected and first in widget display settings', () => {
  assert.deepEqual(withWidgetPurposeColumn(widget, ['net_sales', 'labor_cost']), ['profit_after_labor', 'net_sales', 'labor_cost'])
  assert.deepEqual(withWidgetPurposeColumn(widget, ['net_sales', 'profit_after_labor']), ['profit_after_labor', 'net_sales'])
})

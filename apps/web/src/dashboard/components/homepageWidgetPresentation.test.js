import assert from 'node:assert/strict'
import test from 'node:test'

import {
  homepageWidgetChartCopy,
  widgetDimensionLabel,
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

test('chart copy names the widget metric, time grain, and grouping dimension', () => {
  const copy = homepageWidgetChartCopy(widget, { measure_columns: widget.columns }, 'restaurant')

  assert.equal(copy.trend.title, 'Profit after labor by business day')
  assert.equal(copy.trend.description, 'Profit after labor recorded for each business day in the selected date range.')
  assert.equal(copy.breakdown.title, 'Profit after labor by restaurant')
  assert.equal(copy.breakdown.description, 'Profit after labor totaled separately for each restaurant.')
})

test('chart copy distinguishes widgets that happen to graph a common metric', () => {
  const departmentSales = {
    label: 'Department sales',
    primary_column: 'net_sales',
    columns: [{ id: 'net_sales', label: 'Net sales' }],
  }
  const storeRankings = {
    label: 'Store rankings',
    primary_column: 'net_sales',
    columns: [{ id: 'net_sales', label: 'Net sales' }],
  }

  const departmentCopy = homepageWidgetChartCopy(departmentSales, null, 'department')
  const rankingsCopy = homepageWidgetChartCopy(storeRankings, null, 'restaurant')

  assert.equal(departmentCopy.trend.title, 'Department sales: net sales by business day')
  assert.equal(departmentCopy.breakdown.title, 'Department sales: net sales by menu department')
  assert.equal(rankingsCopy.trend.title, 'Store rankings: net sales by business day')
  assert.equal(rankingsCopy.breakdown.title, 'Store rankings: net sales by restaurant')
  assert.notEqual(departmentCopy.trend.title, rankingsCopy.trend.title)
  assert.notEqual(departmentCopy.breakdown.title, rankingsCopy.breakdown.title)
})

test('business dimensions use operational language', () => {
  assert.equal(widgetDimensionLabel('revenue_center'), 'section')
  assert.equal(widgetDimensionLabel('device'), 'POS device')
  assert.equal(widgetDimensionLabel('status'), 'reservation status')
  assert.equal(widgetDimensionLabel('payment method'), 'payment method')
})

test('the complete ordinary widget catalog produces distinct, specific graph titles', () => {
  const catalog = [
    ['Discounts', 'Discounts', 'discount_type'],
    ['Card deposits', 'Expected deposit', 'restaurant'],
    ['Department sales', 'Net sales', 'department'],
    ['Orders', 'Orders', 'restaurant'],
    ['Covers', 'Covers', 'restaurant'],
    ['Labor', 'Labor cost', 'restaurant'],
    ['Profit after labor', 'Profit after labor', 'restaurant'],
    ['Average check', 'Average check', 'restaurant'],
    ['Tips', 'Tips', 'restaurant'],
    ['Payment mix', 'Total collected', 'payment_method'],
    ['Menu performance', 'Net item sales', 'item'],
    ['Employee tips', 'Tips collected', 'employee'],
    ['Labor by employee', 'Hours', 'employee'],
    ['Table turns', 'Completed turns', 'restaurant'],
    ['Reservations', 'Reservations', 'status'],
    ['Discounts, refunds, and voids', 'Discounts', 'restaurant'],
    ['Group performance', 'Net sales', 'group'],
    ['Store rankings', 'Net sales', 'restaurant'],
  ]
  const copies = catalog.map(([label, measureLabel, breakdown], index) => homepageWidgetChartCopy({
    id: `widget-${index}`,
    label,
    primary_column: 'purpose',
    columns: [{ id: 'purpose', label: measureLabel }],
  }, null, breakdown))
  const trendTitles = copies.map((copy) => copy.trend.title)
  const breakdownTitles = copies.map((copy) => copy.breakdown.title)

  assert.equal(new Set(trendTitles).size, catalog.length)
  assert.equal(new Set(breakdownTitles).size, catalog.length)
  assert.ok(trendTitles.every((title) => title.endsWith('by business day')))
  assert.ok(breakdownTitles.every((title) => / by .+/.test(title)))
  assert.ok([...trendTitles, ...breakdownTitles].every((title) => !['Trend', 'Breakdown'].includes(title)))
})

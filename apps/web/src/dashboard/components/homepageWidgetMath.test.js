import assert from 'node:assert/strict'
import test from 'node:test'

import {
  aggregateWidgetRows,
  effectiveHomepageWidgetSettings,
  normalizeReportingScope,
  pruneReportingScope,
  splitHomepageWidgetIds,
} from './homepageWidgetMath.js'

test('aggregates sales summaries using receipt count', () => {
  const summary = aggregateWidgetRows([
    { net_sales: 100, receipts: 4, average_check: 25 },
    { net_sales: 50, receipts: 1, average_check: 50 },
  ])

  assert.equal(summary.net_sales, 150)
  assert.equal(summary.receipts, 5)
  assert.equal(summary.average_check, 30)
})

test('recalculates non-additive labor and table-turn metrics', () => {
  const labor = aggregateWidgetRows([
    { net_sales: 100, labor_cost: 30, labor_percentage: 30, profit_after_labor: 70 },
    { net_sales: 50, labor_cost: 10, labor_percentage: 20, profit_after_labor: 40 },
  ])
  const turns = aggregateWidgetRows([
    { completed_turns: 1, average_turn_minutes: 10 },
    { completed_turns: 3, average_turn_minutes: 30 },
  ])

  assert.equal(labor.profit_after_labor, 110)
  assert.ok(Math.abs(labor.labor_percentage - 26.6666667) < 0.000001)
  assert.equal(turns.average_turn_minutes, 25)
})

test('does not coerce dates, booleans, or identifiers into measures', () => {
  const summary = aggregateWidgetRows([
    { period: '2026-08-11', is_outlier: true, label: '100 Main', units: '2' },
  ])

  assert.deepEqual(summary, { units: 2 })
})

test('legacy widget scopes inherit the restaurant-wide dashboard default', () => {
  const settings = effectiveHomepageWidgetSettings({
    sales_summary: {
      scope_dimension: 'revenue_center',
      scope_ids: ['bar', 'hibachi'],
    },
  }, ['sales_summary'], { scope_dimension: 'none' })

  assert.deepEqual(settings.sales_summary.scope_ids, [])
  assert.equal(settings.sales_summary.scope_dimension, 'none')
})

test('explicit widget scopes override the dashboard scope', () => {
  const settings = effectiveHomepageWidgetSettings({
    sales_summary: {
      scope_source: 'widget',
      scope_dimension: 'revenue_center',
      scope_mode: 'cumulative',
      scope_ids: ['bar'],
    },
  }, ['sales_summary'], {
    scope_dimension: 'device',
    scope_mode: 'breakdown',
    scope_ids: ['register-1'],
  })

  assert.equal(settings.sales_summary.scope_dimension, 'revenue_center')
  assert.deepEqual(settings.sales_summary.scope_ids, ['bar'])
})

test('normalizes whole-restaurant scope without retaining stale ids', () => {
  assert.deepEqual(normalizeReportingScope({
    scope_dimension: 'none',
    scope_mode: 'breakdown',
    scope_ids: ['stale'],
  }), {
    scope_dimension: 'none',
    scope_mode: 'cumulative',
    scope_ids: [],
  })
})

test('drops stale portfolio scope when its selected stores change', () => {
  assert.deepEqual(pruneReportingScope({
    scope_dimension: 'revenue_center',
    scope_ids: ['old-section'],
  }, {
    sections: [{ id: 'current-section' }],
  }), {
    scope_dimension: 'none',
    scope_mode: 'cumulative',
    scope_ids: [],
  })
})

test('defers the expensive activity review without delaying primary Home widgets', () => {
  assert.deepEqual(splitHomepageWidgetIds([
    'sales_summary',
    'orders',
    'discount_review',
    'tips',
  ]), {
    primary: ['sales_summary', 'orders', 'tips'],
    deferred: ['discount_review'],
  })
})

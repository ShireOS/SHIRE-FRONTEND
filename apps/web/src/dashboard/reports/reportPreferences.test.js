import assert from 'node:assert/strict'
import test from 'node:test'

import { REPORT_CATALOG_VERSION, effectivePreference } from './reportPreferences.js'

const sections = [
  'sales_revenue',
  'payroll_timecards',
  'tip_settlement',
  'daily_summary',
]

test('legacy mixed payroll preference upgrades to two separate visible sections', () => {
  const resolved = effectivePreference({
    visible_sections: ['sales_revenue', 'payroll_support'],
    section_order: ['sales_revenue', 'payroll_support', 'daily_summary'],
    section_settings: { __report_catalog_version: 2 },
  }, sections)

  assert.deepEqual(resolved.order, sections)
  assert.deepEqual(resolved.visible, ['sales_revenue', 'payroll_timecards', 'tip_settlement'])
  assert.equal(resolved.sectionSettings.__report_catalog_version, REPORT_CATALOG_VERSION)
})

test('current preference keeps an intentionally hidden tip section hidden', () => {
  const resolved = effectivePreference({
    visible_sections: ['sales_revenue', 'payroll_timecards'],
    section_order: sections,
    section_settings: { __report_catalog_version: REPORT_CATALOG_VERSION },
  }, sections)

  assert.deepEqual(resolved.visible, ['sales_revenue', 'payroll_timecards'])
})

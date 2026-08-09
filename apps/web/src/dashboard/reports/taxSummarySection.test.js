import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { effectivePreference } from './reportPreferences.js'

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
const reportsPage = read('./RestaurantReportsPage.jsx')

test('tax_summary is registered in SECTION_META and the renderer dispatch', () => {
  assert.match(reportsPage, /\['tax_summary', 'Tax'\]/)
  assert.match(reportsPage, /tax_summary: \(\) => <TaxSummary section=\{sections\.tax_summary\}/)
  assert.match(reportsPage, /function TaxSummary\(\{ section = \{\}, comparisonEnabled \}\)/)
})

test('tax section renders the stats, all three tables, and a CSV export', () => {
  const [, body] = reportsPage.split('function TaxSummary(')
  const section = body.split('\nfunction ')[0]
  for (const label of ['Taxable sales', 'Non-taxable sales', 'Tax collected', 'Tax included in prices', 'Total tax liability']) {
    assert.ok(section.includes(`label="${label}"`), `missing stat ${label}`)
  }
  assert.ok(section.includes('rows={section.by_rate || []}'), 'missing per-rate table')
  assert.ok(section.includes('rows={section.by_category || []}'), 'missing per-category table')
  assert.ok(section.includes('rows={section.by_date || []}'), 'missing per-date table')
  assert.ok(section.includes('exportRows={section.by_rate || []}'), 'missing CSV export rows')
})

test('inclusive stats are conditional so exclusive-only restaurants see no empty tiles', () => {
  const [, body] = reportsPage.split('function TaxSummary(')
  const section = body.split('\nfunction ')[0]
  assert.match(section, /const inclusive = Number\(totals\.inclusive_tax \|\| 0\)/)
  assert.match(section, /\{inclusive !== 0 && <Stat label="Tax included in prices"/)
  assert.match(section, /\{inclusive !== 0 && <Stat label="Total tax liability"/)
})

test('an unattributed residual is surfaced rather than hidden', () => {
  const [, body] = reportsPage.split('function TaxSummary(')
  const section = body.split('\nfunction ')[0]
  assert.match(section, /unattributed_tax_added/)
  assert.match(section, /unattributed_tax_included/)
  assert.match(section, /Math\.abs\(unattributed\) >= 0\.01 &&/)
})

const ALL = ['sales_revenue', 'z_report', 'tax_summary', 'daily_summary']
const OLD = ['sales_revenue', 'z_report', 'daily_summary']

test('sections the saved preference row predates still render', () => {
  const { visible } = effectivePreference({ visible_sections: OLD, section_order: OLD }, ALL)
  assert.ok(visible.includes('tax_summary'))
})

test('the config modal and the page agree, so an untouched save cannot hide a new section', () => {
  // The modal seeds its checkboxes from the same resolver the page renders from, then
  // posts that back. Previously it seeded from the raw saved list, so tax_summary showed
  // unchecked while rendering, and one no-op Save hid it permanently.
  const saved = { visible_sections: OLD, section_order: OLD }
  const first = effectivePreference(saved, ALL)
  assert.deepEqual(first.visible, ['sales_revenue', 'z_report', 'daily_summary', 'tax_summary'])

  // Save with nothing toggled: the backend echoes back what the modal posted.
  const afterSave = { visible_sections: first.visible, section_order: first.order }
  assert.deepEqual(effectivePreference(afterSave, ALL).visible, first.visible)
  assert.match(reportsPage, /const resolved = resolvePreference\(preference\)/)
  assert.match(reportsPage, /useState\(resolved\.visible\)/)
})

test('a section the user actually unchecked stays hidden across reloads', () => {
  const saved = { visible_sections: ['sales_revenue', 'tax_summary'], section_order: ALL }
  const { visible } = effectivePreference(saved, ALL)
  assert.deepEqual(visible, ['sales_revenue', 'tax_summary'])
})

test('an empty saved order does not leak sections the user hid', () => {
  // `[]` is truthy, so the old `preference.section_order || ALL` kept the empty array and
  // then force-added every id as "new", revealing sections the user had switched off.
  const { visible } = effectivePreference({ visible_sections: ['sales_revenue'], section_order: [] }, ALL)
  assert.deepEqual(visible, ['sales_revenue'])
})

test('the POS terminal-home report tile offers the tax section', () => {
  assert.match(read('../pages/PosSettingsPage.jsx'), /\['tax_summary', 'Tax'\]/)
})

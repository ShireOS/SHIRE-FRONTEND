import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  REPORT_CATALOG_VERSION,
  REPORT_CATALOG_VERSION_KEY,
  effectivePreference,
} from './reportPreferences.js'

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
const reportsPage = read('./RestaurantReportsPage.jsx')

test('tax is available in long and short POS report profiles', () => {
  const long = reportsPage.match(/id: 'long'[^\n]+/)?.[0] || ''
  const short = reportsPage.match(/id: 'short'[^\n]+/)?.[0] || ''
  assert.match(long, /'tax'/)
  assert.match(short, /'tax'/)
})

test('the generic receipt renderer supports tax summary lines and detailed rows', () => {
  assert.match(reportsPage, /\(group\.lines \|\| \[\]\)\.length/)
  assert.match(reportsPage, /\(group\.rows \|\| \[\]\)\.length/)
  assert.match(reportsPage, /group\.columns\.map/)
})

test('settings are driven by the backend catalog instead of a second tax schema', () => {
  assert.match(reportsPage, /const catalog = snapshot\?\.catalog\?\.length \? snapshot\.catalog : RECEIPT_GROUP_CATALOG/)
  assert.match(reportsPage, /visibleCatalog\.map\(\(group\) =>/)
  assert.match(reportsPage, /checked=\{selected\.group_ids\.includes\(group\.id\)\}/)
})

test('profile selection is persisted and controls every generated artifact', () => {
  assert.match(reportsPage, /active_profile_id: nextActiveId/)
  assert.match(reportsPage, /pos_report_profiles: nextProfiles/)
  assert.match(reportsPage, /receipt_group_ids: scopedGroupIds/)
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
  const afterSave = {
    visible_sections: first.visible,
    section_order: first.order,
    section_settings: first.sectionSettings,
  }
  assert.deepEqual(effectivePreference(afterSave, ALL).visible, first.visible)
})

test('an older client cannot hide a newly introduced section when the backend backfills order', () => {
  const backendBackfilled = {
    visible_sections: OLD,
    section_order: ALL,
    section_settings: {},
  }
  const resolved = effectivePreference(backendBackfilled, ALL)
  assert.ok(resolved.visible.includes('tax_summary'))
  assert.equal(resolved.sectionSettings[REPORT_CATALOG_VERSION_KEY], REPORT_CATALOG_VERSION)
})

test('a section the user actually unchecked stays hidden across reloads', () => {
  const saved = {
    visible_sections: ['sales_revenue', 'tax_summary'],
    section_order: ALL,
    section_settings: { [REPORT_CATALOG_VERSION_KEY]: REPORT_CATALOG_VERSION },
  }
  const { visible } = effectivePreference(saved, ALL)
  assert.deepEqual(visible, ['sales_revenue', 'tax_summary'])
})

test('an empty saved order does not leak sections the user hid', () => {
  // `[]` is truthy, so the old `preference.section_order || ALL` kept the empty array and
  // then force-added every id as "new", revealing sections the user had switched off.
  const { visible } = effectivePreference({
    visible_sections: ['sales_revenue'],
    section_order: [],
    section_settings: { [REPORT_CATALOG_VERSION_KEY]: REPORT_CATALOG_VERSION },
  }, ALL)
  assert.deepEqual(visible, ['sales_revenue'])
})

test('the POS terminal-home report tile offers the tax section', () => {
  assert.match(read('../pages/PosSettingsPage.jsx'), /\['tax_summary', 'Tax'\]/)
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { cashSettlementDisplay } from './reportDisplay.js'

const reportsPage = await readFile(new URL('./RestaurantReportsPage.jsx', import.meta.url), 'utf8')
const setupPanel = await readFile(new URL('../RestaurantSetupPanel.jsx', import.meta.url), 'utf8')
const settingsOptions = await readFile(new URL('../../../../../packages/settings/src/options.ts', import.meta.url), 'utf8')
const settingsSections = await readFile(new URL('../../../../../packages/settings/src/sections.ts', import.meta.url), 'utf8')
const onboardingSections = await readFile(new URL('../../onboarding/pages/steps/SectionsStep.tsx', import.meta.url), 'utf8')
const onboardingTips = await readFile(new URL('../../onboarding/pages/steps/TipPayrollStep.tsx', import.meta.url), 'utf8')

test('restaurant and section gratuity default to the employee but remain configurable', () => {
  assert.match(settingsSections, /assigned_to_employee: true/)
  assert.match(settingsSections, /assigned_to_employee: gratuity\.assigned_to_employee/)
  assert.match(setupPanel, /Who receives it/)
  assert.match(setupPanel, /Employee — tip earnings/)
  assert.match(setupPanel, /Restaurant — service-charge revenue/)
  assert.match(onboardingSections, /assigned_to_employee: true/)
})

test('cash tip declaration copy distinguishes optional skip from a zero declaration', () => {
  assert.match(settingsOptions, /Optional — employee may declare/)
  assert.match(onboardingTips, /Optional — employee may declare/)
  for (const source of [setupPanel, onboardingTips]) {
    assert.match(source, /Skip records no declaration/)
    assert.match(source, /Only required mode blocks Server Checkout/)
  }
})

test('POS reports use the canonical business-date snapshot and shared output groups', () => {
  assert.match(reportsPage, /Accounting business dates/)
  assert.match(reportsPage, /\/manager\/report-hub\/snapshot/)
  assert.match(reportsPage, /receipt_group_ids: activeProfile\.group_ids/)
  assert.match(reportsPage, /downloadSnapshotCsv\(snapshot, activeProfile\.group_ids/)
  assert.match(reportsPage, /Accounting business date/)
  assert.match(reportsPage, />Scheduled delivery</)
  assert.match(reportsPage, /\/reports\/recipients/)
  assert.doesNotMatch(reportsPage, /business_date: dates\.end/)
})

test('server cash settlement labels follow the signed authoritative amount', () => {
  assert.deepEqual(cashSettlementDisplay(42.5), {
    label: 'Server owes restaurant',
    amount: 42.5,
  })
  assert.deepEqual(cashSettlementDisplay(-42.5), {
    label: 'Restaurant owes server',
    amount: 42.5,
  })
  assert.deepEqual(cashSettlementDisplay(0), {
    label: 'Server owes restaurant',
    amount: 0,
  })
  assert.equal(cashSettlementDisplay(null), null)
})

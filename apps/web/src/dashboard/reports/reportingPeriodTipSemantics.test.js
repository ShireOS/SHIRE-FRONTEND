import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const reportsPage = await readFile(new URL('./RestaurantReportsPage.jsx', import.meta.url), 'utf8')
const reconciliationBanner = await readFile(new URL('../../shared/components/ReconciliationBanner.jsx', import.meta.url), 'utf8')
const setupPanel = await readFile(new URL('../RestaurantSetupPanel.jsx', import.meta.url), 'utf8')
const onboardingSections = await readFile(new URL('../../onboarding/pages/steps/SectionsStep.tsx', import.meta.url), 'utf8')
const onboardingTips = await readFile(new URL('../../onboarding/pages/steps/TipPayrollStep.tsx', import.meta.url), 'utf8')

test('restaurant and section gratuity default to the employee but remain configurable', () => {
  assert.match(setupPanel, /assigned_to_employee: true/)
  assert.match(setupPanel, /assigned_to_employee: gratuity\.assigned_to_employee/)
  assert.match(setupPanel, /Who receives it/)
  assert.match(setupPanel, /Employee — tip earnings/)
  assert.match(setupPanel, /Restaurant — service-charge revenue/)
  assert.match(onboardingSections, /assigned_to_employee: true/)
})

test('cash tip declaration copy distinguishes optional skip from a zero declaration', () => {
  for (const source of [setupPanel, onboardingTips]) {
    assert.match(source, /Optional — employee may declare/)
    assert.match(source, /Skip records no declaration/)
    assert.match(source, /Only required mode blocks Server Checkout/)
  }
})

test('money reports keep accounting dates and employee gratuity explicit', () => {
  assert.match(reportsPage, /Accounting business dates/)
  assert.match(reportsPage, /Payment completed/)
  assert.match(reportsPage, /Voluntary tips/)
  assert.match(reportsPage, /Employee gratuity/)
  assert.match(reportsPage, /Employee gratuity needing attribution/)
  assert.match(reportsPage, /Voluntary tips needing attribution/)
  assert.match(reportsPage, /remains unpaid until a manager attributes it/)
  assert.match(reportsPage, /Unclassified legacy charges/)
  assert.match(reportsPage, /Server owes restaurant/)
  assert.match(reportsPage, /Gratuity owed through payroll/)
  assert.match(reportsPage, /Total tip earnings/)
  assert.match(reportsPage, /Independent transaction verification is unavailable/)
  assert.match(reportsPage, /whole-restaurant green result cannot be mistaken as verification of the visible subset/)
  assert.match(reportsPage, /reconciliationCoversCurrentView \? <ReconciliationBanner/)
  assert.match(reconciliationBanner, /recon\.status === 'verified' && recon\.complete === true/)
  assert.doesNotMatch(reportsPage, /Stat label="Tips"/)
})

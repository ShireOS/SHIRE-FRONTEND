import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  initialSetupSectionStates,
  isCurrentSetupLoad,
  nextSetupLoadScope,
  setupReadOutcomeStates,
  setupSaveBlockReason,
} from './setupLoadSafety.js'

const panelSource = fs.readFileSync(new URL('./RestaurantSetupPanel.jsx', import.meta.url), 'utf8')
const dashboardSource = fs.readFileSync(new URL('./AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')

test('a late load from another restaurant cannot become current', () => {
  const loadA = nextSetupLoadScope(null, 'restaurant-a')
  const loadB = nextSetupLoadScope(loadA, 'restaurant-b')

  assert.equal(isCurrentSetupLoad(loadB, loadA), false)
  assert.equal(isCurrentSetupLoad(loadB, loadB), true)
})

test('remote sections remain blocked until every required read succeeds', () => {
  const loading = initialSetupSectionStates('restaurant-b', ['basics', 'employees', 'payments'])
  assert.equal(setupSaveBlockReason(loading, 'basics', 'restaurant-b'), null)
  assert.match(setupSaveBlockReason(loading, 'employees', 'restaurant-b'), /still loading/)
  assert.match(setupSaveBlockReason(loading, 'pricing_policy', 'restaurant-b'), /still loading/)

  const outcomes = setupReadOutcomeStates('restaurant-b', [
    { requested: true, label: 'Employees', sectionIds: ['employees'], error: null },
    { requested: true, label: 'Roles', sectionIds: ['employees'], error: new Error('offline') },
    { requested: true, label: 'Sensitive settings', sectionIds: ['payments'], error: null },
    { requested: true, label: 'Pricing policy', sectionIds: ['pricing_policy'], error: null },
  ])

  assert.match(setupSaveBlockReason(outcomes, 'employees', 'restaurant-b'), /Roles failed to load/)
  assert.equal(setupSaveBlockReason(outcomes, 'payments', 'restaurant-b'), null)
  assert.equal(setupSaveBlockReason(outcomes, 'pricing_policy', 'restaurant-b'), null)
  assert.match(setupSaveBlockReason(outcomes, 'payments', 'restaurant-a'), /selected restaurant/)
})

test('a failed read never becomes a successful empty state', () => {
  const outcomes = setupReadOutcomeStates('restaurant-a', [
    { requested: true, label: 'Hours', sectionIds: ['hours'], value: undefined, error: new Error('timeout') },
  ])

  assert.deepEqual(outcomes.hours, {
    restaurantId: 'restaurant-a',
    status: 'error',
    error: 'Hours',
  })
  assert.match(setupSaveBlockReason(outcomes, 'hours', 'restaurant-a'), /Retry before saving/)
})

test('a successful empty read remains a valid editable empty state', () => {
  const outcomes = setupReadOutcomeStates('new-restaurant', [
    { requested: true, label: 'Sections', sectionIds: ['sections'], value: [], error: null },
  ])

  assert.equal(setupSaveBlockReason(outcomes, 'sections', 'new-restaurant'), null)
})

test('the setup editor enforces the restaurant-scoped load and save contract', () => {
  assert.match(panelSource, /isCurrentSetupLoad\(setupLoadScopeRef\.current, scope\)/)
  assert.match(panelSource, /setupReadOutcomeStates\(targetRestaurantId, results\)/)
  assert.match(panelSource, /requireReadySetupSection\(sectionId\)/)
  assert.match(panelSource, /fetchRestaurantSensitiveSettings\(targetRestaurantId, \{ signal \}\)/)
  assert.match(panelSource, /fetchReservationSettings\(targetRestaurantId, \{ signal \}\)/)
  assert.match(panelSource, /\}, \[restaurantId\]\)/)
  assert.doesNotMatch(panelSource, /\}, \[restaurant\]\)/)
  assert.match(dashboardSource, /<ModernRestaurantSetupPanel key=\{String\(props\.restaurantId \|\| ''\)\}/)
  assert.doesNotMatch(dashboardSource, /<ModernRestaurantSetupPanel\s+restaurant=/)
})

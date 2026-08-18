import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ROUTE_INHERIT_VALUE,
  ROUTE_MULTI_VALUE,
  ROUTE_NO_PRODUCTION_VALUE,
  explicitProductionRouteValue,
  hasItemProductionOverride,
  productionRouteSelectionPayload,
  resolveDraftProductionRoute,
} from './menuRouting.js'

const kitchen = { id: 'kitchen', name: 'Kitchen' }
const bar = { id: 'bar', name: 'Bar' }
const base = { stations: [kitchen, bar], routableStationIds: ['kitchen', 'bar'] }

test('new items inherit their category route without an item override', () => {
  const route = resolveDraftProductionRoute({
    ...base,
    category: 'Drinks',
    categoryRules: [{ station_id: 'bar', station_name: 'Bar' }],
    fallback: { ok: true, station: kitchen },
  })

  assert.equal(route.kind, 'category')
  assert.equal(route.label, 'Bar')
  assert.equal(route.sourceLabel, 'Drinks category default')
  assert.equal(route.valid, true)
})

test('new items use the restaurant fallback when their category has no route', () => {
  const route = resolveDraftProductionRoute({
    ...base,
    category: 'Other',
    fallback: { ok: true, station: kitchen },
  })

  assert.equal(route.kind, 'fallback')
  assert.equal(route.label, 'Kitchen')
  assert.equal(route.valid, true)
})

test('item overrides and intentional no-production choices take precedence', () => {
  const override = resolveDraftProductionRoute({ ...base, routing: 'bar', fallback: { ok: true, station: kitchen } })
  const suppressed = resolveDraftProductionRoute({ ...base, routing: ROUTE_NO_PRODUCTION_VALUE })

  assert.equal(override.kind, 'item_override')
  assert.equal(override.label, 'Bar')
  assert.equal(suppressed.kind, 'no_production')
  assert.equal(suppressed.valid, true)
})

test('automatic routing blocks save only when its destination has no active output', () => {
  const route = resolveDraftProductionRoute({
    stations: [bar],
    routableStationIds: [],
    category: 'Drinks',
    categoryRules: [{ station_id: 'bar', station_name: 'Bar' }],
  })

  assert.equal(route.valid, false)
  assert.match(route.error, /without an active kitchen printer or display/)
})

test('item override detection excludes automatically inherited items', () => {
  const inherited = { id: 'coffee' }
  const exception = { id: 'tower' }
  const rules = [{ source_type: 'menu_item', source_id: 'tower' }]

  assert.equal(hasItemProductionOverride(inherited, rules, []), false)
  assert.equal(hasItemProductionOverride(exception, rules, []), true)
})

test('routing selections map to canonical inherit, station, and no-ticket payloads', () => {
  assert.deepEqual(productionRouteSelectionPayload(ROUTE_INHERIT_VALUE), { mode: 'inherit', station_ids: [] })
  assert.deepEqual(productionRouteSelectionPayload('bar'), { mode: 'stations', station_ids: ['bar'] })
  assert.deepEqual(productionRouteSelectionPayload(ROUTE_NO_PRODUCTION_VALUE), { mode: 'no_production', station_ids: [] })
  assert.throws(() => productionRouteSelectionPayload(ROUTE_MULTI_VALUE), /Choose one prep station/)
})

test('explicit route values prefer no-ticket exclusions over station rules', () => {
  const rules = [
    { source_type: 'category', category: 'Retail', station_id: 'kitchen', is_active: true },
    { source_type: 'menu_item', source_id: 'gift-card', station_id: 'bar', is_active: true },
  ]
  const exclusions = [{ source_type: 'menu_item', source_id: 'gift-card', is_active: true }]

  assert.equal(explicitProductionRouteValue({ sourceType: 'category', category: 'retail', rules }), 'kitchen')
  assert.equal(explicitProductionRouteValue({ sourceType: 'menu_item', sourceId: 'gift-card', rules, exclusions }), ROUTE_NO_PRODUCTION_VALUE)
  assert.equal(explicitProductionRouteValue({ sourceType: 'category', category: 'Other', projectedStationId: 'expo' }), 'expo')
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ROUTE_NO_PRODUCTION_VALUE,
  hasItemProductionOverride,
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

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routing = await readFile(new URL('./pages/steps/RoutingStep.tsx', import.meta.url), 'utf8')

test('kitchen routing follows the dependency order before menu rules', () => {
  const stations = routing.indexOf('1. Prep Stations')
  const outputs = routing.indexOf('2. Printers & Displays')
  const connections = routing.indexOf('3. Connect Stations to Outputs')
  const fallback = routing.indexOf('4. Choose the Default Prep Station')
  const categories = routing.indexOf('5. Route Menu Categories')

  assert.ok(stations >= 0)
  assert.ok(outputs > stations)
  assert.ok(connections > outputs)
  assert.ok(fallback > connections)
  assert.ok(categories > fallback)
})

test('the fallback selector exposes only stations with an active output', () => {
  assert.match(routing, /connectedStationIds = new Set\(activeStationTargets\.map/)
  assert.match(routing, /fallbackOptions = stationOptions\.filter\(station => connectedStationIds\.has\(station\.id\)\)/)
  assert.match(routing, /Connect at least one station to an output above before choosing the default/)
  assert.match(routing, /disabled=\{!fallbackOptions\.length \|\| workingAction !== null\}/)
})

test('creation is explicit and newly saved stations and outputs are identified inline', () => {
  assert.match(routing, /useState\(''\)[\s\S]*useState\(''\)/)
  assert.match(routing, /placeholder="e\.g\. Kitchen, Bar, Dessert"/)
  assert.match(routing, /placeholder="e\.g\. Kitchen Printer"/)
  assert.match(routing, /recentlyAddedStation[\s\S]*Just added/)
  assert.match(routing, /recentlyAddedTarget[\s\S]*Just added/)
})

test('category and item summaries show the full station-to-output path', () => {
  assert.match(routing, /Menu category[\s\S]*Prep station[\s\S]*Printer or KDS/)
  assert.match(routing, /stationRouteLabel[\s\S]*No output connected/)
  assert.match(routing, /categoryRouteLabel\(category\)/)
  assert.match(routing, /Default: \$\{stationRouteLabel\(currentFallbackId\)\}/)
})

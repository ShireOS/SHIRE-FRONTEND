import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const step = await readFile(new URL('./pages/steps/MenuCategoriesStep.tsx', import.meta.url), 'utf8')
const settings = await readFile(new URL('../../../../packages/settings/src/menuCategories.ts', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../dashboard/MenuPanel.jsx', import.meta.url), 'utf8')

test('new categories persist inherited defaults as empty values', () => {
  const defaults = settings.slice(settings.indexOf('export function defaultMenuCategories'), settings.indexOf('export function normalizeMenuCategories'))
  assert.doesNotMatch(defaults, /routing_station_name: '(Kitchen|Bar|Expo)'/)
  assert.doesNotMatch(defaults, /kds_display_group: '(Apps|Entrees|Bar|Desserts)'/)
  assert.doesNotMatch(defaults, /default_fire_mode: '(immediate|by_course|inherit)'/)
})

test('onboarding uses canonical POS routes and creatable category selectors', () => {
  assert.match(step, /CreatableCombobox/)
  assert.match(step, /productionRouteSelectionPayload/)
  assert.match(step, /\/kitchen-routing\/categories/)
  assert.match(step, /Use restaurant fallback —/)
  assert.match(step, /Use category name —/)
})

test('existing category configuration shares the same explicit controls', () => {
  assert.match(dashboard, /<CreatableCombobox[\s\S]*createNoun="prep station"/)
  assert.match(dashboard, /<CreatableCombobox[\s\S]*createNoun="KDS group"/)
  assert.match(dashboard, /Promote any legacy station projection/)
})

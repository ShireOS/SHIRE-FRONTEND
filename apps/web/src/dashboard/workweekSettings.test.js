import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  normalizeWorkweekStartWeekday,
  WORKWEEK_START_DAY_OPTIONS,
} from './workweekSettings.js'

const setupPanel = await readFile(new URL('./RestaurantSetupPanel.jsx', import.meta.url), 'utf8')
const permissions = await readFile(new URL('../shared/permissions.ts', import.meta.url), 'utf8')

test('workweek weekdays use the shared Monday-zero contract', () => {
  assert.deepEqual(WORKWEEK_START_DAY_OPTIONS, [
    { value: 0, label: 'Monday' },
    { value: 1, label: 'Tuesday' },
    { value: 2, label: 'Wednesday' },
    { value: 3, label: 'Thursday' },
    { value: 4, label: 'Friday' },
    { value: 5, label: 'Saturday' },
    { value: 6, label: 'Sunday' },
  ])
})

test('missing or invalid workweek settings default to Monday', () => {
  assert.equal(normalizeWorkweekStartWeekday(undefined), 0)
  assert.equal(normalizeWorkweekStartWeekday(null), 0)
  assert.equal(normalizeWorkweekStartWeekday(true), 0)
  assert.equal(normalizeWorkweekStartWeekday(false), 0)
  assert.equal(normalizeWorkweekStartWeekday(''), 0)
  assert.equal(normalizeWorkweekStartWeekday('  '), 0)
  assert.equal(normalizeWorkweekStartWeekday(-1), 0)
  assert.equal(normalizeWorkweekStartWeekday(7), 0)
  assert.equal(normalizeWorkweekStartWeekday('4'), 4)
})

test('Setup Basics saves the workweek through the guarded profile contract', () => {
  const saveBasics = setupPanel.slice(
    setupPanel.indexOf('const saveBasics = async'),
    setupPanel.indexOf('const saveGoals = async'),
  )

  assert.match(setupPanel, /Workweek Start Day/)
  assert.match(setupPanel, /restaurant\.config\?\.workweek_start_weekday/)
  assert.match(saveBasics, /workweek_start_weekday: normalizeWorkweekStartWeekday\(profile\.workweek_start_weekday\)/)
  assert.match(saveBasics, /fetchWithSupabaseAuth\(`\/restaurants\/\$\{targetId\}\/setup-profile`/)
  assert.doesNotMatch(saveBasics, /updateRestaurantRow/)
  assert.match(permissions, /setup: 'settings\.edit'/)
  assert.match(permissions, /'store-information': 'settings\.edit'/)
})

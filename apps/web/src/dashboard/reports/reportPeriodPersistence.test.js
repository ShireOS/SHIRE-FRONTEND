import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const reportsPage = await readFile(new URL('./RestaurantReportsPage.jsx', import.meta.url), 'utf8')

test('POS Reports always opens on this week with a full-day window', () => {
  assert.match(reportsPage, /useState\(\(\) => periodRange\('week'\)\)/)
  assert.match(reportsPage, /useState\(\{ start: '00:00', end: '23:59' \}\)/)
  assert.match(reportsPage, /setPeriodPreset\('week'\)\s+setDates\(periodRange\('week'\)\)\s+setTimes\(\{ start: '00:00', end: '23:59' \}\)/)
})

test('date-time windows are deliberately visit-local and never enter preference IO', () => {
  assert.doesNotMatch(reportsPage, /saved\.(?:period_preset|custom_start_date|custom_end_date|start_time|end_time)/)

  const preferencePayload = reportsPage.slice(
    reportsPage.indexOf('const preferencePayload'),
    reportsPage.indexOf('const cachePreferenceSettings'),
  )
  const periodSelection = reportsPage.slice(
    reportsPage.indexOf('const selectPeriod'),
    reportsPage.indexOf('useEffect(() => {', reportsPage.indexOf('const setCustomDateTime')),
  )

  for (const key of ['period_preset', 'custom_start_date', 'custom_end_date', 'start_time', 'end_time']) {
    assert.doesNotMatch(preferencePayload, new RegExp(`${key}:`))
  }
  assert.doesNotMatch(periodSelection, /cachePreferenceSettings|view-preferences|fetchWithSupabaseAuth/)
  assert.match(periodSelection, /setPeriodPreset\(preset\)/)
  assert.match(periodSelection, /setDates\(periodRange\(preset\)\)/)
  assert.match(periodSelection, /setTimes\(nextTimes\)/)
})

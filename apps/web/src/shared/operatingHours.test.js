import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { operatingHoursReplacementPayload } from './operatingHours.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const setup = fs.readFileSync(path.join(here, '../dashboard/RestaurantSetupPanel.jsx'), 'utf8')
const onboarding = fs.readFileSync(path.join(here, '../onboarding/hooks/useOnboarding.ts'), 'utf8')
const bulkApply = fs.readFileSync(path.join(here, '../dashboard/data/bulkApply.js'), 'utf8')

const completeHours = Array.from({ length: 7 }, (_, day) => ({
  day_of_week: day,
  open_time: '09:00',
  close_time: '17:00',
  is_closed: day === 0,
}))

test('operating-hours replacement requires one row for every day', () => {
  const payload = operatingHoursReplacementPayload([...completeHours].reverse())

  assert.deepEqual(payload.hours.map(row => row.day_of_week), [0, 1, 2, 3, 4, 5, 6])
  assert.throws(
    () => operatingHoursReplacementPayload(completeHours.slice(0, 6)),
    /all seven days/,
  )
  assert.throws(
    () => operatingHoursReplacementPayload([...completeHours.slice(0, 6), completeHours[0]]),
    /each day exactly once/,
  )
})

test('setup, onboarding, and multi-store copy use the atomic backend endpoint', () => {
  for (const source of [setup, onboarding, bulkApply]) {
    assert.match(source, /operatingHoursReplacementPayload/)
    assert.match(source, /\/operating-hours/)
  }

  assert.doesNotMatch(setup, /from\('operating_hours'\)[\s\S]{0,160}\.(?:delete|insert|upsert)\(/)
  assert.doesNotMatch(onboarding, /from\('operating_hours'\)[\s\S]{0,160}\.(?:delete|insert|upsert)\(/)
  assert.doesNotMatch(bulkApply, /from\('operating_hours'\)[\s\S]{0,160}\.(?:delete|insert|upsert)\(/)
  assert.match(bulkApply, /source restaurant has no operating hours to copy/i)
})

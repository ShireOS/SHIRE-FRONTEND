import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const boarding = await readFile(new URL('./data/boarding.js', import.meta.url), 'utf8')
const onboarding = await readFile(new URL('../onboarding/hooks/useOnboarding.ts', import.meta.url), 'utf8')

function assertLifecycleSafeInsert(source, idDeclaration, label) {
  const start = source.indexOf(idDeclaration)
  assert.notEqual(start, -1, `${label} must generate the restaurant id before insert`)

  const insert = source.indexOf(".from('restaurants')", start)
  const followUpRead = source.indexOf(".from('restaurants')", insert + 1)
  assert.notEqual(insert, -1, `${label} must insert a restaurant`)
  assert.notEqual(followUpRead, -1, `${label} must read the restaurant after insert`)

  const insertStatement = source.slice(insert, followUpRead)
  assert.doesNotMatch(
    insertStatement,
    /\.select\s*\(/,
    `${label} must not request INSERT RETURNING before the lifecycle trigger is visible`,
  )

  const readStatement = source.slice(followUpRead, followUpRead + 260)
  assert.match(readStatement, /\.select\s*\(\)/)
  assert.match(readStatement, /\.eq\('id',\s*(?:restaurantId|newRestaurantId)\)/)
  assert.match(readStatement, /\.single\s*\(\)/)
}

test('restaurant creation reads the row only after the lifecycle trigger commits', () => {
  assertLifecycleSafeInsert(boarding, 'const restaurantId = crypto.randomUUID()', 'draft boarding')
  assertLifecycleSafeInsert(onboarding, 'const newRestaurantId = crypto.randomUUID()', 'owner onboarding')
})

test('draft boarding reads the seeded pricing version before replacing the rate plan', () => {
  const readIndex = boarding.indexOf('const currentRatePlans = await fetchRatePlans([restaurant.id])')
  const writeIndex = boarding.indexOf('await upsertRatePlan(restaurant.id, {')

  assert.notEqual(readIndex, -1)
  assert.notEqual(writeIndex, -1)
  assert.ok(readIndex < writeIndex)
  assert.match(boarding.slice(writeIndex, writeIndex + 220), /version: currentRatePlans\[restaurant\.id\]\?\.version/)
})

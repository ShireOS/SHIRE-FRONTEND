import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const reportsPage = readFileSync(fileURLToPath(new URL('./RestaurantReportsPage.jsx', import.meta.url)), 'utf8')

test('every built-in POS report includes the canonical revenue group', () => {
  for (const id of ['long', 'short', 'compact']) {
    const profile = reportsPage.match(new RegExp(`id: '${id}'[^\\n]+`))?.[0] || ''
    assert.match(profile, /group_ids: \['revenue'/)
  }
})

test('receipt summary lines preserve backend labels, values, emphasis, and notes', () => {
  assert.match(reportsPage, /line\.label/)
  assert.match(reportsPage, /displayValue\(line\.value, line\.format, line\.digits, timezone\)/)
  assert.match(reportsPage, /line\.emphasis/)
  assert.match(reportsPage, /line\.note/)
})

test('CSV uses only the active profile groups from the displayed snapshot', () => {
  assert.match(reportsPage, /const selected = new Set\(groupIds\)/)
  assert.match(reportsPage, /if \(!selected\.has\(group\.id\)\) continue/)
  assert.match(reportsPage, /downloadSnapshotCsv\(snapshot, scopedGroupIds/)
})

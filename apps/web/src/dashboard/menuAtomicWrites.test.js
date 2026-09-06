import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const menuPanel = readFileSync(new URL('./MenuPanel.jsx', import.meta.url), 'utf8')
const menuGroups = readFileSync(new URL('./data/menuGroups.js', import.meta.url), 'utf8')

const functionSource = (name, nextName) => {
  const start = menuGroups.indexOf(`export async function ${name}`)
  const end = menuGroups.indexOf(`export async function ${nextName}`, start + 1)
  assert.notEqual(start, -1, `${name} must exist`)
  return menuGroups.slice(start, end === -1 ? undefined : end)
}

test('daily-special settings use a nested versioned backend patch', () => {
  assert.match(menuPanel, /menu\/daily-special-settings/)
  assert.match(menuPanel, /expected_version: dailySpecialSettingsVersionRef\.current/)
  assert.match(menuPanel, /saveError\?\.status === 409[\s\S]+loadSpecialSettings\(true\)/)
  assert.doesNotMatch(menuPanel, /update\(\{ config:/)
})

test('modifier item replacement is one backend operation, not browser delete then insert', () => {
  const source = functionSource('replaceGroupItems', 'attachGroupToItem')
  assert.match(source, /modifier-groups\/\$\{groupId\}\/items/)
  assert.match(source, /expected_item_ids/)
  assert.doesNotMatch(source, /\.delete\(/)
  assert.doesNotMatch(source, /\.insert\(/)
})

test('answer and category reorder use bulk backend operations with expected positions', () => {
  const options = functionSource('reorderGroupOptions', 'applyAlphaOrderToGroup')
  const categories = functionSource('reorderCategoryGroups', 'attachGroupToCategory')
  for (const source of [options, categories]) {
    assert.match(source, /expected_positions/)
    assert.doesNotMatch(source, /for \(let index/)
    assert.doesNotMatch(source, /\.update\(/)
  }
  assert.match(options, /options\/order/)
  assert.match(categories, /modifier-groups\/order/)
})

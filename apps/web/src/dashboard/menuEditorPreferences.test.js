import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./MenuPanel.jsx', import.meta.url), 'utf8')

test('debounced editor preference writes retain the store and settings as one snapshot', () => {
  assert.match(source, /editorPrefsPendingRef\.current = \{ restaurantId, settings: next \}/)
  assert.match(source, /persistEditorPrefs = \(\{ restaurantId: targetRestaurantId, settings \}\)/)
  assert.match(source, /flushEditorPrefs\(\)[\s\S]+\}, \[restaurantId\]\)/)
})

test('late preference reads cannot overwrite another store', () => {
  assert.match(source, /editorPrefsRestaurantRef\.current !== targetRestaurantId/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./MenuPanel.jsx', import.meta.url), 'utf8')

test('existing modifier rows permanently label every data control', () => {
  const labels = [
    'Modifier name',
    'Price adjustment',
    'Modifier category',
    'Tax rate',
    'Sales category',
    'Kitchen hierarchy',
    'Kitchen ticket',
    'Applied items',
    'Ticket name',
  ]

  for (const label of labels) {
    assert.match(source, new RegExp(`<ModifierRowField label="${label}">`))
  }
})

test('editable modifier values have explicit accessible names', () => {
  for (const label of [
    'Modifier name',
    'Price adjustment',
    'Modifier category',
    'Modifier tax rate',
    'Modifier sales category',
    'Modifier kitchen hierarchy',
  ]) {
    assert.match(source, new RegExp(`aria-label="${label}"`))
  }
})

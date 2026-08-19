import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./MenuPanel.jsx', import.meta.url), 'utf8')

test('category settings and item visibility use independent controls', () => {
  assert.match(source, /Edit category/)
  assert.match(source, /Hide items/)
  assert.match(source, /editingCategoryKey === categoryEditorKey/)
  assert.match(source, /expandedCategoryNames\.has\(category\.name\)/)
})

test('category question ordering lives in the category editor, before item expansion', () => {
  const questionEditor = source.indexOf('<p className="label-mono mb-1">Base questions</p>')
  const itemExpansion = source.indexOf('{isExpanded && (', questionEditor)

  assert.ok(questionEditor > -1)
  assert.ok(itemExpansion > questionEditor)
  assert.match(source.slice(questionEditor, itemExpansion), /Asked in this order/)
  assert.match(source.slice(questionEditor, itemExpansion), /reorderCategoryQuestions/)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  categoryQuestionGroups,
  nextCategoryQuestionOrder,
} from './menuCategoryQuestions.js'

const groups = [
  { id: 'temperature', name: 'Temperature', category_links: [{ category_id: 'entrees', display_order: 4 }] },
  { id: 'side', name: 'Choose a side', category_links: [{ category_id: 'entrees', display_order: 1 }] },
  { id: 'sauce', name: 'Sauce', category_links: [{ category_id: 'entrees', display_order: 4 }] },
  { id: 'ice', name: 'Ice', category_links: [{ category_id: 'drinks', display_order: 0 }] },
]

test('category questions are isolated and sorted by category order', () => {
  assert.deepEqual(
    categoryQuestionGroups(groups, 'entrees').map(group => group.id),
    ['side', 'sauce', 'temperature'],
  )
})

test('a newly inherited question appends after the highest stored order', () => {
  assert.equal(nextCategoryQuestionOrder(groups, 'entrees'), 5)
  assert.equal(nextCategoryQuestionOrder(groups, 'desserts'), 0)
})

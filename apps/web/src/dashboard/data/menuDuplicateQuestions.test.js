import assert from 'node:assert/strict'
import test from 'node:test'

import {
  copyableDirectQuestionGroups,
  directQuestionGroupsForItem,
  inheritedQuestionIdsToOptOut,
  setQuestionExclusion,
} from './menuDuplicateQuestions.js'

const groups = [
  { id: 'temperature', item_ids: ['burger'], category_links: [] },
  { id: 'cheese', item_ids: ['burger', 'steak'], category_links: [{ category_id: 'entrees' }] },
  { id: 'side', item_ids: [], category_links: [{ category_id: 'entrees' }] },
]

test('duplicate planning finds every directly attached source question', () => {
  assert.deepEqual(
    directQuestionGroupsForItem(groups, 'burger').map(group => group.id),
    ['temperature', 'cheese'],
  )
})

test('excluded source questions are not copied as direct links', () => {
  assert.deepEqual(
    copyableDirectQuestionGroups(groups, 'burger', ['cheese']).map(group => group.id),
    ['temperature'],
  )
})

test('excluded category questions become item-specific opt-outs', () => {
  assert.deepEqual(
    inheritedQuestionIdsToOptOut(groups, 'entrees', ['temperature', 'cheese', 'side']),
    ['cheese', 'side'],
  )
})

test('duplicate question choices can be removed and restored before save', () => {
  const removed = setQuestionExclusion([], 'cheese', true)
  assert.deepEqual(removed, ['cheese'])
  assert.deepEqual(setQuestionExclusion(removed, 'cheese', false), [])
})

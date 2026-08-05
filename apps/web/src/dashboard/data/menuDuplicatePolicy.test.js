import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDuplicateQuestionCopyPlan,
  excludeQuestionId,
  filterExcludedQuestionGroups,
  restoreQuestionId,
} from './menuDuplicatePolicy.js'

test('duplicate question filtering excludes only the questions selected by the user', () => {
  const groups = [
    {
      id: 'temperature',
      item_ids: ['source-item'],
      item_display_orders: { 'source-item': 1 },
      item_overrides: { 'source-item': { prompt_mode: 'ask' } },
    },
    {
      id: 'side',
      item_ids: ['source-item'],
      item_display_orders: { 'source-item': 2 },
      item_overrides: { 'source-item': { default_modifier_ids: ['fries'] } },
    },
    {
      id: 'allergies',
      item_ids: [],
      item_overrides: { 'source-item': { opted_out: true } },
    },
  ]

  const exclusions = excludeQuestionId([], 'side')
  assert.deepEqual(excludeQuestionId(exclusions, 'side'), ['side'])
  assert.deepEqual(
    filterExcludedQuestionGroups(groups, exclusions).map(group => group.id),
    ['temperature', 'allergies'],
  )
  assert.deepEqual(
    filterExcludedQuestionGroups(groups, restoreQuestionId(exclusions, 'side')).map(group => group.id),
    ['temperature', 'side', 'allergies'],
  )

  assert.deepEqual(
    buildDuplicateQuestionCopyPlan(groups, 'source-item', exclusions),
    {
      links: [{ groupId: 'temperature', displayOrder: 1 }],
      overrides: [
        { groupId: 'temperature', override: { prompt_mode: 'ask' } },
        { groupId: 'allergies', override: { opted_out: true } },
      ],
    },
  )
})

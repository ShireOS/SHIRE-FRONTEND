import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cleanMoneyDraft,
  moneyDraftMapToValues,
  moneyValuesToDraft,
  parseMoneyDraft,
} from './moneyDraft.js'

const type = (characters) => {
  let draft = ''
  for (const character of characters) draft = cleanMoneyDraft(draft + character)
  return draft
}

test('cent values survive each controlled-input keystroke', () => {
  assert.equal(type('.75'), '.75')
  assert.equal(type('0.75'), '0.75')
  assert.equal(parseMoneyDraft(type('.75')), 0.75)
  assert.equal(parseMoneyDraft(type('0.75')), 0.75)
})

test('money drafts accept pasted currency and remain valid while incomplete', () => {
  assert.equal(cleanMoneyDraft('$12.34'), '12.34')
  assert.equal(cleanMoneyDraft('0..759'), '0.75')
  assert.equal(cleanMoneyDraft('.'), '.')
  assert.equal(parseMoneyDraft('.'), null)
  assert.equal(parseMoneyDraft(''), null)
})

test('surcharge maps persist active buttons as numeric dollars', () => {
  const draft = moneyValuesToDraft({ Extra: 0.75, Light: 0 })
  assert.deepEqual(draft, { Extra: '0.75', Light: '0' })
  draft.Extra = type('.75')
  draft.No = ''

  assert.deepEqual(
    moneyDraftMapToValues(draft, ['No', 'Extra', 'Light']),
    { Extra: 0.75, Light: 0 },
  )
})

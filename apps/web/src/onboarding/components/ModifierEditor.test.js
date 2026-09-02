import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./ModifierEditor.tsx', import.meta.url), 'utf8')

test('modifier editor blocks saving when either source read fails', () => {
  assert.match(source, /if \(!modifiersRes\.ok\) throw await responseError/)
  assert.match(source, /setLoadError\(loadFailure instanceof Error/)
  assert.match(source, /disabled=\{saving \|\| Boolean\(loadError\)\}/)
  assert.match(source, />\s*Retry\s*<\/button>/)
})

test('modifier update failures are surfaced instead of treated as success', () => {
  assert.match(source, /if \(!response\.ok\) throw await responseError\(response, `Failed to update/)
})

test('partial question saves retain ids so retries do not clone groups or modifiers', () => {
  assert.match(source, /candidate\.localId === question\.localId \? \{ \.\.\.candidate, groupId: group\.id \}/)
  assert.match(source, /updateOption\(question\.localId, option\.localId, \{ modifierId, linkedToGroup: false \}\)/)
  assert.match(source, /if \(option\.linkedToGroup\)[\s\S]+updateGroupOption[\s\S]+addGroupOption/)
  assert.match(source, /linkedToGroup: true/)
})

test('modifier onboarding offers a bottom continue action that saves before advancing', () => {
  const addQuestionIndex = source.indexOf('Add Question')
  const bottomContinueIndex = source.indexOf("{saving ? 'Saving modifiers...' : 'Continue'}")

  assert.ok(addQuestionIndex >= 0)
  assert.ok(bottomContinueIndex > addQuestionIndex)
  assert.match(
    source.slice(addQuestionIndex, bottomContinueIndex),
    /data-onboarding-save[\s\S]*onClick=\{\(\) => void handleSave\(\)\}/,
  )
  assert.match(source, /setRemovedGroupIds\(new Set\(\)\)[\s\S]*onDone\(\)/)
})

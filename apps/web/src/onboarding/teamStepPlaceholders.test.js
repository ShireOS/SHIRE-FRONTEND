import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const team = await readFile(new URL('./pages/steps/TeamStep.tsx', import.meta.url), 'utf8')

test('empty employee examples use an explicit faded placeholder style', () => {
  assert.doesNotMatch(team, /placeholder-\[rgb/)
  assert.equal((team.match(/placeholder:text-white\/35/g) || []).length, 7)
  assert.match(team, /placeholder="Alice"[\s\S]*placeholder:text-white\/35/)
  assert.match(team, /placeholder="alice@restaurant\.com"[\s\S]*placeholder:text-white\/35/)
})

test('a new employee requires an explicitly entered POS PIN', () => {
  assert.match(team, /const \[passcode, setPasscode\] = useState\(''\)/)
  assert.match(team, /setPasscode\(''\)/)
  assert.match(team, /placeholder="e\.g\. 4826"/)
  assert.match(team, /if \(!\/\^\\d\{4\}\$\/\.test\(passcode\)\)/)
})

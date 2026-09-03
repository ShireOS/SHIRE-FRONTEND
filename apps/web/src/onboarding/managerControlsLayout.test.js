import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const managerControls = await readFile(new URL('./pages/steps/ManagerControlsStep.tsx', import.meta.url), 'utf8')

test('restaurant roles use a card layout that fits the onboarding content width', () => {
  assert.match(managerControls, /grid min-w-0 gap-3 sm:grid-cols-2/)
  assert.doesNotMatch(managerControls, /minmax\(180px,1fr\)_140px_130px_110px_96px/)
  assert.match(managerControls, /className="shrink-0 rounded-md border border-red-400\/25/)
})

test('tip participation presents both states and exposes the selected state', () => {
  assert.match(managerControls, /\{ value: false, label: 'Not tipped' \}/)
  assert.match(managerControls, /\{ value: true, label: 'Tipped' \}/)
  assert.match(managerControls, /aria-pressed=\{selected\}/)
  assert.match(managerControls, /bg-\[#d4a854\] text-\[#111111\]/)
})

test('legacy waiter and normal tiers use current user-facing labels', () => {
  assert.match(managerControls, /value="waiter"[^>]*>Server<\/option>/)
  assert.match(managerControls, /value="normal"[^>]*>Standard<\/option>/)
  assert.doesNotMatch(managerControls, />Waiter<\/option>/)
})

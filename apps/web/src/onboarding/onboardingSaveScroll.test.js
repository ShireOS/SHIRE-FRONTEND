import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const layout = await readFile(new URL('./components/OnboardingLayout.tsx', import.meta.url), 'utf8')
const page = await readFile(new URL('./pages/Onboarding.tsx', import.meta.url), 'utf8')
const menu = await readFile(new URL('./pages/steps/MenuStep.tsx', import.meta.url), 'utf8')
const routing = await readFile(new URL('./pages/steps/RoutingStep.tsx', import.meta.url), 'utf8')
const team = await readFile(new URL('./pages/steps/TeamStep.tsx', import.meta.url), 'utf8')
const tipPayroll = await readFile(new URL('./pages/steps/TipPayrollStep.tsx', import.meta.url), 'utf8')

test('onboarding form saves, step changes, and backend errors return to the top', () => {
  assert.match(layout, /window\.scrollTo\(\{ top: 0, left: 0, behavior: 'auto' \}\)/)
  assert.match(layout, /onSubmitCapture=\{scrollToTop\}/)
  assert.match(layout, /\[currentStep, scrollToTop\]/)
  assert.match(layout, /if \(saveError\) scrollToTop\(\)/)
  assert.match(page, /saveError=\{onboarding\.error\}/)
})

test('standalone onboarding save controls opt into the same scroll behavior', () => {
  assert.match(layout, /closest<HTMLElement>\('\[data-onboarding-save\]'\)/)
  assert.match(menu, /data-onboarding-save[\s\S]*handleContinue/)
  assert.match(tipPayroll, /data-onboarding-save[\s\S]*handleContinue/)
  assert.match(routing, /data-onboarding-save[\s\S]*saveCategoryRoutes/)
  assert.match(routing, /data-onboarding-save[\s\S]*saveItemRoutes/)
  assert.match(team, /data-onboarding-save[\s\S]*completeOnboarding/)
})

test('team mutations surface their local validation error at the page top', () => {
  const errorIndex = team.indexOf('{formError && (')
  const staffListIndex = team.indexOf('{/* Staff list */}')

  assert.ok(errorIndex >= 0)
  assert.ok(staffListIndex > errorIndex)
  assert.equal(team.indexOf('{formError && (', errorIndex + 1), -1)
})

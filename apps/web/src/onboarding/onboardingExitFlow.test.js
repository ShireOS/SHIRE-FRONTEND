import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const hook = await readFile(new URL('./hooks/useOnboarding.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('./pages/Onboarding.tsx', import.meta.url), 'utf8')
const layout = await readFile(new URL('./components/OnboardingLayout.tsx', import.meta.url), 'utf8')
const setupPanel = await readFile(new URL('../dashboard/RestaurantSetupPanel.jsx', import.meta.url), 'utf8')
const backOfficeView = await readFile(new URL('../shared/backOfficeView.ts', import.meta.url), 'utf8')

test('exit keeps onboarding incomplete and opens the canonical Setup recovery page', () => {
  const start = hook.indexOf('const exitToBackOffice = useCallback')
  const end = hook.indexOf('const cancelOnboarding = useCallback', start)
  const exitFlow = hook.slice(start, end)

  assert.notEqual(start, -1)
  assert.match(exitFlow, /activeRestaurantId[\s\S]*createRestaurant\(\)/)
  assert.match(exitFlow, /clearDraft\(user\.id\)/)
  assert.match(exitFlow, /navigate\(`\/restaurants\/\$\{targetRestaurantId\}\/setup`/)
  assert.doesNotMatch(exitFlow, /onboarding_completed_at|status:\s*'active'/)
})

test('cancel is confirmed and permanently removes only the onboarding draft restaurant', () => {
  assert.match(page, /showCancelConfirmation/)
  assert.match(page, /Cancel guided setup\?/)
  assert.match(page, /Delete draft restaurant/)
  assert.match(hook, /onboarding-cancellation/)
  assert.match(hook, /const cancelOnboarding = useCallback[\s\S]*clearDraft\(user\.id\)[\s\S]*refreshRestaurants\(\)[\s\S]*navigate\('\/enterprise\/stores'/)
})

test('onboarding actions wrap on narrow headers and lock while saving', () => {
  assert.match(layout, /flex flex-col gap-4 sm:flex-row/)
  assert.match(layout, /flex flex-wrap items-center justify-end/)
  assert.match(layout, /disabled=\{isFlowActionPending \|\| isSwitchingAccount\}/)
})

test('existing restaurant names remain editable but cannot be published blank', () => {
  assert.match(setupPanel, /Field label="Restaurant Name"[\s\S]*value=\{profile\.name\}/)
  assert.match(setupPanel, /const restaurantName = profile\.name\.trim\(\)[\s\S]*Restaurant name is required/)
  assert.match(setupPanel, /\/restaurants\/\$\{targetId\}\/setup-profile/)
  assert.match(backOfficeView, /simple:\s*\{[\s\S]*'store\.basics': 'standard'/)
})

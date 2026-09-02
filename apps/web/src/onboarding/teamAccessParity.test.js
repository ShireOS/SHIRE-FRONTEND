import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const team = await readFile(new URL('./pages/steps/TeamStep.tsx', import.meta.url), 'utf8')
const accounts = await readFile(new URL('./pages/steps/AccountAccessStep.tsx', import.meta.url), 'utf8')
const page = await readFile(new URL('./pages/Onboarding.tsx', import.meta.url), 'utf8')
const layout = await readFile(new URL('./components/OnboardingLayout.tsx', import.meta.url), 'utf8')
const hook = await readFile(new URL('./hooks/useOnboarding.ts', import.meta.url), 'utf8')

test('POS onboarding uses the canonical structured employee contract', () => {
  assert.match(team, /backOfficeApi\.teamWorkspace\(restaurantId\)/)
  assert.match(team, /job_assignments: staffPayPayload\(assignmentRows\)/)
  assert.match(team, /pos_authority: effectivePosAuthority/)
  assert.match(team, /validateStaffPayDrafts\(assignmentRows\)/)
  assert.doesNotMatch(team, /handleRemove/)
})

test('account access is a distinct final stage backed by the Team invitation form', () => {
  assert.match(layout, /id: 'account_access'/)
  assert.match(page, /case 21:[\s\S]*<AccountAccessStep/)
  assert.match(hook, /ONBOARDING_MAX_STEP = 21/)
  assert.match(accounts, /module\.AddTeamMemberModal/)
  assert.match(accounts, /module\.MemberPermissionsModal/)
  assert.match(accounts, /Review access &amp; view/)
  assert.match(accounts, /backOfficeApi\.resendInvite/)
  assert.match(accounts, /backOfficeApi\.revokeAccessInvite/)
  assert.match(accounts, /completeOnboarding/)
})

test('the account step explains and preserves permission versus presentation separation', () => {
  assert.match(accounts, /Permissions[\s\S]*actually allowed/)
  assert.match(accounts, /Back Office view[\s\S]*never grants authority/)
  assert.match(accounts, /Add owner, manager, employee, or reseller/)
})

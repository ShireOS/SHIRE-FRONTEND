import assert from 'node:assert/strict'
import test from 'node:test'

import {
  callbackNext,
  createAppAuthUrl,
  inviteAuthRoutes,
  safeAuthNext,
} from './inviteFlow.ts'

test('invite auth routes preserve the token and lock signup to the invited email', () => {
  const routes = inviteAuthRoutes('token with spaces', 'friend+owner@example.com')

  assert.equal(routes.next, '/invite?token=token%20with%20spaces')
  assert.equal(
    routes.login,
    '/auth/login?next=%2Finvite%3Ftoken%3Dtoken%2520with%2520spaces&email=friend%2Bowner%40example.com',
  )
  assert.equal(
    routes.signup,
    '/auth/signup?next=%2Finvite%3Ftoken%3Dtoken%2520with%2520spaces&email=friend%2Bowner%40example.com&invited=1',
  )
})

test('email verification callback carries a safe invite destination across browsers', () => {
  const next = '/invite?token=invite-token'
  const url = createAppAuthUrl('https://app.shireintelligence.com', 'callback', next)

  assert.equal(
    url,
    'https://app.shireintelligence.com/auth/callback?next=%2Finvite%3Ftoken%3Dinvite-token',
  )
  assert.equal(callbackNext(new URL(url).search), next)
})

test('external and recursive callback destinations are rejected', () => {
  assert.equal(safeAuthNext('https://evil.example'), null)
  assert.equal(safeAuthNext('//evil.example'), null)
  assert.equal(safeAuthNext('/auth/callback?next=/invite'), null)
  assert.equal(safeAuthNext('/enterprise/stores'), '/enterprise/stores')
})

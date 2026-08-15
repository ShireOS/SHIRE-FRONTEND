import assert from 'node:assert/strict'
import test from 'node:test'

import { clearSessionAndRedirect } from './sessionRecoveryCore.ts'

test('clears the stale project session before local sign-out and redirects', async () => {
  const calls = []

  await clearSessionAndRedirect({
    storage: { removeItem: key => calls.push(['remove', key]) },
    storageKey: 'sb-project-auth-token',
    signOut: async options => calls.push(['signOut', options]),
    redirect: () => calls.push(['redirect']),
  })

  assert.deepEqual(calls, [
    ['remove', 'sb-project-auth-token'],
    ['remove', 'sb-project-auth-token-code-verifier'],
    ['signOut', { scope: 'local' }],
    ['redirect'],
  ])
})

test('still redirects when Supabase local sign-out rejects', async () => {
  const cleanupError = new Error('Invalid Refresh Token')
  const calls = []

  await clearSessionAndRedirect({
    storage: { removeItem: key => calls.push(['remove', key]) },
    storageKey: 'sb-project-auth-token',
    signOut: async () => {
      calls.push(['signOut'])
      throw cleanupError
    },
    redirect: () => calls.push(['redirect']),
    onCleanupError: error => calls.push(['error', error]),
  })

  assert.deepEqual(calls, [
    ['remove', 'sb-project-auth-token'],
    ['remove', 'sb-project-auth-token-code-verifier'],
    ['signOut'],
    ['error', cleanupError],
    ['redirect'],
  ])
})

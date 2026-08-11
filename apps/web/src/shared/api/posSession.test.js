import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PosSessionError,
  getValidPosAccessToken,
  requestWithPosSession,
  sessionExpiresSoon,
} from './posSession.ts'

const NOW = 2_000_000_000_000
const futureSession = (token = 'current-token') => ({
  access_token: token,
  expires_at: Math.floor((NOW + 10 * 60_000) / 1000),
})
const expiringSession = (token = 'expiring-token') => ({
  access_token: token,
  expires_at: Math.floor((NOW + 30_000) / 1000),
})

function createAuth(initialSession, { refreshSession = futureSession('refreshed-token'), refreshError = null } = {}) {
  let currentSession = initialSession
  let refreshCount = 0
  return {
    get refreshCount() { return refreshCount },
    getSession: async () => ({ data: { session: currentSession }, error: null }),
    refreshSession: async () => {
      refreshCount += 1
      if (refreshError) return { data: { session: null }, error: refreshError }
      currentSession = refreshSession
      return { data: { session: currentSession }, error: null }
    },
  }
}

test('detects only sessions inside the refresh window', () => {
  assert.equal(sessionExpiresSoon(expiringSession(), NOW), true)
  assert.equal(sessionExpiresSoon(futureSession(), NOW), false)
  assert.equal(sessionExpiresSoon({ access_token: 'legacy-token' }, NOW), false)
})

test('refreshes proactively when the access token is close to expiry', async () => {
  const auth = createAuth(expiringSession())

  const token = await getValidPosAccessToken(auth, NOW)

  assert.equal(token, 'refreshed-token')
  assert.equal(auth.refreshCount, 1)
})

test('concurrent requests share one token refresh', async () => {
  let releaseRefresh
  let currentSession = expiringSession()
  let refreshCount = 0
  const auth = {
    getSession: async () => ({ data: { session: currentSession }, error: null }),
    refreshSession: async () => {
      refreshCount += 1
      await new Promise(resolve => { releaseRefresh = resolve })
      currentSession = futureSession('shared-token')
      return { data: { session: currentSession }, error: null }
    },
  }

  const requests = Promise.all([
    getValidPosAccessToken(auth, NOW),
    getValidPosAccessToken(auth, NOW),
    getValidPosAccessToken(auth, NOW),
  ])
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(refreshCount, 1)
  releaseRefresh()

  assert.deepEqual(await requests, ['shared-token', 'shared-token', 'shared-token'])
})

test('concurrent 401 responses share one token refresh and retry independently', async () => {
  let releaseRefresh
  let currentSession = futureSession()
  let refreshCount = 0
  const auth = {
    getSession: async () => ({ data: { session: currentSession }, error: null }),
    refreshSession: async () => {
      refreshCount += 1
      await new Promise(resolve => { releaseRefresh = resolve })
      currentSession = futureSession('shared-token')
      return { data: { session: currentSession }, error: null }
    },
  }
  const seenTokens = [[], [], []]

  const requests = seenTokens.map(tokens => requestWithPosSession({
    auth,
    nowMs: NOW,
    request: async token => {
      tokens.push(token)
      return new Response(null, { status: token === 'current-token' ? 401 : 200 })
    },
  }))

  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(refreshCount, 1)
  releaseRefresh()

  const responses = await Promise.all(requests)
  assert.deepEqual(responses.map(response => response.status), [200, 200, 200])
  assert.deepEqual(seenTokens, [
    ['current-token', 'shared-token'],
    ['current-token', 'shared-token'],
    ['current-token', 'shared-token'],
  ])
})

test('uses a token already rotated by another request without refreshing again', async () => {
  let readCount = 0
  let refreshCount = 0
  const auth = {
    getSession: async () => {
      readCount += 1
      return {
        data: { session: futureSession(readCount === 1 ? 'current-token' : 'other-request-token') },
        error: null,
      }
    },
    refreshSession: async () => {
      refreshCount += 1
      return { data: { session: futureSession('unexpected-token') }, error: null }
    },
  }
  const tokens = []

  const response = await requestWithPosSession({
    auth,
    nowMs: NOW,
    request: async token => {
      tokens.push(token)
      return new Response(null, { status: token === 'current-token' ? 401 : 200 })
    },
  })

  assert.equal(response.status, 200)
  assert.deepEqual(tokens, ['current-token', 'other-request-token'])
  assert.equal(refreshCount, 0)
})

test('retries one time with a rotated token after a 401', async () => {
  const auth = createAuth(futureSession())
  const tokens = []

  const response = await requestWithPosSession({
    auth,
    nowMs: NOW,
    request: async token => {
      tokens.push(token)
      return new Response(null, { status: tokens.length === 1 ? 401 : 200 })
    },
  })

  assert.equal(response.status, 200)
  assert.deepEqual(tokens, ['current-token', 'refreshed-token'])
  assert.equal(auth.refreshCount, 1)
})

test('does not refresh authorization, validation, or server failures', async () => {
  for (const status of [403, 404, 500]) {
    const auth = createAuth(futureSession())
    const response = await requestWithPosSession({
      auth,
      nowMs: NOW,
      request: async () => new Response(null, { status }),
    })
    assert.equal(response.status, status)
    assert.equal(auth.refreshCount, 0)
  }
})

test('returns the second 401 without another refresh loop', async () => {
  const auth = createAuth(futureSession())
  let requestCount = 0

  const response = await requestWithPosSession({
    auth,
    nowMs: NOW,
    request: async () => {
      requestCount += 1
      return new Response(null, { status: 401 })
    },
  })

  assert.equal(response.status, 401)
  assert.equal(requestCount, 2)
  assert.equal(auth.refreshCount, 1)
})

test('surfaces refresh failures as an actionable session error', async () => {
  const auth = createAuth(futureSession(), { refreshError: new Error('Refresh token revoked') })

  await assert.rejects(
    requestWithPosSession({
      auth,
      nowMs: NOW,
      request: async () => new Response(null, { status: 401 }),
    }),
    error => error instanceof PosSessionError && error.status === 401 && error.message === 'Refresh token revoked',
  )
})

test('does not refresh an aborted request after its response arrives', async () => {
  const auth = createAuth(futureSession())
  const controller = new AbortController()
  controller.abort()

  const response = await requestWithPosSession({
    auth,
    signal: controller.signal,
    nowMs: NOW,
    request: async () => new Response(null, { status: 401 }),
  })

  assert.equal(response.status, 401)
  assert.equal(auth.refreshCount, 0)
})

test('does not turn transport failures into token refresh attempts', async () => {
  const auth = createAuth(futureSession())

  await assert.rejects(
    requestWithPosSession({
      auth,
      nowMs: NOW,
      request: async () => { throw new TypeError('fetch failed') },
    }),
    /fetch failed/,
  )
  assert.equal(auth.refreshCount, 0)
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { createAuthHydrationCoordinator } from './authHydrationCoordinator.ts'

const source = await readFile(new URL('./AuthContext.tsx', import.meta.url), 'utf8')

test('cold auth hydration batches independent restaurant scopes', () => {
  assert.match(source, /const ownedRequest = withTimeout/)
  assert.match(source, /const portfolioRequest = accountType === 'reseller'/)
  assert.match(source, /const membershipRequest = !membershipQueryDisabledRef\.current/)
  assert.match(source, /Promise\.all\(\[ownedRequest, portfolioRequest, membershipRequest\]\)/)
})

test('admin hydration excludes closed restaurants from the operational portfolio', () => {
  assert.match(
    source,
    /accountType === 'admin'[\s\S]*from\('restaurants'\)[\s\S]*neq\('status', 'closed'\)/,
  )
})

function deferred() {
  let resolve
  const promise = new Promise((next) => { resolve = next })
  return { promise, resolve }
}

test('superseded account hydration cannot commit stale restaurants or loading state', async () => {
  const coordinator = createAuthHydrationCoordinator()
  const oldAccount = deferred()
  const newAccount = deferred()
  const state = { restaurants: [], loading: false }

  const hydrate = async (lease, request) => {
    state.loading = true
    try {
      const restaurants = await request
      if (lease.isCurrent()) state.restaurants = restaurants
    } finally {
      if (lease.isCurrent()) state.loading = false
    }
  }

  const oldLease = coordinator.begin()
  const oldHydration = hydrate(oldLease, oldAccount.promise)
  const newLease = coordinator.begin()
  const newHydration = hydrate(newLease, newAccount.promise)

  assert.equal(oldLease.signal.aborted, true)
  oldAccount.resolve(['old-store'])
  await oldHydration
  assert.deepEqual(state, { restaurants: [], loading: true })

  newAccount.resolve(['new-store'])
  await newHydration
  assert.deepEqual(state, { restaurants: ['new-store'], loading: false })

  const signedOutAccount = deferred()
  const signedOutLease = coordinator.begin()
  const signedOutHydration = hydrate(signedOutLease, signedOutAccount.promise)
  coordinator.invalidate()
  state.restaurants = []
  state.loading = false
  signedOutAccount.resolve(['late-store'])
  await signedOutHydration

  assert.equal(signedOutLease.signal.aborted, true)
  assert.deepEqual(state, { restaurants: [], loading: false })
  assert.match(source, /hydrationCoordinatorRef\.current\.invalidate\(\)/)
  assert.match(source, /authUserIdRef\.current !== nextUserId/)
  assert.match(source, /if \(!hydration\.isCurrent\(\)\) return/)
  assert.match(source, /authIdentityResolvedRef\.current[\s\S]*queryClient\.clear\(\)[\s\S]*resetRestaurantState\(\)/)
  assert.match(source, /authEventGenerationRef\.current !== initializationGeneration/)
  assert.match(source, /authEventGenerationRef\.current \+= 1/)
})

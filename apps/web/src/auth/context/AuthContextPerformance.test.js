import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('./AuthContext.tsx', import.meta.url), 'utf8')

test('cold auth hydration batches independent restaurant scopes', () => {
  assert.match(source, /const ownedRequest = withTimeout/)
  assert.match(source, /const portfolioRequest = accountType === 'reseller'/)
  assert.match(source, /const membershipRequest = !membershipQueryDisabledRef\.current/)
  assert.match(source, /Promise\.all\(\[ownedRequest, portfolioRequest, membershipRequest\]\)/)
})

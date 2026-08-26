import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_API_BASE_PATH,
  isSafeSameOriginApiBasePath,
  resolveProductionApiBasePath,
} from './apiBaseUrl.ts'

test('production API bases accept only root-relative same-origin paths', () => {
  for (const candidate of ['/ml-api', '/api/v1', '/nested/path/']) {
    assert.equal(isSafeSameOriginApiBasePath(candidate), true, candidate)
    assert.equal(resolveProductionApiBasePath(` ${candidate} `), candidate)
  }
})

test('production API bases reject URL and path forms that can escape the proxy contract', () => {
  for (const candidate of [
    'https://api.example.com',
    'http://api.example.com',
    '//api.example.com/ml-api',
    '\\\\api.example.com\\ml-api',
    '/\\api.example.com/ml-api',
    'ml-api',
    '/ml-api?target=https://api.example.com',
    '/ml-api#fragment',
  ]) {
    assert.equal(isSafeSameOriginApiBasePath(candidate), false, candidate)
    assert.equal(resolveProductionApiBasePath(candidate), DEFAULT_API_BASE_PATH, candidate)
  }
})

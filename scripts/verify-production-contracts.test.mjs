import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DIRECT_POS_REPORTS_CAPABILITY,
  MIN_ML_OPERATION_COUNT,
  MIN_POS_OPERATION_COUNT,
  REPORT_CONTRACT_CAPABILITY,
  REPORT_CONTRACT_VERSION,
  REQUIRED_ML_OPERATIONS,
  REQUIRED_POS_OPERATIONS,
  productionApiRoutingWarning,
  releaseVerificationRequired,
  verifyProductionContracts,
} from './verify-production-contracts.mjs'

function schema(required, minimum) {
  const paths = Object.fromEntries(required.map(([method, path]) => [path, { [method]: {} }]))
  let index = 0
  while (Object.values(paths).reduce((count, value) => count + Object.keys(value).length, 0) < minimum) {
    paths[`/generated/${index}`] = { get: {} }
    index += 1
  }
  return { paths }
}

function response(body) {
  return { ok: true, status: 200, json: async () => body }
}

test('release verification accepts matching route and report contracts', async () => {
  const bodies = [
    schema(REQUIRED_ML_OPERATIONS, MIN_ML_OPERATION_COUNT),
    schema(REQUIRED_POS_OPERATIONS, MIN_POS_OPERATION_COUNT),
    {
      build_sha: 'matching-build',
      report_contract_version: REPORT_CONTRACT_VERSION,
      capabilities: [REPORT_CONTRACT_CAPABILITY],
    },
  ]
  const result = await verifyProductionContracts({
    fetchImpl: async () => response(bodies.shift()),
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

test('release verification reports stale routes and reporting metadata together', async () => {
  const mlSchema = schema(REQUIRED_ML_OPERATIONS.slice(2), MIN_ML_OPERATION_COUNT - 2)
  const bodies = [
    mlSchema,
    schema(REQUIRED_POS_OPERATIONS, MIN_POS_OPERATION_COUNT),
    { status: 'ok' },
  ]
  const result = await verifyProductionContracts({
    fetchImpl: async () => response(bodies.shift()),
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some(error => error.includes('manager-action-inbox/count')))
  assert.ok(result.errors.some(error => error.includes('reports/homepage/bootstrap')))
  assert.ok(result.errors.some(error => error.includes('expected at least 351')))
  assert.ok(result.errors.some(error => error.includes('contract none')))
  assert.ok(result.errors.some(error => error.includes(REPORT_CONTRACT_CAPABILITY)))
})

test('direct rollout requires the dark-launch ML capability only when enabled', async () => {
  const missingBodies = [
    schema(REQUIRED_ML_OPERATIONS, MIN_ML_OPERATION_COUNT),
    schema(REQUIRED_POS_OPERATIONS, MIN_POS_OPERATION_COUNT),
    {
      report_contract_version: REPORT_CONTRACT_VERSION,
      capabilities: [REPORT_CONTRACT_CAPABILITY],
    },
  ]
  const missing = await verifyProductionContracts({
    fetchImpl: async () => response(missingBodies.shift()),
    directReportsEnabled: true,
  })
  assert.equal(missing.ok, false)
  assert.ok(missing.errors.some(error => error.includes(DIRECT_POS_REPORTS_CAPABILITY)))

  const readyBodies = [
    schema(REQUIRED_ML_OPERATIONS, MIN_ML_OPERATION_COUNT),
    schema(REQUIRED_POS_OPERATIONS, MIN_POS_OPERATION_COUNT),
    {
      report_contract_version: REPORT_CONTRACT_VERSION,
      capabilities: [REPORT_CONTRACT_CAPABILITY, DIRECT_POS_REPORTS_CAPABILITY],
    },
  ]
  const ready = await verifyProductionContracts({
    fetchImpl: async () => response(readyBodies.shift()),
    directReportsEnabled: true,
  })
  assert.equal(ready.ok, true)
})

test('release verification fails closed when a manifest cannot be read', async () => {
  await assert.rejects(
    verifyProductionContracts({
      fetchImpl: async () => ({ ok: false, status: 503 }),
    }),
    /HTTP 503/,
  )
})

test('automatic enforcement targets production builds without blocking previews', () => {
  assert.equal(releaseVerificationRequired({ VERCEL_ENV: 'production' }), true)
  assert.equal(releaseVerificationRequired({ VERCEL_ENV: 'preview' }), false)
  assert.equal(releaseVerificationRequired({ VERCEL_ENV: 'development' }), false)
  assert.equal(releaseVerificationRequired({}), true)
})

test('production routing warns about a direct ML API override without blocking the build', () => {
  assert.match(
    productionApiRoutingWarning({
      VERCEL_ENV: 'production',
      VITE_API_BASE_URL: 'https://web-production.example/api/v1',
    }),
    /Ignoring absolute VITE_API_BASE_URL.*same-origin \/ml-api proxy/,
  )
  assert.equal(
    productionApiRoutingWarning({ VERCEL_ENV: 'production', VITE_API_BASE_URL: '/ml-api' }),
    null,
  )
  assert.equal(
    productionApiRoutingWarning({
      VERCEL_ENV: 'preview',
      VITE_API_BASE_URL: 'https://preview.example/api/v1',
    }),
    null,
  )
})

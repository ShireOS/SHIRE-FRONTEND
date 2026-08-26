import { pathToFileURL } from 'node:url'

const DEFAULT_ML_BASE_URL = 'https://web-production-5c5b4.up.railway.app'
const DEFAULT_POS_BASE_URL = 'https://shire-pos-api-production.up.railway.app'

export const REPORT_CONTRACT_VERSION = '2026-08-19.v3'
export const REPORT_CONTRACT_CAPABILITY = 'pos_reports.receipt.v3'
export const DIRECT_POS_REPORTS_CAPABILITY = 'back_office_pos_reports.direct.v1'

export const REQUIRED_ML_OPERATIONS = [
  ['get', '/api/v1/restaurants/{restaurant_id}/manager-action-inbox/count'],
  ['get', '/api/v1/restaurants/{restaurant_id}/reports/homepage/bootstrap'],
  ['post', '/api/v1/restaurants/{restaurant_id}/reports/pos/snapshot'],
  ['post', '/api/v1/restaurants/{restaurant_id}/reports/pos/artifact'],
  ['post', '/api/v1/restaurants/{restaurant_id}/reports/pos/email-now'],
  ['post', '/api/v1/restaurants/{restaurant_id}/reports/pos-snapshots'],
  ['post', '/api/v1/restaurants/{restaurant_id}/reports/pos-snapshots/{snapshot_id}/artifacts'],
  ['post', '/api/v1/restaurants/{restaurant_id}/reports/pos-snapshots/{snapshot_id}/email-now'],
]

export const REQUIRED_POS_OPERATIONS = [
  ['post', '/api/v1/dev-v2/manager/report-hub/snapshot'],
  ['post', '/api/v1/dev-v2/manager/report-hub/artifact'],
  ['post', '/api/v1/dev-v2/manager/report-hub/email-now'],
  ['post', '/api/v1/dev-v2/manager/report-hub/receipt-preview'],
  ['post', '/api/v1/dev-v2/manager/report-hub/receipt'],
  ['get', '/api/v1/dev-v2/manager/report-hub/receipt-jobs/{job_id}'],
]

// These floors are generated from the checked-out backend OpenAPI manifests.
// A deliberate route retirement must update the floor in the same release.
export const MIN_ML_OPERATION_COUNT = 351
export const MIN_POS_OPERATION_COUNT = 481

function trimBaseUrl(value, fallback) {
  return String(value || fallback).replace(/\/+$/, '')
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return response.json()
}

function operationCount(schema) {
  return Object.values(schema?.paths || {}).reduce(
    (count, operations) => count + Object.keys(operations || {})
      .filter(method => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .length,
    0,
  )
}

function missingOperations(schema, required) {
  return required
    .filter(([method, path]) => !schema?.paths?.[path]?.[method])
    .map(([method, path]) => `${method.toUpperCase()} ${path}`)
}

export async function verifyProductionContracts({
  fetchImpl = globalThis.fetch,
  mlBaseUrl = process.env.SHIRE_ML_RELEASE_URL,
  posBaseUrl = process.env.SHIRE_POS_RELEASE_URL,
  directReportsEnabled = process.env.VITE_DIRECT_POS_REPORTS_ENABLED === 'true',
} = {}) {
  const mlBase = trimBaseUrl(mlBaseUrl, DEFAULT_ML_BASE_URL)
  const posBase = trimBaseUrl(posBaseUrl, DEFAULT_POS_BASE_URL)
  const [mlSchema, posSchema, mlReadiness] = await Promise.all([
    fetchJson(fetchImpl, `${mlBase}/openapi.json`),
    fetchJson(fetchImpl, `${posBase}/openapi.json`),
    fetchJson(fetchImpl, `${mlBase}/readyz`),
  ])

  const errors = []
  const mlOperations = operationCount(mlSchema)
  const posOperations = operationCount(posSchema)
  if (mlOperations < MIN_ML_OPERATION_COUNT) {
    errors.push(`Restaurant ML exposes ${mlOperations} operations; expected at least ${MIN_ML_OPERATION_COUNT}`)
  }
  if (posOperations < MIN_POS_OPERATION_COUNT) {
    errors.push(`POS exposes ${posOperations} operations; expected at least ${MIN_POS_OPERATION_COUNT}`)
  }
  for (const operation of missingOperations(mlSchema, REQUIRED_ML_OPERATIONS)) {
    errors.push(`Restaurant ML is missing ${operation}`)
  }
  for (const operation of missingOperations(posSchema, REQUIRED_POS_OPERATIONS)) {
    errors.push(`POS is missing ${operation}`)
  }
  if (mlReadiness?.report_contract_version !== REPORT_CONTRACT_VERSION) {
    errors.push(
      `Restaurant ML reports contract ${mlReadiness?.report_contract_version || 'none'}; expected ${REPORT_CONTRACT_VERSION}`,
    )
  }
  if (!Array.isArray(mlReadiness?.capabilities)
    || !mlReadiness.capabilities.includes(REPORT_CONTRACT_CAPABILITY)) {
    errors.push(`Restaurant ML does not advertise ${REPORT_CONTRACT_CAPABILITY}`)
  }
  if (directReportsEnabled && (
    !Array.isArray(mlReadiness?.capabilities)
    || !mlReadiness.capabilities.includes(DIRECT_POS_REPORTS_CAPABILITY)
  )) {
    errors.push(`Restaurant ML does not advertise ${DIRECT_POS_REPORTS_CAPABILITY}`)
  }

  return {
    ok: errors.length === 0,
    errors,
    mlOperations,
    posOperations,
    mlBuildSha: mlReadiness?.build_sha || null,
    directReportsEnabled,
  }
}

export function releaseVerificationRequired(environment = process.env) {
  return environment.VERCEL_ENV !== 'preview' && environment.VERCEL_ENV !== 'development'
}

export function productionApiRoutingWarning(environment = process.env) {
  if (environment.VERCEL_ENV !== 'production') return null
  const override = String(environment.VITE_API_BASE_URL || '').trim()
  const safeSameOriginPath = /^\/(?!\/)[^\\?#\u0000-\u001f\u007f]*$/.test(override)
  if (!override || safeSameOriginPath) return null
  return 'Ignoring unsafe VITE_API_BASE_URL because production accepts only a same-origin path and falls back to /ml-api'
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const routingWarning = productionApiRoutingWarning()
  if (routingWarning) console.warn(`Production API routing warning: ${routingWarning}`)

  if (!releaseVerificationRequired()) {
    console.log(`Skipping production API compatibility check for Vercel ${process.env.VERCEL_ENV} build.`)
  } else {
    try {
      const result = await verifyProductionContracts()
      if (!result.ok) {
        console.error('Production API compatibility check failed:')
        for (const error of result.errors) console.error(`- ${error}`)
        process.exitCode = 1
      } else {
        console.log(
          `Production API compatibility passed (ML ${result.mlOperations}, POS ${result.posOperations}, ML build ${result.mlBuildSha || 'unknown'}).`,
        )
      }
    } catch (error) {
      console.error(`Production API compatibility check failed: ${error.message}`)
      process.exitCode = 1
    }
  }
}

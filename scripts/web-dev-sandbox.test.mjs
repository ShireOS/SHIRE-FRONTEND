import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertRuntimeCapabilities,
  buildMlEnvironment,
  isLoopbackUrl,
  parseArguments,
  resolveSandboxEnvironment,
  sandboxLoginRows,
  sanitizedBackendFailure,
} from './web-dev-sandbox.mjs'

test('default repository paths resolve within the Shire workspace', () => {
  const options = parseArguments([])
  assert.match(options.backendRoot, /POS_backend\/Shire_POS_backend$/)
  assert.match(options.mlBackendRoot, /Restuarant_ML-Backend$/)
})

const safeRuntime = {
  schema_version: 1,
  sandbox: true,
  environment: 'sandbox',
  capabilities: {
    pos_api: true,
    local_supabase: true,
    local_storage: true,
  },
  restaurant_id: '57353dd5-a41f-4feb-9cf5-165abd389e53',
  restaurant_name: 'Matthews Little River',
  pos_api_url: 'http://127.0.0.1:8001/api/v1',
  ml_api_url: 'http://localhost:8000/api/v1',
  reservations_api_url: 'http://127.0.0.1:4100/api/v1',
  supabase_url: 'http://127.0.0.1:54321',
  supabase_publishable_key: 'sandbox-public-key',
}

test('recognizes only HTTP loopback URLs as local', () => {
  assert.equal(isLoopbackUrl('http://localhost:8000/api/v1'), true)
  assert.equal(isLoopbackUrl('https://127.0.0.1:54321'), true)
  assert.equal(isLoopbackUrl('http://[::1]:8001'), true)
  assert.equal(isLoopbackUrl('https://shire-pos-api-production.up.railway.app'), false)
  assert.equal(isLoopbackUrl('postgresql://localhost:5432/db'), false)
  assert.equal(isLoopbackUrl('not-a-url'), false)
})

test('passes restaurant and rebuild options to the backend', () => {
  const parsed = parseArguments([
    '--restaurant',
    safeRuntime.restaurant_id,
    '--fresh',
    '--',
    '--host',
    '127.0.0.1',
  ])
  assert.deepEqual(parsed.backendArgs, ['--restaurant', safeRuntime.restaurant_id, '--fresh'])
  assert.deepEqual(parsed.viteArgs, ['--host', '127.0.0.1'])
  assert.equal(parsed.command, 'up')
})

test('accepts a separate Restaurant ML working tree without forwarding it to the backend CLI', () => {
  const parsed = parseArguments(['--ml-backend-repo', '/tmp/ml', '--ml-api-port', '8123'])
  assert.equal(parsed.mlBackendRoot, '/tmp/ml')
  assert.equal(parsed.mlApiPort, 8123)
  assert.deepEqual(parsed.backendArgs, [])
})

test('injects only explicit sandbox configuration', () => {
  assert.doesNotThrow(() => assertRuntimeCapabilities(safeRuntime))
  const env = resolveSandboxEnvironment(safeRuntime, {})
  assert.equal(env.VITE_SANDBOX_MODE, 'true')
  assert.equal(env.VITE_RESTAURANT_ID, safeRuntime.restaurant_id)
  assert.equal(env.VITE_API_BASE_URL, safeRuntime.ml_api_url)
  assert.equal(env.VITE_POS_API_BASE_URL, safeRuntime.pos_api_url)
  assert.equal(env.VITE_POS_API_PROXY_TARGET, 'http://127.0.0.1:8001')
  assert.equal(env.VITE_SUPABASE_URL, safeRuntime.supabase_url)
  assert.equal(env.VITE_USE_MOCK_DATA, 'false')
})

test('refuses a raw database clone without local Supabase APIs', () => {
  assert.throws(
    () => assertRuntimeCapabilities({
      ...safeRuntime,
      capabilities: { pos_api: true, local_supabase: false },
    }),
    /raw PostgreSQL clone is enough for POS-backend SQL/,
  )
})

test('refuses missing or future backend runtime schema versions', () => {
  const { schema_version: _missing, ...missingVersion } = safeRuntime
  assert.throws(() => assertRuntimeCapabilities(missingVersion), /schema version: missing/)
  assert.throws(
    () => assertRuntimeCapabilities({ ...safeRuntime, schema_version: 2 }),
    /schema version: 2/,
  )
})

test('refuses a Supabase stack without local Storage', () => {
  assert.throws(
    () => assertRuntimeCapabilities({
      ...safeRuntime,
      capabilities: { pos_api: true, local_supabase: true, local_storage: false },
    }),
    /capabilities.local_storage/,
  )
})

test('builds an isolated Restaurant ML environment with outbound integrations disabled', () => {
  const env = buildMlEnvironment({
    ...safeRuntime,
    database_url: 'postgresql://sandbox:sandbox@127.0.0.1:55432/sandbox',
    supabase_secret_key: 'sandbox-secret-key',
    supabase_jwt_secret: 'sandbox-jwt-secret',
    _ml_backend_root: '/tmp/ml',
  }, 8002)
  assert.equal(env.DATABASE_URL, 'postgresql://sandbox:sandbox@127.0.0.1:55432/sandbox')
  assert.equal(env.SUPABASE_URL, safeRuntime.supabase_url)
  assert.equal(env.PYTHONPATH, '/tmp/ml')
  assert.equal(env.ENABLE_BACKGROUND_WORKERS, 'false')
  assert.equal(env.REPORT_EMAIL_ENABLED, 'false')
  assert.equal(env.LLM_ENABLED, 'false')
  assert.equal(env.RESEND_API_KEY, '')
  assert.equal('SHIRE_PRODUCTION_SECRET' in env, false)
})

test('refuses to launch Restaurant ML against a remote database', () => {
  assert.throws(
    () => buildMlEnvironment({
      ...safeRuntime,
      database_url: 'postgresql://postgres:secret@db.production.supabase.co/postgres',
      supabase_secret_key: 'sandbox-secret-key',
      supabase_jwt_secret: 'sandbox-jwt-secret',
      _ml_backend_root: '/tmp/ml',
    }, 8002),
    /must both be loopback targets/,
  )
})

test('refuses missing services instead of loading normal env fallbacks', () => {
  assert.throws(
    () => resolveSandboxEnvironment({ restaurant_id: safeRuntime.restaurant_id }, {}),
    /missing local SHIRE services/,
  )
})

test('refuses a production service mixed into an otherwise local manifest', () => {
  assert.throws(
    () => resolveSandboxEnvironment({
      ...safeRuntime,
      supabase_url: 'https://production.supabase.co',
    }, {}),
    /Refusing non-local sandbox target/,
  )
})

test('backend failures never echo runtime credentials or raw stderr', () => {
  const message = sanitizedBackendFailure({
    status: 1,
    stdout: JSON.stringify({
      status: 'error',
      error: 'database failed with service-role-secret',
      supabase_service_role_key: 'service-role-secret',
      supabase_jwt_secret: 'jwt-secret',
    }),
    stderr: 'provider-secret-from-stderr',
  }, 'up')

  assert.match(message, /status=error, exit=1/)
  assert.doesNotMatch(message, /service-role-secret|jwt-secret|provider-secret-from-stderr|database failed/)
})

test('shows only allowlisted synthetic local login fields and domains', () => {
  const rows = sandboxLoginRows({
    test_users: {
      owner: {
        email: 'owner@sandbox.shire.invalid',
        password: 'ShireSandbox-owner-2026!',
        user_id: 'must-not-display',
        token: 'must-not-display',
      },
      manager: { email: 'manager@production.example', password: 'must-not-display' },
      server: { email: 'server@sandbox.shire.invalid', password: 'ShireSandbox-server-2026!' },
      attacker: { email: 'attacker@sandbox.shire.invalid', password: 'must-not-display' },
    },
    supabase_service_role_key: 'must-not-display',
  })

  assert.deepEqual(rows, [
    { role: 'owner', email: 'owner@sandbox.shire.invalid', password: 'ShireSandbox-owner-2026!' },
    { role: 'server', email: 'server@sandbox.shire.invalid', password: 'ShireSandbox-server-2026!' },
  ])
  assert.doesNotMatch(JSON.stringify(rows), /user_id|token|service_role|attacker|production|must-not-display/)
})

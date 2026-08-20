#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url))
const FRONTEND_ROOT = resolve(SCRIPT_DIR, '..')

function firstExistingPath(candidates) {
  return candidates.find(candidate => existsSync(candidate)) || candidates[0]
}

const DEFAULT_BACKEND_ROOT = firstExistingPath([
  resolve(FRONTEND_ROOT, '..', 'POS_backend', 'Shire_POS_backend'),
  resolve(FRONTEND_ROOT, '..', 'Shire_POS_backend'),
])
const DEFAULT_ML_BACKEND_ROOT = firstExistingPath([
  resolve(FRONTEND_ROOT, '..', 'Restuarant_ML-Backend'),
  resolve(FRONTEND_ROOT, '..', 'Documents', 'Restuarant_ML-Backend'),
])

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const VALUE_FLAGS = new Set([
  '--restaurant',
  '--bundle',
  '--snapshot-dir',
  '--api-port',
  '--supabase-api-port',
  '--db-port',
])
const BOOLEAN_FLAGS = new Set(['--baseline', '--fresh', '--offline'])

export function isLoopbackUrl(value) {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && LOOPBACK_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export function parseArguments(argv) {
  const result = {
    backendRoot: process.env.SHIRE_POS_BACKEND_DIR || DEFAULT_BACKEND_ROOT,
    mlBackendRoot: process.env.SHIRE_ML_BACKEND_DIR || DEFAULT_ML_BACKEND_ROOT,
    mlApiPort: 8002,
    backendArgs: [],
    viteArgs: [],
    command: 'up',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--') {
      result.viteArgs = argv.slice(index + 1)
      break
    }
    if (arg === '--down') {
      result.command = 'down'
      continue
    }
    if (arg === '--reset') {
      result.command = 'reset'
      continue
    }
    if (arg === '--backend-dir') {
      const value = argv[index + 1]
      if (!value) throw new Error('--backend-dir requires a path')
      result.backendRoot = resolve(value)
      index += 1
      continue
    }
    if (arg === '--ml-backend-repo') {
      const value = argv[index + 1]
      if (!value) throw new Error('--ml-backend-repo requires a path')
      result.mlBackendRoot = resolve(value)
      index += 1
      continue
    }
    if (arg === '--ml-api-port') {
      const value = Number(argv[index + 1])
      if (!Number.isInteger(value) || value < 1024 || value > 65535) {
        throw new Error('--ml-api-port requires a port between 1024 and 65535')
      }
      result.mlApiPort = value
      index += 1
      continue
    }
    if (VALUE_FLAGS.has(arg)) {
      const value = argv[index + 1]
      if (!value) throw new Error(`${arg} requires a value`)
      result.backendArgs.push(arg, value)
      index += 1
      continue
    }
    if (BOOLEAN_FLAGS.has(arg)) {
      result.backendArgs.push(arg)
      continue
    }
    throw new Error(`Unknown option: ${arg}`)
  }

  if (result.command === 'down' && result.backendArgs.length > 0) {
    throw new Error('--down cannot be combined with sandbox creation options')
  }

  return result
}

export function sanitizedBackendFailure(result, command) {
  let status = 'unknown'
  try {
    const payload = JSON.parse(String(result.stdout || '').trim())
    if (payload?.status === 'error') status = 'error'
  } catch {
    // Raw launcher output can contain local service-role/JWT credentials.
  }
  const exitCode = Number.isInteger(result.status) ? result.status : 'unknown'
  return `Backend sandbox ${command} failed (status=${status}, exit=${exitCode}). Run the backend launcher directly for local diagnostics.`
}

export function sandboxLoginRows(runtime) {
  const users = runtime?.test_users
  if (!users || typeof users !== 'object') return []
  return ['owner', 'manager', 'server'].flatMap((role) => {
    const user = users[role]
    const email = typeof user?.email === 'string' ? user.email.trim() : ''
    const password = typeof user?.password === 'string' ? user.password : ''
    if (!email.toLowerCase().endsWith('@sandbox.shire.invalid') || !password) return []
    return [{ role, email, password }]
  })
}

export function assertRuntimeCapabilities(runtime) {
  if (!runtime || runtime.schema_version !== 1) {
    throw new Error(
      `Unsupported backend sandbox runtime schema version: ${String(runtime?.schema_version ?? 'missing')}`,
    )
  }
  if (runtime.sandbox !== true || runtime.environment !== 'sandbox') {
    throw new Error('Backend runtime is not marked as a sandbox; refusing to connect SHIRE-FRONTEND')
  }

  const capabilities = runtime.capabilities || {}
  const missing = []
  if (capabilities.pos_api !== true) missing.push('capabilities.pos_api')
  if (capabilities.local_supabase !== true) missing.push('capabilities.local_supabase')
  if (capabilities.local_storage !== true) missing.push('capabilities.local_storage')
  if (missing.length > 0) {
    throw new Error(
      `The backend runtime cannot safely host SHIRE-FRONTEND yet: ${missing.join(', ')}.\n` +
      'A raw PostgreSQL clone is enough for POS-backend SQL, but SHIRE-FRONTEND also makes direct ' +
      'Supabase Auth, REST, RPC, and Storage calls. The sandbox must expose a real local Supabase API ' +
      'over the cloned database and report that capability before the web app can start.',
    )
  }
}

function isLoopbackPostgresUrl(value) {
  try {
    const parsed = new URL(value)
    return (
      (parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:') &&
      LOOPBACK_HOSTS.has(parsed.hostname)
    )
  } catch {
    return false
  }
}

function runtimeSecret(runtime, ...names) {
  for (const name of names) {
    if (typeof runtime[name] === 'string' && runtime[name].trim()) return runtime[name].trim()
  }
  return ''
}

export function buildMlEnvironment(runtime, mlApiPort) {
  const databaseUrl = runtimeSecret(runtime, 'database_url')
  const supabaseUrl = runtimeSecret(runtime, 'supabase_url')
  const publicKey = runtimeSecret(runtime, 'supabase_publishable_key', 'supabase_anon_key')
  const privateKey = runtimeSecret(runtime, 'supabase_secret_key', 'supabase_service_key')
  const jwtSecret = runtimeSecret(runtime, 'supabase_jwt_secret')

  const missing = []
  if (!databaseUrl) missing.push('database_url')
  if (!supabaseUrl) missing.push('supabase_url')
  if (!publicKey) missing.push('supabase_publishable_key')
  if (!privateKey) missing.push('supabase_secret_key')
  if (!jwtSecret) missing.push('supabase_jwt_secret')
  if (missing.length > 0) {
    throw new Error(
      `Cannot launch Restaurant ML safely; backend runtime is missing ${missing.join(', ')}`,
    )
  }
  if (!isLoopbackPostgresUrl(databaseUrl) || !isLoopbackUrl(supabaseUrl)) {
    throw new Error('Cannot launch Restaurant ML: its database and Supabase API must both be loopback targets')
  }

  const posApiUrl = runtimeSecret(runtime, 'pos_api_url')
  if (!isLoopbackUrl(posApiUrl)) throw new Error('Cannot launch Restaurant ML without a local POS API URL')

  // Deliberately do not inherit the caller's environment here. The ML repo has
  // many optional external providers; this process receives only local sandbox
  // coordinates and explicit off switches.
  return {
    PATH: process.env.PATH || '/usr/bin:/bin',
    LANG: process.env.LANG || 'en_US.UTF-8',
    TMPDIR: process.env.TMPDIR || '/private/tmp',
    PYTHONPATH: runtimeSecret(runtime, '_ml_backend_root'),
    APP_ENV: 'development',
    DEBUG: 'true',
    HOST: '127.0.0.1',
    PORT: String(mlApiPort),
    CORS_ORIGINS: 'http://127.0.0.1:5173,http://localhost:5173',
    DATABASE_URL: databaseUrl,
    DATABASE_POOL_MIN_SIZE: '1',
    DATABASE_POOL_MAX_SIZE: '4',
    SUPABASE_URL: supabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: publicKey,
    SUPABASE_ANON_KEY: publicKey,
    SUPABASE_SECRET_KEY: privateKey,
    SUPABASE_SERVICE_KEY: privateKey,
    SUPABASE_JWT_SECRET: jwtSecret,
    EMPLOYEE_AUTH_SECRET: jwtSecret,
    ENABLE_BACKGROUND_WORKERS: 'false',
    MANAGER_ALERT_PUSH_ENABLED: 'false',
    CAMERA_RESULT_INGEST_WORKER_ENABLED: 'false',
    FLYWHEEL_ENABLED: 'false',
    ML_ENABLED: 'false',
    ML_SERVICE_URL: '',
    ML_SERVICE_URLS: '',
    RESTAURANT_ML_SERVICE_URL: '',
    TABLE_STATE_DIFFERENTIAL_ENABLED: 'false',
    DIFFERENTIAL_SERVICE_URLS: '',
    LLM_ENABLED: 'false',
    OPENAI_API_KEY: '',
    OPENROUTER_API_KEY: '',
    REPORT_EMAIL_ENABLED: 'false',
    RESEND_API_KEY: '',
    SMS_ENABLED: 'false',
    TWILIO_ACCOUNT_SID: '',
    TWILIO_AUTH_TOKEN: '',
    SENDBLUE_API_KEY_ID: '',
    SENDBLUE_API_SECRET_KEY: '',
    AZURE_IMAGE_UPLOAD_ENABLED: 'false',
    AZURE_STORAGE_CONNECTION_STRING: '',
    POS_HANDOFF_ENABLED: 'false',
    POS_HANDOFF_BASE_URL: posApiUrl,
    POS_HANDOFF_TOKEN: '',
    EXPO_PUSH_ACCESS_TOKEN: '',
    SCHEDULED_CHANGE_SECRET: '',
    USEFUL_SAMPLE_CALLBACK_URL: '',
    FRONTEND_BASE_URL: 'http://127.0.0.1:5173',
    PUBLIC_BOOKING_BASE_URL: 'http://127.0.0.1:5173/book',
  }
}

async function waitForService(url, child, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.shireSpawnError) throw child.shireSpawnError
    if (child.exitCode !== null) throw new Error(`${label} exited before becoming ready`)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(750) })
      if (response.ok) return
    } catch {
      // Service is still starting.
    }
    await delay(250)
  }
  throw new Error(`${label} did not become ready at ${url}`)
}

async function ensureMlBackend(runtime, options) {
  if (runtime.ml_api_url) {
    return {
      child: null,
      runtime: {
        ...runtime,
        // Keep reservations fail-local when no dedicated sandbox service is
        // available. Unsupported routes return 404 from the local ML API.
        reservations_api_url: runtime.reservations_api_url || runtime.ml_api_url,
      },
    }
  }

  const python = resolve(options.mlBackendRoot, '.venv', 'bin', 'python')
  if (!existsSync(python)) {
    throw new Error(
      `Restaurant ML virtualenv not found at ${python}. ` +
      'Set SHIRE_ML_BACKEND_DIR or pass --ml-backend-repo.',
    )
  }

  const mlApiUrl = `http://127.0.0.1:${options.mlApiPort}/api/v1`
  const sandboxRuntime = { ...runtime, _ml_backend_root: options.mlBackendRoot }
  const mlEnv = buildMlEnvironment(sandboxRuntime, options.mlApiPort)
  const child = spawn(
    python,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(options.mlApiPort)],
    {
      cwd: resolve(options.backendRoot, '.sandbox'),
      stdio: 'inherit',
      env: mlEnv,
    },
  )
  child.on('error', (error) => {
    child.shireSpawnError = error
  })

  try {
    await waitForService(`http://127.0.0.1:${options.mlApiPort}/readyz`, child, 'Restaurant ML')
  } catch (error) {
    child.kill('SIGTERM')
    throw error
  }

  return {
    child,
    runtime: {
      ...runtime,
      ml_api_url: mlApiUrl,
      // Reservations is a separate surface in some deployments. Pointing its
      // sandbox client at the local ML service is fail-local (unsupported routes
      // return 404) and can never fall through to the production reservations API.
      reservations_api_url: runtime.reservations_api_url || mlApiUrl,
    },
  }
}

function requireValue(name, value, missing) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) missing.push(name)
  return normalized
}

export function resolveSandboxEnvironment(runtime, overrides = process.env) {
  const missing = []
  const posApiUrl = requireValue(
    'pos_api_url',
    overrides.SHIRE_SANDBOX_POS_API_URL || runtime.pos_api_url,
    missing,
  )
  const mlApiUrl = requireValue(
    'ml_api_url',
    overrides.SHIRE_SANDBOX_ML_API_URL || runtime.ml_api_url,
    missing,
  )
  const supabaseUrl = requireValue(
    'supabase_url',
    overrides.SHIRE_SANDBOX_SUPABASE_URL || runtime.supabase_url,
    missing,
  )
  const supabasePublishableKey = requireValue(
    'supabase_publishable_key',
    overrides.SHIRE_SANDBOX_SUPABASE_PUBLISHABLE_KEY || runtime.supabase_publishable_key,
    missing,
  )
  const reservationsApiUrl = requireValue(
    'reservations_api_url',
    overrides.SHIRE_SANDBOX_RESERVATIONS_API_URL || runtime.reservations_api_url,
    missing,
  )

  if (missing.length > 0) {
    throw new Error(
      `The backend sandbox is missing local SHIRE services: ${missing.join(', ')}.\n` +
      'SHIRE-FRONTEND talks directly to Restaurant ML, POS, Reservations, and Supabase Auth/REST. ' +
      'It will not start while any target is absent because Vite could otherwise load a production value from .env.\n' +
      'Start those local services or provide SHIRE_SANDBOX_ML_API_URL, SHIRE_SANDBOX_POS_API_URL, ' +
      'SHIRE_SANDBOX_RESERVATIONS_API_URL, SHIRE_SANDBOX_SUPABASE_URL, and ' +
      'SHIRE_SANDBOX_SUPABASE_PUBLISHABLE_KEY.',
    )
  }

  const urls = {
    pos_api_url: posApiUrl,
    ml_api_url: mlApiUrl,
    reservations_api_url: reservationsApiUrl,
    supabase_url: supabaseUrl,
  }
  const unsafe = Object.entries(urls).filter(([, value]) => !isLoopbackUrl(value))
  if (unsafe.length > 0) {
    throw new Error(
      `Refusing non-local sandbox target(s): ${unsafe.map(([name, value]) => `${name}=${value}`).join(', ')}`,
    )
  }

  const restaurantId = requireValue('restaurant_id', runtime.restaurant_id, missing)
  if (!restaurantId) throw new Error('The backend sandbox did not report a restaurant_id')

  return {
    VITE_SANDBOX_MODE: 'true',
    VITE_SANDBOX_RESTAURANT_LABEL: runtime.restaurant_name || `Restaurant ${restaurantId}`,
    VITE_API_BASE_URL: mlApiUrl,
    VITE_POS_API_BASE_URL: posApiUrl,
    VITE_POS_API_BASE: posApiUrl,
    VITE_POS_API_PROXY_TARGET: new URL(posApiUrl).origin,
    VITE_RESERVATIONS_API_BASE_URL: reservationsApiUrl,
    VITE_RESERVATIONS_API_BASE: reservationsApiUrl,
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey,
    VITE_RESTAURANT_ID: restaurantId,
    VITE_USE_MOCK_DATA: 'false',
    VITE_PUBLIC_SITE_URL: 'http://127.0.0.1:5173',
    VITE_POS_UI_PREVIEW_URL: 'http://127.0.0.1:8082',
    VITE_HOST_UI_PREVIEW_URL: 'http://127.0.0.1:8083',
    VITE_STORAGE_KEY: `shire_sandbox_${restaurantId}`,
  }
}

function runBackend(options) {
  const launcher = resolve(options.backendRoot, 'scripts', 'snapshot-sandbox')
  if (!existsSync(launcher)) {
    throw new Error(
      `Backend sandbox launcher not found at ${launcher}. ` +
      'Set SHIRE_POS_BACKEND_DIR or pass --backend-dir.',
    )
  }

  if (options.command === 'down') {
    const result = spawnSync(launcher, ['down'], {
      cwd: options.backendRoot,
      stdio: 'inherit',
    })
    if (result.error) throw result.error
    process.exitCode = result.status ?? 1
    return null
  }

  const result = spawnSync(launcher, [options.command, ...options.backendArgs, '--json'], {
    cwd: options.backendRoot,
    encoding: 'utf8',
  })
  if (result.error) {
    throw new Error(`Could not start the backend sandbox launcher (${result.error.code || 'spawn error'}).`)
  }
  if (result.status !== 0) {
    throw new Error(sanitizedBackendFailure(result, options.command))
  }

  try {
    return JSON.parse(result.stdout.trim())
  } catch {
    throw new Error(
      'Backend sandbox returned an unreadable runtime contract. Raw output was suppressed because it may contain local credentials.',
    )
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv)
  let runtime = runBackend(options)
  if (!runtime) return

  assertRuntimeCapabilities(runtime)
  const ml = await ensureMlBackend(runtime, options)
  runtime = ml.runtime
  let sandboxEnv
  try {
    sandboxEnv = resolveSandboxEnvironment(runtime)
  } catch (error) {
    ml.child?.kill('SIGTERM')
    throw error
  }
  console.log('')
  console.log('\x1b[43m\x1b[30m === SHIRE WEB SANDBOX === \x1b[0m')
  console.log(` Restaurant: ${sandboxEnv.VITE_SANDBOX_RESTAURANT_LABEL} (${sandboxEnv.VITE_RESTAURANT_ID})`)
  console.log(` Restaurant ML: ${sandboxEnv.VITE_API_BASE_URL}`)
  console.log(` POS API: ${sandboxEnv.VITE_POS_API_BASE_URL}`)
  console.log(` Reservations: unsupported local sink (${sandboxEnv.VITE_RESERVATIONS_API_BASE_URL})`)
  console.log(` Supabase: ${sandboxEnv.VITE_SUPABASE_URL}`)
  const localLogins = sandboxLoginRows(runtime)
  if (localLogins.length > 0) {
    console.log(' Synthetic local logins:')
    console.table(localLogins)
  }
  console.log(' Production writes: DISABLED')
  console.log(' Stop the shared sandbox later with: pnpm web:dev:sandbox:down')
  console.log('')

  const web = spawn('pnpm', ['--filter', 'web', 'dev', ...options.viteArgs], {
    cwd: FRONTEND_ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...sandboxEnv },
  })
  web.on('error', (error) => {
    console.error(`Could not start Vite: ${error.message}`)
    ml.child?.kill('SIGTERM')
    process.exitCode = 1
  })
  web.on('exit', (code, signal) => {
    ml.child?.kill('SIGTERM')
    if (signal) console.log(`Vite stopped by ${signal}`)
    process.exitCode = code ?? (signal ? 0 : 1)
  })
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  main().catch((error) => {
    console.error(`\nSandbox startup refused: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}

import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultViewPolicy, flattenViewCapabilities, viewMode } from '../../../shared/backOfficeView.ts'
import {
  createRecoveryController, isRecoveryActive, recoveryError, recoverySelection,
  recoverySessionKey, referenceDeviceBlocker,
} from './deviceSyncRecoveryState.js'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function memoryStorage() {
  const values = new Map()
  return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }
}
function inspection(patch = {}) {
  return {
    id: 'run-1', restaurant_id: 'store-1', reference_device_id: 'reference', status: 'inspecting',
    preview_token: 'fresh-preview', targets: [
      { device_id: 'reference', device_name: 'Bar', state: 'ready', blockers: [] },
      { device_id: 'peer', device_name: 'Dining', state: 'ready', blockers: [] },
      { device_id: 'offline', device_name: 'Patio', state: 'offline', blockers: ['device_offline'] },
    ], ...patch,
  }
}
function harness(overrides = {}, storage = memoryStorage()) {
  const calls = []
  const api = {
    overview: async () => ({ enabled: true, devices: [], active_run: null, recent_runs: [] }),
    run: async () => inspection(),
    inspect: async (store, body) => { calls.push({ store, body }); return inspection() },
    confirm: async (_store, _run, body) => { calls.push(body); return inspection({ status: 'preparing', preview_token: null }) },
    cancel: async () => inspection({ status: 'cancelled' }),
    ...overrides,
  }
  const controller = createRecoveryController({ restaurantId: 'store-1', userId: 'user-1', api, storage, uuid: () => 'stable-request-1' })
  return { controller, calls, storage, api }
}

test('reference candidates require current compatible devices while queue counts remain advisory', () => {
  const now = Date.parse('2026-09-05T12:00:00Z')
  const device = { status: 'active', device_type: 'fixed_terminal', protocol_version: 1, last_seen_at: '2026-09-05T11:59:00Z', capability_reported_at: '2026-09-05T11:59:00Z', pending_mutation_count: 4 }
  assert.equal(referenceDeviceBlocker(device, now), null)
  for (const patch of [
    { status: 'revoked' }, { device_type: 'kitchen_display' }, { device_type: null }, { protocol_version: null }, { protocol_version: 2 },
    { last_seen_at: null }, { capability_reported_at: '2026-09-05T11:57:59Z' },
  ]) assert.equal(typeof referenceDeviceBlocker({ ...device, ...patch }, now), 'string')
  for (const device_type of ['android_tablet', 'waiter_handheld', 'fixed_terminal', 'desktop']) {
    assert.equal(referenceDeviceBlocker({ ...device, device_type }, now), null)
  }
})

test('confirm requires an explicit preview and fresh ready reference plus peer', () => {
  const selection = recoverySelection(inspection())
  assert.equal(selection.canConfirm, true)
  assert.deepEqual(selection.ready.map((item) => item.device_id), ['reference', 'peer'])
  assert.deepEqual(selection.excluded.map((item) => item.device_id), ['offline'])
  assert.equal(recoverySelection(inspection({ preview_token: null })).canConfirm, false)
  assert.equal(recoverySelection(inspection({ reference_device_id: 'offline' })).canConfirm, false)
  assert.equal(recoverySelection(inspection({ targets: [inspection().targets[0]] })).canConfirm, false)
  for (const status of ['preparing', 'completed', 'partial', 'blocked', 'failed', 'expired', 'cancelled']) {
    assert.equal(recoverySelection(inspection({ status })).canConfirm, false)
  }
})

test('disabled rollout cannot initiate inspection', async () => {
  const { controller, calls } = harness({ overview: async () => ({ enabled: false, active_run: null }) })
  await controller.load()
  await controller.inspect('reference')
  assert.equal(calls.length, 0)
  controller.dispose()
})

test('inspection creates no confirm command or overlapping run', async () => {
  const { controller, calls } = harness()
  await controller.load()
  await controller.inspect('reference')
  assert.deepEqual(calls, [{ store: 'store-1', body: { request_id: 'stable-request-1', reference_device_id: 'reference' } }])
  await controller.inspect('peer')
  assert.equal(calls.length, 1, 'Cannot create a second inspection while the current run is active')
  assert.equal(controller.getSnapshot().run.status, 'inspecting')
  controller.dispose()
})

test('an unavailable saved history row does not prevent a fresh inspection', async () => {
  const storage = memoryStorage()
  storage.setItem(recoverySessionKey('user-1', 'store-1'), JSON.stringify({ runId: 'old-run' }))
  const { controller, calls } = harness({
    run: async () => { throw Object.assign(new Error('Not found'), { status: 404 }) },
  }, storage)
  await controller.load()
  assert.equal(controller.getSnapshot().run, null)
  assert.equal(controller.getSnapshot().readError, null)
  await controller.inspect('reference')
  assert.equal(calls.length, 1)
  controller.dispose()
})

test('a fresh inspection after a finished run obtains a new idempotency key', async () => {
  const requests = []
  let count = 0
  const controller = createRecoveryController({
    restaurantId: 'store-1', userId: 'user-1', storage: memoryStorage(), uuid: () => `request-${++count}`,
    api: {
      overview: async () => ({ enabled: true, active_run: null }),
      inspect: async (_store, body) => { requests.push(body); return inspection({ id: `run-${count}` }) },
      cancel: async () => inspection({ status: 'cancelled' }),
    },
  })
  await controller.load()
  await controller.inspect('reference')
  await controller.cancel('Fix terminal first')
  await controller.inspect('peer')
  assert.equal(requests.length, 2)
  assert.notEqual(requests[0].request_id, requests[1].request_id)
  assert.equal(requests[1].reference_device_id, 'peer')
  controller.dispose()
})

test('confirmation uses only the inspected token and trimmed reason; stale token cannot execute', async () => {
  const { controller, calls } = harness({ overview: async () => ({ enabled: true, active_run: inspection() }) })
  await controller.load()
  await controller.confirm('stale-preview', 'Repair outage')
  assert.equal(calls.length, 0)
  await controller.confirm('fresh-preview', '  Repair outage  ')
  assert.deepEqual(calls, [{ preview_token: 'fresh-preview', reason: 'Repair outage' }])
  assert.equal(controller.getSnapshot().run.status, 'preparing')
  controller.dispose()
})

test('failed inspection reads preserve prior status but disable confirmation', async () => {
  const forbidden = Object.assign(new Error('Forbidden'), { status: 403 })
  const { controller, calls } = harness({
    overview: async () => ({ enabled: true, active_run: inspection() }),
    run: async () => { throw forbidden },
  })
  await controller.load()
  await controller.refreshRun()
  assert.match(controller.getSnapshot().readError, /permission/)
  assert.equal(controller.getSnapshot().run.status, 'inspecting')
  await controller.confirm('fresh-preview', 'Repair outage')
  assert.equal(calls.length, 0)
  controller.dispose()
})

test('stale preview rejection clears confirmation eligibility and does not create a new run', async () => {
  const { controller } = harness({
    overview: async () => ({ enabled: true, active_run: inspection() }),
    confirm: async () => { throw Object.assign(new Error('stale'), { status: 409, detail: { code: 'preview_stale', message: 'Readiness changed.' } }) },
  })
  await controller.load()
  await controller.confirm('fresh-preview', 'Repair outage')
  assert.equal(controller.getSnapshot().error, 'Readiness changed.')
  assert.equal(controller.getSnapshot().pending, null)
  assert.equal(recoverySelection(controller.getSnapshot().run).canConfirm, false)
  controller.dispose()
})

test('ambiguous creation survives reload and repeats the original request ID', async () => {
  const storage = memoryStorage()
  const first = harness({ inspect: async () => { throw new TypeError('Network failure') } }, storage)
  await first.controller.load()
  await first.controller.inspect('reference')
  assert.equal(first.controller.getSnapshot().pending.body.request_id, 'stable-request-1')
  first.controller.dispose()

  const second = harness({}, storage)
  await second.controller.load()
  await second.controller.inspect('peer')
  assert.equal(second.calls.length, 0, 'New intent cannot supersede an ambiguous request')
  await second.controller.retryPending()
  assert.deepEqual(second.calls[0], { store: 'store-1', body: { request_id: 'stable-request-1', reference_device_id: 'reference' } })
  assert.equal(second.controller.getSnapshot().pending, null)
  second.controller.dispose()
})

test('ambiguous confirmation retries its exact review and never refreshes its payload', async () => {
  const calls = []
  const { controller } = harness({
    overview: async () => ({ enabled: true, active_run: inspection() }),
    confirm: async (_store, _id, body) => {
      calls.push(body)
      if (calls.length === 1) throw Object.assign(new Error('Timed out'), { status: 503 })
      return inspection({ status: 'preparing' })
    },
  })
  await controller.load()
  await controller.confirm('fresh-preview', 'Repair outage')
  await controller.confirm('another-preview', 'Changed reason')
  await controller.retryPending()
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0], calls[1])
  controller.dispose()
})

test('double click issues one command while response is outstanding', async () => {
  const pending = deferred()
  let count = 0
  const { controller } = harness({ inspect: () => { count += 1; return pending.promise } })
  await controller.load()
  const first = controller.inspect('reference')
  await controller.inspect('peer')
  assert.equal(count, 1)
  pending.resolve(inspection())
  await first
  controller.dispose()
})

test('disposed account or store ignores late responses and aborts its reads', async () => {
  const pending = deferred()
  let signal
  const { controller } = harness({ overview: (_store, requestSignal) => { signal = requestSignal; return pending.promise } })
  let notifications = 0
  controller.subscribe(() => { notifications += 1 })
  const loading = controller.load()
  const beforeDispose = notifications
  controller.dispose()
  assert.equal(signal.aborted, true)
  pending.resolve({ enabled: true, active_run: inspection() })
  await loading
  assert.equal(notifications, beforeDispose)
  assert.equal(controller.getSnapshot().run, null)
  assert.notEqual(recoverySessionKey('user-1', 'store-1'), recoverySessionKey('user-2', 'store-1'))
  assert.notEqual(recoverySessionKey('user-1', 'store-1'), recoverySessionKey('user-1', 'store-2'))
})

test('history restores active run from server and cancel retains per-device outcomes', async () => {
  const run = inspection({ status: 'applying', targets: [
    { device_id: 'reference', state: 'applied' }, { device_id: 'peer', state: 'applying' },
  ] })
  const { controller } = harness({
    overview: async () => ({ enabled: true, active_run: run }),
    cancel: async () => ({ ...run, status: 'cancelled', targets: [run.targets[0], { device_id: 'peer', state: 'cancelled' }] }),
  })
  await controller.load()
  assert.equal(isRecoveryActive(controller.getSnapshot().run), true)
  await controller.cancel('Stop recovery')
  assert.equal(controller.getSnapshot().run.targets[0].state, 'applied')
  assert.equal(isRecoveryActive(controller.getSnapshot().run), false)
  controller.dispose()
})

test('auth errors retain their meaning and presentation is independently configurable', () => {
  assert.match(recoveryError({ status: 401 }), /sign-in/)
  assert.match(recoveryError({ status: 403 }), /permission/)
  assert.ok(flattenViewCapabilities().some((node) => node.id === 'devices.sync_recovery'))
  assert.equal(viewMode(defaultViewPolicy('simple'), 'devices.sync_recovery'), 'summary')
  assert.equal(viewMode(defaultViewPolicy('medium'), 'devices.sync_recovery'), 'summary')
  assert.equal(viewMode(defaultViewPolicy('advanced'), 'devices.sync_recovery'), 'full')
  assert.equal(viewMode({ ...defaultViewPolicy(), overrides: { 'devices.sync_recovery': 'hidden' } }, 'devices.sync_recovery'), 'hidden')
})

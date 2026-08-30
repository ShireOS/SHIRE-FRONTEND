import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAPABILITY_MAX_AGE_MS,
  deviceCompatibilityReasons,
  requestIdForDeploymentIntent,
} from './deviceUpdateEligibility.js'

const NOW = Date.parse('2026-08-30T16:00:00Z')
const release = { platform: 'ios', runtime_version: '1.0.8', channel: 'production-1-0-8' }
const compatible = {
  update_protocol_version: '1',
  updates_enabled: 'true',
  update_platform: 'ios',
  update_runtime_version: '1.0.8',
  update_channel: 'production-1-0-8',
  update_capabilities_reported_at: new Date(NOW - 60_000).toISOString(),
}

test('device rollout eligibility mirrors the server channel and freshness gates', () => {
  assert.deepEqual(deviceCompatibilityReasons(compatible, release, NOW), [])
  assert.deepEqual(
    deviceCompatibilityReasons({ ...compatible, update_channel: 'preview' }, release, NOW),
    ['channel_mismatch'],
  )
  assert.deepEqual(
    deviceCompatibilityReasons({
      ...compatible,
      update_capabilities_reported_at: new Date(NOW - CAPABILITY_MAX_AGE_MS - 1).toISOString(),
    }, release, NOW),
    ['managed_update_capability_stale'],
  )
})

test('an idempotency key is stable only for an exact deployment intent', () => {
  const ref = { current: null }
  let sequence = 0
  const createId = () => `request-${++sequence}`
  const intent = { release_id: 'release-1', device_ids: ['device-1'], reason: 'Routine rollout' }

  assert.equal(requestIdForDeploymentIntent(ref, intent, createId), 'request-1')
  assert.equal(requestIdForDeploymentIntent(ref, { ...intent }, createId), 'request-1')
  assert.equal(requestIdForDeploymentIntent(ref, { ...intent, device_ids: ['device-2'] }, createId), 'request-2')
})

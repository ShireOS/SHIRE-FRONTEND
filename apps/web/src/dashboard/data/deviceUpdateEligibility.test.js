import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAPABILITY_MAX_AGE_MS,
  ONLINE_MAX_AGE_MS,
  deviceCompatibilityReasons,
  effectiveTargetState,
  managedUpdateErrorCode,
  normalizeRolloutScope,
  previewChanges,
  requestIdForDeploymentIntent,
} from './deviceUpdateEligibility.js'

test('V2 fleet constants distinguish capability freshness from online presence', () => {
  assert.equal(CAPABILITY_MAX_AGE_MS, 30 * 24 * 60 * 60 * 1000)
  assert.equal(ONLINE_MAX_AGE_MS, 5 * 60 * 1000)
})

test('legacy V1 compatibility keeps its existing 15-minute freshness window', () => {
  const now = Date.parse('2026-09-03T12:00:00Z')
  const reasons = deviceCompatibilityReasons(
    {
      update_capabilities_reported_at: '2026-09-03T11:44:59Z',
      update_protocol_version: 1,
      updates_enabled: true,
      update_platform: 'ios',
      update_runtime_version: '1.0.0',
      update_channel: 'stable',
    },
    { platform: 'ios', runtime_version: '1.0.0', channel: 'stable' },
    now,
  )
  assert.deepEqual(reasons, ['managed_update_capability_stale'])
})

test('scope normalization is stable and removes duplicate client hints', () => {
  assert.deepEqual(
    normalizeRolloutScope({
      restaurant_ids: ['store-b', 'store-a', 'store-a'],
      reseller_group_ids: ['group-1'],
      included_device_ids: ['device-2', 'device-1'],
    }),
    {
      restaurant_ids: ['store-a', 'store-b'],
      reseller_group_ids: ['group-1'],
      included_device_ids: ['device-1', 'device-2'],
      excluded_device_ids: [],
    },
  )
})

test('an idempotency key is stable for an equivalent rollout intent', () => {
  const ref = { current: null }
  let sequence = 0
  const createId = () => `request-${++sequence}`
  const intent = {
    release_family_id: 'release-1',
    scope: { restaurant_ids: ['store-b', 'store-a'] },
    reason: 'Routine rollout',
  }

  assert.equal(requestIdForDeploymentIntent(ref, intent, createId), 'request-1')
  assert.equal(
    requestIdForDeploymentIntent(
      ref,
      {
        ...intent,
        scope: { restaurant_ids: ['store-a', 'store-b', 'store-a'] },
      },
      createId,
    ),
    'request-1',
  )
  assert.equal(
    requestIdForDeploymentIntent(
      ref,
      { ...intent, release_family_id: 'release-2' },
      createId,
    ),
    'request-2',
  )
})

test('preview comparisons expose membership and wave changes', () => {
  const before = {
    devices: [
      { id: 'a', eligible: true, wave_number: 1 },
      {
        id: 'b',
        eligible: false,
        wave_number: null,
        eligibility_reasons: ['protocol_v2_required'],
      },
      { id: 'removed', eligible: true, wave_number: 4 },
    ],
  }
  const after = {
    devices: [
      { id: 'a', eligible: true, wave_number: 2 },
      {
        id: 'b',
        eligible: false,
        wave_number: null,
        eligibility_reasons: ['protocol_v2_required'],
      },
      { id: 'added', eligible: true, wave_number: 4 },
    ],
  }
  assert.deepEqual(previewChanges(before, after), {
    added: 1,
    removed: 1,
    changed: 1,
  })
})

test('rollout target and structured error helpers preserve server authority', () => {
  assert.equal(
    effectiveTargetState({
      state: 'released',
      command_state: 'waiting_safe_point',
    }),
    'waiting_safe_point',
  )
  assert.equal(
    managedUpdateErrorCode({ detail: { reason_code: 'PREVIEW_STALE' } }),
    'PREVIEW_STALE',
  )
  assert.equal(managedUpdateErrorCode(new Error('network')), null)
})

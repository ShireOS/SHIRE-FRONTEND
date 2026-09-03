export const CAPABILITY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
export const ONLINE_MAX_AGE_MS = 5 * 60 * 1000
export const CAPABILITY_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000
const LEGACY_CAPABILITY_MAX_AGE_MS = 15 * 60 * 1000

const sortedUnique = (values = []) =>
  [...new Set(values.filter(Boolean).map(String))].sort()

export function normalizeRolloutScope(scope = {}) {
  return {
    restaurant_ids: sortedUnique(scope.restaurant_ids),
    reseller_group_ids: sortedUnique(scope.reseller_group_ids),
    included_device_ids: sortedUnique(scope.included_device_ids),
    excluded_device_ids: sortedUnique(scope.excluded_device_ids),
  }
}

// V1 remains available during the Protocol V2 bootstrap window.
export function deviceCompatibilityReasons(device, release, now = Date.now()) {
  if (!release) return ['release_not_selected']
  const reasons = []
  const reportedAt = Date.parse(
    String(device.update_capabilities_reported_at || ''),
  )
  if (
    !Number.isFinite(reportedAt) ||
    reportedAt < now - LEGACY_CAPABILITY_MAX_AGE_MS
  ) {
    reasons.push('managed_update_capability_stale')
  } else if (reportedAt > now + CAPABILITY_MAX_FUTURE_SKEW_MS) {
    reasons.push('managed_update_capability_invalid_timestamp')
  }
  if (String(device.update_protocol_version || '') !== '1')
    reasons.push('managed_update_capability_missing')
  if (String(device.updates_enabled || '').toLowerCase() !== 'true')
    reasons.push('expo_updates_disabled')
  if (!device.update_platform) reasons.push('platform_unknown')
  else if (device.update_platform !== release.platform)
    reasons.push('platform_mismatch')
  if (!device.update_runtime_version) reasons.push('runtime_unknown')
  else if (device.update_runtime_version !== release.runtime_version)
    reasons.push('runtime_mismatch')
  if (!device.update_channel) reasons.push('channel_unknown')
  else if (device.update_channel !== release.channel)
    reasons.push('channel_mismatch')
  return reasons
}

export function managedUpdateIntentFingerprint(intent) {
  return JSON.stringify({
    ...intent,
    scope: normalizeRolloutScope(intent.scope),
  })
}

export function requestIdForDeploymentIntent(
  ref,
  intent,
  createId = () => crypto.randomUUID(),
) {
  const fingerprint = managedUpdateIntentFingerprint(intent)
  if (ref.current?.fingerprint !== fingerprint) {
    ref.current = { fingerprint, id: createId() }
  }
  return ref.current.id
}

export function resetDeploymentRequestId(ref) {
  ref.current = null
}

export function effectiveTargetState(target) {
  return target?.command_state || target?.state || 'unknown'
}

export function isTerminalTargetState(state) {
  return ['active', 'cancelled', 'failed', 'incompatible', 'expired'].includes(
    state,
  )
}

export function previewChanges(previous, current) {
  if (!previous || !current) return { added: 0, removed: 0, changed: 0 }
  const before = new Map(
    (previous.devices || []).map((device) => [String(device.id), device]),
  )
  const after = new Map(
    (current.devices || []).map((device) => [String(device.id), device]),
  )
  let added = 0
  let removed = 0
  let changed = 0
  for (const [id, device] of after) {
    const old = before.get(id)
    if (!old) {
      added += 1
      continue
    }
    if (
      Boolean(old.eligible) !== Boolean(device.eligible) ||
      Number(old.wave_number || 0) !== Number(device.wave_number || 0) ||
      JSON.stringify(old.eligibility_reasons || []) !==
        JSON.stringify(device.eligibility_reasons || [])
    ) {
      changed += 1
    }
  }
  for (const id of before.keys()) {
    if (!after.has(id)) removed += 1
  }
  return { added, removed, changed }
}

export function managedUpdateErrorCode(error) {
  const detail = error?.detail
  if (
    detail &&
    typeof detail === 'object' &&
    typeof detail.reason_code === 'string'
  ) {
    return detail.reason_code
  }
  return null
}

export function humanizeUpdateCode(value) {
  return String(value || 'unknown')
    .replaceAll('_', ' ')
    .toLowerCase()
}

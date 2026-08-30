const CAPABILITY_MAX_AGE_MS = 15 * 60 * 1000
const CAPABILITY_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000

export function deviceCompatibilityReasons(device, release, now = Date.now()) {
  if (!release) return ['release_not_selected']

  const reasons = []
  const reportedAt = Date.parse(String(device.update_capabilities_reported_at || ''))
  if (!Number.isFinite(reportedAt) || reportedAt < now - CAPABILITY_MAX_AGE_MS) {
    reasons.push('managed_update_capability_stale')
  } else if (reportedAt > now + CAPABILITY_MAX_FUTURE_SKEW_MS) {
    reasons.push('managed_update_capability_invalid_timestamp')
  }
  if (String(device.update_protocol_version || '') !== '1') reasons.push('managed_update_capability_missing')
  if (String(device.updates_enabled || '').toLowerCase() !== 'true') reasons.push('expo_updates_disabled')
  if (!device.update_platform) reasons.push('platform_unknown')
  else if (device.update_platform !== release.platform) reasons.push('platform_mismatch')
  if (!device.update_runtime_version) reasons.push('runtime_unknown')
  else if (device.update_runtime_version !== release.runtime_version) reasons.push('runtime_mismatch')
  if (!device.update_channel) reasons.push('channel_unknown')
  else if (device.update_channel !== release.channel) reasons.push('channel_mismatch')
  return reasons
}

export function requestIdForDeploymentIntent(ref, intent, createId = () => crypto.randomUUID()) {
  const fingerprint = JSON.stringify(intent)
  if (ref.current?.fingerprint !== fingerprint) {
    ref.current = { fingerprint, id: createId() }
  }
  return ref.current.id
}

export function resetDeploymentRequestId(ref) {
  ref.current = null
}

export { CAPABILITY_MAX_AGE_MS, CAPABILITY_MAX_FUTURE_SKEW_MS }

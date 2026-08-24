export function receiptSnapshotContextKey(payload) {
  const {
    receipt_group_ids: _groupIds,
    snapshot_id: _snapshotId,
    force_refresh: _forceRefresh,
    ...context
  } = payload
  return JSON.stringify(context)
}

export function reportOutputContextKey(restaurantId, payload) {
  return JSON.stringify([
    restaurantId,
    receiptSnapshotContextKey(payload),
    payload.receipt_group_ids || [],
  ])
}

function outputContextSet(keys) {
  return keys instanceof Set ? keys : new Set(keys || [])
}

export function shouldForceReportSnapshotRefresh(forceRefresh, invalidatedOutputContextKeys, outputContextKey) {
  return Boolean(forceRefresh || outputContextSet(invalidatedOutputContextKeys).has(outputContextKey))
}

export function snapshotCoversReceiptRequest(snapshot, payload, restaurantId) {
  const retainedSnapshotId = snapshot?.snapshot_id || snapshot?.print_snapshot_id
  if (!retainedSnapshotId || snapshot._restaurant_id !== restaurantId || snapshot._request_context_key !== receiptSnapshotContextKey(payload)) return false
  const available = new Set((snapshot.groups || []).map((group) => group.id))
  return (payload.receipt_group_ids || []).every((groupId) => available.has(groupId))
}

export function snapshotIsFreshForOutput(snapshot, payload, restaurantId, invalidatedOutputContextKeys) {
  const invalidated = outputContextSet(invalidatedOutputContextKeys)
  return !invalidated.has(reportOutputContextKey(restaurantId, payload))
    && snapshotCoversReceiptRequest(snapshot, payload, restaurantId)
}

export function reportOutputRequestIsCurrent(request, current) {
  return request.restaurantId === current.restaurantId
    && request.generation === current.generation
    && request.contextKey === current.contextKey
    && request.refreshEpoch === current.refreshEpoch
}

export const normalizedStatus = (value) => String(value || '').trim().toLowerCase()

export const isVerifiedRestore = (store) => (
  store?.state === 'active'
  && ['verified', 'completed', 'succeeded'].includes(normalizedStatus(store.restore_status))
)

export const isRestoreInProgress = (store) => (
  store?.state === 'restoring'
  || (store?.state === 'active' && ['processing', 'pending', 'failed'].includes(normalizedStatus(store.restore_status)))
)

export const isPurgeState = (store) => ['purging', 'purged'].includes(store?.state)

export const trackedRestoreDisappearanceIsVerified = (tracked) => Boolean(
  tracked?.accepted || tracked?.observed_restoring
)

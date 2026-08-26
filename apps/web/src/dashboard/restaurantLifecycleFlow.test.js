import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  isPurgeState,
  isRestoreInProgress,
  isVerifiedRestore,
  trackedRestoreDisappearanceIsVerified,
} from './components/deletedStoreLifecycle.js'

const dangerZone = await readFile(new URL('./components/StoreDangerZone.jsx', import.meta.url), 'utf8')
const recoveryPanel = await readFile(new URL('./components/DeletedStoresPanel.jsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('./AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../shared/api/backOfficeApi.ts', import.meta.url), 'utf8')
const view = await readFile(new URL('../shared/backOfficeView.ts', import.meta.url), 'utf8')

test('danger zone is primary-owner-only and requires an exact name plus password', () => {
  assert.match(dashboard, /restaurant\?\.owner_id === auth\.user\?\.id[\s\S]*settings\.lifecycle/)
  assert.match(dangerZone, /restaurantName === \(restaurant\?\.name \|\| ''\)/)
  assert.match(dangerZone, /disabled=\{submitting \|\| !exactNameMatches \|\| !password \|\| !readiness\?\.ready\}/)
  assert.match(dangerZone, /You can fill this out while it runs/)
  assert.match(dangerZone, /autoComplete="current-password"/)
  assert.match(dangerZone, /const requestKey = idempotencyKeyRef\.current \|\| \(idempotencyKeyRef\.current = crypto\.randomUUID\(\)\)/)
  assert.match(dangerZone, /queryClient\.clear\(\)[\s\S]*navigate\([\s\S]*void auth\.refreshRestaurants\(\)\.catch/)
  assert.doesNotMatch(dangerZone, /await auth\.refreshRestaurants\(\)/)
  assert.match(dangerZone, /window\.sessionStorage\.setItem\(key, JSON\.stringify\(value\)\)/)
  assert.match(dangerZone, /phase: 'requesting'[\s\S]*phase: 'ambiguous'/)
  assert.match(dangerZone, /catch \{[\s\S]*transport failure[\s\S]*if \(current && current\.lifecycle_state !== 'suspending'\) return current/)
  assert.match(dangerZone, /!\['active', 'suspending'\]\.includes\(current\.lifecycle_state\)[\s\S]*leaveStore/)
  assert.match(dangerZone, /window\.setTimeout\(check, DELETION_BACKGROUND_RECONCILE_MS\)/)
  assert.match(dangerZone, /const checkAgain = async \(\)[\s\S]*reconcileDeletion\(3\)[\s\S]*applyReconciledState/)
  assert.match(dangerZone, /result\.state && !\['active', 'suspending'\]\.includes\(result\.state\)[\s\S]*leaveStore/)
  assert.match(dashboard, /queryClient\.prefetchQuery\([\s\S]*queryKeys\.deletionReadiness\(restaurantId\)/)
})

test('recovery stays in account settings and admin recovery requires a support reason', () => {
  assert.match(recoveryPanel, /auth\.accountType === 'admin' && !supportReason\.trim\(\)/)
  assert.match(recoveryPanel, /support_reason: supportReason\.trim\(\) \|\| undefined/)
  assert.match(recoveryPanel, /restoreIdempotencyKeyRef\.current[\s\S]*crypto\.randomUUID\(\)/)
  assert.match(recoveryPanel, /Recovery deadline/)
  assert.match(recoveryPanel, /if \(!deadline\) return 'Unavailable while restoration is running'/)
  assert.match(recoveryPanel, /Open Store/)
  assert.match(recoveryPanel, /Email password setup link/)
  assert.match(recoveryPanel, /window\.sessionStorage\.setItem/)
  assert.match(recoveryPanel, /store\.state === 'recoverable' && normalizedStatus\(store\.restore_status\) === 'failed'/)
  assert.match(recoveryPanel, /trackedRestoreDisappearanceIsVerified\(item\)/)
  assert.doesNotMatch(recoveryPanel, /Object\.values\(tracked\)\.filter\(\(row\) => !currentIds\.has/)
  assert.match(recoveryPanel, /await refreshRestaurants\(\)/)
  assert.match(recoveryPanel, /Replay the[\s\S]*exact request once/)
  assert.match(api, /recoverable_until: string \| null/)
  assert.match(api, /'purging' \| 'purged'/)
  assert.doesNotMatch(recoveryPanel, /disabled=\{!recoverable/)
})

test('restore lifecycle classification never confuses failure or purge with verified recovery', () => {
  assert.equal(isVerifiedRestore({ state: 'active', restore_status: 'verified' }), true)
  assert.equal(isVerifiedRestore({ state: 'active', restore_status: 'processing' }), false)
  assert.equal(isVerifiedRestore({ state: 'recoverable', restore_status: 'verified' }), false)
  assert.equal(isRestoreInProgress({ state: 'restoring', restore_status: 'failed' }), true)
  assert.equal(isRestoreInProgress({ state: 'recoverable', restore_status: 'failed' }), false)
  assert.equal(isPurgeState({ state: 'purging' }), true)
  assert.equal(isPurgeState({ state: 'purged' }), true)
  assert.equal(trackedRestoreDisappearanceIsVerified({}), false)
  assert.equal(trackedRestoreDisappearanceIsVerified({ accepted: true }), true)
  assert.equal(trackedRestoreDisappearanceIsVerified({ observed_restoring: true }), true)
})

test('lifecycle API writes carry idempotency keys and the view capability exists', () => {
  assert.match(api, /headers: \{ 'Idempotency-Key': idempotencyKey \}/)
  assert.match(api, /\/account\/deleted-restaurants\/\$\{deletionId\}\/restore/)
  assert.match(api, /timeoutMs: LIFECYCLE_MUTATION_TIMEOUT_MS/)
  assert.match(recoveryPanel, /status < 500 && status !== 408/)
  assert.match(view, /node\('settings\.lifecycle', 'Store deletion and recovery'\)/)
  assert.match(view, /'settings\.lifecycle': 'standard'/)
})

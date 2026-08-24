import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const dangerZone = await readFile(new URL('./components/StoreDangerZone.jsx', import.meta.url), 'utf8')
const recoveryPanel = await readFile(new URL('./components/DeletedStoresPanel.jsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('./AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../shared/api/backOfficeApi.ts', import.meta.url), 'utf8')
const view = await readFile(new URL('../shared/backOfficeView.ts', import.meta.url), 'utf8')

test('danger zone is primary-owner-only and requires an exact name plus password', () => {
  assert.match(dashboard, /restaurant\?\.owner_id === auth\.user\?\.id[\s\S]*settings\.lifecycle/)
  assert.match(dangerZone, /restaurantName === \(restaurant\?\.name \|\| ''\)/)
  assert.match(dangerZone, /disabled=\{submitting \|\| !exactNameMatches \|\| !password \|\| !readiness\?\.ready\}/)
  assert.match(dangerZone, /autoComplete="current-password"/)
  assert.match(dangerZone, /idempotencyKeyRef\.current \|\| \(idempotencyKeyRef\.current = crypto\.randomUUID\(\)\)/)
  assert.match(dangerZone, /queryClient\.clear\(\)[\s\S]*auth\.refreshRestaurants\(\)/)
})

test('recovery stays in account settings and admin recovery requires a support reason', () => {
  assert.match(recoveryPanel, /auth\.accountType === 'admin' && !supportReason\.trim\(\)/)
  assert.match(recoveryPanel, /support_reason: supportReason\.trim\(\) \|\| undefined/)
  assert.match(recoveryPanel, /restoreIdempotencyKeyRef\.current[\s\S]*crypto\.randomUUID\(\)/)
  assert.match(recoveryPanel, /Recovery deadline/)
  assert.match(recoveryPanel, /Open Store/)
  assert.match(recoveryPanel, /Email password setup link/)
  assert.match(recoveryPanel, /window\.sessionStorage\.setItem/)
  assert.match(recoveryPanel, /row\.state === 'restoring'/)
  assert.match(recoveryPanel, /await refreshRestaurants\(\)/)
})

test('lifecycle API writes carry idempotency keys and the view capability exists', () => {
  assert.match(api, /headers: \{ 'Idempotency-Key': idempotencyKey \}/)
  assert.match(api, /\/account\/deleted-restaurants\/\$\{deletionId\}\/restore/)
  assert.match(view, /node\('settings\.lifecycle', 'Store deletion and recovery'\)/)
  assert.match(view, /'settings\.lifecycle': 'standard'/)
})

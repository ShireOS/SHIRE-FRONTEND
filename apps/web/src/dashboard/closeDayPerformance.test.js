import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  closeDayOperationKey,
  isAlternateCloseDayPreviewKey,
  mergeCloseDaySettings,
} from './closeDayState.js'

const page = readFileSync(new URL('./pages/CloseDayPage.jsx', import.meta.url), 'utf8')
const settings = readFileSync(new URL('./components/CashCloseDaySettings.jsx', import.meta.url), 'utf8')
const posClient = readFileSync(new URL('../shared/api/posClient.ts', import.meta.url), 'utf8')

test('Close Day renders POS readiness while reconciliation is still delayed', () => {
  assert.match(page, /const previewQuery = useQuery\(/)
  assert.match(page, /const reconciliationQuery = useQuery\(/)
  assert.match(page, /enabled: Boolean\(restaurantId && previewBusinessDate && !previewIsClosed\)/)
  assert.match(page, /POS readiness is available\. Independently verifying transaction totals in the background/)
  assert.match(page, /preview && \(isClosed \? \(/)
  assert.doesNotMatch(page, /if \(loading && !preview\) \{\s*return/)
})

test('Close Day lets advisory reconciliation fall through to the audited exception path', () => {
  assert.match(page, /disabled=\{closing \|\| !preview\}/)
  assert.doesNotMatch(page, /if \(reconLoading\) \{[\s\S]*Wait for independent financial verification/)
  assert.match(page, /verificationStatus !== 'verified'[\s\S]*setModal\('verification'\)/)
  assert.match(page, /signal, timeoutMs: CLOSE_DAY_RECONCILIATION_TIMEOUT_MS/)
})

test('Close Day reuses preview settings and requests a bounded compact payload', () => {
  assert.match(page, /initialSettings=\{preview\.closeout_settings\}/)
  assert.match(settings, /if \(initialSettings\) \{\s*setLoading\(false\)/)
  assert.match(settings, /const latestSettings = await fetchWithSupabaseAuth/)
  assert.match(posClient, /new URLSearchParams\(\{ compact: 'true' \}\)/)
  assert.match(posClient, /timeoutMs: 20_000/)
  assert.match(page, /staleTime: CLOSE_DAY_PREVIEW_STALE_MS,\s*\/\/[\s\S]*?retry: 0/)
  assert.equal(page.match(/posCloseDayApi\.preview\(/g)?.length, 1)
})

test('Close Day scopes idempotency and operator state to each numbered close period', () => {
  const first = closeDayOperationKey({
    business_date: '2026-08-22',
    close_period: { sequence: 1, previous_close_id: 'first', opened_at: '10:00' },
  })
  const second = closeDayOperationKey({
    business_date: '2026-08-22',
    close_period: { sequence: 2, previous_close_id: 'second', opened_at: '18:00' },
  })
  assert.notEqual(first, second)
  assert.match(page, /closeOperationKey\.current === operationKey/)
  assert.match(page, /closeOperationKey\.current = operationKey[\s\S]*attemptId\.current = newAttemptId\(\)/)
})

test('settings saves merge into the newest preview without rolling back readiness', () => {
  const current = { open_checks: 3, gross_subtotal: 125, closeout_settings: { blind_drawer_close: true } }
  const merged = mergeCloseDaySettings(current, { blind_drawer_close: false })

  assert.equal(merged.open_checks, 3)
  assert.equal(merged.gross_subtotal, 125)
  assert.deepEqual(merged.closeout_settings, { blind_drawer_close: false })
  assert.match(page, /replacePreview\(\(current\) => mergeCloseDaySettings\(current, settings\)\)/)
})

test('a successful close removes alternate cached previews for the same restaurant', () => {
  const restaurantId = 'restaurant-a'
  assert.equal(isAlternateCloseDayPreviewKey(
    ['close-day-preview', restaurantId, 'active'],
    restaurantId,
    '2026-08-22',
  ), true)
  assert.equal(isAlternateCloseDayPreviewKey(
    ['close-day-preview', restaurantId, '2026-08-22'],
    restaurantId,
    '2026-08-22',
  ), false)
  assert.equal(isAlternateCloseDayPreviewKey(
    ['close-day-preview', 'restaurant-b', 'active'],
    restaurantId,
    '2026-08-22',
  ), false)
  assert.match(page, /queryClient\.removeQueries\(\{[\s\S]*isAlternateCloseDayPreviewKey/)
})

test('compact readiness surfaces every canonical POS close blocker', () => {
  assert.match(page, /preview\?\.paid_unsent_fulfillment_checks/)
  assert.match(page, /preview\?\.cash_accountability\?\.pending_count/)
  assert.match(page, /preview\?\.cash_accountability\?\.unreviewed_paid_out_count/)
  assert.match(page, /label="Fulfillment"/)
  assert.match(page, /label="Cash movements"/)
})

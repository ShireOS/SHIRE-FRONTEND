import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  canNavigateCloseDayStep,
  closeDayCashAllocationError,
  closeDayOperationKey,
  closeDayPrintQueueSignature,
  isAlternateCloseDayPreviewKey,
  mergeCloseDaySettings,
  normalizeCloseDayErrorMessage,
  reconcileClockOutEntryIds,
} from './closeDayState.js'

const page = readFileSync(new URL('./pages/CloseDayPage.jsx', import.meta.url), 'utf8')
const settings = readFileSync(new URL('./components/CashCloseDaySettings.jsx', import.meta.url), 'utf8')
const teamRoster = readFileSync(new URL('./components/CloseDayTeamRoster.jsx', import.meta.url), 'utf8')
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
  assert.match(page, /verificationStatus !== 'verified'[\s\S]*showStepError\('review'/)
  assert.match(page, /Manager reason for verification exception/)
  assert.match(page, /signal, timeoutMs: CLOSE_DAY_RECONCILIATION_TIMEOUT_MS/)
})

test('Close Day uses a four-stage page flow without modal confirmation chaining', () => {
  assert.match(page, /id: 'readiness', label: 'Readiness'/)
  assert.match(page, /id: 'cash', label: 'Cash'/)
  assert.match(page, /id: 'team', label: 'Team'/)
  assert.match(page, /id: 'review', label: 'Review'/)
  assert.match(page, /aria-label="Close Day progress"/)
  assert.match(page, /Nothing is submitted until you select the final Close Day action\./)
  assert.doesNotMatch(page, /modal === '(verification|employees|confirm|recent-activity)'/)
})

test('cash entry uses current and expected drawer wording', () => {
  assert.match(page, /label="Current cash"/)
  assert.match(page, />Expected cash</)
  assert.match(page, /label="Cash left in drawer"/)
  assert.doesNotMatch(page, /label="Float left in drawer"/)
  assert.match(settings, />Current cash</)
  assert.match(settings, />Expected cash</)
  assert.match(settings, />Cash left in drawer</)
  assert.doesNotMatch(settings, />Float left in drawer</)
})

test('cash allocation is validated before the close request', () => {
  assert.equal(closeDayCashAllocationError({
    cashCountStatus: 'counted', countedCash: '100', retainedBank: '101', depositAmount: '0', trackDeposit: false,
  }), 'Cash left in drawer cannot exceed current cash.')
  assert.equal(closeDayCashAllocationError({
    cashCountStatus: 'counted', countedCash: '100', retainedBank: '20', depositAmount: '70', trackDeposit: true,
  }), 'Deposit plus cash left in drawer must equal current cash.')
  assert.equal(closeDayCashAllocationError({
    cashCountStatus: 'counted', countedCash: '100', retainedBank: '20', depositAmount: '80', trackDeposit: true,
  }), '')
  assert.equal(closeDayCashAllocationError({
    cashCountStatus: 'not_counted', countedCash: '', retainedBank: '200', depositAmount: '300', trackDeposit: true,
  }), '')
  assert.match(page, /if \(cashAllocationError\)[\s\S]*showStepError\('cash', cashAllocationError\)/)
})

test('legacy backend cash terms are normalized for the manager', () => {
  assert.equal(
    normalizeCloseDayErrorMessage('Deposit plus float left in the drawer must equal counted cash'),
    'Deposit plus cash left in drawer must equal current cash',
  )
})

test('future Close Day stages stay locked until Continue unlocks them', () => {
  assert.equal(canNavigateCloseDayStep(0, 0), true)
  assert.equal(canNavigateCloseDayStep(1, 0), false)
  assert.equal(canNavigateCloseDayStep(2, 3), true)
  assert.match(page, /disabled=\{!unlocked \|\| closing\}/)
  assert.match(page, /index < furthestStepIndex && stepIsReady\(step\.id\)/)
})

test('required team confirmations remain reachable when presentation is hidden', () => {
  assert.match(page, /const showTeamStep = access\.viewVisible\('close_day\.clockouts'\)[\s\S]*openEmployees\.length > 0[\s\S]*recentActivityRequiresReview/)
  assert.match(page, /currentStep\?\.id === 'team' && showTeamStep/)
})

test('team review uses a fixed dashboard roster grid and preserves automatic clock-out', () => {
  assert.match(page, /<CloseDayTeamRoster/)
  assert.match(teamRoster, /xl:grid-cols-3/)
  assert.match(teamRoster, /Currently clocked in/)
  assert.match(teamRoster, /Last POS activity/)
  assert.match(teamRoster, /LONG_SHIFT_MINUTES/)
  assert.match(teamRoster, /Automatic clock-out is on/)
  assert.match(teamRoster, /will be clocked out automatically when the day closes/)
})

test('required cash entry remains reachable whenever finalization is visible', () => {
  assert.match(page, /const showCashStep = access\.viewVisible\('close_day\.cash'\)[\s\S]*access\.viewVisible\('close_day\.finalize'\)/)
  assert.match(page, /currentStep\?\.id === 'cash' && showCashStep/)
})

test('workflow errors scroll into view beside the active stage', () => {
  assert.match(page, /const showStepError = \(stepId, message\)/)
  assert.match(page, /workflowErrorRef\.current\?\.scrollIntoView/)
  assert.match(page, /ref=\{workflowErrorRef\} role="alert"/)
})

test('the staged flow preserves the canonical audited close payload', () => {
  for (const field of [
    'business_date',
    'close_attempt_id',
    'discard_print_jobs',
    'expected_print_queue_revision',
    'confirm_auto_clock_out',
    'clock_out_mode',
    'clock_out_entry_ids',
    'confirm_recent_activity',
    'expected_recent_activity_at',
    'opening_bank',
    'cash_count_status',
    'counted_cash',
    'confirm_uncounted_cash',
    'uncounted_cash_reason',
    'retained_bank',
    'deposit_amount',
    'variance_reason',
    'verification_status',
    'verification_checks',
    'confirm_verification_exception',
    'verification_reason',
  ]) {
    assert.match(page, new RegExp(`${field}:`))
  }
  assert.match(page, /posCloseDayApi\.close\(restaurantId,/)
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
  assert.match(page, /const operationChanged = closeOperationKey\.current !== operationKey/)
  assert.match(page, /closeOperationKey\.current = operationKey[\s\S]*attemptId\.current = newAttemptId\(\)/)
})

test('print discard approval is scoped to the exact period and queue counts', () => {
  const first = closeDayPrintQueueSignature({
    business_date: '2026-08-22',
    close_period: { sequence: 1, previous_close_id: 'first', opened_at: '10:00' },
    print_queue_revision: 'queue-a',
    pending_print_jobs: 3,
    pending_receipt_print_jobs: 2,
    pending_kitchen_print_jobs: 1,
  })
  const changedQueue = closeDayPrintQueueSignature({
    business_date: '2026-08-22',
    close_period: { sequence: 1, previous_close_id: 'first', opened_at: '10:00' },
    print_queue_revision: 'queue-b',
    pending_print_jobs: 3,
    pending_receipt_print_jobs: 2,
    pending_kitchen_print_jobs: 1,
  })
  const changedPeriod = closeDayPrintQueueSignature({
    business_date: '2026-08-22',
    close_period: { sequence: 2, previous_close_id: 'second', opened_at: '18:00' },
    print_queue_revision: 'queue-a',
    pending_print_jobs: 3,
    pending_receipt_print_jobs: 2,
    pending_kitchen_print_jobs: 1,
  })

  assert.notEqual(first, changedQueue)
  assert.notEqual(first, changedPeriod)
  assert.match(page, /current === printQueueSignature \? current : null/)
  assert.match(page, /discardPrintQueueSignature === currentPrintQueueSignature/)
})

test('recent-activity approval is scoped to the exact last activity timestamp', () => {
  assert.match(page, /confirmedRecentActivityAt === recentActivityAt/)
  assert.match(
    page,
    /expected_recent_activity_at: recentActivityConfirmed \? recentActivityAt : undefined/,
  )
  assert.match(
    page,
    /setConfirmedRecentActivityAt\(event\.target\.checked \? recentActivityAt : null\)/,
  )
})

test('same-period readiness expands default Everyone but preserves a customized subset', () => {
  const openEntries = [{ id: 'new' }, { id: 'selected' }, { id: 'also-open' }]

  assert.deepEqual(
    reconcileClockOutEntryIds(['selected'], openEntries, false, false),
    ['new', 'selected', 'also-open'],
  )
  assert.deepEqual(
    reconcileClockOutEntryIds(['selected', 'now-closed'], openEntries, false, true),
    ['selected'],
  )
  assert.deepEqual(
    reconcileClockOutEntryIds([], openEntries, false, true),
    [],
  )
  assert.deepEqual(
    reconcileClockOutEntryIds(['selected'], openEntries, true, true),
    ['new', 'selected', 'also-open'],
  )
  assert.match(page, /const operationChanged = closeOperationKey\.current !== operationKey/)
  assert.match(page, /reconcileClockOutEntryIds\([\s\S]*operationChanged,[\s\S]*clockOutSelectionCustomized\.current/)
  assert.match(page, /selectAllClockOutEntries[\s\S]*clockOutSelectionCustomized\.current = false/)
  assert.match(page, /selectNoClockOutEntries[\s\S]*clockOutSelectionCustomized\.current = true/)
  assert.match(page, /clock_out_mode:[\s\S]*!clockOutSelectionCustomized\.current[\s\S]*'selected'/)
})

test('historical Close Day review has an explicit freshly loaded route to the active day', () => {
  assert.match(page, /const showActivePreview = useCallback/)
  assert.match(page, /queryKey: closeDayPreviewKey\(restaurantId, null\),\s*exact: true/)
  assert.match(page, />Active day</)
  assert.match(page, />Return to active day</)
  assert.match(page, /selectedBusinessDate && <button[\s\S]{0,300}disabled=\{closing \|\| !restaurantId\}[\s\S]{0,300}Active day<\/button>/)
  assert.match(page, /selectedBusinessDate \? 'Refresh history' : 'Refresh'/)
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

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('./pages/CloseDayPage.jsx', import.meta.url), 'utf8')
const printDecision = readFileSync(new URL('./components/CloseDayPrintDecisionCard.jsx', import.meta.url), 'utf8')
const posClient = readFileSync(new URL('../shared/api/posClient.ts', import.meta.url), 'utf8')

test('queued print work is a reviewed decision instead of an absolute readiness blocker', () => {
  const hardBlockers = page.slice(
    page.indexOf('const hardBlockers = ['),
    page.indexOf('const recentActivityRequiresReview'),
  )

  assert.doesNotMatch(hardBlockers, /pendingPrintJobs/)
  assert.match(page, /<CloseDayPrintDecisionCard/)
  assert.match(printDecision, /Wait and review on POS/)
  assert.match(printDecision, /Discard during Close Day/)
  assert.match(printDecision, /sm:grid-cols-2/)
  assert.match(printDecision, /bg-dash-base\/45/)
  assert.match(page, /pendingPrintJobs > 0 && !discardPrintJobs/)
  assert.match(page, /showStepError\('review', 'Choose whether to keep waiting for print work or explicitly discard it during Close Day\.'/)
})

test('discarding queued print work requires a separate explicit confirmation', () => {
  assert.match(page, /setModal\('discard-print-work'\)/)
  assert.match(page, /title="Discard pending print work\?"/)
  assert.match(page, /Confirm discard on close/)
  assert.match(page, /onClick=\{confirmDiscardPrintWork\}/)
  assert.match(page, /setDiscardPrintQueueSignature\(currentPrintQueueSignature\)/)
})

test('the warning distinguishes server queue records from physical and POS-local work', () => {
  assert.match(printDecision, /Paper already sent to or printed by a printer cannot be recalled\./)
  assert.match(printDecision, /POS-local held or dead-letter work is not included/)
  assert.match(page, /This does not discard POS-local held or dead-letter work\./)
})

test('the canonical close payload carries the confirmed discard choice', () => {
  assert.match(page, /discard_print_jobs: discardPrintJobs/)
  assert.match(page, /expected_print_queue_revision: discardPrintJobs \? preview\.print_queue_revision : undefined/)
  assert.match(page, /discardPrintJobs && !preview\.print_queue_revision/)
  assert.match(posClient, /export interface CloseDayInput \{[\s\S]*discard_print_jobs: boolean/)
  assert.match(posClient, /export interface CloseDayInput \{[\s\S]*expected_print_queue_revision\?: string/)
  assert.match(posClient, /print_queue_revision\?: string/)
  assert.match(posClient, /pending_receipt_print_jobs\?: number/)
  assert.match(posClient, /pending_kitchen_print_jobs\?: number/)
  assert.match(posClient, /expired_print_jobs\?: number/)
  assert.match(page, /queued print job[\s\S]*were discarded and retained in the close audit/)
})

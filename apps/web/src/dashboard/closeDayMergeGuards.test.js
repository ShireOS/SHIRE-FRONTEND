import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8')
const checkLedger = read('./components/CheckLedgerSection.jsx')
const closeDay = read('./pages/CloseDayPage.jsx')

test('check actions retain permission and view-policy guards after merging', () => {
  assert.match(checkLedger, /const canRefund = access\.can\('payments\.refund'\) && access\.viewVisible\('checks\.refunds'\)/)
  assert.match(checkLedger, /const canCloseDay = access\.can\('operations\.close_day'\) && access\.viewVisible\('close_day\.readiness'\)/)
  assert.match(checkLedger, /canCloseDay && detail\.available_actions\?\.includes\('repair_stale_split'\)/)
})

test('close-day safeguards remain inside their configured views', () => {
  assert.match(closeDay, /access\.viewVisible\('close_day\.readiness'\) && <>[\s\S]*overdueCloseAlerts\.length > 0/)
  assert.match(closeDay, /const showCashStep = access\.viewVisible\('close_day\.cash'\)/)
  assert.match(closeDay, /currentStep\?\.id === 'cash' && showCashStep && <section/)
  assert.match(closeDay, /const showTeamStep = access\.viewVisible\('close_day\.clockouts'\)/)
  assert.match(closeDay, /currentStep\?\.id === 'team' && showTeamStep && <section/)
  assert.match(closeDay, /access\.viewVisible\('close_day\.finalize'\) && <section/)
  assert.match(closeDay, /cashCountStatus === 'counted' && <label className="mt-4 block">/)
  assert.doesNotMatch(closeDay, /^(<<<<<<<|=======|>>>>>>>)/m)
})

test('cash-left entry is isolated to prior-retained Close Day policy', () => {
  assert.match(closeDay, /const asksForRetainedBank = openingBankPolicy\?\.source === 'previous_retained'/)
  assert.match(closeDay, /Cash left for next day/)
  assert.match(closeDay, /Calculated deposit/)
  assert.doesNotMatch(closeDay, /CashInput label="Deposit amount"/)
})

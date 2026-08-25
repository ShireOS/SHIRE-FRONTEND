import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canOpenWorkforcePay,
  firstAvailableWorkforcePayHash,
  resolveWorkforcePayHash,
  workforcePayAvailability,
  workforcePayArea,
} from './workforcePayNavigation.js'

test('the consolidated route opens for either existing permission domain', () => {
  assert.equal(canOpenWorkforcePay({ canViewTeam: true, canViewPayroll: false }), true)
  assert.equal(canOpenWorkforcePay({ canViewTeam: false, canViewPayroll: true }), true)
  assert.equal(canOpenWorkforcePay({ canViewTeam: false, canViewPayroll: false }), false)
})

test('section availability never widens team and payroll permissions', () => {
  const teamOnly = workforcePayAvailability({
    canViewTeam: true,
    canViewPayroll: false,
    timecardsVisible: true,
    payrollOverviewVisible: true,
    runsVisible: true,
  })
  assert.deepEqual(teamOnly, {
    overview: false,
    timecards: true,
    runs: false,
    rules: false,
    payroll: false,
  })

  const payrollOnly = workforcePayAvailability({
    canViewTeam: false,
    canViewPayroll: true,
    payrollOverviewVisible: true,
    timecardsVisible: true,
    runsVisible: true,
    rulesVisible: true,
    payrollSetupVisible: true,
  })
  assert.deepEqual(payrollOnly, {
    overview: true,
    timecards: false,
    runs: true,
    rules: true,
    payroll: true,
  })
})

test('legacy payroll hashes map into the consolidated top-level areas', () => {
  assert.equal(workforcePayArea('overview'), 'overview')
  assert.equal(workforcePayArea('timecards'), 'timecards')
  assert.equal(workforcePayArea('run'), 'runs')
  assert.equal(workforcePayArea('rules'), 'settings')
  assert.equal(workforcePayArea('payroll'), 'settings')
})

test('the first available section preserves the existing permission boundaries', () => {
  assert.equal(firstAvailableWorkforcePayHash({ overview: false, timecards: true }), 'timecards')
  assert.equal(firstAvailableWorkforcePayHash({ overview: false, timecards: false, runs: true }), 'run')
  assert.equal(firstAvailableWorkforcePayHash({}), null)
})

test('unavailable and unknown hashes resolve to an accessible section', () => {
  const availability = { overview: true, timecards: false, runs: true, rules: true, payroll: true }
  assert.equal(resolveWorkforcePayHash('payroll', availability), 'payroll')
  assert.equal(resolveWorkforcePayHash('timecards', availability), 'overview')
  assert.equal(resolveWorkforcePayHash('unknown', availability), 'overview')
})

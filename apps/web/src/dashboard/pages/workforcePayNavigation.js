export const WORKFORCE_PAY_HASHES = ['overview', 'timecards', 'run', 'rules', 'payroll']

export function canOpenWorkforcePay({ canViewTeam, canViewPayroll }) {
  return Boolean(canViewTeam || canViewPayroll)
}

export function workforcePayAvailability({
  canViewTeam,
  canViewPayroll,
  payrollOverviewVisible,
  laborOverviewVisible,
  timecardEntriesVisible,
  timecardAdjustmentsVisible,
  timecardTotalsVisible,
  runsVisible,
  rulesVisible,
  payrollSetupVisible,
}) {
  return {
    overview: Boolean(canViewPayroll && (payrollOverviewVisible || laborOverviewVisible)),
    timecards: Boolean(canViewTeam && (
      timecardEntriesVisible
      || timecardAdjustmentsVisible
      || timecardTotalsVisible
    )),
    runs: Boolean(canViewPayroll && runsVisible),
    rules: Boolean(canViewPayroll && rulesVisible),
    payroll: Boolean(canViewPayroll && payrollSetupVisible),
  }
}

export function workforcePayArea(hash) {
  if (hash === 'timecards') return 'timecards'
  if (hash === 'run') return 'runs'
  if (hash === 'rules' || hash === 'payroll') return 'settings'
  return 'overview'
}

export function firstAvailableWorkforcePayHash(availability) {
  if (availability.overview) return 'overview'
  if (availability.timecards) return 'timecards'
  if (availability.runs) return 'run'
  if (availability.rules) return 'rules'
  if (availability.payroll) return 'payroll'
  return null
}

export function resolveWorkforcePayHash(hash, availability) {
  const requested = WORKFORCE_PAY_HASHES.includes(hash) ? hash : null
  if (requested && availability[requested === 'run' ? 'runs' : requested]) return requested
  return firstAvailableWorkforcePayHash(availability)
}

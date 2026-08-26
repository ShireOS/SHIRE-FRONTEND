import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const shell = await readFile(new URL('../shell/DashboardShell.jsx', import.meta.url), 'utf8')
const workspace = await readFile(new URL('../AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const page = await readFile(new URL('./WorkforcePayPage.jsx', import.meta.url), 'utf8')

test('Team keeps its stable entries and exposes one consolidated workforce entry', () => {
  const teamGroup = shell.slice(shell.indexOf("id: 'team-group'"), shell.indexOf("{ id: 'messaging'"))
  assert.match(teamGroup, /label: 'Members'/)
  assert.match(teamGroup, /label: 'Alerts'/)
  assert.match(teamGroup, /label: 'Scheduling'/)
  assert.match(teamGroup, /label: 'Workforce & Pay'/)
  assert.doesNotMatch(teamGroup, /label: 'Time Clock'/)
  assert.doesNotMatch(teamGroup, /label: 'Labor Cost'/)
  assert.doesNotMatch(teamGroup, /label: 'Pay Run'/)
})

test('legacy time-clock and labor-cost routes land in the consolidated workspace', () => {
  assert.match(workspace, /activeTab === 'time-clock'[\s\S]{0,180}tip-pooling#timecards/)
  assert.match(workspace, /activeTab === 'labor-cost'[\s\S]{0,180}tip-pooling#overview/)
})

test('the consolidated page reuses every existing functional page', () => {
  assert.match(page, /<TimeClockPage restaurantId=\{restaurantId\}/)
  assert.match(page, /<TipPoolingPage restaurantId=\{restaurantId\}/)
  assert.match(page, /<LaborCostPage restaurantId=\{restaurantId\}/)
  assert.match(page, /access\.can\('team\.view'\)/)
  assert.match(page, /access\.can\('payroll\.view'\)/)
})

test('an unavailable raw hash redirects before an existing page can render it', () => {
  const redirectIndex = page.indexOf('requestedHash !== activeHash')
  const timeClockIndex = page.indexOf('<TimeClockPage')
  const tipPoolingIndex = page.indexOf('<TipPoolingPage')
  const laborCostIndex = page.indexOf('<LaborCostPage')

  assert.ok(redirectIndex > 0)
  assert.ok(redirectIndex < timeClockIndex)
  assert.ok(redirectIndex < tipPoolingIndex)
  assert.ok(redirectIndex < laborCostIndex)
  assert.match(page, /<Navigate[\s\S]{0,220}replace/)
})

test('fully hidden workforce views retain the self-service recovery action', () => {
  assert.match(page, /backOfficeApi\.updateMyViewPolicy/)
  assert.match(page, /queryKeys\.backOfficeAccess/)
  assert.match(page, /\['nav\.tip-pooling', 'payroll\.overview'\]/)
  assert.match(page, /\['nav\.time-clock', 'time_clock\.entries'\]/)
  assert.match(page, /Object\.fromEntries\(revealCapabilities\.map/)
  assert.match(page, /Show in my view/)
})

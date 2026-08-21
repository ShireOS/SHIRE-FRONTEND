import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dashboardApp = await readFile(new URL('./AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const dashboardShell = await readFile(new URL('./shell/DashboardShell.jsx', import.meta.url), 'utf8')

function between(source, start, end) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`)
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`)
  return source.slice(startIndex, endIndex)
}

test('sidebar intent prefetches only the destination critical path', () => {
  const setupPrefetch = between(dashboardShell, "tabId === 'setup'", "tabId === 'scheduling'")
  assert.match(setupPrefetch, /queryKeys\.setupStatus/)
  assert.equal((setupPrefetch.match(/\bprefetch\(/g) || []).length, 1)

  const menuPrefetch = between(dashboardShell, "tabId === 'menu'", "tabId === 'taxes'")
  assert.match(menuPrefetch, /queryKeys\.menuItems/)
  assert.match(menuPrefetch, /queryKeys\.menuCategories/)
  assert.doesNotMatch(menuPrefetch, /kitchenRouting/)
})

test('sidebar prefetch parameters match each destination initial query', () => {
  assert.match(dashboardShell, /shiftTradeRequests\(restaurantId, 'all'\).*status=all/)
  assert.match(dashboardShell, /guestFeedback\(restaurantId, 'open'\)[\s\S]*status=open/)
})

test('store tab navigation does not restart manager inbox polling', () => {
  assert.match(dashboardShell, /\}, \[context, restaurantId\]\)/)
  assert.doesNotMatch(dashboardShell, /\[context, restaurantId, activeItem\]/)
})

test('supplemental setup reads stay off ordinary operational pages', () => {
  assert.match(
    dashboardApp,
    /needsSupplementalSetupData = activeTab === 'setup' \|\| activeTab === 'team' \|\| activeTab === 'ui'/,
  )
  assert.match(dashboardApp, /!restaurant \|\| !needsSupplementalSetupData/)
})

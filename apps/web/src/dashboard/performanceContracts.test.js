import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dashboardApp = await readFile(new URL('./AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const dashboardShell = await readFile(new URL('./shell/DashboardShell.jsx', import.meta.url), 'utf8')
const menuPanel = await readFile(new URL('./MenuPanel.jsx', import.meta.url), 'utf8')
const menuUi = await readFile(new URL('./components/menuUi.jsx', import.meta.url), 'utf8')
const reportsPage = await readFile(new URL('./reports/RestaurantReportsPage.jsx', import.meta.url), 'utf8')
const queryKeys = await readFile(new URL('../shared/query/queryKeys.ts', import.meta.url), 'utf8')
const workspaceLoaders = await readFile(new URL('./workspaceModuleLoaders.js', import.meta.url), 'utf8')

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

test('heavy workspace pages use shared lazy loaders that sidebar intent can warm', () => {
  for (const loader of ['loadMenuPanel', 'loadReports', 'loadCheckLedger', 'loadTeam', 'loadTipPooling']) {
    assert.match(dashboardApp, new RegExp(`lazy\\(${loader}\\)`))
    assert.match(workspaceLoaders, new RegExp(`export const ${loader} = \\(\\) => import\\(`))
  }
  assert.match(dashboardShell, /preloadWorkspaceModule\(tabId\)/)
  assert.match(dashboardApp, /<Suspense fallback=\{<PageLoading \/>\}>/)
})

test('Menu first paint waits only for items and categories', () => {
  const criticalLoad = between(
    menuPanel,
    "const loaders = [\n      ['items', 'items'",
    "  useEffect(() => {\n    if (!restaurantId || loading)",
  )
  assert.match(criticalLoad, /loadItems\(false\)/)
  assert.match(criticalLoad, /loadCategories\(false\)/)
  for (const offTabLoader of ['loadCombos', 'loadAllergies', 'loadRouting', 'loadPrintingConfig']) {
    assert.doesNotMatch(criticalLoad, new RegExp(offTabLoader))
  }
  assert.match(menuPanel, /const loadersByTab = \{/)
  assert.match(menuPanel, /const contentReady = !loading && !activeTabLoading/)
})

test('Menu supplemental reads use shared restaurant-scoped cache keys', () => {
  for (const key of ['menuItemImages', 'menuCategoryColors', 'menuModifiers', 'menuModifierGroups', 'menuCombos', 'menuAllergies', 'menuSpecials', 'menuPrintingConfig']) {
    assert.match(queryKeys, new RegExp(`${key}: \\(restaurantId`))
    assert.match(menuPanel, new RegExp(`queryKeys\\.${key}\\(restaurantId\\)`))
  }
})

test('Menu thumbnails defer offscreen transfer and decoding', () => {
  assert.match(menuUi, /loading="lazy"/)
  assert.match(menuUi, /decoding="async"/)
  assert.match(menuUi, /width="40"/)
  assert.match(menuUi, /height="40"/)
})

test('POS Reports starts from preferences without blocking on modal-only reads', () => {
  const hydration = between(
    reportsPage,
    'setHydrated(false)',
    '  const loadDimensions = async',
  )
  assert.match(hydration, /queryKeys\.reportPreferences/)
  assert.doesNotMatch(hydration, /reports\/dimensions/)
  assert.doesNotMatch(hydration, /reports\/recipients/)
  assert.match(reportsPage, /const openScopeModal = \(\) => \{[\s\S]*void loadDimensions\(\)/)
  assert.match(reportsPage, /const openSchedulesModal = \(\) => \{[\s\S]*void loadRecipients\(\)/)
})

test('POS Reports caches snapshots and preloads only the active receipt on intent', () => {
  assert.match(reportsPage, /queryKeys\.reportSnapshot\(restaurantId, requestKey\)/)
  assert.match(reportsPage, /queryKeys\.reportReceiptPreview\(restaurantId, receiptPreviewRequestKey\)/)
  assert.match(reportsPage, /onIntent=\{\(\) => \{ void preloadReceiptPreview\(\) \}\}/)
  assert.doesNotMatch(reportsPage, /profiles\.filter\(\(candidate\) => candidate\.built_in\)/)
})

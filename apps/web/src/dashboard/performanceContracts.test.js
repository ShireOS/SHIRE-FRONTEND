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

test('shell badge polls the lightweight manager inbox count', () => {
  assert.match(dashboardShell, /queryKeys\.managerInboxCount/)
  assert.match(dashboardShell, /backOfficeApi\.managerInboxCount/)
  assert.doesNotMatch(dashboardShell, /backOfficeApi\.managerInbox\(restaurantId, 'open'\)/)
  assert.doesNotMatch(dashboardShell, /window\.setInterval/)
  assert.match(dashboardShell, /canViewManagerAlerts[\s\S]*access\.can\('team\.view'\)/)
  assert.match(dashboardShell, /disabled=\{!canViewManagerAlerts\}/)
})

test('supplemental setup reads stay off ordinary operational pages', () => {
  const marker = dashboardApp.indexOf('// setupRefreshKey bumps after setup edits')
  const effectStart = dashboardApp.lastIndexOf('  useEffect(() => {', marker)
  const effectEnd = dashboardApp.indexOf('\n  }, [needsSupplementalSetupData', marker)
  assert.notEqual(marker, -1)
  assert.notEqual(effectStart, -1)
  assert.notEqual(effectEnd, -1)
  const supplementalEffect = dashboardApp.slice(effectStart, effectEnd)

  assert.match(supplementalEffect, /!restaurantId \|\| !restaurant \|\| !needsSupplementalSetupData/)
  assert.match(dashboardApp, /if \(!restaurantId \|\| !restaurant\) return[\s\S]*auth\.switchRestaurant\(restaurantId\)/)
  assert.doesNotMatch(dashboardApp, /auth\.switchRestaurant\(restaurantId\)[\s\S]{0,160}\[auth\.restaurant\.currentRestaurant\?\.id, auth\.switchRestaurant, needsSupplementalSetupData/)
  assert.match(dashboardApp, /\[needsSupplementalSetupData, restaurant, restaurantId, setupRefreshKey\]/)
})

test('heavy workspace pages use shared lazy loaders that sidebar intent can warm', () => {
  for (const loader of ['loadMenuPanel', 'loadReports', 'loadCheckLedger', 'loadTeam', 'loadWorkforcePay']) {
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
  assert.match(reportsPage, /queryKeys\.reportSnapshot\(requestedRestaurantId, requestKey\)/)
  assert.match(reportsPage, /queryKeys\.reportReceiptPreview\(requestedRestaurantId, receiptPreviewRequestBody\)/)
  assert.match(reportsPage, /const receiptPreviewLocalKey = `\$\{restaurantId\}:\$\{receiptPreviewRequestBody\}`/)
  assert.match(reportsPage, /onIntent=\{\(\) => \{ void preloadReceiptPreview\(\) \}\}/)
  assert.doesNotMatch(reportsPage, /profiles\.filter\(\(candidate\) => candidate\.built_in\)/)
})

test('POS Reports bounds interactive snapshot waits and keeps refresh state visible', () => {
  const snapshotRequest = between(
    reportsPage,
    "fetchPosApi(requestedRestaurantId, '/manager/report-hub/snapshot'",
    'effectiveForceRefresh ? 0 : STALE_TIMES.reports',
  )
  assert.match(snapshotRequest, /timeoutMs: REPORT_SNAPSHOT_TIMEOUT_MS/)
  assert.match(reportsPage, /const REPORT_SNAPSHOT_TIMEOUT_MS = 15_000/)
  assert.match(reportsPage, /aria-busy=\{loading\}/)
  assert.match(reportsPage, /Updating POS report…/)
  assert.match(reportsPage, /Loading POS report…/)
  assert.match(reportsPage, /reporting services are running incompatible versions/)
})

test('POS Reports isolates delayed requests when the selected restaurant changes', () => {
  assert.match(dashboardApp, /<RestaurantReportsPage key=\{restaurantId\} restaurantId=\{restaurantId\}/)
  assert.match(reportsPage, /const restaurantGenerationRef = useRef\(0\)/)
  assert.match(reportsPage, /activeRestaurantRef\.current = restaurantId/)
  assert.match(reportsPage, /loadAbortRef\.current\?\.abort\(\)/)
  assert.match(reportsPage, /generation !== restaurantGenerationRef\.current \|\| activeRestaurantRef\.current !== requestedRestaurantId/)
  assert.match(reportsPage, /_restaurant_id: requestedRestaurantId/)
  assert.match(reportsPage, /setModal\(null\)/)
  assert.match(reportsPage, /setReceiptPrintOpen\(false\)/)
  assert.match(reportsPage, /restaurantGenerationRef\.current \+= 1/)
})

test('POS Reports forces both backend cache layers and disables stale-context outputs', () => {
  assert.match(reportsPage, /const effectiveForceRefresh = shouldForceReportSnapshotRefresh/)
  assert.match(reportsPage, /force_refresh: effectiveForceRefresh/)
  assert.match(reportsPage, /effectiveForceRefresh \? 0 : STALE_TIMES\.reports/)
  assert.match(reportsPage, /const snapshotIsCurrent = snapshotIsFreshForOutput/)
  assert.match(reportsPage, /invalidatedOutputContextRef\.current\.add\(requestedOutputContextKey\)/)
  assert.match(reportsPage, /setInvalidatedOutputContextKeys\(\[\.\.\.invalidatedOutputContextRef\.current\]\)/)
  assert.match(reportsPage, /receivedCurrentNetworkResponse && invalidatedOutputContextRef\.current\.delete\(requestedOutputContextKey\)/)
  assert.match(reportsPage, /disabled=\{!snapshotIsCurrent \|\| loading \|\| Boolean\(working\)\}/)
  assert.match(reportsPage, /Downloads and delivery are disabled until the current report refresh succeeds/)
  assert.match(reportsPage, /window\.clearTimeout\(loadDebounceRef\.current\)[\s\S]*load\(true\)/)
  assert.match(reportsPage, /reportOutputRefreshEpochRef\.current \+= 1/)
  assert.match(reportsPage, /if \(!isCurrentOutputRequest\(outputRequest\)\) return[\s\S]*saveBlob/)
})

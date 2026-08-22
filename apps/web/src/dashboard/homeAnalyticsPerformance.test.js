import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync(new URL('./AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const widgetSource = readFileSync(new URL('./components/HomepageWidgets.jsx', import.meta.url), 'utf8')
const shellSource = readFileSync(new URL('./shell/DashboardShell.jsx', import.meta.url), 'utf8')
const storesSource = readFileSync(new URL('./pages/StoresPage.jsx', import.meta.url), 'utf8')

test('restaurant Home uses one preference bootstrap and never persists untouched view state', () => {
  const analyticsSource = appSource.slice(
    appSource.indexOf('function AnalyticsDashboard'),
    appSource.indexOf('const RESTAURANT_HOMEPAGE_WIDGETS'),
  )

  assert.match(analyticsSource, /reports\/homepage\/bootstrap/)
  assert.match(analyticsSource, /queryFn: \(\{ signal \}\).*homepage\/bootstrap`, \{ signal \}\)/)
  assert.doesNotMatch(analyticsSource, /reports\/view-preferences`\)/)
  assert.match(analyticsSource, /!viewTouchedRef\.current/)
  assert.match(analyticsSource, /if \(viewTouchedRef\.current\) \{\s+setViewHydrated\(true\)/)
  assert.match(analyticsSource, /<HomeAnalyticsSkeleton \/>/)
})

test('restaurant Home defers non-critical data and below-fold work', () => {
  assert.match(widgetSource, /splitHomepageWidgetIds\(orderedVisible\)/)
  assert.match(widgetSource, /const secondaryDataQuery = useQuery/)
  assert.match(widgetSource, /const deferredDataQuery = useQuery/)
  assert.match(widgetSource, /widgetGroups\.primary\.join\(','\), JSON\.stringify\(groupedSettings\.primary\)/)
  assert.match(widgetSource, /widgetGroups\.secondary\.join\(','\), JSON\.stringify\(groupedSettings\.secondary\)/)
  assert.match(widgetSource, /widgetGroups\.deferred\.join\(','\), JSON\.stringify\(groupedSettings\.deferred\)/)
  assert.match(widgetSource, /queryFn: \(\{ signal \}\) => loadWidgetData\(widgetGroups\.primary, groupedSettings\.primary, signal\)/)
  assert.match(widgetSource, /queryFn: \(\{ signal \}\) => loadWidgetData\(widgetGroups\.secondary, groupedSettings\.secondary, signal\)/)
  assert.match(widgetSource, /queryFn: \(\{ signal \}\) => loadWidgetData\(widgetGroups\.deferred, groupedSettings\.deferred, signal\)/)
  assert.match(widgetSource, /initialDataUpdatedAt:.*staleTime: STALE_TIMES\.analytics/)
  assert.match(widgetSource, /placeholderData: sameWorkspacePlaceholder/)
  assert.match(widgetSource, /previousQuery\?\.queryKey\?\.\[2\] === restaurantId/)
  assert.match(widgetSource, /scope === 'portfolio' \|\| scopeOpen \|\| Boolean\(settingsId\)/)
  assert.match(widgetSource, /<HomepageWidgetSkeleton key=\{id\}/)
  assert.match(widgetSource, /deferredDataQuery\.isError && deferredDataQuery\.data/)
  assert.match(appSource, /<DeferredCheckLedgerSection restaurantId=\{restaurant\?\.id\} \/>/)
  assert.match(appSource, /<AnalyticsDashboard key=\{restaurantId\} restaurant=\{restaurant\} \/>/)
  assert.match(appSource, /activeTab === 'setup'.*15_000/)
})

test('analytics intent prefetch warms the current Home bootstrap contract', () => {
  const prefetchSource = shellSource.slice(
    shellSource.indexOf("if (tabId === 'reports')"),
    shellSource.indexOf("} else if (tabId === 'setup')"),
  )

  assert.match(prefetchSource, /queryKeys\.homepageBootstrap\(restaurantId\)/)
  assert.match(prefetchSource, /reports\/homepage\/bootstrap/)
  assert.doesNotMatch(prefetchSource, /owner-analytics/)
  assert.match(storesSource, /onMouseEnter=\{onIntent\}/)
  assert.match(storesSource, /onFocus=\{onIntent\}/)
  assert.match(storesSource, /queryKey: queryKeys\.homepageBootstrap\(restaurantId\)/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync(new URL('./AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const widgetSource = readFileSync(new URL('./components/HomepageWidgets.jsx', import.meta.url), 'utf8')
const shellSource = readFileSync(new URL('./shell/DashboardShell.jsx', import.meta.url), 'utf8')

test('restaurant Home uses one preference bootstrap and never persists untouched view state', () => {
  const analyticsSource = appSource.slice(
    appSource.indexOf('function AnalyticsDashboard'),
    appSource.indexOf('const RESTAURANT_HOMEPAGE_WIDGETS'),
  )

  assert.match(analyticsSource, /reports\/homepage\/bootstrap/)
  assert.doesNotMatch(analyticsSource, /reports\/view-preferences`\)/)
  assert.match(analyticsSource, /!viewTouchedRef\.current/)
  assert.match(analyticsSource, /if \(viewTouchedRef\.current\) \{\s+setViewHydrated\(true\)/)
  assert.match(analyticsSource, /<HomeAnalyticsSkeleton \/>/)
})

test('restaurant Home defers non-critical data and below-fold work', () => {
  assert.match(widgetSource, /splitHomepageWidgetIds\(orderedVisible\)/)
  assert.match(widgetSource, /const deferredDataQuery = useQuery/)
  assert.match(widgetSource, /initialDataUpdatedAt:.*staleTime: STALE_TIMES\.analytics/)
  assert.match(widgetSource, /placeholderData: sameWorkspacePlaceholder/)
  assert.match(widgetSource, /previousQuery\?\.queryKey\?\.\[2\] === restaurantId/)
  assert.match(widgetSource, /scope === 'portfolio' \|\| scopeOpen \|\| Boolean\(settingsId\)/)
  assert.match(widgetSource, /<HomepageWidgetSkeleton key=\{id\}/)
  assert.match(appSource, /<DeferredCheckLedgerSection restaurantId=\{restaurant\?\.id\} \/>/)
  assert.match(appSource, /activeTab === 'setup'.*15_000/)
})

test('analytics intent prefetch warms the current Home bootstrap contract', () => {
  const prefetchSource = shellSource.slice(
    shellSource.indexOf("if (tabId === 'reports')"),
    shellSource.indexOf("} else if (tabId === 'setup')"),
  )

  assert.match(prefetchSource, /homepage-bootstrap/)
  assert.match(prefetchSource, /reports\/homepage\/bootstrap/)
  assert.doesNotMatch(prefetchSource, /owner-analytics/)
})

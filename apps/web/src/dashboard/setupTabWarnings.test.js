import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { setupTabWarnings } from './setupTabWarnings.js'

const setupPanelSource = await readFile(new URL('./RestaurantSetupPanel.jsx', import.meta.url), 'utf8')
const dashboardSource = await readFile(new URL('./AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const resellerSource = await readFile(new URL('../reseller/ResellerApp.jsx', import.meta.url), 'utf8')

test('canonical incomplete setup domains mark their matching setup tabs', () => {
  const warnings = setupTabWarnings(
    { basics: ['Browser fallback'] },
    {
      domains: [
        { id: 'basics', complete: true, missing: [] },
        { id: 'legal', complete: false, missing: ['Legal details are required.'] },
        { id: 'hours', complete: false, missing: ['Add all seven days.'] },
      ],
    },
  )

  assert.deepEqual(warnings, {
    legal: ['Legal details are required.'],
    hours: ['Add all seven days.'],
  })
})

test('menu category and menu requirements share the Menu setup tab', () => {
  const warnings = setupTabWarnings({}, {
    domains: [
      { id: 'menu_categories', complete: false, missing: ['Add a category.'] },
      { id: 'menu', complete: false, missing: ['Import or skip the menu.'] },
    ],
  })

  assert.deepEqual(warnings.menu, ['Add a category.', 'Import or skip the menu.'])
})

test('an incomplete domain always produces an indicator even without detail copy', () => {
  const warnings = setupTabWarnings({}, {
    domains: [{ id: 'routing', label: 'Kitchen routing', complete: false, missing: [] }],
  })

  assert.deepEqual(warnings.routing, ['Kitchen routing needs attention.'])
})

test('browser warnings remain available when setup status cannot be loaded', () => {
  const fallback = { employees: ['Employees'] }

  assert.equal(setupTabWarnings(fallback, null), fallback)
  assert.equal(setupTabWarnings(fallback, { complete: false }), fallback)
})

test('owner and reseller Setup editors receive canonical setup status', () => {
  assert.match(dashboardSource, /setupStatus=\{setupStatusQuery\.data\}/)
  assert.match(resellerSource, /setupStatus=\{setupStatus\}/)
  assert.match(setupPanelSource, /tabWarnings\[item\.id\][\s\S]*WarningTriangle/g)
  assert.match(setupPanelSource, />\s*!\s*<\/span>/)
})

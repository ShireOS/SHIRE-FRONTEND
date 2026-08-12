import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')

test('the Menu workspace exposes kitchen routing under the settings permission', () => {
  assert.match(
    source,
    /backOfficeAccess\.can\('settings\.edit'\) \? \[\{ id: 'routing', label: 'Kitchen Routing' \}\]/,
  )
  assert.match(source, /allowedTabs=\{\[section === 'taxes' \? 'taxes_charges' : section\]\}/)
})

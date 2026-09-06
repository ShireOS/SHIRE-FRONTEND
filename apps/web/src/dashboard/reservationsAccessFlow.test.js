import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workspace = await readFile(new URL('./AuthenticatedDashboardApp.jsx', import.meta.url), 'utf8')
const setupPanel = await readFile(new URL('./RestaurantSetupPanel.jsx', import.meta.url), 'utf8')
const guestTextsPage = await readFile(new URL('./pages/GuestTextUpdatesPage.jsx', import.meta.url), 'utf8')

test('an empty reservations tab set never falls through to the AI phone child', () => {
  const hub = workspace.slice(
    workspace.indexOf('function ConfigurationHub'),
    workspace.indexOf('const feedbackStatusOptions'),
  )
  assert.match(hub, /if \(tabs\.length === 0\) return null/)
  assert.match(hub, /const resolvedActive = tabs\.some/)
  assert.ok(hub.indexOf('tabs.length === 0') < hub.indexOf('children(resolvedActive)'))
})

test('the setup tab list itself excludes Danger Zone for non-primary owners', () => {
  assert.match(setupPanel, /const isPrimaryOwner = Boolean\(auth\?\.user\?\.id && restaurant\?\.owner_id === auth\.user\.id\)/)
  assert.match(setupPanel, /SETUP_TABS\.filter\(\(tab\) => tab\.id !== 'lifecycle' \|\| isPrimaryOwner\)/)
})

test('reservation text timing is restaurant-scoped and uses the authorized API', () => {
  assert.match(guestTextsPage, /reservation-notification-settings/)
  assert.match(guestTextsPage, /activeRestaurantRef\.current !== requestRestaurantId/)
  assert.match(guestTextsPage, /confirmationSmsEnabled/)
  assert.match(guestTextsPage, /sameDayReminderHoursBefore/)
  assert.match(guestTextsPage, /readOnly \|\| !draft\.sameDayReminderEnabled/)
})

test('reservations setup presents AI phone first and separates guest texts', () => {
  const reservationsHub = workspace.slice(
    workspace.indexOf("{activeTab === 'reservations' && ("),
    workspace.indexOf("{activeTab === 'ui' && ("),
  )
  assert.ok(reservationsHub.indexOf("id: 'phone'") < reservationsHub.indexOf("id: 'booking'"))
  assert.ok(reservationsHub.indexOf("id: 'booking'") < reservationsHub.indexOf("id: 'texts'"))
  assert.match(reservationsHub, /initialTab=\{backOfficeAccess\.viewVisible\('reservations\.phone'\) \? 'phone'/)
  assert.match(reservationsHub, /<GuestTextUpdatesPage/)
})

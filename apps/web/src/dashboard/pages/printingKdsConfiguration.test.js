import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('./PrintingRoutingPage.jsx', import.meta.url), 'utf8')
const shell = await readFile(new URL('../shell/DashboardShell.jsx', import.meta.url), 'utf8')
const card = await readFile(new URL('../components/printing/KdsConfigurationCard.jsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../../shared/api/kds.js', import.meta.url), 'utf8')
const view = await readFile(new URL('../../shared/backOfficeView.ts', import.meta.url), 'utf8')

test('KDS is a first-class Printing & Routing section and does not load receipt editors', () => {
  assert.match(shell, /section: 'kds', label: 'Kitchen Displays'/)
  assert.match(page, /if \(section === 'kds'\) return <KdsConfigurationCard/)
  assert.ok(page.indexOf("if (section === 'kds')") < page.indexOf('function PrintingRoutingContent'))
})

test('KDS has a stable presentation capability for sidebar and direct-link gating', () => {
  assert.match(view, /node\('printing\.kds', 'Kitchen display configuration'\)/)
  assert.match(view, /'printing-routing#kds': 'printing\.kds'/)
  assert.match(page, /kds: 'printing\.kds'/)
  assert.match(page, /requestedSection === 'kds' && access\.loading/)
  assert.match(page, /access\.viewVisible\(PRINTING_SECTION_CAPABILITIES\[requestedSection\]\)/)
  assert.match(page, /<KdsConfigurationCard key=\{restaurantId\} restaurantId=\{restaurantId\} \/>/)
})

test('Back Office distinguishes station routing from left-side display grouping', () => {
  assert.match(card, /same station-routed item subset/)
  assert.match(card, /Display groups organize the left all-day rail; they never reroute food/)
  assert.match(card, /Slim station rail on the right/)
  assert.match(card, /each row retains check, table and guest/)
  assert.match(card, /Check number is always shown, including in item mode/)
  assert.doesNotMatch(card, /\['check_number', 'Check number'\]/)
})

test('profiles expose item, ticket, split, expo, rush, undo and device assignment controls', () => {
  for (const token of ['display_mode', "value=\"item\"", "value=\"split\"", "role === 'expo'", 'rush_after_seconds', 'undo_window_seconds', 'recently_completed_seconds', 'allow_cancel_from_kds', 'expo_ready_first', 'Profile active', 'device.is_online', 'assignKdsDevice']) {
    assert.ok(card.includes(token), `missing ${token}`)
  }
  assert.match(api, /\/kds\/devices\/assignment/)
  assert.match(card, /Off by default.*canceled items and checks must originate from POS/)
  assert.match(card, /Active tickets/)
  assert.match(card, /KDS online/)
  assert.match(card, /profiles\.filter\(profile => profile\.is_active !== false\)/)
  assert.match(card, /undo_window_seconds: 10/)
  assert.match(card, /recently_completed_seconds: 3600/)
})

test('restaurant switches clear tenant state and fence stale responses', () => {
  for (const token of [
    'restaurantRef.current = String(restaurantId)',
    'loadRequestRef.current += 1',
    'setConfiguration(emptyConfiguration())',
    'setDraft(null)',
    "setReason('')",
    "setMessage('')",
    'setSaving(false)',
    'restaurantRef.current !== requestedRestaurant',
    'generation !== loadRequestRef.current',
  ]) assert.ok(card.includes(token), `missing ${token}`)
  assert.doesNotMatch(card, /return fresh \? normalizeProfile\(fresh\) : current/)
  assert.ok((card.match(/restaurantRef\.current !== requestedRestaurant \|\| generation !== loadRequestRef\.current/g) || []).length >= 3)
})

test('KDS mutations require one reason and carry it through both API contracts', () => {
  assert.match(card, /Manager reason/)
  assert.match(card, /Enter a reason for this KDS configuration change/)
  assert.match(card, /reason: reason\.trim\(\)/)
  assert.match(card, /assignKdsDevice\(restaurantId, deviceId, profileId, reason\.trim\(\)\)/)
  assert.match(api, /assignKdsDevice = \(restaurantId, deviceId, profileId, reason\)/)
  assert.match(api, /platform: 'ios', reason/)
})

test('new profiles require prep topology instead of treating Expo as prep', () => {
  assert.match(card, /const first = stations\.find\(station => station\.station_type !== 'expo'\)/)
  assert.match(card, /if \(!first\) return null/)
  assert.doesNotMatch(card, /\|\| stations\[0\]/)
  assert.match(card, /disabled=\{!canCreateProfile\}/)
  assert.match(card, /Create at least one active non-Expo production station/)
})

test('health and ticket metrics refresh without overwriting an active draft', () => {
  assert.match(card, /setInterval\(\(\) => void load\(controller\.signal, \{ background: true \}\), 15_000\)/)
  assert.match(card, /if \(replaceDraft\) setDraft/)
  assert.doesNotMatch(card, /if \(background\)[\s\S]{0,120}setDraft/)
})

test('background metrics polling cannot overwrite an in-flight KDS mutation', () => {
  assert.match(card, /if \(background && mutationInFlightRef\.current\) return/)
  assert.ok((card.match(/mutationInFlightRef\.current = true/g) || []).length >= 2)
  assert.ok((card.match(/mutationInFlightRef\.current = false/g) || []).length >= 2)
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('./PrintingRoutingPage.jsx', import.meta.url), 'utf8')
const shell = await readFile(new URL('../shell/DashboardShell.jsx', import.meta.url), 'utf8')
const card = await readFile(new URL('../components/printing/KdsConfigurationCard.jsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../../shared/api/kds.js', import.meta.url), 'utf8')

test('KDS is a first-class Printing & Routing section and does not load receipt editors', () => {
  assert.match(shell, /section: 'kds', label: 'Kitchen Displays'/)
  assert.match(page, /if \(section === 'kds'\) return <KdsConfigurationCard/)
  assert.ok(page.indexOf("if (section === 'kds')") < page.indexOf('function PrintingRoutingContent'))
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
})

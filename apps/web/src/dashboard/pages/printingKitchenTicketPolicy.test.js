import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('./PrintingRoutingPage.jsx', import.meta.url), 'utf8')

test('Back Office exposes the hybrid kitchen defaults and legacy choices', () => {
  assert.match(page, /modifier_marker: 'indent', line_density: 'tight'/)
  assert.match(page, /<option value="indent">Indent only \(recommended\)<\/option>/)
  assert.match(page, /<option value="plus">Plus sign<\/option>/)
  assert.match(page, /<option value="tight">Shorter same-width font \+ tight pitch<\/option>/)
  assert.match(page, /<option value="standard">Original tall font \+ spacing<\/option>/)
})

test('Back Office accepts renderer v9 and previews tight density', () => {
  assert.match(page, /'printing-v9'/)
  assert.match(page, /effectiveKitchen\.line_density \?\? 'tight'/)
  assert.match(page, /leading-\[1\.18\]/)
})

test('full-document saves rebase edits onto a fresh canonical read', () => {
  assert.match(page, /function mergeChangedPrintingValues/)
  assert.match(page, /const fresh = await fetchPosApi\(restaurantId, `\/restaurants\/\$\{restaurantId\}\/printing-config`/)
  assert.match(page, /mergeChangedPrintingValues\(loadedConfigRef\.current \|\| fresh, config, fresh\)/)
})

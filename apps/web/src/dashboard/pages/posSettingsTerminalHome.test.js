import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('./PosSettingsPage.jsx', import.meta.url), 'utf8')

test('Back Office configures left and right rails while keeping bottom Time Clock fixed', () => {
  assert.match(source, /bottomClock: true/)
  assert.match(source, /\['left', 'right'\]\.map\(\(placement\)/)
  assert.match(source, /Time Clock stays fixed at the bottom/)
})

test('custom report choices reuse the canonical section catalog and manager minimum', () => {
  assert.match(source, /const REPORT_SECTIONS = \[/)
  assert.match(source, /id: 'custom_report'[\s\S]*?minimumAccess: 'manager_pin'/)
  assert.match(source, /normalized\.reportSection = REPORT_SECTION_IDS\.has/)
})

test('terminal defaults use the existing authorized backend config endpoint', () => {
  assert.match(source, /fetchPosApi\(restaurantId, `\/restaurants\/\$\{restaurantId\}\/terminal-home-config`\)/)
  assert.match(source, /method: 'PUT'/)
  assert.match(source, /body: JSON\.stringify\(config\)/)
})

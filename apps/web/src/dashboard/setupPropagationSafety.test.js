import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const panelSource = fs.readFileSync(new URL('./RestaurantSetupPanel.jsx', import.meta.url), 'utf8')
const scheduledApiSource = fs.readFileSync(new URL('../shared/api/scheduledChanges.ts', import.meta.url), 'utf8')

test('multi-store setup saves use atomic or durable publication instead of the sequential loop', () => {
  assert.match(panelSource, /targetIds\.length > 1 && saveBatch/)
  assert.match(panelSource, /targetIds\.length > 1 && buildCommand/)
  assert.match(panelSource, /applyChangeNow\(\{ label, commands \}\)/)
  assert.match(panelSource, /if \(targetIds\.length > 1\) \{\s*throw new Error/)
  assert.match(scheduledApiSource, /['"]\/scheduled-changes\/apply-now['"]/)
})

test('pricing and canonical reservation settings have safe multi-store commands', () => {
  assert.match(panelSource, /path: `\/restaurants\/\$\{targetId\}\/pricing-policy`/)
  assert.match(panelSource, /fetchReservationsApi\(['"]\/locations\/reservation-settings\/batch['"]/)
  assert.match(panelSource, /saveBatch: async \(targetIds\)/)
})

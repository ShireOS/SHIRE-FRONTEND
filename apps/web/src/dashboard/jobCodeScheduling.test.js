import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { buildScheduledJobCodeUpdate } from './jobCodeScheduling.js'

const panelSource = fs.readFileSync(new URL('./RestaurantSetupPanel.jsx', import.meta.url), 'utf8')

test('scheduled existing-role edits bind path and audit target to one restaurant', () => {
  const payload = { label: 'Bartender', default_hourly_rate: 18 }
  const command = buildScheduledJobCodeUpdate({
    restaurantId: 'restaurant-a',
    jobCodeId: 'job-code-1',
    payload,
  })

  assert.deepEqual(command, {
    method: 'PATCH',
    path: '/restaurants/restaurant-a/job-codes/job-code-1',
    body: payload,
    target_type: 'restaurant',
    target_id: 'restaurant-a',
  })
})

test('scheduled existing-role edits reject a missing restaurant or role', () => {
  assert.throws(
    () => buildScheduledJobCodeUpdate({ restaurantId: '', jobCodeId: 'job-code-1', payload: {} }),
    /Restaurant is required/,
  )
  assert.throws(
    () => buildScheduledJobCodeUpdate({ restaurantId: 'restaurant-a', jobCodeId: '', payload: {} }),
    /existing role is required/,
  )
})

test('the setup editor uses the scoped command builder and has no free targetId reference', () => {
  const saveJobCode = panelSource.slice(
    panelSource.indexOf('const saveJobCode ='),
    panelSource.indexOf('const removeJobCode ='),
  )

  assert.match(saveJobCode, /buildScheduledJobCodeUpdate\(\{/)
  assert.doesNotMatch(saveJobCode, /\$\{targetId\}/)
  assert.match(saveJobCode, /jobCode\.id \? `\/restaurants\/\$\{restaurantId\}\/job-codes/)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { loadRestaurantHomepageBootstrap } from './homepageBootstrap.js'

const restaurantId = 'restaurant-1'

test('homepage bootstrap uses the aggregate endpoint when it is available', async () => {
  const calls = []
  const aggregate = { view_settings: { period: 'week' }, preferences: { catalog: [] } }
  const request = async (path, options) => {
    calls.push({ path, options })
    return aggregate
  }
  const signal = new AbortController().signal

  assert.equal(await loadRestaurantHomepageBootstrap(request, restaurantId, signal), aggregate)
  assert.deepEqual(calls, [{
    path: `/restaurants/${restaurantId}/reports/homepage/bootstrap`,
    options: { signal },
  }])
})

test('homepage bootstrap falls back to the existing reads only when the aggregate route is missing', async () => {
  const calls = []
  const signal = new AbortController().signal
  const request = async (path, options) => {
    calls.push({ path, options })
    if (path.endsWith('/bootstrap')) {
      throw Object.assign(new Error('Not Found'), { status: 404 })
    }
    if (path.endsWith('/view-preferences')) {
      return { settings: { homepage: { period: 'month', scope_dimension: 'none' } } }
    }
    return { catalog: [{ id: 'sales_summary' }], visible_widgets: ['sales_summary'] }
  }

  assert.deepEqual(
    await loadRestaurantHomepageBootstrap(request, restaurantId, signal),
    {
      view_settings: { period: 'month', scope_dimension: 'none' },
      preferences: { catalog: [{ id: 'sales_summary' }], visible_widgets: ['sales_summary'] },
    },
  )
  assert.deepEqual(calls.map(call => call.path), [
    `/restaurants/${restaurantId}/reports/homepage/bootstrap`,
    `/restaurants/${restaurantId}/reports/view-preferences`,
    `/restaurants/${restaurantId}/reports/homepage/preferences`,
  ])
  assert.ok(calls.every(call => call.options?.signal === signal))
})

test('homepage bootstrap preserves non-404 failures', async () => {
  const failure = Object.assign(new Error('Forbidden'), { status: 403 })
  const request = async () => { throw failure }

  await assert.rejects(
    loadRestaurantHomepageBootstrap(request, restaurantId),
    error => error === failure,
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  chunkRestaurantIds,
  combineAnalyticsSummaryQueries,
  validateAnalyticsSummaryPayload,
} from './analyticsSummaryCore.js'

test('restaurant summary IDs are stable, unique, and chunked at fifty', () => {
  const ids = Array.from({ length: 51 }, (_, index) => `restaurant-${String(51 - index).padStart(2, '0')}`)
  ids.push(ids[0])

  const chunks = chunkRestaurantIds(ids)

  assert.equal(chunks.length, 2)
  assert.equal(chunks[0].length, 50)
  assert.equal(chunks[1].length, 1)
  assert.deepEqual(chunks.flat(), [...new Set(ids)].sort())
})

test('restaurant summary validation accepts real zeroes and isolates unavailable restaurants', () => {
  const valid = validateAnalyticsSummaryPayload(
    {
      restaurants: {
        'restaurant-1': { net_sales: 0, order_count: '0', covers: 0, tips: 0 },
        'restaurant-3': { net_sales: null, order_count: 1, covers: 1, tips: 0 },
      },
    },
    ['restaurant-1', 'restaurant-2', 'restaurant-3'],
  )
  assert.deepEqual(valid.restaurants['restaurant-1'], {
    net_sales: 0,
    order_count: 0,
    covers: 0,
    tips: 0,
  })
  assert.deepEqual(valid.unavailableRestaurantIds, ['restaurant-2', 'restaurant-3'])
  assert.equal(valid.restaurants['restaurant-2'], undefined)
  assert.equal(valid.restaurants['restaurant-3'], undefined)
})

test('one omitted restaurant does not discard valid summaries in the same chunk', () => {
  const valid = validateAnalyticsSummaryPayload(
    {
      restaurants: {
        'restaurant-1': { net_sales: 20, order_count: 2, covers: 4, tips: 3 },
      },
    },
    ['restaurant-1', 'restaurant-2'],
  )
  const combined = combineAnalyticsSummaryQueries(
    [['restaurant-1', 'restaurant-2']],
    [{ data: valid, isError: false }],
  )

  assert.equal(combined.restaurantStates['restaurant-1'].status, 'success')
  assert.equal(combined.restaurantStates['restaurant-2'].status, 'error')
  assert.equal(combined.data.restaurants['restaurant-1'].net_sales, 20)
  assert.equal(combined.isError, true)
  assert.match(combined.error.message, /unavailable/)
})

test('cached data remains successful when a background refresh fails', () => {
  const data = { net_sales: 20, order_count: 2, covers: 4, tips: 3 }
  const combined = combineAnalyticsSummaryQueries(
    [['restaurant-1'], ['restaurant-2']],
    [
      { data: { restaurants: { 'restaurant-1': data } }, isError: true, error: new Error('offline') },
      { isError: true, error: new Error('offline') },
    ],
  )

  assert.equal(combined.restaurantStates['restaurant-1'].status, 'success')
  assert.equal(combined.restaurantStates['restaurant-1'].updateFailed, true)
  assert.equal(combined.restaurantStates['restaurant-2'].status, 'error')
  assert.equal(combined.isError, true)
  assert.equal(combined.hasData, true)
})

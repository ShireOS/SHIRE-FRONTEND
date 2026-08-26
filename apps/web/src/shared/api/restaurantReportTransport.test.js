import assert from 'node:assert/strict'
import test from 'node:test'

import {
  RestaurantReportError,
  requestRestaurantReport,
} from './restaurantReportTransport.ts'

function auth(token = 'report-token') {
  return {
    getSession: async () => ({
      data: {
        session: {
          access_token: token,
          expires_at: Math.floor((Date.now() + 10 * 60_000) / 1000),
        },
      },
      error: null,
    }),
    refreshSession: async () => ({ data: { session: null }, error: new Error('unexpected refresh') }),
  }
}

test('sends browser-authenticated JSON directly to Restaurant ML', async () => {
  let request
  const result = await requestRestaurantReport({
    auth: auth(),
    baseUrl: '/ml-api/',
    restaurantId: 'restaurant-1',
    endpoint: '/restaurants/restaurant-1/reports/pos-snapshots',
    method: 'POST',
    body: JSON.stringify({ receipt_group_ids: ['revenue'] }),
    fetchImpl: async (url, options) => {
      request = { url, options }
      return Response.json({ snapshot_id: 'snapshot-1' })
    },
  })

  assert.equal(request.url, '/ml-api/restaurants/restaurant-1/reports/pos-snapshots')
  assert.equal(request.options.headers.get('Authorization'), 'Bearer report-token')
  assert.equal(request.options.headers.get('X-Restaurant-Id'), 'restaurant-1')
  assert.equal(request.options.headers.get('Content-Type'), 'application/json')
  assert.equal(result.snapshot_id, 'snapshot-1')
})

test('returns raw artifact bytes and the unchanged server filename', async () => {
  const result = await requestRestaurantReport({
    auth: auth(),
    baseUrl: '/ml-api',
    restaurantId: 'restaurant-1',
    endpoint: '/restaurants/restaurant-1/reports/pos-snapshots/snapshot-1/artifacts',
    method: 'POST',
    responseType: 'blob',
    fetchImpl: async () => new Response(new Uint8Array([37, 80, 68, 70]), {
      headers: {
        'Content-Type': 'application/pdf',
        'X-Report-Filename': 'golden-fork-long-pos-report.pdf',
      },
    }),
  })

  assert.equal(result.fileName, 'golden-fork-long-pos-report.pdf')
  assert.equal(result.mimeType, 'application/pdf')
  assert.equal(await result.blob.text(), '%PDF')
})

test('preserves typed snapshot-expiry errors so the UI can require Refresh', async () => {
  await assert.rejects(
    requestRestaurantReport({
      auth: auth(),
      baseUrl: '/ml-api',
      restaurantId: 'restaurant-1',
      endpoint: '/restaurants/restaurant-1/reports/pos-snapshots/expired/artifacts',
      method: 'POST',
      fetchImpl: async () => Response.json({
        detail: {
          code: 'report_snapshot_expired',
          message: 'This report snapshot expired. Refresh the report before downloading or sending it.',
        },
      }, { status: 409 }),
    }),
    error => error instanceof RestaurantReportError
      && error.status === 409
      && error.code === 'report_snapshot_expired'
      && error.message.startsWith('This report snapshot expired'),
  )
})

test('restaurant switches retain tenant-specific paths and headers', async () => {
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push([url, options.headers.get('X-Restaurant-Id')])
    return Response.json({ ok: true })
  }

  await Promise.all(['restaurant-a', 'restaurant-b'].map(restaurantId =>
    requestRestaurantReport({
      auth: auth(),
      baseUrl: '/ml-api',
      restaurantId,
      endpoint: `/restaurants/${restaurantId}/reports/pos-snapshots`,
      method: 'POST',
      fetchImpl,
    }),
  ))

  assert.deepEqual(requests.sort(), [
    ['/ml-api/restaurants/restaurant-a/reports/pos-snapshots', 'restaurant-a'],
    ['/ml-api/restaurants/restaurant-b/reports/pos-snapshots', 'restaurant-b'],
  ])
})

test('transport settles as soon as the underlying response resolves', async () => {
  let releaseResponse
  const responseGate = new Promise((resolve) => {
    releaseResponse = resolve
  })
  let settled = false
  const request = requestRestaurantReport({
    auth: auth(),
    baseUrl: '/ml-api',
    restaurantId: 'restaurant-1',
    endpoint: '/restaurants/restaurant-1/reports/pos-snapshots',
    method: 'POST',
    fetchImpl: async () => responseGate,
  })
  request.finally(() => { settled = true })

  await Promise.resolve()
  assert.equal(settled, false)

  releaseResponse(Response.json({ snapshot_id: 'snapshot-1' }))
  assert.deepEqual(await request, { snapshot_id: 'snapshot-1' })
  assert.equal(settled, true)
})

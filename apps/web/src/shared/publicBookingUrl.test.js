import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_PUBLIC_BOOKING_BASE_URL,
  buildPublicBookingUrl,
  resolvePublicBookingBaseUrl,
} from './publicBookingUrl.js'

test('public booking URLs default to the canonical reservations deployment', () => {
  assert.equal(
    buildPublicBookingUrl({ slug: 'shire-temp-bistro', production: true }),
    `${DEFAULT_PUBLIC_BOOKING_BASE_URL}/book/shire-temp-bistro`,
  )
})

test('production booking URLs reject loopback configuration', () => {
  assert.equal(
    resolvePublicBookingBaseUrl('http://localhost:5174', true),
    DEFAULT_PUBLIC_BOOKING_BASE_URL,
  )
  assert.equal(
    resolvePublicBookingBaseUrl('http://127.0.0.1:5174/', true),
    DEFAULT_PUBLIC_BOOKING_BASE_URL,
  )
  assert.equal(
    resolvePublicBookingBaseUrl('http://[::1]:5174/', true),
    DEFAULT_PUBLIC_BOOKING_BASE_URL,
  )
  assert.equal(
    resolvePublicBookingBaseUrl('http://bookings.example.com', true),
    DEFAULT_PUBLIC_BOOKING_BASE_URL,
  )
})

test('API canonical links contribute only their booking path', () => {
  assert.equal(
    buildPublicBookingUrl({
      slug: 'draft-slug',
      canonicalBookingUrl: 'https://old.example.com/book/saved-slug',
      production: true,
    }),
    `${DEFAULT_PUBLIC_BOOKING_BASE_URL}/book/saved-slug`,
  )
})

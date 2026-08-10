import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveReservationsApiBaseUrl } from './reservationsConfig.js'

test('production never falls back to the browser machine localhost', () => {
  assert.equal(resolveReservationsApiBaseUrl(''), '')
})

test('an explicitly configured local development service is accepted', () => {
  assert.equal(
    resolveReservationsApiBaseUrl('http://127.0.0.1:4100/api/v1'),
    'http://127.0.0.1:4100/api/v1',
  )
})

test('configured deployment URL wins and is normalized', () => {
  assert.equal(
    resolveReservationsApiBaseUrl('https://reservations.example.com/api/v1///'),
    'https://reservations.example.com/api/v1',
  )
})

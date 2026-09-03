import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const bookingApp = await readFile(new URL('./PublicBookingApp.tsx', import.meta.url), 'utf8')

test('public booking requires explicit transactional SMS consent and records its source', () => {
  assert.match(bookingApp, /const \[smsConsent, setSmsConsent\] = useState\(false\)/)
  assert.match(bookingApp, /smsTransactionalConsent: true/)
  assert.match(bookingApp, /smsTransactionalConsentSource: 'public_booking_checkbox'/)
  assert.match(bookingApp, /disabled=\{submitting \|\| !selectedTime \|\| !smsConsent\}/)
  assert.match(bookingApp, /checked=\{smsConsent\}/)
})

test('public booking keeps phone normalization while enabling telephone autofill', () => {
  assert.match(bookingApp, /guestPhone: guestPhone\.replace\(\/\\D\/g, ''\)/)
  assert.match(bookingApp, /autoComplete="tel"/)
  assert.match(bookingApp, /inputMode="tel"/)
})

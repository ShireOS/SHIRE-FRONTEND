import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('./PrintingRoutingPage.jsx', import.meta.url), 'utf8')
const permissions = await readFile(new URL('../../shared/permissions.ts', import.meta.url), 'utf8')

test('Back Office exposes the restaurant-wide paid receipt policy under Printing and Routing', () => {
  assert.match(source, /auto_print_after_payment: true/)
  assert.match(source, /Print automatically when payment succeeds/)
  assert.match(source, /payment still completes normally and staff can print/)
  assert.match(source, /change_reason: reason/)
  assert.match(source, /printing configuration audit log/)
})

test('Printing and Routing remains protected by settings edit permission', () => {
  assert.match(permissions, /'printing-routing': 'settings\.edit'/)
})

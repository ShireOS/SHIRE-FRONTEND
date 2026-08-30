import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const rolesSource = fs.readFileSync(new URL('./roles.ts', import.meta.url), 'utf8')
const closeoutSource = fs.readFileSync(new URL('./closeout.ts', import.meta.url), 'utf8')

test('new settings enable assigned bartender No Sale without broadening movement approval', () => {
  assert.match(closeoutSource, /require_manager_for_drawer_open: false/)
  assert.match(rolesSource, /can_open_cash_drawer: elevated \|\| cashier \|\| key === 'bartender'/)
  assert.match(rolesSource, /can_no_sale: elevated \|\| cashier \|\| key === 'bartender'/)
  assert.match(rolesSource, /can_paid_in_out: elevated \|\| cashier/)
  assert.match(rolesSource, /require_manager_pin_for_approval: !elevated/)
})

test('new restaurants carry the finalized retained cash into the next opening bank', () => {
  assert.match(closeoutSource, /opening_bank_source: 'previous_retained'/)
})

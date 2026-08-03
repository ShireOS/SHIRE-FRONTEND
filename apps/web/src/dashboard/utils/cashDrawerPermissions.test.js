import assert from 'node:assert/strict'
import test from 'node:test'
import { cashDrawerRoleSummary } from './cashDrawerPermissions.ts'

const values = (role, policy) => Object.fromEntries(
  cashDrawerRoleSummary(role, policy).map((item) => [item.key, item.value]),
)

test('restaurant manager override wins over a self-authorized cashier role', () => {
  const summary = values(
    { can_open_cash_drawer: true, can_no_sale: true, can_paid_in_out: true, require_manager_pin_for_approval: false },
    { require_manager_for_drawer_open: true, allow_paid_in_out: true, cash_drop_threshold: 250 },
  )

  assert.equal(summary.no_sale, 'manager PIN')
  assert.equal(summary.paid_in, 'manager PIN')
  assert.equal(summary.paid_out, 'manager PIN')
})

test('authorized roles can self-approve safe actions while paid out remains manager-only', () => {
  const summary = values(
    { can_open_cash_drawer: true, can_no_sale: true, can_paid_in_out: true, require_manager_pin_for_approval: false },
    { require_manager_for_drawer_open: false, allow_paid_in_out: true, cash_drop_threshold: 250 },
  )

  assert.equal(summary.no_sale, 'role approved')
  assert.equal(summary.paid_in, 'role approved')
  assert.equal(summary.paid_out, 'manager PIN')
  assert.equal(summary.cash_drop, 'manager at $250.00+')
})

test('roles without cash movement capability cannot initiate ledger movements', () => {
  const summary = values(
    { can_open_cash_drawer: true, can_no_sale: false, can_paid_in_out: false, require_manager_pin_for_approval: false },
    { require_manager_for_drawer_open: false, allow_paid_in_out: true },
  )

  assert.equal(summary.no_sale, 'manager only')
  assert.equal(summary.paid_in, 'not allowed')
  assert.equal(summary.cash_drop, 'not allowed')
})

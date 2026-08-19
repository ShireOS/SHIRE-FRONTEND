import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyDrawerOverrides,
  noSaleOverrideState,
  withNoSaleOverride,
} from './employeePosPermissionOverrides.ts'

test('employee No Sale override is tri-state and preserves unrelated keys', () => {
  assert.equal(noSaleOverrideState({}), 'inherit')
  assert.equal(noSaleOverrideState({ can_no_sale: true, can_open_cash_drawer: true }), 'allow')
  assert.equal(noSaleOverrideState({ can_no_sale: false, can_open_cash_drawer: true }), 'deny')
  assert.deepEqual(
    withNoSaleOverride({ future_permission: true }, 'allow'),
    { future_permission: true, can_no_sale: true, can_open_cash_drawer: true },
  )
  assert.deepEqual(
    withNoSaleOverride({ can_no_sale: false, can_open_cash_drawer: false }, 'inherit'),
    {},
  )
})

test('effective drawer access layers literal employee booleans over the role', () => {
  assert.deepEqual(
    applyDrawerOverrides(
      { can_no_sale: true, can_open_cash_drawer: true, can_discount: true },
      { can_no_sale: false, can_discount: false },
    ),
    { can_no_sale: false, can_open_cash_drawer: true, can_discount: true },
  )
})

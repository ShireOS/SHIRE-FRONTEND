import assert from 'node:assert/strict'
import test from 'node:test'

import { employeeGratuityView, mergeEmployeeGratuityPreviews } from './employeeGratuity.js'

test('employee gratuity view keeps earned, settled, and payroll amounts separate', () => {
  const view = employeeGratuityView({
    totals: {
      total_employee_gratuity: 39.65,
      total_cash_employee_gratuity: 19.09,
      total_non_cash_employee_gratuity: 20.56,
      total_employee_gratuity_payroll_owed: 20.56,
      total_unattributed_employee_gratuity: 0,
    },
    payouts: [
      { staff_id: 'stephany', staff_name: 'Stephany', employee_gratuity: 19.09, cash_employee_gratuity: 19.09, employee_gratuity_payroll_owed: 0 },
      { staff_id: 'maria', staff_name: 'Maria', employee_gratuity: 20.56, non_cash_employee_gratuity: 20.56, employee_gratuity_payroll_owed: 20.56 },
    ],
  })

  assert.equal(view.earned, 39.65)
  assert.equal(view.cashKept, 19.09)
  assert.equal(view.payrollDue, 20.56)
  assert.equal(view.settled, 19.09)
  assert.equal(view.gratuityTipout, 0)
  assert.deepEqual(view.rows.map(row => [row.staff_name, row.payrollDue]), [['Maria', 20.56], ['Stephany', 0]])
})

test('range fallback aggregates employee gratuity fields for each employee', () => {
  const merged = mergeEmployeeGratuityPreviews([
    {
      totals: { total_employee_gratuity: 10, total_employee_gratuity_payroll_owed: 6 },
      payouts: [{ staff_id: 'one', role_key: 'server', staff_name: 'One', employee_gratuity: 10, cash_employee_gratuity: 4, non_cash_employee_gratuity: 6, employee_gratuity_payroll_owed: 6, tipout_pending: 5 }],
    },
    {
      totals: { total_employee_gratuity: 8, total_employee_gratuity_payroll_owed: 5 },
      payouts: [{ staff_id: 'one', role_key: 'server', staff_name: 'One', employee_gratuity: 8, cash_employee_gratuity: 3, non_cash_employee_gratuity: 5, employee_gratuity_payroll_owed: 5, tipout_pending: 7 }],
    },
  ], { start: '2026-08-14', end: '2026-08-15' })

  assert.equal(merged.totals.total_employee_gratuity, 18)
  assert.equal(merged.payouts[0].employee_gratuity, 18)
  assert.equal(merged.payouts[0].cash_employee_gratuity, 7)
  assert.equal(merged.payouts[0].employee_gratuity_payroll_owed, 11)
  assert.equal(merged.payouts[0].tipout_pending, 12)
})

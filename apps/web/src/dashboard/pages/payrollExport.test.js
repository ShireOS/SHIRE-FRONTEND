import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPayrollRows, payrollTotals } from './payrollExport.js'

test('payroll rows do not disguise payroll-owed employee gratuity as voluntary tips', () => {
  const [row] = buildPayrollRows([{
    staff_name: 'Maria',
    hours_worked: 5,
    final_amount: 20.56,
    tips_collected: 0,
    employee_gratuity: 20.56,
    non_cash_employee_gratuity: 20.56,
    employee_gratuity_payroll_owed: 20.56,
  }], () => 10)

  assert.equal(row.voluntary_tips_net, 0)
  assert.equal(row.gratuity_payroll_due, 20.56)
  assert.equal(row.tips_net, 20.56)
  assert.equal(row.gross_pay, 70.56)

  const totals = payrollTotals([row])
  assert.equal(totals.voluntary_tips_net, 0)
  assert.equal(totals.employee_gratuity, 20.56)
  assert.equal(totals.gratuity_payroll_due, 20.56)
})

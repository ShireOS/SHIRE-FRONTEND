import assert from 'node:assert/strict'
import test from 'node:test'

import { managerControlsPayload } from './roles.ts'
import { tipPayrollEntryError } from './tipsPayroll.ts'
import { closeoutSettingsEntryError } from './closeout.ts'
import { checkWorkflowSettingsEntryError } from './checkWorkflow.ts'
import { discountRulesEntryError } from './discounts.ts'

test('manager discount limits reject percentages over one hundred', () => {
  assert.throws(() => managerControlsPayload([{ role_key: 'server', discount_limit_percent: '101' }]), /cannot exceed 100/)
})

test('cash and check workflow amounts reject silent clamping', () => {
  assert.match(closeoutSettingsEntryError({ opening_bank_source: 'fixed', opening_bank_default: '' }), /required/)
  assert.match(closeoutSettingsEntryError({ cash_drop_threshold: '-1' }), /at least 0/)
  assert.match(checkWorkflowSettingsEntryError({ default_hold_minutes: '361' }), /cannot exceed 360/)
  assert.match(checkWorkflowSettingsEntryError({ sent_item_correction_window_minutes: '2.5' }), /whole number/)
})

test('tip and payroll entry rejects invalid percentages and cutoff dates', () => {
  const base = { payroll_period_start_weekday: 0, payroll_semimonthly_cutoff_day: 15 }
  assert.match(tipPayrollEntryError({ ...base, credit_card_fee_percent: '101' }), /cannot exceed 100/)
  assert.match(tipPayrollEntryError({ ...base, payroll_semimonthly_cutoff_day: 30 }), /cannot exceed 27/)
  assert.match(tipPayrollEntryError({ ...base, role_tip_rules: [{ role_key: 'server', tipouts: [{ percent: '120' }] }] }), /cannot exceed 100/)
  assert.match(tipPayrollEntryError({
    ...base,
    role_tip_rules: [{
      role_key: 'server',
      tipouts: [{
        percent: '5',
        headcount: {
          driver_role: 'busser',
          tiers: [{ min_count: 0, max_count: null, allocations: [{ target_role: 'busser', percent: '90' }] }],
        },
      }],
    }],
  }), /exactly 100/)
})

test('discount entry rejects duplicate names and invalid bounds', () => {
  const base = { value_type: 'percent', default_value: '10', min_value: '', max_value: '', is_active: true }
  assert.match(discountRulesEntryError([{ ...base, name: 'Comp' }, { ...base, name: ' comp ' }]), /more than once/)
  assert.match(discountRulesEntryError([{ ...base, name: 'Comp', min_value: '20' }]), /below the minimum/)
})

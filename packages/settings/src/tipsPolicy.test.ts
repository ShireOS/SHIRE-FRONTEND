import assert from 'node:assert/strict'
import test from 'node:test'

import {
  serializeTipRoleRules,
  serializeWeekdayTipoutOverrides,
  tipoutPolicyFingerprint,
  validateTipoutPolicy,
} from './tipsPolicy.ts'

const rule = {
  role_key: 'server',
  pool_points: '1',
  pool_contribution_percent: '100',
  pool_share_percent: '',
  tipout_split_basis: 'weights',
  tipout_split_weights: [
    { staff_id: 'known-busser', weight: '2.5' },
    { staff_id: 'invalid-weight', weight: '0' },
  ],
  tipouts: [{
    target_role: '',
    percent: '20',
    basis: 'tips',
    sales_category: '',
    basis_scope: 'own',
    headcount: {
      driver_role: 'busser',
      tiers: [
        { min_count: 0, max_count: 0, allocations: [{ target_role: '', unallocated: true, percent: '100' }] },
        {
          min_count: 1,
          max_count: null,
          allocations: [
            { target_role: 'busser', unallocated: false, percent: '70' },
            { target_role: 'cook', unallocated: false, percent: '20' },
            { target_role: '', unallocated: true, percent: '10' },
          ],
        },
      ],
    },
  }],
  tipout_percent: '',
  tipout_target_role: '',
  notes: '',
}

test('complete headcount and custom-weight policies survive serialization', () => {
  const serialized = serializeTipRoleRules([rule])[0]

  assert.equal(serialized.tipout_split_basis, 'weights')
  assert.deepEqual(serialized.tipout_split_weights, [{ staff_id: 'known-busser', weight: 2.5 }])
  assert.equal(serialized.tipouts[0].target_role, null)
  assert.deepEqual(serialized.tipouts[0].headcount.tiers[1].allocations, [
    { target_role: 'busser', unallocated: false, percent: 70 },
    { target_role: 'cook', unallocated: false, percent: 20 },
    { target_role: null, unallocated: true, percent: 10 },
  ])
})

test('weekday exceptions serialize as JSON objects without inheriting invalid fields', () => {
  const serialized = serializeWeekdayTipoutOverrides({
    saturday: { mode: 'disabled', role_tip_rules: [rule] },
    sunday: { mode: 'custom', role_tip_rules: [{ ...rule, tipout_split_basis: '' }], category_tip_profiles: [] },
    monday: { mode: 'inherit' },
  })

  assert.deepEqual(serialized.saturday, { mode: 'disabled' })
  assert.equal(serialized.sunday.role_tip_rules[0].tipout_split_basis, 'even')
  assert.equal(Object.hasOwn(serialized, 'monday'), false)
})

test('incomplete rules are rejected instead of disappearing during serialization', () => {
  const errors = validateTipoutPolicy({
    role_tip_rules: [{
      role_key: 'server',
      tipouts: [{ target_role: '', percent: '', basis: 'tips' }],
    }],
  })

  assert.ok(errors.some(message => message.includes('percentage')))
  assert.ok(errors.some(message => message.includes('recipient role')))
})

test('a self-target created by changing the paying role is rejected', () => {
  const errors = validateTipoutPolicy({
    role_tip_rules: [{
      role_key: 'busser',
      tipouts: [{ target_role: 'busser', percent: '2', basis: 'sales' }],
    }],
  })

  assert.ok(errors.some(message => message.includes('same role')))
})

test('a complete fixed-role tipout is valid', () => {
  assert.deepEqual(validateTipoutPolicy({
    role_tip_rules: [{
      role_key: 'server',
      tipouts: [{ target_role: 'busser', percent: '2', basis: 'sales' }],
    }],
  }), [])
})

test('a complete headcount tipout is valid before save', () => {
  assert.deepEqual(validateTipoutPolicy({
    role_tip_rules: [rule],
  }), [])
})

test('headcount allocations that do not total 100 are rejected before save', () => {
  const invalidRule = {
    ...rule,
    tipouts: [{
      ...rule.tipouts[0],
      headcount: {
        ...rule.tipouts[0].headcount,
        tiers: [{
          min_count: 0,
          max_count: null,
          allocations: [{ target_role: 'busser', unallocated: false, percent: '90' }],
        }],
      },
    }],
  }

  const errors = validateTipoutPolicy({ role_tip_rules: [invalidRule] })

  assert.ok(errors.some(message => message.includes('exactly 100%')))
})

test('saved decimal strings have the same policy fingerprint as numeric drafts', () => {
  const draft = {
    role_tip_rules: [{ ...rule, tipouts: [{ target_role: 'busser', percent: 2, basis: 'sales' }] }],
    category_tip_profiles: [],
    weekday_tipout_overrides: { saturday: { mode: 'disabled' } },
  }
  const saved = {
    ...draft,
    role_tip_rules: [{ ...rule, tipouts: [{ target_role: 'busser', percent: '2.0', basis: 'sales' }] }],
  }

  assert.equal(tipoutPolicyFingerprint(saved), tipoutPolicyFingerprint(draft))
})

test('policy serialization keeps nullable percentages null', () => {
  const serialized = serializeTipRoleRules([{
    ...rule,
    pool_points: null,
    pool_contribution_percent: null,
    pool_share_percent: null,
    tipout_percent: null,
  }])[0]

  assert.equal(serialized.pool_points, null)
  assert.equal(serialized.pool_contribution_percent, null)
  assert.equal(serialized.pool_share_percent, null)
  assert.equal(serialized.tipout_percent, null)
})

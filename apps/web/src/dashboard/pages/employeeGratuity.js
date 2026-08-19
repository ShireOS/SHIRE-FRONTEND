const PAYOUT_SUM_FIELDS = [
  'hours_worked',
  'tips_collected',
  'pool_share',
  'tipout_paid',
  'tipout_received',
  'tipout_pending',
  'adjustment',
  'final_amount',
  'sales_total',
  'employee_gratuity',
  'cash_employee_gratuity',
  'non_cash_employee_gratuity',
  'employee_gratuity_payroll_owed',
  'employee_gratuity_settled_now',
  'restaurant_service_charges',
  'unclassified_service_charges',
]

function amount(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function totalOrPayoutSum(preview, totalKey, payoutKey) {
  if (preview?.totals?.[totalKey] != null) return amount(preview.totals[totalKey])
  return (preview?.payouts || []).reduce((sum, payout) => sum + amount(payout?.[payoutKey]), 0)
}

export function mergeEmployeeGratuityPreviews(previews, interval) {
  const byPerson = new Map()
  const totals = {}

  previews.filter(Boolean).forEach((preview) => {
    Object.entries(preview.totals || {}).forEach(([key, value]) => {
      totals[key] = amount(totals[key]) + amount(value)
    })
    ;(preview.payouts || []).forEach((payout) => {
      const key = `${payout.staff_id || payout.staff_name || 'staff'}:${payout.role_key || ''}`
      const row = byPerson.get(key) || { ...payout, id: null }
      if (!byPerson.has(key)) {
        PAYOUT_SUM_FIELDS.forEach((field) => { row[field] = 0 })
      }
      PAYOUT_SUM_FIELDS.forEach((field) => {
        row[field] = amount(row[field]) + amount(payout[field])
      })
      byPerson.set(key, row)
    })
  })

  const first = previews.find(Boolean)
  return {
    mode: first?.mode || 'individual',
    distribution_mode: first?.distribution_mode || first?.mode || 'individual',
    totals,
    payouts: [...byPerson.values()],
    window_start: `${interval.start}T00:00:00`,
    window_end: `${interval.end}T23:59:59`,
    range_fallback: true,
  }
}

export function employeeGratuityView(preview) {
  const rows = (preview?.payouts || []).map((payout) => {
    const earned = amount(payout.employee_gratuity)
    const payrollDue = amount(payout.employee_gratuity_payroll_owed)
    return {
      staff_id: payout.staff_id,
      staff_name: payout.staff_name || 'Unknown employee',
      role_key: payout.role_key || '',
      earned,
      cashKept: amount(payout.cash_employee_gratuity),
      nonCash: amount(payout.non_cash_employee_gratuity),
      payrollDue,
      settled: payout.employee_gratuity_settled_now == null
        ? Math.max(earned - payrollDue, 0)
        : amount(payout.employee_gratuity_settled_now),
      gratuityTipout: 0,
    }
  }).sort((left, right) => right.earned - left.earned || left.staff_name.localeCompare(right.staff_name))

  const earned = totalOrPayoutSum(preview, 'total_employee_gratuity', 'employee_gratuity')
  const payrollDue = totalOrPayoutSum(preview, 'total_employee_gratuity_payroll_owed', 'employee_gratuity_payroll_owed')
  return {
    earned,
    cashKept: totalOrPayoutSum(preview, 'total_cash_employee_gratuity', 'cash_employee_gratuity'),
    nonCash: totalOrPayoutSum(preview, 'total_non_cash_employee_gratuity', 'non_cash_employee_gratuity'),
    payrollDue,
    settled: Math.max(earned - payrollDue, 0),
    unattributed: amount(preview?.totals?.total_unattributed_employee_gratuity),
    gratuityTipout: 0,
    rows,
  }
}

export type CashDrawerRole = {
  can_open_cash_drawer?: boolean
  can_no_sale?: boolean
  can_paid_in_out?: boolean
  require_manager_pin_for_approval?: boolean
}

export type CashDrawerPolicy = {
  require_manager_for_drawer_open?: boolean
  allow_paid_in_out?: boolean
  cash_drop_threshold?: number | string | null
}

export type CashDrawerAccessSummary = {
  key: 'no_sale' | 'paid_in' | 'paid_out' | 'cash_drop'
  label: 'No Sale' | 'Paid In' | 'Paid Out' | 'Cash Drop'
  value: string
}

const enabled = (value: unknown) => value === true

export function cashDrawerRoleSummary(
  role: CashDrawerRole = {},
  policy: CashDrawerPolicy = {},
): CashDrawerAccessSummary[] {
  const managerOverride = policy.require_manager_for_drawer_open !== false
  const roleApproval = enabled(role.require_manager_pin_for_approval)
  const canOpen = enabled(role.can_open_cash_drawer)
  const canNoSale = canOpen && enabled(role.can_no_sale)
  const canMoveCash = canOpen && enabled(role.can_paid_in_out) && policy.allow_paid_in_out === true
  const generalApproval = managerOverride || roleApproval
  const threshold = policy.cash_drop_threshold == null || policy.cash_drop_threshold === ''
    ? null
    : Number(policy.cash_drop_threshold)

  return [
    { key: 'no_sale', label: 'No Sale', value: canNoSale ? (generalApproval ? 'manager PIN' : 'role approved') : 'manager only' },
    { key: 'paid_in', label: 'Paid In', value: canMoveCash ? (generalApproval ? 'manager PIN' : 'role approved') : 'not allowed' },
    { key: 'paid_out', label: 'Paid Out', value: canMoveCash ? 'manager PIN' : 'not allowed' },
    {
      key: 'cash_drop',
      label: 'Cash Drop',
      value: !canMoveCash
        ? 'not allowed'
        : generalApproval || threshold == null || !Number.isFinite(threshold)
          ? 'manager PIN'
          : `manager at $${threshold.toFixed(2)}+`,
    },
  ]
}

// Option lists shared by the setup panel, onboarding steps, and mobile admin
// settings. Object format ({ value, label }) is canonical; mobile's tuple
// pickers derive their shape with optionTuples().

export interface SettingsOption<V extends string = string> {
  value: V
  label: string
}

/** Mobile pickers render [value, label] tuples; derive them, don't fork them. */
export function optionTuples<V extends string>(options: readonly SettingsOption<V>[]): Array<readonly [V, string]> {
  return options.map(option => [option.value, option.label] as const)
}

export function optionValues<V extends string>(options: readonly SettingsOption<V>[]): V[] {
  return options.map(option => option.value)
}

export function isOptionValue<V extends string>(options: readonly SettingsOption<V>[], value: unknown): value is V {
  return options.some(option => option.value === value)
}

// --- Service basics (setup + onboarding TechStackStep + mobile) -------------

export const SERVICE_MODE_OPTIONS = [
  { id: 'dine_in', label: 'Dine-in' },
  { id: 'bar', label: 'Bar service' },
  { id: 'counter_service', label: 'Counter service' },
  { id: 'takeout', label: 'Takeout' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'catering', label: 'Catering' },
] as const

export const GUEST_FLOW_OPTIONS = [
  { id: 'seat_first', label: 'Seat first' },
  { id: 'order_first', label: 'Order first' },
  { id: 'tab_first', label: 'Tab first' },
  { id: 'counter_pay', label: 'Counter pay' },
] as const

export const CAPACITY_OPTIONS = [
  { value: 20, label: 'Small', description: 'Under 30 seats' },
  { value: 50, label: 'Medium', description: '30-60 seats' },
  { value: 80, label: 'Large', description: '60-100 seats' },
  { value: 150, label: 'Very Large', description: '100+ seats' },
] as const

export const DAY_LABELS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const DEFAULT_HOURS = [
  { day_of_week: 0, open_time: '11:00', close_time: '22:00', is_closed: true },
  { day_of_week: 1, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 2, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 3, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 4, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 5, open_time: '11:00', close_time: '23:00', is_closed: false },
  { day_of_week: 6, open_time: '11:00', close_time: '23:00', is_closed: false },
]

/** Half-hour slots for hours pickers: value '13:30', label '1:30 PM'. */
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2)
  const minutes = i % 2 === 0 ? '00' : '30'
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return {
    value: `${hours.toString().padStart(2, '0')}:${minutes}`,
    label: `${displayHours}:${minutes} ${period}`,
  }
})

// --- Taxes & charges --------------------------------------------------------

export const TAX_APPLIES_TO_OPTIONS: readonly SettingsOption<'all' | 'food' | 'beer_wine' | 'liquor' | 'non_alcohol' | 'merchandise'>[] = [
  { value: 'all', label: 'All sales' },
  { value: 'food', label: 'Food' },
  { value: 'beer_wine', label: 'Beer & Wine' },
  { value: 'liquor', label: 'Liquor' },
  { value: 'non_alcohol', label: 'Non-alcohol' },
  { value: 'merchandise', label: 'Merchandise' },
]

export const TAX_APPLIES_TO_VALUES = [
  ...TAX_APPLIES_TO_OPTIONS.map(option => option.value),
  'alcohol',
] as const

/** Preserve an existing generic alcohol scope while nudging new setup toward the split scopes. */
export function taxAppliesToOptions(currentValue?: string): readonly SettingsOption[] {
  return currentValue === 'alcohol'
    ? [...TAX_APPLIES_TO_OPTIONS, { value: 'alcohol', label: 'All alcohol (legacy)' }]
    : TAX_APPLIES_TO_OPTIONS
}

export const CHARGE_APPLIES_TO_OPTIONS: readonly SettingsOption<'all' | 'dine_in' | 'bar' | 'takeout' | 'delivery' | 'catering' | 'large_party'>[] = [
  { value: 'all', label: 'All orders' },
  { value: 'dine_in', label: 'Dine-in' },
  { value: 'bar', label: 'Bar' },
  { value: 'takeout', label: 'Takeout' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'catering', label: 'Catering' },
  { value: 'large_party', label: 'Large party' },
]

// --- Discounts --------------------------------------------------------------

export const DISCOUNT_TYPE_OPTIONS: readonly SettingsOption<'discount' | 'comp' | 'promo' | 'employee_meal' | 'service_recovery'>[] = [
  { value: 'discount', label: 'Discount' },
  { value: 'comp', label: 'Comp' },
  { value: 'promo', label: 'Promo' },
  { value: 'employee_meal', label: 'Employee meal' },
  { value: 'service_recovery', label: 'Service recovery' },
]

export const DISCOUNT_APPLIES_TO_OPTIONS: readonly SettingsOption<'item' | 'check' | 'both'>[] = [
  { value: 'item', label: 'Item' },
  { value: 'check', label: 'Check' },
  { value: 'both', label: 'Both' },
]

export const DISCOUNT_VALUE_TYPE_OPTIONS: readonly SettingsOption<'percent' | 'fixed' | 'open'>[] = [
  { value: 'percent', label: 'Percent %' },
  { value: 'fixed', label: 'Fixed $' },
  // The custom-amount key: the POS shows a keypad instead of a preset tile and
  // staff type the figure, capped by the rule's maximum.
  { value: 'open', label: 'Custom — staff enters amount' },
]

export const DISCOUNT_TAX_BEHAVIOR_OPTIONS: readonly SettingsOption<'reduce_taxable_amount' | 'apply_after_tax' | 'no_tax_impact'>[] = [
  { value: 'reduce_taxable_amount', label: 'Reduce taxable amount' },
  { value: 'apply_after_tax', label: 'Apply after tax' },
  { value: 'no_tax_impact', label: 'No tax impact' },
]

export const DISCOUNT_ROLE_OPTIONS = ['owner', 'manager', 'server', 'bartender', 'cashier', 'host', 'runner', 'busser'] as const

export const DISCOUNT_SERVICE_MODE_OPTIONS: readonly SettingsOption<'dine_in' | 'bar' | 'counter_service' | 'takeout' | 'delivery' | 'catering'>[] = [
  { value: 'dine_in', label: 'Dine-in' },
  { value: 'bar', label: 'Bar' },
  { value: 'counter_service', label: 'Counter' },
  { value: 'takeout', label: 'Takeout' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'catering', label: 'Catering' },
]

// --- Roles & permissions ----------------------------------------------------

export const DEFAULT_ROLE_PERMISSION_OPTIONS = ['owner', 'manager', 'server', 'bartender', 'cashier', 'host', 'runner', 'busser', 'kitchen'] as const

export const MANAGER_PERMISSION_OPTIONS = [
  { key: 'can_refund', label: 'Refunds' },
  { key: 'can_void', label: 'Voids' },
  { key: 'can_comp', label: 'Comps' },
  { key: 'can_discount', label: 'Discounts' },
  { key: 'can_open_cash_drawer', label: 'Open drawer' },
  { key: 'can_no_sale', label: 'No-sale' },
  { key: 'can_paid_in_out', label: 'Paid in/out' },
  { key: 'can_adjust_tips', label: 'Tip edits' },
  { key: 'can_edit_menu', label: 'Menu edits' },
  { key: 'can_edit_employees', label: 'Employee edits' },
  { key: 'can_edit_schedules', label: 'Schedule edits' },
  { key: 'can_view_reports', label: 'Reports' },
  { key: 'can_close_drawer', label: 'Close drawer' },
  { key: 'can_close_day', label: 'Close day' },
  { key: 'can_reopen_business_day', label: 'Reopen business day' },
  { key: 'can_change_payment_settings', label: 'Payment settings' },
  { key: 'can_edit_sent_items_within_window', label: 'Sent corrections in window' },
  { key: 'can_edit_sent_items_after_window', label: 'Sent corrections after window' },
  { key: 'can_unsend_sent_items', label: 'Unsend kitchen items' },
  { key: 'can_edit_paid_check_items', label: 'Edit paid-check items' },
] as const

export const PERMISSION_TIER_OPTIONS: readonly SettingsOption<'owner' | 'manager' | 'waiter' | 'normal' | 'limited'>[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'waiter', label: 'Waiter' },
  { value: 'normal', label: 'Normal' },
  { value: 'limited', label: 'Limited' },
]

// --- Closeout ---------------------------------------------------------------

export const CASH_TRACKING_OPTIONS: readonly SettingsOption<'shared_drawer' | 'per_terminal' | 'per_employee' | 'no_cash'>[] = [
  { value: 'shared_drawer', label: 'Shared drawer' },
  { value: 'per_terminal', label: 'Drawer per terminal' },
  { value: 'per_employee', label: 'Drawer per employee/server bank' },
  { value: 'no_cash', label: 'No cash accepted' },
]

export const CHECKOUT_REPORT_OPTIONS: readonly SettingsOption<'none' | 'print' | 'email' | 'print_and_email'>[] = [
  { value: 'none', label: 'No report' },
  { value: 'print', label: 'Print' },
  { value: 'email', label: 'Email' },
  { value: 'print_and_email', label: 'Print + email' },
]

export const EOD_BATCH_OPTIONS: readonly SettingsOption<'automatic' | 'manual' | 'prompt_manager'>[] = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'manual', label: 'Manual' },
  { value: 'prompt_manager', label: 'Prompt manager' },
]

export const EOD_REPORT_OPTIONS: readonly SettingsOption<'sales_summary' | 'labor_summary' | 'cash_drawer_summary' | 'tip_summary' | 'discounts_voids_refunds' | 'tax_summary'>[] = [
  { value: 'sales_summary', label: 'Sales' },
  { value: 'labor_summary', label: 'Labor' },
  { value: 'cash_drawer_summary', label: 'Cash drawer' },
  { value: 'tip_summary', label: 'Tips' },
  { value: 'discounts_voids_refunds', label: 'Discounts/voids/refunds' },
  { value: 'tax_summary', label: 'Taxes' },
]

// --- Check workflow ---------------------------------------------------------

export const ORDER_FIRE_MODE_OPTIONS: readonly SettingsOption<'manual' | 'immediate' | 'by_course'>[] = [
  { value: 'manual', label: 'Manual fire' },
  { value: 'immediate', label: 'Send immediately' },
  { value: 'by_course', label: 'Course-based' },
]

// --- Tips & payroll ---------------------------------------------------------

export const TIP_DISTRIBUTION_OPTIONS: readonly SettingsOption<'individual' | 'pooled' | 'role_based' | 'sales_based' | 'hours_based' | 'points_based' | 'role_shares'>[] = [
  { value: 'individual', label: 'Individual' },
  { value: 'pooled', label: 'Pooled' },
  { value: 'role_based', label: 'Role-based' },
  { value: 'sales_based', label: 'Sales-based' },
  { value: 'hours_based', label: 'Hours-based' },
  { value: 'points_based', label: 'Point-based' },
  // Pool paid out by declared per-role percentages ("40% bussers / 30% bar").
  { value: 'role_shares', label: 'Role shares' },
]

export const CASH_TIP_OPTIONS: readonly SettingsOption<'not_tracked' | 'declared_by_employee' | 'declared_by_manager' | 'required_checkout'>[] = [
  { value: 'not_tracked', label: 'Not tracked — no declaration' },
  { value: 'declared_by_employee', label: 'Optional — employee may declare' },
  { value: 'declared_by_manager', label: 'Manager declares' },
  { value: 'required_checkout', label: 'Required before checkout' },
]

export const PAYROLL_EXPORT_OPTIONS: readonly SettingsOption<'daily' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'manual'>[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'semimonthly', label: 'Semimonthly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'manual', label: 'Manual' },
]

export const TIP_POOL_RESET_OPTIONS: readonly SettingsOption<'shift' | 'day' | 'pay_period'>[] = [
  { value: 'shift', label: 'Shift' },
  { value: 'day', label: 'Day' },
  { value: 'pay_period', label: 'Pay period' },
]

export const TIPOUT_BASIS_OPTIONS: readonly SettingsOption<'none' | 'sales' | 'tips' | 'hours' | 'points' | 'custom'>[] = [
  { value: 'none', label: 'None' },
  { value: 'sales', label: 'Sales' },
  { value: 'tips', label: 'Tips' },
  { value: 'hours', label: 'Hours' },
  { value: 'points', label: 'Points' },
  { value: 'custom', label: 'Custom' },
]

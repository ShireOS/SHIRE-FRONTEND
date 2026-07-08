import { supabase } from '../../shared/lib/supabase'

// POS role permission matrix (pos_role_permissions). One row per (restaurant, role_key).
// The POS apps hydrate the signed-in staffer's row at PIN validation and gate
// sensitive actions (void / refund / comp / discount / no-sale / drawer) from it.

export const PERMISSION_TOGGLES = [
  { key: 'can_void', label: 'Void items / checks' },
  { key: 'can_refund', label: 'Refund payments' },
  { key: 'can_comp', label: 'Comp items' },
  { key: 'can_discount', label: 'Apply discounts' },
  { key: 'can_no_sale', label: 'No-sale' },
  { key: 'can_open_cash_drawer', label: 'Open cash drawer' },
  { key: 'can_paid_in_out', label: 'Paid in / out' },
  { key: 'can_adjust_tips', label: 'Adjust tips' },
  { key: 'can_close_drawer', label: 'Close drawer' },
  { key: 'can_close_day', label: 'Close day' },
  { key: 'can_change_payment_settings', label: 'Payment settings' },
  { key: 'can_edit_menu', label: 'Edit menu' },
  { key: 'can_edit_employees', label: 'Edit employees' },
  { key: 'can_edit_schedules', label: 'Edit schedules' },
  { key: 'can_view_reports', label: 'View reports' },
]

export async function fetchRolePermissions(restaurantId) {
  const { data, error } = await supabase
    .from('pos_role_permissions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('role_key')
  if (error) throw error
  return data || []
}

export async function updateRolePermission(id, patch) {
  const { error } = await supabase
    .from('pos_role_permissions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

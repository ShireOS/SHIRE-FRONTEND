import { supabase } from '../../shared/lib/supabase'
import { fetchWithSupabaseAuth } from '../../shared/query/fetchWithSupabaseAuth'

// POS role permission matrix (pos_role_permissions). One row per (restaurant, role_key).
// The POS apps hydrate the signed-in staffer's row at PIN validation and gate
// sensitive actions (void / refund / comp / discount / gratuity / no-sale / drawer) from it.

export const PERMISSION_TOGGLES = [
  { key: 'can_void', label: 'Void items / checks' },
  { key: 'can_refund', label: 'Refund payments' },
  { key: 'can_comp', label: 'Comp items' },
  { key: 'can_discount', label: 'Apply discounts' },
  { key: 'can_no_sale', label: 'No-sale' },
  { key: 'can_open_cash_drawer', label: 'Open cash drawer' },
  { key: 'can_paid_in_out', label: 'Paid in / out' },
  { key: 'can_adjust_tips', label: 'Adjust tips' },
  { key: 'can_adjust_gratuity', label: 'Adjust gratuity' },
  { key: 'can_close_drawer', label: 'Close drawer' },
  { key: 'can_close_day', label: 'Close day' },
  { key: 'can_reopen_business_day', label: 'Reopen business day' },
  { key: 'can_change_payment_settings', label: 'Payment settings' },
  { key: 'can_edit_menu', label: 'Edit menu' },
  { key: 'can_edit_employees', label: 'Edit employees' },
  { key: 'can_edit_schedules', label: 'Edit schedules' },
  { key: 'can_view_reports', label: 'View reports' },
  { key: 'can_edit_sent_items_within_window', label: 'Correct own sent items in window' },
  { key: 'can_edit_sent_items_after_window', label: 'Correct sent items after window' },
  { key: 'can_unsend_sent_items', label: 'Unsend sent items' },
  { key: 'can_edit_paid_check_items', label: 'Edit items on paid checks' },
]

export async function fetchRolePermissions(restaurantId) {
  return fetchWithSupabaseAuth(`/restaurants/${restaurantId}/role-permissions`)
}

export async function fetchCashDrawerPolicy(restaurantId) {
  const { data, error } = await supabase
    .from('pos_closeout_settings')
    .select('require_manager_for_drawer_open,allow_paid_in_out,cash_drop_threshold')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  if (error) throw error
  return data || {
    require_manager_for_drawer_open: true,
    allow_paid_in_out: false,
    cash_drop_threshold: null,
  }
}

export async function updateRolePermission(restaurantId, id, patch) {
  return fetchWithSupabaseAuth(`/restaurants/${restaurantId}/role-permissions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

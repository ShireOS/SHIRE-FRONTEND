import { DEFAULT_ROLE_PERMISSION_OPTIONS, PERMISSION_TIER_OPTIONS, isOptionValue } from './options'
import { sanitizeNumber, slugRoleCode } from './helpers'
import type { JobCodeData, JobCodeLike, RolePermissionData } from './types'

export function normalizeJobCodes(rows: unknown): JobCodeData[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row: any, index: number) => ({
      id: row?.id || null,
      code: slugRoleCode(row?.code || row?.label, `role_${index + 1}`),
      label: String(row?.label || row?.code || '').trim(),
      permission_tier: isOptionValue(PERMISSION_TIER_OPTIONS, row?.permission_tier) ? row.permission_tier : 'normal' as const,
      default_hourly_rate: row?.default_hourly_rate == null ? '' : sanitizeNumber(row.default_hourly_rate),
      is_tipped: Boolean(row?.is_tipped),
      tipout_role: row?.tipout_role || '',
      sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : index * 10,
      is_active: row?.is_active !== false,
      assigned_count: Math.max(0, Number.parseInt(String(row?.assigned_count || 0), 10) || 0),
    }))
    .filter(row => row.label && row.is_active)
}

/**
 * Sensible starting permissions for a role. `permissionTier` (from the job
 * code) wins over key-name matching, so a custom-named manager-tier role
 * still starts elevated — this was the TeamStep/ManagerControlsStep behavior
 * and is a superset of the setup panel's key-only version.
 */
export function defaultRolePermission(roleKey: string, permissionTier?: string): RolePermissionData {
  const key = slugRoleCode(roleKey)
  const elevated = permissionTier === 'owner' || permissionTier === 'manager' || key === 'owner' || key === 'manager'
  const cashier = key === 'cashier'
  const service = key === 'server' || key === 'bartender' || key === 'cashier'
  return {
    role_key: key,
    can_refund: elevated || cashier,
    refund_limit: elevated ? '' : cashier ? '25' : '',
    can_void: elevated,
    can_comp: elevated,
    can_discount: elevated || service,
    discount_limit_percent: elevated ? '' : service ? '20' : '',
    can_open_cash_drawer: elevated || cashier || key === 'bartender',
    can_no_sale: elevated || cashier || key === 'bartender',
    can_paid_in_out: elevated || cashier,
    can_adjust_tips: elevated,
    can_adjust_gratuity: elevated,
    can_edit_menu: elevated,
    can_edit_employees: elevated,
    can_edit_schedules: elevated,
    can_view_reports: elevated,
    can_close_drawer: elevated || cashier,
    can_close_day: elevated,
    can_reopen_business_day: key === 'owner',
    can_change_payment_settings: key === 'owner',
    can_edit_sent_items_within_window: elevated || service,
    can_edit_sent_items_after_window: elevated,
    can_unsend_sent_items: elevated || service,
    can_edit_paid_check_items: elevated,
    require_manager_pin_for_approval: !elevated,
  }
}

/** Active job-code keys in order, falling back to the stock role list. */
export function rolePermissionKeys(jobCodes: JobCodeLike[] = []): string[] {
  const seen = new Set<string>()
  const keys: string[] = []
  const sourceRoles = jobCodes.length > 0
    ? jobCodes.filter(code => code.is_active !== false).map(code => code.code)
    : [...DEFAULT_ROLE_PERMISSION_OPTIONS]
  sourceRoles.forEach(raw => {
    const key = slugRoleCode(raw)
    if (!key || seen.has(key)) return
    seen.add(key)
    keys.push(key)
  })
  return keys
}

export function defaultRolePermissions(jobCodes: JobCodeLike[] = []): RolePermissionData[] {
  return rolePermissionKeys(jobCodes).map(key => {
    const jobCode = jobCodes.find(code => slugRoleCode(code.code) === key)
    return defaultRolePermission(key, jobCode?.permission_tier)
  })
}

/**
 * Rows from the API keep any extra columns they carry (the manager-controls
 * upsert preserves back_office_permissions server-side); roles without a row
 * get defaults, and saved roles no longer in the job-code list still surface.
 */
export function normalizeRolePermissions(rows: unknown, jobCodes: JobCodeLike[] = []): RolePermissionData[] {
  const keys = rolePermissionKeys(jobCodes)
  const byRole = new Map<string, RolePermissionData>()
  ;(Array.isArray(rows) ? rows : []).forEach((row: any) => {
    const role = slugRoleCode(row?.role_key)
    const jobCode = jobCodes.find(code => slugRoleCode(code.code) === role)
    byRole.set(role, {
      ...defaultRolePermission(role, jobCode?.permission_tier),
      ...row,
      id: row?.id || null,
      role_key: role,
      refund_limit: row?.refund_limit == null ? '' : sanitizeNumber(row.refund_limit),
      discount_limit_percent: row?.discount_limit_percent == null ? '' : sanitizeNumber(row.discount_limit_percent),
      require_manager_pin_for_approval: row?.require_manager_pin_for_approval !== false,
    })
  })
  const normalized = keys.map(role => {
    const jobCode = jobCodes.find(code => slugRoleCode(code.code) === role)
    return byRole.get(role) || defaultRolePermission(role, jobCode?.permission_tier)
  })
  byRole.forEach((row, role) => {
    if (!keys.includes(role)) normalized.push(row)
  })
  return normalized
}

/** PUT /restaurants/:id/manager-controls body. */
export function managerControlsPayload(rolePermissions: unknown, jobCodes: JobCodeLike[] = []) {
  return {
    role_permissions: normalizeRolePermissions(rolePermissions, jobCodes).map(row => ({
      ...row,
      id: undefined,
      refund_limit: row.refund_limit === '' ? null : Number(row.refund_limit),
      discount_limit_percent: row.discount_limit_percent === '' ? null : Number(row.discount_limit_percent),
    })),
  }
}

// Back-office permission model (two layers):
//   role defaults  -> pos_role_permissions.back_office_permissions (jsonb {key: bool})
//   member diffs   -> restaurant_members.permission_overrides (jsonb, only keys that differ)
// Effective = merge(roleDefaults, overrides); owners implicitly hold every key.
// Canonical key list lives here AND in AGENTS.md "Permission keys registry" —
// keep both in sync when adding keys (standing rule).

export type PermissionMap = Record<string, boolean>

export interface PermissionKeyDef {
  key: string
  label: string
  description: string
}

export interface PermissionGroup {
  id: string
  label: string
  keys: PermissionKeyDef[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'menu',
    label: 'Menu',
    keys: [
      { key: 'menu.view', label: 'View menu', description: 'See menu items, categories and modifiers' },
      { key: 'menu.edit_items', label: 'Edit items & modifiers', description: 'Create, edit and archive menu items' },
      { key: 'menu.edit_prices', label: 'Edit prices', description: 'Change item and modifier prices' },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    keys: [
      { key: 'team.view', label: 'View members', description: 'See the staff list and roles' },
      { key: 'team.edit_employees', label: 'Edit employees & roles', description: 'Add or edit staff, roles and back-office access' },
      { key: 'team.adjust_timeclock', label: 'Adjust time clock', description: 'Fix, create or void clock-in/out punches' },
    ],
  },
  {
    id: 'scheduling',
    label: 'Scheduling',
    keys: [
      { key: 'scheduling.view', label: 'View schedules', description: 'See schedules, availability, requests and coverage rules' },
      { key: 'scheduling.edit', label: 'Edit schedules', description: 'Create, edit, generate and publish schedules and coverage rules' },
    ],
  },
  {
    id: 'payroll',
    label: 'Payroll & Tips',
    keys: [
      { key: 'payroll.view', label: 'View payroll & labor cost', description: 'See pay runs, tips and labor cost' },
      { key: 'payroll.run', label: 'Run / finalize payroll', description: 'Preview and finalize pay runs' },
      { key: 'payroll.adjust_tips', label: 'Adjust tips', description: 'Apply per-person tip adjustments' },
      { key: 'payroll.export', label: 'Export (CSV / PDF)', description: 'Download payroll exports' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports & Settings',
    keys: [
      { key: 'reports.view', label: 'View reports', description: 'See analytics and reports' },
      { key: 'operations.close_day', label: 'Review & close day', description: 'Review close-day exceptions, confirm staff clock-outs and finalize a business day' },
      { key: 'payments.refund', label: 'Issue payment refunds', description: 'Request and monitor processor-backed card refunds' },
      { key: 'settings.edit', label: 'Edit restaurant settings', description: 'Change setup, POS settings and devices' },
      { key: 'devices.manage', label: 'Manage devices & updates', description: 'Configure terminals and control approved POS update rollouts' },
      { key: 'devices.force_sync', label: 'Recover device sync', description: 'Inspect and start an audited sync recovery from Back Office; also requires Manage devices & updates' },
    ],
  },
]

export const PERMISSION_KEYS: string[] = PERMISSION_GROUPS.flatMap((group) =>
  group.keys.map((item) => item.key)
)

export const PERMISSION_PRESETS: { id: string; label: string; permissions: PermissionMap }[] = [
  {
    id: 'manager',
    label: 'Manager',
    // Recovery requires a deliberate grant, including when applying a preset.
    permissions: Object.fromEntries(PERMISSION_KEYS.map((key) => [key, key !== 'devices.force_sync'])),
  },
  {
    id: 'shift_lead',
    label: 'Shift Lead',
    permissions: {
      'menu.view': true,
      'team.view': true,
      'team.adjust_timeclock': true,
      'scheduling.view': true,
      'reports.view': true,
    },
  },
  {
    id: 'view_only',
    label: 'View only',
    permissions: {
      'menu.view': true,
      'team.view': true,
      'scheduling.view': true,
      'payroll.view': true,
      'reports.view': true,
    },
  },
]

export function allPermissions(value: boolean): PermissionMap {
  return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, value]))
}

function hasOwnPermission(permissions: PermissionMap | null | undefined, key: string): boolean {
  return Boolean(permissions && Object.prototype.hasOwnProperty.call(permissions, key))
}

function rawPermission(permissions: PermissionMap | null | undefined, key: string): boolean {
  if (hasOwnPermission(permissions, key)) return permissions?.[key] === true
  if (key === 'devices.manage') return permissions?.['settings.edit'] === true
  if (key === 'scheduling.view') return permissions?.['team.view'] === true
  if (key === 'scheduling.edit') return permissions?.['team.edit_employees'] === true
  return false
}

// Overrides win; only known keys are considered.
export function mergePermissions(roleDefaults: PermissionMap | null | undefined, overrides: PermissionMap | null | undefined): PermissionMap {
  const merged: PermissionMap = {}
  for (const key of PERMISSION_KEYS) {
    if (hasOwnPermission(overrides, key)) {
      merged[key] = overrides?.[key] === true
      continue
    }
    const schedulingLegacyKey = key === 'scheduling.view'
      ? 'team.view'
      : key === 'scheduling.edit'
        ? 'team.edit_employees'
        : null
    if (schedulingLegacyKey && hasOwnPermission(overrides, schedulingLegacyKey)) {
      merged[key] = overrides?.[schedulingLegacyKey] === true
      continue
    }
    if (hasOwnPermission(roleDefaults, key)) {
      merged[key] = roleDefaults?.[key] === true
      continue
    }

    const legacyKey = key === 'devices.manage'
      ? 'settings.edit'
      : key === 'scheduling.view'
        ? 'team.view'
        : key === 'scheduling.edit'
          ? 'team.edit_employees'
          : null
    if (legacyKey && hasOwnPermission(overrides, legacyKey)) {
      merged[key] = overrides?.[legacyKey] === true
    } else if (legacyKey && hasOwnPermission(roleDefaults, legacyKey)) {
      merged[key] = roleDefaults?.[legacyKey] === true
    } else {
      merged[key] = false
    }
  }
  return merged
}

export function can(permissions: PermissionMap | null | undefined, key: string): boolean {
  return rawPermission(permissions, key)
}

export function diffPermissionOverrides(effective: PermissionMap, roleDefaults: PermissionMap | null | undefined): PermissionMap {
  const overrides: PermissionMap = {}
  for (const key of PERMISSION_KEYS) {
    const next = can(effective, key)
    if (next !== can(roleDefaults, key)) overrides[key] = next
  }
  // A settings override can change the inherited device permission even when
  // the device toggle still matches the role. Preserve the requested effective
  // map after applying those overrides, including explicit device denials.
  const inherited = mergePermissions(roleDefaults, overrides)
  for (const key of PERMISSION_KEYS) {
    if (can(inherited, key) !== can(effective, key)) overrides[key] = can(effective, key)
  }
  return overrides
}

// Which permission unlocks each store nav tab. Tabs absent from this map are
// always visible (Home). Owners bypass this entirely.
export const TAB_PERMISSIONS: Record<string, string> = {
  reports: 'reports.view',
  checks: 'reports.view',
  'close-day': 'operations.close_day',
  setup: 'settings.edit',
  'store-information': 'settings.edit',
  marketing: 'settings.edit',
  settings: 'settings.edit',
  integrations: 'settings.edit',
  reservations: 'settings.edit',
  ui: 'settings.edit',
  menu: 'menu.view',
  'menu-workspace': 'menu.view',
  taxes: 'settings.edit',
  feedback: 'reports.view',
  devices: 'devices.manage',
  'device-updates': 'devices.manage',
  'pos-settings': 'settings.edit',
  'printing-routing': 'settings.edit',
  'tip-pooling': 'payroll.view',
  'labor-cost': 'payroll.view',
  team: 'team.view',
  'time-clock': 'team.view',
  scheduling: 'scheduling.view',
  alerts: 'team.view',
  messaging: 'team.view',
  payments: 'settings.edit',
}

export function allowedTabsFor(permissions: PermissionMap | null | undefined, isOwner: boolean, tabIds: string[]): string[] {
  if (isOwner) return tabIds
  return tabIds.filter((id) => {
    const required = TAB_PERMISSIONS[id]
    return !required || can(permissions, required)
  })
}

// Back-office permission model (two layers):
//   role defaults  -> pos_role_permissions.back_office_permissions (jsonb {key: bool})
//   member diffs   -> restaurant_members.permission_overrides (jsonb, only keys that differ)
// Effective = merge(roleDefaults, overrides); owners implicitly hold every key.
// Canonical key list lives here AND in CLAUDE.md "Permission keys registry" —
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
      { key: 'team.view', label: 'View members & schedule', description: 'See the staff list, roles and schedules' },
      { key: 'team.edit_employees', label: 'Edit employees & roles', description: 'Add or edit staff, roles and back-office access' },
      { key: 'team.adjust_timeclock', label: 'Adjust time clock', description: 'Fix, create or void clock-in/out punches' },
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
      { key: 'settings.edit', label: 'Edit restaurant settings', description: 'Change setup, POS settings and devices' },
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
    permissions: Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true])),
  },
  {
    id: 'shift_lead',
    label: 'Shift Lead',
    permissions: {
      'menu.view': true,
      'team.view': true,
      'team.adjust_timeclock': true,
      'reports.view': true,
    },
  },
  {
    id: 'view_only',
    label: 'View only',
    permissions: {
      'menu.view': true,
      'team.view': true,
      'payroll.view': true,
      'reports.view': true,
    },
  },
]

export function allPermissions(value: boolean): PermissionMap {
  return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, value]))
}

// Overrides win; only known keys are considered.
export function mergePermissions(roleDefaults: PermissionMap | null | undefined, overrides: PermissionMap | null | undefined): PermissionMap {
  const merged: PermissionMap = {}
  for (const key of PERMISSION_KEYS) {
    merged[key] = Boolean(
      overrides && key in overrides ? overrides[key] : roleDefaults?.[key]
    )
  }
  return merged
}

export function can(permissions: PermissionMap | null | undefined, key: string): boolean {
  return Boolean(permissions?.[key])
}

// Which permission unlocks each store nav tab. Tabs absent from this map are
// always visible (Home). Owners bypass this entirely.
export const TAB_PERMISSIONS: Record<string, string> = {
  setup: 'settings.edit',
  menu: 'menu.view',
  feedback: 'reports.view',
  devices: 'settings.edit',
  'pos-settings': 'settings.edit',
  'tip-pooling': 'payroll.view',
  'labor-cost': 'payroll.view',
  team: 'team.view',
  'time-clock': 'team.view',
  scheduling: 'team.view',
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

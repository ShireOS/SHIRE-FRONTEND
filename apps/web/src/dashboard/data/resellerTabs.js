// One store-level reseller grant may own several concrete sidebar routes.
// Keep this translation independent of React/Supabase so route guards, shells,
// and tests all share the same contract.
export const RESELLER_TOGGLEABLE_TABS = [
  'devices',
  'setup',
  'menu',
  'feedback',
  'team',
  'scheduling',
  'messaging',
  'payments',
  'close_day',
]

export const DEFAULT_RESELLER_PERMISSIONS = {
  devices: true,
  setup: true,
  menu: true,
  feedback: true,
  team: false,
  scheduling: false,
  messaging: false,
  payments: false,
  close_day: false,
}

const MANDATORY_STORE_TABS = [
  'analytics',
  'reports',
  'checks',
  'labor-cost',
  'tip-pooling',
]

const GRANT_ROUTES = {
  devices: ['devices'],
  setup: ['setup', 'store-information', 'marketing', 'settings', 'integrations', 'ui', 'pos-settings', 'printing-routing'],
  menu: ['menu', 'menu-workspace'],
  feedback: ['feedback'],
  team: ['team', 'time-clock', 'alerts'],
  scheduling: ['scheduling'],
  messaging: ['messaging'],
  payments: ['payments'],
  close_day: ['close-day'],
}

export const normalizeResellerPermissions = (permissions) => ({
  ...DEFAULT_RESELLER_PERMISSIONS,
  ...(permissions && typeof permissions === 'object' ? permissions : {}),
})

export const allowedTabsForResellerPermissions = (permissions) => {
  const normalized = normalizeResellerPermissions(permissions)
  return [...new Set([
    ...MANDATORY_STORE_TABS,
    ...RESELLER_TOGGLEABLE_TABS.flatMap((grant) => (
      normalized[grant] ? GRANT_ROUTES[grant] : []
    )),
  ])]
}

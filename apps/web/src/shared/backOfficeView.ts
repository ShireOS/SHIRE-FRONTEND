export type BackOfficeViewLevel = 'simple' | 'medium' | 'advanced'
export type BackOfficeViewMode = 'hidden' | 'summary' | 'standard' | 'full'

export interface BackOfficeViewPolicy {
  schema_version: 1
  base: BackOfficeViewLevel
  overrides: Record<string, BackOfficeViewMode>
}

export interface BackOfficeViewAssignment {
  policy: BackOfficeViewPolicy
  template_id?: string | null
  template_version?: number | null
  configured_by_user_id?: string | null
  configured_by_name?: string | null
  configured_source?: string | null
  updated_at?: string | null
}

export interface ViewCapability {
  id: string
  label: string
  description?: string
  children?: ViewCapability[]
}

export const VIEW_LEVELS: { id: BackOfficeViewLevel; label: string; description: string }[] = [
  { id: 'simple', label: 'Simple', description: 'Critical daily operations and clear summaries.' },
  { id: 'medium', label: 'Medium', description: 'Routine management and common configuration.' },
  { id: 'advanced', label: 'Advanced', description: 'Every authorized Back Office control.' },
]

export const VIEW_MODES: { id: BackOfficeViewMode; label: string }[] = [
  { id: 'hidden', label: 'Hidden' },
  { id: 'summary', label: 'Summary' },
  { id: 'standard', label: 'Standard' },
  { id: 'full', label: 'Full' },
]

const node = (id: string, label: string, children?: ViewCapability[]): ViewCapability => ({ id, label, children })

export const BACK_OFFICE_VIEW_CATALOG: ViewCapability[] = [
  node('nav.analytics', 'Home', [
    node('home.analytics', 'Sales and operating overview'),
    node('home.widgets', 'Custom analytics widgets'),
    node('home.discount_review', 'Discount and risk review'),
    node('home.check_ledger', 'Recent checks'),
  ]),
  node('nav.reports', 'POS Reports', [
    node('reports.viewer', 'Report viewer'),
    node('reports.scope', 'Employee, section and device scopes'),
    node('reports.exports', 'Download, email and print'),
    node('reports.profiles', 'Report profile editor'),
    node('reports.schedules', 'Email schedules'),
    node('reports.receipt_template', 'Server receipt template'),
    node('reports.activity', 'Detailed activity and risk reports'),
  ]),
  node('nav.checks', 'Checks', [
    node('checks.active', 'Active and closed checks'),
    node('checks.history', 'Full history'),
    node('checks.activity', 'Check activity log'),
    node('checks.refunds', 'Refund workflow'),
  ]),
  node('nav.close-day', 'Close Day', [
    node('close_day.readiness', 'Readiness and exceptions'),
    node('close_day.cash', 'Cash reconciliation'),
    node('close_day.clockouts', 'Employee clock-out handling'),
    node('close_day.finalize', 'Finalize business day'),
  ]),
  node('nav.store-information', 'Store Information', [
    node('store.basics', 'Name, address and contact'),
    node('store.goals', 'Goals and operating profile'),
  ]),
  node('nav.marketing', 'Marketing', [node('marketing.branding', 'POS branding')]),
  node('nav.settings', 'Store Settings', [
    node('settings.legal', 'Business and legal'),
    node('settings.payments', 'Payments and payouts'),
    node('settings.pricing', 'Pricing policy'),
    node('settings.taxes', 'Tax rates and assignments'),
    node('settings.charges', 'Service charges and auto-gratuity'),
    node('settings.closeout', 'Cash and closeout policy'),
    node('settings.check_workflow', 'Check workflow'),
    node('settings.hours', 'Operating hours'),
    node('settings.lifecycle', 'Store deletion and recovery'),
  ]),
  node('nav.integrations', 'Integrations', [
    node('integrations.service_model', 'Tools and service model'),
    node('integrations.providers', 'Provider connections'),
  ]),
  node('nav.reservations', 'Reservations', [
    node('reservations.booking', 'Booking page and timing'),
    node('reservations.phone', 'AI phone'),
  ]),
  node('nav.ui', 'UI Editor', [
    node('ui.appearance', 'Application appearance'),
    node('ui.sections', 'Restaurant sections'),
    node('ui.floor_plan', 'Floor plan'),
  ]),
  node('nav.menu', 'Menu', [
    node('menu.items', 'Items'),
    node('menu.categories', 'Categories'),
    node('menu.combos', 'Combos'),
    node('menu.modifiers', 'Modifiers and questions'),
    node('menu.allergies', 'Allergy controls'),
    node('menu.pricing', 'Pricing and allocations'),
    node('menu.availability', 'Availability and specials'),
    node('menu.discounts', 'Discounts and comps'),
    node('menu.routing', 'Kitchen routing'),
  ]),
  node('nav.menu-workspace', 'POS Menus', [
    node('pos_menu.navigation', 'Navigation modes and departments'),
    node('pos_menu.quick_menu', 'Quick Menu'),
    node('pos_menu.fast_bar', 'Fast Bar and department ranking'),
    node('pos_menu.bartender_defaults', 'Bartender home defaults'),
  ]),
  node('nav.feedback', 'Complaints', [node('feedback.inbox', 'Guest complaint inbox')]),
  node('nav.devices', 'Devices', [
    node('devices.health', 'Device and printer health'),
    node('devices.pairing', 'Pair and replace terminals'),
    node('devices.assignments', 'Receipt printer assignments'),
    node('devices.failover', 'Printer outage protection'),
    node('devices.sessions', 'Session and auto-lock policy'),
    node('devices.network', 'Network printer endpoints'),
    node('devices.hardware', 'Cash-drawer and hardware transport'),
    node('devices.print_groups', 'Print groups and category routing'),
  ]),
  node('nav.device-updates', 'Device Updates', [
    node('device_updates.fleet', 'Fleet update status'),
    node('device_updates.rollouts', 'Create and cancel rollouts'),
    node('device_updates.releases', 'Approved release library'),
    node('device_updates.policy', 'Restaurant update policy'),
    node('device_updates.audit', 'Update audit trail'),
  ]),
  node('nav.pos-settings', 'POS Settings', [
    node('pos_settings.reasons', 'Reason presets'),
    node('pos_settings.approvals', 'Remote manager approval'),
    node('pos_settings.terminal_home', 'Terminal home designer'),
  ]),
  node('nav.printing-routing', 'Printing & Routing', [
    node('printing.overview', 'Printing overview and recovery'),
    node('printing.routing', 'Production workflow and routing'),
    node('printing.receipts', 'Receipt and ticket design'),
    node('printing.ticket_layout', 'Advanced ticket layout'),
  ]),
  node('nav.team', 'Team Members', [
    node('team.positions', 'Positions and default pay'),
    node('team.employees', 'Employees, jobs, pay and PINs'),
    node('team.access', 'Back Office users and invitations'),
    node('team.permissions', 'Role and member permissions'),
    node('team.manager_controls', 'Manager controls'),
  ]),
  node('nav.time-clock', 'Time Clock', [
    node('time_clock.entries', 'Clock entries'),
    node('time_clock.adjustments', 'Manager adjustments'),
    node('time_clock.totals', 'Labor totals'),
  ]),
  node('nav.alerts', 'Alerts', [node('alerts.inbox', 'Manager action inbox')]),
  node('nav.labor-cost', 'Labor Cost', [node('labor.overview', 'Labor cost and breakdowns')]),
  node('nav.tip-pooling', 'Payroll & Tips', [
    node('payroll.overview', 'Payroll and tip overview'),
    node('payroll.runs', 'Pay runs'),
    node('payroll.rules', 'Tip and tipout rules'),
    node('payroll.advanced_rules', 'Weekday, category and item overrides'),
    node('payroll.setup', 'Payroll setup'),
    node('payroll.exceptions', 'Tipout exception handling'),
  ]),
  node('nav.scheduling', 'Scheduling', [
    node('scheduling.calendar', 'Calendar builder'),
    node('scheduling.approvals', 'Approvals and requests'),
    node('scheduling.coverage', 'Coverage requirements'),
    node('scheduling.optimization', 'Optimization and diagnostic controls'),
  ]),
  node('nav.messaging', 'Messaging', [
    node('messaging.chats', 'Employee chats'),
    node('messaging.announcements', 'Announcements'),
  ]),
  node('nav.payments', 'Payments / Plan', [node('plan.billing', 'Billing and plan')]),
]

export const TAB_VIEW_CAPABILITIES: Record<string, string> = {
  analytics: 'nav.analytics', reports: 'nav.reports', checks: 'nav.checks',
  'close-day': 'nav.close-day', 'store-information': 'nav.store-information',
  marketing: 'nav.marketing', settings: 'nav.settings', integrations: 'nav.integrations',
  reservations: 'nav.reservations',
  ui: 'nav.ui', menu: 'nav.menu', 'menu-workspace': 'nav.menu-workspace',
  feedback: 'nav.feedback', devices: 'nav.devices', 'device-updates': 'nav.device-updates', 'pos-settings': 'nav.pos-settings',
  'printing-routing': 'nav.printing-routing', team: 'nav.team', 'time-clock': 'nav.time-clock',
  alerts: 'nav.alerts', 'labor-cost': 'nav.labor-cost', 'tip-pooling': 'nav.tip-pooling',
  scheduling: 'nav.scheduling', messaging: 'nav.messaging', payments: 'nav.payments',
}

export const SECTION_VIEW_CAPABILITIES: Record<string, string> = {
  'menu#organization': 'pos_menu.navigation',
  'menu#pos-menus': 'pos_menu.navigation',
  'printing-routing#overview': 'printing.overview',
  'printing-routing#routing': 'printing.routing',
  'printing-routing#receipts': 'printing.receipts',
  'tip-pooling#overview': 'payroll.overview',
  'tip-pooling#timecards': 'time_clock.entries',
  'tip-pooling#run': 'payroll.runs',
  'tip-pooling#rules': 'payroll.rules',
  'tip-pooling#payroll': 'payroll.setup',
}

const LEVEL_DEFAULTS: Record<BackOfficeViewLevel, BackOfficeViewMode> = {
  simple: 'summary', medium: 'standard', advanced: 'full',
}

const PRESET_OVERRIDES: Record<BackOfficeViewLevel, Record<string, BackOfficeViewMode>> = {
  advanced: {},
  medium: {
    'reports.activity': 'summary', 'reports.receipt_template': 'summary',
    'settings.taxes': 'summary', 'ui.appearance': 'hidden',
    'menu.pricing': 'standard', 'devices.sessions': 'summary',
    'devices.network': 'hidden', 'devices.hardware': 'hidden',
    'pos_settings.terminal_home': 'hidden', 'printing.ticket_layout': 'hidden',
    'team.permissions': 'summary', 'payroll.advanced_rules': 'summary',
    'scheduling.optimization': 'hidden',
  },
  simple: {
    'nav.marketing': 'hidden', 'nav.integrations': 'hidden', 'nav.menu-workspace': 'hidden',
    'nav.device-updates': 'hidden', 'nav.pos-settings': 'hidden', 'nav.printing-routing': 'hidden',
    'home.widgets': 'hidden', 'home.discount_review': 'summary',
    'home.analytics': 'standard', 'home.check_ledger': 'standard',
    'reports.viewer': 'standard', 'checks.active': 'standard',
    'reports.scope': 'hidden', 'reports.profiles': 'hidden', 'reports.schedules': 'hidden',
    'reports.receipt_template': 'hidden', 'reports.activity': 'hidden',
    'checks.activity': 'summary', 'store.goals': 'hidden',
    'settings.pricing': 'summary', 'settings.taxes': 'summary',
    'settings.charges': 'summary', 'settings.closeout': 'summary',
    'settings.check_workflow': 'summary', 'ui.appearance': 'hidden',
    'settings.lifecycle': 'standard',
    'reservations.booking': 'standard', 'reservations.phone': 'standard',
    'menu.combos': 'standard', 'menu.allergies': 'hidden', 'menu.pricing': 'standard',
    'menu.discounts': 'hidden', 'menu.routing': 'hidden',
    'devices.health': 'full', 'devices.pairing': 'standard', 'devices.assignments': 'standard',
    'devices.failover': 'standard', 'devices.sessions': 'hidden', 'devices.network': 'hidden',
    'devices.hardware': 'hidden', 'devices.print_groups': 'hidden',
    'team.permissions': 'hidden', 'team.manager_controls': 'hidden',
    'team.positions': 'standard', 'team.employees': 'standard', 'team.access': 'standard',
    'time_clock.entries': 'standard', 'time_clock.adjustments': 'standard',
    'payroll.overview': 'standard', 'payroll.runs': 'standard',
    'payroll.rules': 'standard', 'payroll.advanced_rules': 'hidden', 'payroll.setup': 'summary',
    'scheduling.calendar': 'standard', 'scheduling.approvals': 'standard',
    'scheduling.coverage': 'summary', 'scheduling.optimization': 'hidden',
  },
}

const CAPABILITY_ANCESTORS = new Map<string, string[]>()
const CAPABILITY_BY_ID = new Map<string, ViewCapability>()

function registerCapabilityAncestors(nodes: ViewCapability[], ancestors: string[] = []) {
  for (const item of nodes) {
    CAPABILITY_ANCESTORS.set(item.id, ancestors)
    CAPABILITY_BY_ID.set(item.id, item)
    registerCapabilityAncestors(item.children || [], [...ancestors, item.id])
  }
}

registerCapabilityAncestors(BACK_OFFICE_VIEW_CATALOG)

export const defaultViewPolicy = (base: BackOfficeViewLevel = 'advanced'): BackOfficeViewPolicy => ({
  schema_version: 1,
  base,
  overrides: {},
})

export function normalizeViewPolicy(value: unknown): BackOfficeViewPolicy {
  const raw = value && typeof value === 'object' ? value as Partial<BackOfficeViewPolicy> : {}
  const base = VIEW_LEVELS.some(level => level.id === raw.base) ? raw.base as BackOfficeViewLevel : 'advanced'
  const overrides: Record<string, BackOfficeViewMode> = {}
  for (const [key, mode] of Object.entries(raw.overrides || {})) {
    if (VIEW_MODES.some(item => item.id === mode)) overrides[key] = mode
  }
  return { schema_version: 1, base, overrides }
}

export function viewMode(policyValue: unknown, capabilityId: string): BackOfficeViewMode {
  const policy = normalizeViewPolicy(policyValue)
  const hierarchy = [...(CAPABILITY_ANCESTORS.get(capabilityId) || []), capabilityId]
  for (let index = hierarchy.length - 1; index >= 0; index -= 1) {
    const explicit = policy.overrides[hierarchy[index]]
    if (explicit) return explicit
  }
  for (let index = hierarchy.length - 1; index >= 0; index -= 1) {
    const preset = PRESET_OVERRIDES[policy.base][hierarchy[index]]
    if (preset) return preset
  }
  return LEVEL_DEFAULTS[policy.base]
}

export function viewVisible(policy: unknown, capabilityId: string): boolean {
  if (viewMode(policy, capabilityId) === 'hidden') return false
  const capability = CAPABILITY_BY_ID.get(capabilityId)
  if (!capability?.children?.length) return true
  return capability.children.some(child => viewVisible(policy, child.id))
}

export function flattenViewCapabilities(nodes = BACK_OFFICE_VIEW_CATALOG): ViewCapability[] {
  return nodes.flatMap(item => [item, ...flattenViewCapabilities(item.children || [])])
}

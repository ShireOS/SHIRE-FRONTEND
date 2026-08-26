// Keep page imports and sidebar intent preloading on the same loaders. Calling
// an import function early warms Vite's module promise without mounting the
// page or starting any page-owned data requests.
export const loadCheckLedger = () => import('./components/CheckLedgerSection')
export const loadCloseDay = () => import('./pages/CloseDayPage')
export const loadCloseDayReview = () => import('./components/CloseDayReview')
export const loadHomepageWidgets = () => import('./components/HomepageWidgets')
export const loadLaborCost = () => import('./pages/LaborCostPage')
export const loadManagerInbox = () => import('./pages/ManagerActionInboxPage')
export const loadMenuPanel = () => import('./MenuPanel')
export const loadMenuWorkspace = () => import('../shared/components/MenuWorkspaceEditor')
export const loadPosSettings = () => import('./pages/PosSettingsPage')
export const loadPrintingRouting = () => import('./pages/PrintingRoutingPage')
export const loadReports = () => import('./reports/RestaurantReportsPage')
export const loadResellerUiEditor = () => import('../reseller/ResellerUiEditor')
export const loadStoreDevices = () => import('./components/devices/StoreDevicesPanel')
export const loadDeviceUpdates = () => import('./pages/DeviceUpdatesPage')
export const loadSalesTiles = () => import('./components/SalesTiles')
export const loadTeam = () => import('./pages/TeamPage')
export const loadTimeClock = () => import('./pages/TimeClockPage')
export const loadTipPooling = () => import('./pages/TipPoolingPage')
export const loadVoiceReservations = () => import('./pages/VoiceReservationsPage')
export const loadWorkforcePay = () => import('./pages/WorkforcePayPage')

const WORKSPACE_MODULE_LOADERS = {
  analytics: () => Promise.all([loadSalesTiles(), loadHomepageWidgets(), loadCloseDayReview()]),
  reports: loadReports,
  checks: loadCheckLedger,
  'close-day': loadCloseDay,
  ui: loadResellerUiEditor,
  menu: loadMenuPanel,
  'menu-workspace': loadMenuWorkspace,
  team: loadTeam,
  'time-clock': loadTimeClock,
  'labor-cost': loadLaborCost,
  devices: loadStoreDevices,
  'device-updates': loadDeviceUpdates,
  'pos-settings': loadPosSettings,
  'printing-routing': loadPrintingRouting,
  'tip-pooling': loadWorkforcePay,
  reservations: loadVoiceReservations,
  alerts: loadManagerInbox,
}

export function preloadWorkspaceModule(tabId) {
  const load = WORKSPACE_MODULE_LOADERS[tabId]
  if (load) void load()
}

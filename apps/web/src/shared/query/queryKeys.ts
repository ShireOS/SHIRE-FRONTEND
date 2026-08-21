// Canonical cache keys. Every read and every invalidation goes through these
// so the same resource fetched from different panels shares one cache entry.
export const queryKeys = {
  restaurant: (restaurantId: string) => ['restaurant', restaurantId] as const,
  setupStatus: (restaurantId: string) => ['restaurant', restaurantId, 'setup-status'] as const,

  waiters: (restaurantId: string) => ['restaurant', restaurantId, 'waiters'] as const,
  tables: (restaurantId: string) => ['restaurant', restaurantId, 'tables'] as const,
  sections: (restaurantId: string) => ['restaurant', restaurantId, 'sections'] as const,
  floorPlan: (restaurantId: string) => ['restaurant', restaurantId, 'floor-plan'] as const,
  jobCodes: (restaurantId: string) => ['restaurant', restaurantId, 'job-codes'] as const,

  menuItems: (restaurantId: string) => ['restaurant', restaurantId, 'menu-items'] as const,
  menuCategories: (restaurantId: string) => ['restaurant', restaurantId, 'menu-categories'] as const,
  menuItemImages: (restaurantId: string) => ['restaurant', restaurantId, 'menu-item-images'] as const,
  menuCategoryColors: (restaurantId: string) => ['restaurant', restaurantId, 'menu-category-colors'] as const,
  menuModifiers: (restaurantId: string) => ['restaurant', restaurantId, 'menu-modifiers'] as const,
  menuModifierGroups: (restaurantId: string) => ['restaurant', restaurantId, 'menu-modifier-groups'] as const,
  menuCombos: (restaurantId: string) => ['restaurant', restaurantId, 'menu-combos'] as const,
  menuModifierOverrides: (restaurantId: string) => ['restaurant', restaurantId, 'menu-modifier-overrides'] as const,
  menuAllergies: (restaurantId: string) => ['restaurant', restaurantId, 'menu-allergies'] as const,
  menuSpecials: (restaurantId: string) => ['restaurant', restaurantId, 'menu-specials'] as const,
  menuSpecialSettings: (restaurantId: string) => ['restaurant', restaurantId, 'menu-special-settings'] as const,
  menuEditorPreferences: (restaurantId: string) => ['restaurant', restaurantId, 'menu-editor-preferences'] as const,
  menuPrintingConfig: (restaurantId: string) => ['restaurant', restaurantId, 'menu-printing-config'] as const,

  taxesCharges: (restaurantId: string) => ['restaurant', restaurantId, 'taxes-charges'] as const,
  priceAllocations: (restaurantId: string) => ['restaurant', restaurantId, 'price-allocations'] as const,
  discountRules: (restaurantId: string) => ['restaurant', restaurantId, 'discount-rules'] as const,
  managerControls: (restaurantId: string) => ['restaurant', restaurantId, 'manager-controls'] as const,
  closeoutSettings: (restaurantId: string) => ['restaurant', restaurantId, 'closeout-settings'] as const,
  checkWorkflowSettings: (restaurantId: string) => ['restaurant', restaurantId, 'check-workflow-settings'] as const,
  tipsPayrollSettings: (restaurantId: string) => ['restaurant', restaurantId, 'tips-payroll-settings'] as const,
  pricingPolicy: (restaurantId: string) => ['restaurant', restaurantId, 'pricing-policy'] as const,
  kitchenRouting: (restaurantId: string) => ['restaurant', restaurantId, 'kitchen-routing'] as const,

  operatingHours: (restaurantId: string) => ['restaurant', restaurantId, 'operating-hours'] as const,
  guestFeedback: (restaurantId: string, status = 'all') =>
    ['restaurant', restaurantId, 'guest-feedback', status] as const,

  ownerAnalytics: (restaurantId: string, period: string) =>
    ['restaurant', restaurantId, 'owner-analytics', period] as const,
  restaurantReports: (restaurantId: string, query: string) =>
    ['restaurant', restaurantId, 'reports', query] as const,
  reportPreferences: (restaurantId: string) => ['restaurant', restaurantId, 'reports', 'preferences'] as const,
  reportDimensions: (restaurantId: string) => ['restaurant', restaurantId, 'reports', 'dimensions'] as const,
  reportRecipients: (restaurantId: string) => ['restaurant', restaurantId, 'reports', 'recipients'] as const,
  reportSnapshot: (restaurantId: string, requestKey: string) =>
    ['restaurant', restaurantId, 'reports', 'snapshot', requestKey] as const,
  reportReceiptPreview: (restaurantId: string, requestKey: string) =>
    ['restaurant', restaurantId, 'reports', 'receipt-preview', requestKey] as const,

  staffingBlocks: (restaurantId: string) => ['restaurant', restaurantId, 'staffing-blocks'] as const,
  staffingSuggestions: (restaurantId: string) => ['restaurant', restaurantId, 'staffing-suggestions'] as const,
  schedules: (restaurantId: string, query = '') => ['restaurant', restaurantId, 'schedules', query] as const,
  employeeRequestPolicy: (restaurantId: string) => ['restaurant', restaurantId, 'employee-request-policy'] as const,
  employeeRequests: (restaurantId: string, status = 'all') =>
    ['restaurant', restaurantId, 'employee-requests', status] as const,
  shiftTradeRequests: (restaurantId: string, status = '') =>
    ['restaurant', restaurantId, 'shift-trade-requests', status] as const,

  backOfficeAccess: (restaurantId: string) => ['restaurant', restaurantId, 'back-office-access'] as const,
  backOfficeMembers: (restaurantId: string) => ['restaurant', restaurantId, 'back-office-members'] as const,
  timeClockRange: (restaurantId: string, startDate: string, endDate: string) =>
    ['restaurant', restaurantId, 'time-clock', startDate, endDate] as const,
  checkLedger: (restaurantId: string, query: Record<string, unknown>) =>
    ['restaurant', restaurantId, 'check-ledger', query] as const,
  checkLedgerDetail: (restaurantId: string, orderId: string) =>
    ['restaurant', restaurantId, 'check-ledger', 'detail', orderId] as const,

  conversations: (restaurantId: string) => ['restaurant', restaurantId, 'conversations'] as const,
  conversationMessages: (restaurantId: string, conversationId: string) =>
    ['restaurant', restaurantId, 'conversations', conversationId, 'messages'] as const,
  announcements: (restaurantId: string) => ['restaurant', restaurantId, 'announcements'] as const,
}

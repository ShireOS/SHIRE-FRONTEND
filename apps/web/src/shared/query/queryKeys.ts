// Canonical cache keys. Every read and every invalidation goes through these
// so the same resource fetched from different panels shares one cache entry.
export const queryKeys = {
  restaurant: (restaurantId: string) => ['restaurant', restaurantId] as const,

  waiters: (restaurantId: string) => ['restaurant', restaurantId, 'waiters'] as const,
  tables: (restaurantId: string) => ['restaurant', restaurantId, 'tables'] as const,
  sections: (restaurantId: string) => ['restaurant', restaurantId, 'sections'] as const,
  floorPlan: (restaurantId: string) => ['restaurant', restaurantId, 'floor-plan'] as const,
  jobCodes: (restaurantId: string) => ['restaurant', restaurantId, 'job-codes'] as const,

  menuItems: (restaurantId: string) => ['restaurant', restaurantId, 'menu-items'] as const,
  menuCategories: (restaurantId: string) => ['restaurant', restaurantId, 'menu-categories'] as const,

  taxesCharges: (restaurantId: string) => ['restaurant', restaurantId, 'taxes-charges'] as const,
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

  staffingBlocks: (restaurantId: string) => ['restaurant', restaurantId, 'staffing-blocks'] as const,
  staffingSuggestions: (restaurantId: string) => ['restaurant', restaurantId, 'staffing-suggestions'] as const,
  schedules: (restaurantId: string, query = '') => ['restaurant', restaurantId, 'schedules', query] as const,
  employeeRequestPolicy: (restaurantId: string) => ['restaurant', restaurantId, 'employee-request-policy'] as const,
  employeeRequests: (restaurantId: string, status = 'all') =>
    ['restaurant', restaurantId, 'employee-requests', status] as const,
  shiftTradeRequests: (restaurantId: string, status = '') =>
    ['restaurant', restaurantId, 'shift-trade-requests', status] as const,

  conversations: (restaurantId: string) => ['restaurant', restaurantId, 'conversations'] as const,
  conversationMessages: (restaurantId: string, conversationId: string) =>
    ['restaurant', restaurantId, 'conversations', conversationId, 'messages'] as const,
  announcements: (restaurantId: string) => ['restaurant', restaurantId, 'announcements'] as const,
}

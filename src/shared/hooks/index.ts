// Export all hooks from shared module

export { useApiQuery, useApiQueryWithFallback } from './useApiQuery'
export type { UseApiQueryResult } from './useApiQuery'

export { useWaiterList, useStaffToday } from './useWaiterList'
export { useWaiterDashboard } from './useWaiterDashboard'

// Scheduling hooks
export {
  useSchedule,
  useStaffingRequirements,
  useAllStaffAvailability,
  useStaffAvailability,
  useStaffPreferences,
  useCoverageGaps,
} from './useSchedule'
export { useSchedulingEngine } from './useSchedulingEngine'

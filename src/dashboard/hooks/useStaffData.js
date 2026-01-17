// Dashboard-specific hooks for staff data
// Re-exports shared hooks for use in JavaScript components

import { useWaiterList, useStaffToday, useWaiterDashboard } from '@shared/hooks'

// Re-export for convenience
export { useWaiterList, useStaffToday, useWaiterDashboard }

/**
 * Hook for StaffTable component
 * Returns staff list with loading/error state
 */
export function useStaffWithStatus() {
  const { data, loading, error, refetch } = useWaiterList()

  return {
    staff: data || [],
    isLoading: loading,
    isError: !!error,
    error: error,
    errorMessage: error?.message || null,
    refetch,
  }
}

/**
 * Hook for StaffLeaderboard component
 * Returns today's staff with loading/error state
 */
export function useStaffTodayWithStatus() {
  const { data, loading, error, refetch } = useStaffToday()

  return {
    staffToday: data || [],
    isLoading: loading,
    isError: !!error,
    error: error,
    errorMessage: error?.message || null,
    refetch,
  }
}

/**
 * Hook for StaffProfile component
 * Returns single staff member with loading/error state
 */
export function useStaffProfileWithStatus(staffId) {
  const { data, loading, error, refetch } = useWaiterDashboard(staffId)

  return {
    member: data,
    isLoading: loading,
    isError: !!error,
    error: error,
    errorMessage: error?.message || null,
    refetch,
  }
}

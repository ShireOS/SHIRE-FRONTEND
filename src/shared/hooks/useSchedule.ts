// Hooks for fetching and managing schedule data

import { useCallback, useMemo } from 'react'
import { useApiQuery } from './useApiQuery'
import { scheduleApi, staffingApi } from '../api/scheduleApi'
import { transformSchedule, detectCoverageGaps } from '../utils/dataTransformers'
import type {
  FrontendSchedule,
  StaffingRequirement,
  Availability,
  Preferences,
} from '../types/api'
import type { StaffMember } from '../types/api'

/**
 * Fetch schedule for a specific week
 * @param restaurantId Restaurant ID
 * @param weekStartDate Week start date in YYYY-MM-DD format
 * @param staff List of staff members (for transformation)
 * @param allAvailability Optional availability data for overlay
 * @returns Schedule data with loading/error states
 */
export function useSchedule(
  restaurantId: string | undefined,
  weekStartDate: string,
  staff: StaffMember[] = [],
  allAvailability: Availability[] = []
) {
  const fetchFn = useCallback(async (): Promise<FrontendSchedule | null> => {
    if (!restaurantId || !weekStartDate) return null

    try {
      const schedules = await scheduleApi.getSchedules(restaurantId, weekStartDate)

      if (schedules.length === 0) {
        // No schedule exists for this week yet
        console.log('[useSchedule] No schedule found for week:', weekStartDate)
        return null
      }

      // Get the first schedule for the week (should only be one)
      const schedule = schedules[0]
      console.log('[useSchedule] Raw schedule from backend:', schedule)
      console.log('[useSchedule] Schedule has items?', schedule.items ? `YES (${schedule.items.length} items)` : 'NO - MISSING!')

      // Transform to frontend format
      return transformSchedule(schedule, staff, allAvailability)
    } catch (error: unknown) {
      // If 404 or no schedule, return null (not an error)
      const apiError = error as { status?: number }
      if (apiError?.status === 404 || apiError?.status === 422) {
        console.log('[useSchedule] No schedule exists yet for this week')
        return null
      }
      // Re-throw other errors
      throw error
    }
    // Only depend on restaurantId and weekStartDate - staff and availability are used for transformation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, weekStartDate])

  return useApiQuery(fetchFn, [restaurantId, weekStartDate])
}

/**
 * Fetch staffing requirements for a restaurant
 * @param restaurantId Restaurant ID
 */
export function useStaffingRequirements(restaurantId: string | undefined) {
  const fetchFn = useCallback(async (): Promise<StaffingRequirement[]> => {
    if (!restaurantId) return []
    return staffingApi.getRequirements(restaurantId)
  }, [restaurantId])

  return useApiQuery(fetchFn, [restaurantId])
}

/**
 * Fetch all staff availability for a restaurant
 * @param staff List of staff members
 */
export function useAllStaffAvailability(staff: StaffMember[]) {
  // Create a stable key from staff IDs to prevent infinite loops
  const staffIds = staff.map(s => s.id).sort().join(',')

  const fetchFn = useCallback(async (): Promise<Availability[]> => {
    if (staff.length === 0) return []

    // Fetch availability for all staff in parallel
    const availabilityPromises = staff.map((member) =>
      staffingApi.getAvailability(member.id).catch(() => [])
    )

    const results = await Promise.all(availabilityPromises)
    return results.flat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffIds])

  return useApiQuery(fetchFn, [staffIds])
}

/**
 * Fetch staff availability for a single staff member
 * @param waiterId Waiter/staff ID
 */
export function useStaffAvailability(waiterId: string | undefined) {
  const fetchFn = useCallback(async (): Promise<Availability[]> => {
    if (!waiterId) return []
    return staffingApi.getAvailability(waiterId)
  }, [waiterId])

  return useApiQuery(fetchFn, [waiterId])
}

/**
 * Fetch staff preferences for a single staff member
 * @param waiterId Waiter/staff ID
 */
export function useStaffPreferences(waiterId: string | undefined) {
  const fetchFn = useCallback(async (): Promise<Preferences | null> => {
    if (!waiterId) return null
    return staffingApi.getPreferences(waiterId)
  }, [waiterId])

  return useApiQuery(fetchFn, [waiterId])
}

/**
 * Hook for detecting coverage gaps
 * @param schedule Frontend schedule
 * @param requirements Staffing requirements
 */
export function useCoverageGaps(
  schedule: FrontendSchedule | null,
  requirements: StaffingRequirement[]
) {
  return useMemo(() => {
    return detectCoverageGaps(schedule, requirements)
  }, [schedule, requirements])
}

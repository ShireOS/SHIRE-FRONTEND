// Schedule API Functions
// Functions for interacting with the scheduling backend

import { apiClient } from './client'
import { ENDPOINTS } from './endpoints'
import { API_CONFIG } from './config'
import type {
  Schedule,
  ScheduleItem,
  ScheduleRun,
  StaffingRequirement,
  Availability,
  Preferences,
} from '../types/api'

export const scheduleApi = {
  /**
   * Get schedules for a restaurant
   * @param restaurantId Restaurant ID (optional, uses default if not provided)
   * @param weekStart Week start date in YYYY-MM-DD format (optional)
   */
  getSchedules: async (
    restaurantId?: string,
    weekStart?: string
  ): Promise<Schedule[]> => {
    const id = restaurantId || API_CONFIG.restaurantId
    console.log('[scheduleApi] Fetching schedules:', { restaurantId: id, weekStart })
    try {
      return await apiClient.get<Schedule[]>(ENDPOINTS.schedules(id, weekStart))
    } catch (error) {
      console.error('[scheduleApi] Error fetching schedules:', error)
      throw error
    }
  },

  /**
   * Get a specific schedule by ID
   * @param scheduleId Schedule ID
   */
  getScheduleById: async (scheduleId: string): Promise<Schedule> => {
    return apiClient.get<Schedule>(ENDPOINTS.scheduleById(scheduleId))
  },

  /**
   * Create a new schedule item (shift)
   * @param scheduleId Schedule ID
   * @param itemData Shift data
   */
  createItem: async (
    scheduleId: string,
    itemData: {
      waiter_id: string
      role: string
      shift_date: string
      shift_start: string
      shift_end: string
      section_id?: string
    }
  ): Promise<ScheduleItem> => {
    return apiClient.post<ScheduleItem>(
      ENDPOINTS.createScheduleItem(scheduleId),
      itemData
    )
  },

  /**
   * Update an existing schedule item
   * @param itemId Schedule item ID
   * @param itemData Updated shift data
   */
  updateItem: async (
    itemId: string,
    itemData: Partial<{
      role: string
      shift_start: string
      shift_end: string
      section_id: string
    }>
  ): Promise<ScheduleItem> => {
    return apiClient.put<ScheduleItem>(
      ENDPOINTS.updateScheduleItem(itemId),
      itemData
    )
  },

  /**
   * Delete a schedule item
   * @param itemId Schedule item ID
   */
  deleteItem: async (itemId: string): Promise<void> => {
    return apiClient.delete<void>(ENDPOINTS.deleteScheduleItem(itemId))
  },

  /**
   * Publish a schedule
   * @param scheduleId Schedule ID
   */
  publishSchedule: async (scheduleId: string): Promise<Schedule> => {
    return apiClient.post<Schedule>(ENDPOINTS.publishSchedule(scheduleId))
  },

  /**
   * Delete a schedule
   * @param scheduleId Schedule ID
   */
  deleteSchedule: async (scheduleId: string): Promise<void> => {
    return apiClient.delete<void>(`/schedules/${scheduleId}`)
  },

  /**
   * Run the AI scheduling engine
   * @param restaurantId Restaurant ID (optional)
   * @param weekStartDate Week start date in YYYY-MM-DD format
   */
  runScheduler: async (
    restaurantId: string | undefined,
    weekStartDate: string
  ): Promise<ScheduleRun> => {
    const id = restaurantId || API_CONFIG.restaurantId
    return apiClient.post<ScheduleRun>(ENDPOINTS.runScheduler(id), {
      week_start_date: weekStartDate,
    })
  },

  /**
   * Get status of a schedule run
   * @param runId Schedule run ID
   */
  getSchedulerStatus: async (runId: string): Promise<ScheduleRun> => {
    return apiClient.get<ScheduleRun>(ENDPOINTS.schedulerStatus(runId))
  },
}

export const staffingApi = {
  /**
   * Get staffing requirements for a restaurant
   * @param restaurantId Restaurant ID (optional)
   */
  getRequirements: async (
    restaurantId?: string
  ): Promise<StaffingRequirement[]> => {
    const id = restaurantId || API_CONFIG.restaurantId
    return apiClient.get<StaffingRequirement[]>(
      ENDPOINTS.staffingRequirements(id)
    )
  },

  /**
   * Get staff availability
   * @param waiterId Waiter/staff ID
   */
  getAvailability: async (waiterId: string): Promise<Availability[]> => {
    return apiClient.get<Availability[]>(ENDPOINTS.staffAvailability(waiterId))
  },

  /**
   * Get staff preferences
   * @param waiterId Waiter/staff ID
   */
  getPreferences: async (waiterId: string): Promise<Preferences | null> => {
    try {
      return await apiClient.get<Preferences>(
        ENDPOINTS.staffPreferences(waiterId)
      )
    } catch (error) {
      // Return null if preferences don't exist yet
      return null
    }
  },
}

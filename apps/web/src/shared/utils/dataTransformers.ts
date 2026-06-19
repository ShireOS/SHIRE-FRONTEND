// Data Transformers
// Convert API responses to frontend format expected by components

import type {
  WaiterDashboard,
  WaiterListItem,
  StaffMember,
  TrendDataPoint,
  RecentShift,
  BadgeType,
  TrendDirection,
  Schedule,
  ScheduleItem,
  FrontendSchedule,
  ShiftCell,
  StaffScheduleRow,
  CoverageGap,
  StaffingRequirement,
  Availability,
  AvailabilityStatus,
} from '../types/api'

/**
 * Convert API tenure_years (number) to display string
 * Examples: 0.05 -> "3 weeks", 0.5 -> "6 months", 2.3 -> "2.3 years"
 */
function formatTenure(years: number | undefined | null): string {
  if (years == null || isNaN(years)) return 'New'
  if (years < 0.08) return `${Math.round(years * 52)} weeks`
  if (years < 1) return `${Math.round(years * 12)} months`
  return `${years.toFixed(1)} years`
}

/**
 * Derive badges from tier and tenure
 * tier: "strong" -> topPerformer, "developing" -> struggling
 */
function deriveBadges(tier: string | undefined, tenureYears: number | undefined | null): BadgeType[] {
  const badges: BadgeType[] = []

  if (tier === 'strong' || tier === 'top_performer') {
    badges.push('topPerformer')
  }
  if (tier === 'developing' || tier === 'struggling') {
    badges.push('struggling')
  }
  if (tenureYears == null || tenureYears < 0.1) {
    badges.push('new')
  }

  return badges
}

/**
 * Derive trend direction from historical data
 */
function deriveTrendDirection(
  trends: TrendDataPoint[],
  tenureYears: number
): TrendDirection {
  if (tenureYears < 0.1 || trends.length < 2) return 'new'

  const recent = trends.slice(-2)
  if (recent.length < 2) return 'stable'

  const [prev, curr] = recent
  const change = curr.tips - prev.tips
  const percentChange = (change / prev.tips) * 100

  if (percentChange > 5) return 'up'
  if (percentChange < -5) return 'down'
  return 'stable'
}

/**
 * Transform API shifts to frontend format
 */
function transformShifts(
  shifts: RecentShift[]
): StaffMember['recentShifts'] {
  return shifts.map((shift) => ({
    date: formatShiftDate(shift.date),
    hours: shift.hours,
    covers: shift.covers,
    tips: shift.tips,
    efficiency: shift.efficiency_pct ?? null,
  }))
}

/**
 * Format shift date from ISO to display format
 * "2025-01-04" -> "Sat Jan 4"
 */
function formatShiftDate(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`
  } catch {
    return isoDate
  }
}

/**
 * Transform API trends to frontend chart format
 */
function transformTrends(trends: TrendDataPoint[]): StaffMember['trendData'] {
  return trends.map((t) => {
    // Extract month name from "YYYY-MM"
    const monthName = formatMonthName(t.month)
    return {
      month: monthName,
      tips: t.tips,
      // Approximate efficiency from avg_tip_pct if available
      efficiency: t.avg_tip_pct ? Math.round(t.avg_tip_pct * 5) : 80,
    }
  })
}

/**
 * Format month from "YYYY-MM" to "Jan", "Feb", etc.
 */
function formatMonthName(yearMonth: string): string {
  try {
    const [, month] = yearMonth.split('-')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months[parseInt(month, 10) - 1] || yearMonth
  } catch {
    return yearMonth
  }
}

/**
 * Transform full waiter dashboard response to frontend StaffMember format
 * Backend response has nested 'profile' object
 */
export function transformWaiterDashboard(data: WaiterDashboard): StaffMember {
  // Extract from nested profile object with fallbacks
  const profile = data?.profile
  const stats = data?.stats
  const trends = data?.trends || []
  const insights = data?.insights
  const recent_shifts = data?.recent_shifts || []

  const tipPercent =
    stats && stats.total_sales > 0
      ? Math.round((stats.tips / stats.total_sales) * 100)
      : 0

  return {
    id: profile?.id ?? '',
    name: profile?.name ?? 'Unknown',
    role: 'Server',
    tenure: formatTenure(profile?.tenure_years),
    avatar: null,
    badges: deriveBadges(profile?.tier, profile?.tenure_years),
    thisMonth: {
      covers: stats?.covers ?? 0,
      tips: stats?.tips ?? 0,
      avgTip: stats?.avg_per_cover ?? 0,
      efficiency: stats?.efficiency_pct ?? null,
      revenue: stats?.total_sales ?? 0,
    },
    trend: deriveTrendDirection(trends, profile?.tenure_years),
    tipPercent,
    strengths: insights?.strengths || [],
    areasToWatch: insights?.areas_to_watch || [],
    recentShifts: transformShifts(recent_shifts),
    trendData: transformTrends(trends),
  }
}

/**
 * Transform waiter list item to staff table format
 * Stats are now included in the list response from backend
 */
export function transformWaiterListItem(data: WaiterListItem): StaffMember {
  // ENHANCED LOGGING - Track transformation input/output
  if (import.meta.env.DEV) {
    console.log('[Transform] Converting waiter:', {
      id: data.id.slice(0, 8) + '...',
      name: data.name,
      tier: data.tier,
      hasStats: !!data.stats,
      tips: data.stats?.tips ?? 0,
      covers: data.stats?.covers ?? 0,
    })
  }

  const stats = data.stats
  const tipPercent =
    stats && stats.total_sales > 0
      ? Math.round((stats.tips / stats.total_sales) * 100)
      : 0

  const staffMember: StaffMember = {
    id: data.id,
    name: data.name,
    role: 'Server',
    tenure: formatTenure(data.tenure_years),
    avatar: null,
    badges: deriveBadges(data.tier, data.tenure_years),
    thisMonth: {
      covers: stats?.covers ?? 0,
      tips: stats?.tips ?? 0,
      avgTip: stats?.avg_per_cover ?? 0,
      efficiency: stats?.efficiency_pct ?? null,
      revenue: stats?.total_sales ?? 0,
    },
    trend: 'stable',
    tipPercent,
    strengths: [],
    areasToWatch: [],
    recentShifts: [],
    trendData: [],
  }

  if (import.meta.env.DEV) {
    console.log('[Transform] ✅ Result:', {
      id: staffMember.id.slice(0, 8) + '...',
      name: staffMember.name,
      tips: staffMember.thisMonth.tips,
      covers: staffMember.thisMonth.covers,
    })
  }

  return staffMember
}

/**
 * Transform API waiter list to staffToday format (for leaderboard)
 * Sorts by tips descending and takes top 4
 */
export function transformToStaffToday(
  waiters: WaiterListItem[]
): Array<{
  id: string
  name: string
  tips: number
  covers: number
  avgTip: number
  rank: number
  warning?: boolean
  isNew?: boolean
}> {
  // Sort by tips descending before taking top 4
  const sorted = [...waiters].sort(
    (a, b) => (b.stats?.tips ?? 0) - (a.stats?.tips ?? 0)
  )

  return sorted.slice(0, 4).map((w, idx) => ({
    id: w.id,
    name: w.name?.split(' ').map((n, i) => (i === 0 ? n : `${n[0]}.`)).join(' ') ?? 'Unknown',
    tips: w.stats?.tips ?? 0,
    covers: w.stats?.covers ?? 0,
    avgTip: w.stats?.avg_per_cover ?? 0,
    rank: idx + 1,
    warning: w.tier === 'developing',
    isNew: w.tenure_years == null || w.tenure_years < 0.1,
  }))
}

// ========== Scheduling Transformers ==========

/**
 * Format 24-hour time to 12-hour display format
 * "16:00" -> "4pm", "09:30" -> "9:30am"
 */
export function formatTimeDisplay(time: string): string {
  try {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'pm' : 'am'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : ''
    return `${displayHours}${displayMinutes}${period}`
  } catch {
    return time
  }
}

/**
 * Calculate shift hours from start and end times
 * "09:00", "17:00" -> 8
 */
function calculateShiftHours(startTime: string, endTime: string): number {
  try {
    const [startHours, startMinutes] = startTime.split(':').map(Number)
    const [endHours, endMinutes] = endTime.split(':').map(Number)
    const startTotal = startHours + startMinutes / 60
    const endTotal = endHours + endMinutes / 60
    return Math.max(0, endTotal - startTotal)
  } catch {
    return 0
  }
}

/**
 * Transform schedule item to shift cell for grid display
 */
export function transformScheduleItemToShiftCell(item: ScheduleItem): ShiftCell {
  const hours = calculateShiftHours(item.shift_start, item.shift_end)
  const displayTime = `${formatTimeDisplay(item.shift_start)}-${formatTimeDisplay(item.shift_end)}`

  return {
    itemId: item.id,
    displayTime,
    startTime: item.shift_start,
    endTime: item.shift_end,
    role: item.role,
    hours,
    preferenceScore: item.preference_match_score ?? undefined,
    fairnessScore: item.fairness_impact_score ?? undefined,
    source: item.source,
    reasoning: item.reasoning ?? undefined,  // NEW: Pass through AI reasoning from backend
  }
}

/**
 * Get day labels for a week starting from a date
 * Returns ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
 */
function getWeekDays(): string[] {
  return ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
}

/**
 * Format week range for display
 * "2025-01-06" -> "Jan 6-12"
 */
function formatWeekRange(weekStartDate: string): string {
  try {
    const start = new Date(weekStartDate)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const startMonth = months[start.getMonth()]
    const startDay = start.getDate()
    const endDay = end.getDate()

    return `${startMonth} ${startDay}-${endDay}`
  } catch {
    return weekStartDate
  }
}

/**
 * Determine day type based on day of week
 * Friday/Saturday = busy, Sunday-Thursday = avg
 */
function getDayType(dayIndex: number): 'slow' | 'avg' | 'busy' {
  // 0=Mon, 1=Tue, ..., 4=Fri, 5=Sat, 6=Sun
  if (dayIndex === 4 || dayIndex === 5) return 'busy' // Fri, Sat
  return 'avg'
}

/**
 * Get availability status for a staff member on a specific day
 */
function getStaffAvailability(
  waiterId: string,
  dayIndex: number,
  allAvailability: Availability[]
): AvailabilityStatus {
  const staffAvailability = allAvailability.filter(a => a.waiter_id === waiterId && a.day_of_week === dayIndex)

  if (staffAvailability.length === 0) return 'available'

  // If any unavailable slot exists, mark as unavailable
  if (staffAvailability.some(a => a.availability_type === 'unavailable')) {
    return 'unavailable'
  }

  // If any preferred slot exists, mark as preferred
  if (staffAvailability.some(a => a.availability_type === 'preferred')) {
    return 'preferred'
  }

  return 'available'
}

/**
 * Main transformer: Convert backend schedule to frontend grid format
 */
export function transformSchedule(
  schedule: Schedule | null,
  staff: StaffMember[],
  allAvailability: Availability[] = []
): FrontendSchedule | null {
  if (!schedule) return null

  const weekStartDate = new Date(schedule.week_start_date)
  const days = getWeekDays()
  const dayTypes = days.map((_, idx) => getDayType(idx))

  // Ensure items array exists
  const items = schedule.items || []

  // Build staff schedule rows
  const staffRows: StaffScheduleRow[] = staff.map((member) => {
    const shifts: (ShiftCell | null)[] = []
    const availability: AvailabilityStatus[] = []
    let totalHours = 0

    // For each day of the week
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      // Get availability for this day
      availability.push(getStaffAvailability(member.id, dayIndex, allAvailability))

      // Calculate the date for this day
      const dayDate = new Date(weekStartDate)
      dayDate.setDate(weekStartDate.getDate() + dayIndex)
      const dayDateStr = dayDate.toISOString().split('T')[0]

      // Find shift for this staff member on this day
      const item = items.find(
        (item) => item.waiter_id === member.id && item.shift_date === dayDateStr
      )

      if (item) {
        const shiftCell = transformScheduleItemToShiftCell(item)
        shifts.push(shiftCell)
        totalHours += shiftCell.hours
      } else {
        shifts.push(null)
      }
    }

    return {
      waiterId: member.id,
      name: member.name,
      role: member.role,
      shifts,
      availability,
      totalHours,
    }
  })

  // Calculate total labor hours and cost
  const totalHours = items.reduce((sum, item) => {
    return sum + calculateShiftHours(item.shift_start, item.shift_end)
  }, 0)

  const HOURLY_RATE = 15 // Estimate $15/hr
  const laborCost = totalHours * HOURLY_RATE

  const WEEKLY_REVENUE = 10000 // Estimate $10k/week
  const laborPercent = (laborCost / WEEKLY_REVENUE) * 100

  return {
    id: schedule.id,
    weekOf: formatWeekRange(schedule.week_start_date),
    weekStartDate,
    status: schedule.status,
    days,
    dayTypes,
    staff: staffRows,
    laborCost,
    laborPercent,
    coverageGaps: [], // Will be populated by detectCoverageGaps
    warnings: [],
    totalHours,
    scheduleSummary: schedule.schedule_summary ?? null,  // NEW: AI summary from backend
  }
}

/**
 * Detect coverage gaps by comparing schedule vs requirements
 */
export function detectCoverageGaps(
  schedule: FrontendSchedule | null,
  requirements: StaffingRequirement[]
): CoverageGap[] {
  if (!schedule) return []

  const gaps: CoverageGap[] = []

  // Group requirements by day and time
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayRequirements = requirements.filter((r) => r.day_of_week === dayIndex)
    for (const req of dayRequirements) {
      // Count how many staff are scheduled for this time slot and role
      const scheduled = schedule.staff.filter((staffRow) => {
        const shift = staffRow.shifts[dayIndex]
        if (!shift) return false

        // Check if shift overlaps with requirement time
        const shiftStart = shift.startTime
        const shiftEnd = shift.endTime
        const reqStart = req.start_time
        const reqEnd = req.end_time

        const overlaps = shiftStart < reqEnd && shiftEnd > reqStart
        const matchesRole = shift.role === req.role

        return overlaps && matchesRole
      }).length

      // Check if we have a gap
      if (scheduled < req.min_staff) {
        const shortage = req.min_staff - scheduled
        gaps.push({
          day: schedule.days[dayIndex],
          dayIndex,
          timeSlot: `${formatTimeDisplay(req.start_time)}-${formatTimeDisplay(req.end_time)}`,
          role: req.role,
          scheduled,
          required: req.min_staff,
          shortage,
        })
      }
    }
  }

  return gaps
}

/**
 * Calculate labor cost from schedule items
 */
export function calculateLaborCost(items: ScheduleItem[]): number {
  const HOURLY_RATE = 15
  const totalHours = items.reduce((sum, item) => {
    return sum + calculateShiftHours(item.shift_start, item.shift_end)
  }, 0)
  return totalHours * HOURLY_RATE
}

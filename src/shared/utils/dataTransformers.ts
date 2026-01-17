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
} from '../types/api'

/**
 * Convert API tenure_years (number) to display string
 * Examples: 0.05 -> "3 weeks", 0.5 -> "6 months", 2.3 -> "2.3 years"
 */
function formatTenure(years: number): string {
  if (years < 0.08) return `${Math.round(years * 52)} weeks`
  if (years < 1) return `${Math.round(years * 12)} months`
  return `${years.toFixed(1)} years`
}

/**
 * Derive badges from tier and tenure
 * tier: "strong" -> topPerformer, "developing" -> struggling
 */
function deriveBadges(tier: string, tenureYears: number): BadgeType[] {
  const badges: BadgeType[] = []

  if (tier === 'strong' || tier === 'top_performer') {
    badges.push('topPerformer')
  }
  if (tier === 'developing' || tier === 'struggling') {
    badges.push('struggling')
  }
  if (tenureYears < 0.1) {
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
    const [year, month] = yearMonth.split('-')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months[parseInt(month, 10) - 1] || yearMonth
  } catch {
    return yearMonth
  }
}

/**
 * Transform full waiter dashboard response to frontend StaffMember format
 */
export function transformWaiterDashboard(data: WaiterDashboard): StaffMember {
  const tipPercent =
    data.stats.total_sales > 0
      ? Math.round((data.stats.tips / data.stats.total_sales) * 100)
      : 0

  return {
    id: data.id,
    name: data.name,
    role: 'Server',
    tenure: formatTenure(data.tenure_years),
    avatar: null,
    badges: deriveBadges(data.tier, data.tenure_years),
    thisMonth: {
      covers: data.stats.covers,
      tips: data.stats.tips,
      avgTip: data.stats.avg_per_cover,
      efficiency: data.stats.efficiency_pct ?? null,
      revenue: data.stats.total_sales,
    },
    trend: deriveTrendDirection(data.trends, data.tenure_years),
    tipPercent,
    strengths: data.insights?.strengths || [],
    areasToWatch: data.insights?.areas_to_watch || [],
    recentShifts: transformShifts(data.recent_shifts),
    trendData: transformTrends(data.trends),
  }
}

/**
 * Transform waiter list item to staff table format
 * Note: List items don't have insights, shifts, or trends
 */
export function transformWaiterListItem(data: WaiterListItem): StaffMember {
  const tipPercent =
    data.stats.total_sales > 0
      ? Math.round((data.stats.tips / data.stats.total_sales) * 100)
      : 0

  return {
    id: data.id,
    name: data.name,
    role: data.role || 'Server',
    tenure: formatTenure(data.tenure_years),
    avatar: null,
    badges: deriveBadges(data.tier, data.tenure_years),
    thisMonth: {
      covers: data.stats.covers,
      tips: data.stats.tips,
      avgTip: data.stats.avg_per_cover,
      efficiency: data.stats.efficiency_pct ?? null,
      revenue: data.stats.total_sales,
    },
    trend: 'stable', // List endpoint doesn't include trend data
    tipPercent,
    strengths: [],
    areasToWatch: [],
    recentShifts: [],
    trendData: [],
  }
}

/**
 * Transform API waiter list to staffToday format (for leaderboard)
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
  return waiters
    .sort((a, b) => b.stats.tips - a.stats.tips)
    .slice(0, 4)
    .map((w, idx) => ({
      id: w.id,
      name: w.name.split(' ').map((n, i) => i === 0 ? n : `${n[0]}.`).join(' '),
      tips: w.stats.tips,
      covers: w.stats.covers,
      avgTip: w.stats.avg_per_cover,
      rank: idx + 1,
      warning: w.tier === 'developing',
      isNew: w.tenure_years < 0.1,
    }))
}

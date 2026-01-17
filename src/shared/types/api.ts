// ========== API Response Types ==========
// These types match the Waiter Intelligence Backend API responses

export interface WaiterStats {
  covers: number
  tips: number
  avg_per_cover: number
  efficiency_pct: number
  tables_served: number
  total_sales: number
}

export interface TrendDataPoint {
  month: string // "YYYY-MM"
  tips: number
  covers: number
  avg_tip_pct: number | null
}

export interface WaiterInsights {
  tier: string
  composite_score: number
  strengths: string[]
  areas_to_watch: string[]
  suggestions: string[]
  llm_summary: string | null
  computed_at: string | null
}

export interface RecentShift {
  id: string
  date: string
  hours: string
  covers: number
  tips: number
  sales: number
  efficiency_pct: number
  section_name: string | null
}

export interface WaiterDashboard {
  id: string
  name: string
  tier: string // 'strong' | 'standard' | 'developing'
  tenure_years: number
  stats: WaiterStats
  trends: TrendDataPoint[]
  insights: WaiterInsights | null
  recent_shifts: RecentShift[]
}

export interface WaiterListItem {
  id: string
  name: string
  role?: string
  tenure_years: number
  tier: string
  stats: WaiterStats
}

// ========== Frontend-Adapted Types ==========
// These adapt API types to match existing frontend component expectations

export type BadgeType = 'topPerformer' | 'struggling' | 'new'
export type TrendDirection = 'up' | 'down' | 'stable' | 'new'

export interface StaffMember {
  id: string
  name: string
  role: string
  tenure: string
  avatar: string | null
  badges: BadgeType[]
  thisMonth: {
    covers: number
    tips: number
    avgTip: number
    efficiency: number | null
    revenue: number
  }
  trend: TrendDirection
  tipPercent: number
  strengths: string[]
  areasToWatch: string[]
  recentShifts: {
    date: string
    hours: string
    covers: number
    tips: number
    efficiency: number | null
  }[]
  trendData: {
    month: string
    tips: number
    efficiency: number
  }[]
}

// ========== API Error Types ==========
export interface ApiError {
  status: number
  message: string
  details?: unknown
  endpoint?: string
}

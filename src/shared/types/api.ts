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

// Profile nested inside dashboard response
export interface WaiterProfile {
  id: string
  name: string
  email?: string
  phone?: string | null
  tier: string // 'strong' | 'standard' | 'developing'
  tenure_years: number
  total_shifts?: number
  total_covers?: number
  total_tips?: number
  is_active?: boolean
  created_at?: string
}

// Actual dashboard response structure from backend
export interface WaiterDashboard {
  profile: WaiterProfile
  stats: WaiterStats
  trends: TrendDataPoint[]
  insights: WaiterInsights | null
  recent_shifts: RecentShift[]
}

export interface WaiterListItem {
  id: string
  name: string
  email?: string
  tier: string
  tenure_years: number
  is_active?: boolean
  stats?: WaiterStats
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

// ========== Menu Analytics Types ==========
// Types for menu ranking, scoring, and 86 management

export interface MenuItemRanked {
  id: string
  name: string
  category: string | null
  price: number
  cost: number
  is_available: boolean
  combined_score: number // 0-100
  demand_score: number // 0-100
  margin_pct: number
  orders_per_day: number
  times_ordered: number
  rank: number
}

export interface MenuItemRankingResponse {
  restaurant_id: string
  analysis_period_days: number
  total_items: number
  items: MenuItemRanked[]
}

export interface MenuItem86Recommendation {
  id: string
  name: string
  category: string | null
  price: number
  combined_score: number
  demand_score: number
  margin_pct: number
  orders_per_day: number
  reason: string
}

export interface MenuItem86RecommendationResponse {
  restaurant_id: string
  analysis_period_days: number
  score_threshold: number
  total_recommendations: number
  recommendations: MenuItem86Recommendation[]
}

export interface MenuItem86Response {
  success: boolean
  item_id: string
  name: string
  is_available: boolean
  message: string
}

export interface MenuItem86dItem {
  id: string
  name: string
  category: string | null
  price: number | null
  is_available: boolean
  updated_at: string | null
}

export interface MenuItem86dListResponse {
  restaurant_id: string
  total_86d: number
  items: MenuItem86dItem[]
}

export interface Restaurant {
  id: string
  name: string
  timezone: string
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ========== Scheduling Types ==========
// Types for staff scheduling, availability, and AI generation

// Backend response types

// AI Reasoning for schedule items
export interface ScheduleReasoning {
  reasons: string[]
  constraint_violations: string[]
  confidence_score: number
}

export interface Schedule {
  id: string
  restaurant_id: string
  week_start_date: string
  status: 'draft' | 'published' | 'archived'
  generated_by: 'manual' | 'engine' | 'suggestion'
  version: number
  items: ScheduleItem[]
  schedule_summary?: string | null  // NEW: AI-generated explanation from backend
  created_at: string
  updated_at: string
}

export interface ScheduleItem {
  id: string
  schedule_id: string
  waiter_id: string
  role: string
  section_id?: string | null
  shift_date: string
  shift_start: string
  shift_end: string
  source: 'manual' | 'engine' | 'suggestion'
  preference_match_score?: number | null
  fairness_impact_score?: number | null
  reasoning?: ScheduleReasoning | null  // NEW: Nested AI reasoning from backend
  created_at: string
  updated_at: string
}

export interface ScheduleRun {
  id: string
  run_status: 'running' | 'completed' | 'failed'
  schedule_id?: string | null
  error_message?: string | null
  summary_metrics?: {
    items_created: number
    total_hours: number
    coverage_pct: number
    fairness_gini: number
    preference_avg: number
  } | null
}

export interface StaffingRequirement {
  id: string
  restaurant_id: string
  day_of_week: number // 0=Mon, 6=Sun
  start_time: string
  end_time: string
  role: string
  min_staff: number
  max_staff: number
  is_prime_shift: boolean
  notes?: string | null
}

export interface Availability {
  id: string
  waiter_id: string
  day_of_week: number // 0=Mon, 6=Sun
  start_time: string
  end_time: string
  availability_type: 'available' | 'unavailable' | 'preferred'
  notes?: string | null
}

export interface Preferences {
  waiter_id: string
  preferred_roles: string[]
  preferred_shift_types: string[]
  preferred_sections?: string[] | null
  max_shifts_per_week?: number | null
  max_hours_per_week?: number | null
  min_hours_per_week?: number | null
  avoid_clopening: boolean
  notes?: string | null
}

// Frontend-adapted types for schedule display
export type AvailabilityStatus = 'available' | 'preferred' | 'unavailable'

export interface ShiftCell {
  itemId: string
  displayTime: string // "4-11pm"
  startTime: string
  endTime: string
  role: string
  hours: number
  preferenceScore?: number
  fairnessScore?: number
  source: 'manual' | 'engine' | 'suggestion'
  reasoning?: ScheduleReasoning  // NEW: AI reasoning for tooltip display
}

export interface StaffScheduleRow {
  waiterId: string
  name: string
  role: string
  shifts: (ShiftCell | null)[] // 7 days (Mon-Sun)
  availability: AvailabilityStatus[] // 7 days
  totalHours: number
}

export interface CoverageGap {
  day: string
  dayIndex: number
  timeSlot: string
  role: string
  scheduled: number
  required: number
  shortage: number
}

export interface FrontendSchedule {
  id: string
  weekOf: string // "Jan 6-12"
  weekStartDate: Date
  status: 'draft' | 'published' | 'archived'
  days: string[] // ['MON', 'TUE', 'WED', ...]
  dayTypes: ('slow' | 'avg' | 'busy')[]
  staff: StaffScheduleRow[]
  laborCost: number
  laborPercent: number
  coverageGaps: CoverageGap[]
  warnings: string[]
  totalHours: number
  scheduleSummary?: string | null  // NEW: AI-generated reasoning from backend
}

// ========== Review Management Types ==========
// Types for Yelp review analysis and AI categorization

export interface CategoryOpinions {
  food: string
  service: string
  atmosphere: string
  value: string
  cleanliness: string
}

export interface ReviewRead {
  id: string
  platform: string // 'yelp'
  rating: number // 1-5
  text: string
  review_date: string // ISO 8601
  sentiment_score: number | null // -1.0 to 1.0
  category_opinions: CategoryOpinions | null
  overall_summary: string | null
  needs_attention: boolean
  status: 'pending' | 'categorized' | 'dismissed'
  created_at: string
}

export interface RatingDistribution {
  five_star: number
  four_star: number
  three_star: number
  two_star: number
  one_star: number
}

export interface ReviewStats {
  overall_average: number
  total_reviews: number
  reviews_this_month: number
  rating_distribution: RatingDistribution
}

export interface ReviewSummary {
  category_opinions: CategoryOpinions
  overall_summary: string
  needs_attention: boolean
}

export interface ReviewCreate {
  platform: string
  review_identifier: string
  rating: number
  text: string
  review_date: string
}

export interface IngestResponse {
  added: number
  total_submitted: number
  status: 'categorizing' | 'no_new_reviews'
}

export interface CategorizationResult {
  processed: number
  batches: number
  pending_remaining: number
  message?: string
}

// ========== Chat/AI Assistant Types ==========
// Types for the AI chatbot feature

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string // ISO 8601
}

export interface ChatRequest {
  message: string
  history?: {
    role: string
    content: string
  }[]
}

export interface StreamChunk {
  type: 'start' | 'content' | 'done' | 'error'
  content?: string
  message_id?: string
  message?: string // For error messages
}

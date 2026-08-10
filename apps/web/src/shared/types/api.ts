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

// ========== Reservation Configuration Types ==========
// Types for service periods, pacing, booking channels, and blackouts

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
export type BookingChannel = 'host' | 'phone' | 'web' | 'app'
export type BlackoutScope = 'full_day' | 'partial'
export type BlackoutStatus = 'active' | 'cancelled'

export interface ServicePeriod {
  id: string
  name: string
  days_of_week: DayOfWeek[]
  start_time: string // "HH:MM" 24h
  end_time: string   // "HH:MM" 24h
  slot_interval_minutes: number
  lead_time_hours: number
  cutoff_time: string | null // "HH:MM" 24h
  min_party_size: number
  max_party_size: number
  is_active: boolean
  default_duration_minutes?: number
  backend_period_ids?: Partial<Record<DayOfWeek, string>>
}

export interface PacingRule {
  id: string
  window_minutes: number
  max_covers_per_window: number
  service_period_id?: string | null
  channel?: BookingChannel | null
  is_active?: boolean
}

export interface ChannelRule {
  id?: string
  service_period_id?: string | null
  channel: BookingChannel
  is_enabled: boolean
}

export interface ReservationSettings {
  location_id: string
  service_periods: ServicePeriod[]
  pacing_rules: PacingRule[]
  channel_rules: ChannelRule[]
  default_slot_interval_minutes: number
  default_min_party_size: number
  default_max_party_size: number
  auto_confirm: boolean
  confirmation_lead_hours: number
  booking_horizon_days?: number
  grace_period_minutes?: number
  updated_at: string
}

export interface ReservationBlackout {
  id: string
  location_id: string
  date: string // "YYYY-MM-DD"
  start_date?: string
  end_date?: string
  scope: BlackoutScope
  start_time: string | null // "HH:MM" for partial
  end_time: string | null   // "HH:MM" for partial
  reason: string
  status: BlackoutStatus
  active?: boolean
  service_period_id?: string | null
  channels?: BookingChannel[]
  created_at: string
  updated_at: string
}

export interface ReservationBlackoutCreate {
  date: string
  start_date?: string
  end_date?: string
  scope: BlackoutScope
  start_time?: string | null
  end_time?: string | null
  reason: string
  channels?: BookingChannel[]
  service_period_id?: string | null
}

export interface ReservationBlackoutUpdate {
  date?: string
  start_date?: string
  end_date?: string
  status?: BlackoutStatus
  reason?: string
  scope?: BlackoutScope
  start_time?: string | null
  end_time?: string | null
  channels?: BookingChannel[]
  service_period_id?: string | null
}

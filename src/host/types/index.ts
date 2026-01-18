// Table types
export type TableStatus =
  | 'available'
  | 'occupied'
  | 'needs_server'
  | 'dirty'
  | 'blocked'
  | 'reserved'

export type TableShape = 'round' | 'square' | 'rectangle'

export interface Table {
  id: string
  number: number
  tableNumber: string // Original table_number from backend (e.g., "T1", "T5")
  shape: TableShape
  capacity: number
  position: { x: number; y: number }
  rotation: number
  sectionId: string
  status: TableStatus
  assignedServerId: string | null
  currentGuestId: string | null
  seatedAt: Date | null
  reservedFor: string | null
  cvConfidence: number
  _justUpdated?: boolean // Temporary flag for WebSocket update animation
}

// Guest types
export type GuestStatus =
  | 'waiting'
  | 'notified'
  | 'arriving'
  | 'seated'
  | 'no_show'

export interface Guest {
  id: string
  name: string
  partySize: number
  phone: string
  addedAt: Date
  estimatedWait: number
  status: GuestStatus
  notes: string
  preferences: string[]
  visitCount: number
  tags: string[]
}

// Reservation types
export type ReservationStatus =
  | 'confirmed'
  | 'upcoming'
  | 'arriving_soon'
  | 'arrived'
  | 'seated'
  | 'no_show'
  | 'cancelled'

export interface Reservation {
  id: string
  guestName: string
  partySize: number
  phone: string
  email: string
  dateTime: Date
  status: ReservationStatus
  tableId: string | null
  notes: string
  specialRequests: string[]
  source: 'phone' | 'online' | 'walk_in' | 'opentable'
}

// Server types
export type ServerStatus = 'active' | 'on_break' | 'off'

export interface Server {
  id: string
  name: string
  initials: string
  color: string
  sectionIds: string[]
  activeTableCount: number
  rotationPosition: number
  status: ServerStatus
  efficiency: number
  totalTips: number
}

// Section types
export interface Section {
  id: string
  name: string
  color: string
  tableIds: string[]
  serverId: string | null
}

// Activity types
export type ActivityType =
  | 'seated'
  | 'cleared'
  | 'reservation_arrived'
  | 'wait_added'
  | 'table_status_change'
  | 'server_assigned'
  | 'cv_alert'

export type ActivityPriority = 'low' | 'medium' | 'high'

export interface ActivityItem {
  id: string
  type: ActivityType
  message: string
  timestamp: Date
  tableId?: string
  guestId?: string
  serverId?: string
  priority: ActivityPriority
  read: boolean
}

// Recommendation types
export type RecommendationType = 'seat_suggestion' | 'alert' | 'server_stat' | 'optimization'

export interface SmartRecommendation {
  id: string
  type: RecommendationType
  title: string
  description: string
  priority: number
  actionLabel: string
  tableId?: string
  guestId?: string
  serverId?: string
  cvReason: string
}

// Server assignment mode
export type ServerMode = 'sections' | 'rotations'

// Demo and WebSocket types
export interface TableStateEvent {
  type: 'table.state'
  camera_id: string
  table_id: string
  table_number: string
  state: string
  confidence: number
  timestamp: string
}

export interface BackendTable {
  id: string
  table_number: string
  capacity: number
  table_type: string
  location: string
  state: string
  section_name: string
  waiter_name: string | null
  party_size: number
  seated_duration_minutes: number
}

export interface TableRecommendation {
  table_id: string
  table_number: string
  score: number
  reason: string
  table_capacity?: number // Use this from RouteResponse to avoid mismatch
  table_type?: string
  table_location?: string
}

// Demo Summary types (for live waiter/table stats)
export interface DemoSummaryTable {
  table_id: string
  table_number: string
  capacity: number
  table_type: string
  location: string
  section_id: string
  section_name: string
}

export interface DemoSummaryWaiter {
  waiter_id: string
  name: string
  tier: string
  section_id: string
  status: string
  current_tables: number
  current_covers: number
  current_tips: number
  priority_score: number
  rank: number
}

export interface DemoSummaryResponse {
  generated_at: string
  routing_mode: string
  open_tables_count: number
  tables: DemoSummaryTable[]
  waiters: DemoSummaryWaiter[]
}

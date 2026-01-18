import { create } from 'zustand'
import type { Table, Guest, Reservation, Server, Section, ActivityItem, SmartRecommendation, ServerMode, TableStatus, TableStateEvent, BackendTable, TableRecommendation, DemoSummaryResponse } from '../types'
import { mockTables, mockGuests, mockReservations, mockServers, mockSections, mockActivity, mockRecommendations } from '../data/mockData'
import { apiClient } from '../../shared/api/client'
import { ENDPOINTS } from '../../shared/api/endpoints'

interface UndoAction {
  type: 'seat' | 'unseat' | 'status_change'
  tableId: string
  previousStatus: TableStatus
  guestId?: string
  guestData?: Guest
}

export type Theme = 'light' | 'dark'

interface RestaurantState {
  // Data
  tables: Table[]
  guests: Guest[]
  reservations: Reservation[]
  servers: Server[]
  sections: Section[]
  activity: ActivityItem[]
  recommendations: SmartRecommendation[]

  // UI State
  selectedTableId: string | null
  selectedGuestId: string | null
  selectedServerId: string | null
  activeSection: string | null
  serverMode: ServerMode
  rightPanelCollapsed: boolean
  activeTab: 'waitlist' | 'reservations'
  theme: Theme

  // Undo history
  undoHistory: UndoAction[]

  // Demo state
  demoActive: boolean
  demoStatus: { speed: number; cameras: string[] } | null
  wsConnected: boolean
  lastCvUpdate: Date | null

  // Actions
  setSelectedTable: (id: string | null) => void
  setSelectedGuest: (id: string | null) => void
  setSelectedServer: (id: string | null) => void
  setActiveSection: (id: string | null) => void
  setServerMode: (mode: ServerMode) => void
  toggleRightPanel: () => void
  setActiveTab: (tab: 'waitlist' | 'reservations') => void
  toggleTheme: () => void

  // Table actions
  updateTableStatus: (tableId: string, status: TableStatus) => void
  seatGuest: (guestId: string, tableId: string) => void
  unseatTable: (tableId: string) => void
  undo: () => void

  // Guest actions
  addGuest: (guest: Omit<Guest, 'id' | 'addedAt' | 'status'>) => void
  removeGuest: (guestId: string) => void

  // Activity actions
  addActivity: (activity: Omit<ActivityItem, 'id' | 'timestamp' | 'read'>) => void

  // Demo actions
  initializeFromBackend: (restaurantId: string) => Promise<void>
  startDemo: (restaurantId: string) => Promise<void>
  handleTableStateUpdate: (event: TableStateEvent) => void
  setWsConnected: (connected: boolean) => void
  getRoutingRecommendations: (restaurantId: string, partySize: number, preferences?: string[]) => Promise<TableRecommendation[]>
  seedDemoData: () => Promise<void>
  fetchDemoSummary: (restaurantId: string) => Promise<void>
}

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  // Initial data
  tables: mockTables,
  guests: mockGuests,
  reservations: mockReservations,
  servers: mockServers,
  sections: mockSections,
  activity: mockActivity,
  recommendations: mockRecommendations,

  // Initial UI state
  selectedTableId: null,
  selectedGuestId: null,
  selectedServerId: null,
  activeSection: null,
  serverMode: 'sections',
  rightPanelCollapsed: false,
  activeTab: 'waitlist',
  theme: 'light',

  // Undo history
  undoHistory: [],

  // Demo state
  demoActive: false,
  demoStatus: null,
  wsConnected: false,
  lastCvUpdate: null,

  // UI Actions
  setSelectedTable: (id) => set({ selectedTableId: id }),
  setSelectedGuest: (id) => set({ selectedGuestId: id }),
  setSelectedServer: (id) => set({ selectedServerId: id }),
  setActiveSection: (id) => set({ activeSection: id }),
  setServerMode: (mode) => set({ serverMode: mode }),
  toggleRightPanel: () => set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark'
    // Update document class for CSS
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(newTheme)
    return { theme: newTheme }
  }),

  // Table actions
  updateTableStatus: (tableId, status) => {
    const table = get().tables.find((t) => t.id === tableId)
    if (!table) return

    // Save to undo history
    const undoAction: UndoAction = {
      type: 'status_change',
      tableId,
      previousStatus: table.status,
    }
    set((state) => ({
      undoHistory: [...state.undoHistory, undoAction].slice(-10), // Keep last 10
      tables: state.tables.map((t) =>
        t.id === tableId
          ? { ...t, status, seatedAt: status === 'occupied' ? new Date() : null }
          : t
      ),
    }))

    get().addActivity({
      type: 'table_status_change',
      message: `Table ${table.number} marked as ${status}`,
      tableId,
      priority: status === 'needs_server' ? 'high' : 'low',
    })
  },

  seatGuest: (guestId, tableId) => {
    const guest = get().guests.find((g) => g.id === guestId)
    const table = get().tables.find((t) => t.id === tableId)

    if (!guest || !table) return

    const undoAction: UndoAction = {
      type: 'seat',
      tableId,
      previousStatus: table.status,
      guestId,
      guestData: guest,
    }

    // Find the server assigned to this table
    const assignedServerId = table.assignedServerId

    set((state) => {
      // Calculate new rotation: server who just got seated moves to back
      const maxRotation = Math.max(...state.servers.map(s => s.rotationPosition))

      const updatedServers = state.servers.map((server) => {
        if (server.id === assignedServerId) {
          // This server just got a table - increment count and move to back of rotation
          return {
            ...server,
            activeTableCount: server.activeTableCount + 1,
            rotationPosition: maxRotation + 1,
            totalTips: server.totalTips + Math.round(guest.partySize * 8), // ~$8/person avg tip
          }
        } else if (server.rotationPosition > 1) {
          // Move everyone else up in the queue
          return {
            ...server,
            rotationPosition: server.rotationPosition - 1,
          }
        }
        return server
      })

      return {
        // Save to undo history
        undoHistory: [...state.undoHistory, undoAction].slice(-10),
        // Update table
        tables: state.tables.map((t) =>
          t.id === tableId
            ? { ...t, status: 'occupied' as TableStatus, currentGuestId: guestId, seatedAt: new Date() }
            : t
        ),
        // Remove guest from waitlist
        guests: state.guests.filter((g) => g.id !== guestId),
        // Update servers with new counts and rotation
        servers: updatedServers,
        // Clear selection
        selectedGuestId: null,
        selectedTableId: null,
      }
    })

    get().addActivity({
      type: 'seated',
      message: `${guest.name} (${guest.partySize}) seated at Table ${table.number}`,
      tableId,
      guestId,
      priority: 'low',
    })
  },

  unseatTable: (tableId) => {
    const table = get().tables.find((t) => t.id === tableId)
    if (!table || table.status !== 'occupied') return

    const undoAction: UndoAction = {
      type: 'unseat',
      tableId,
      previousStatus: table.status,
    }
    set((state) => ({
      undoHistory: [...state.undoHistory, undoAction].slice(-10),
      tables: state.tables.map((t) =>
        t.id === tableId
          ? { ...t, status: 'available' as TableStatus, currentGuestId: null, seatedAt: null }
          : t
      ),
    }))

    get().addActivity({
      type: 'cleared',
      message: `Table ${table.number} cleared`,
      tableId,
      priority: 'low',
    })
  },

  undo: () => {
    const history = get().undoHistory
    if (history.length === 0) return

    const lastAction = history[history.length - 1]

    set((state) => {
      const newState: Partial<RestaurantState> = {
        undoHistory: state.undoHistory.slice(0, -1),
      }

      if (lastAction.type === 'seat' && lastAction.guestData) {
        // Undo seating: restore table status and add guest back
        newState.tables = state.tables.map((t) =>
          t.id === lastAction.tableId
            ? { ...t, status: lastAction.previousStatus, currentGuestId: null, seatedAt: null }
            : t
        )
        newState.guests = [...state.guests, lastAction.guestData]
      } else if (lastAction.type === 'unseat') {
        // Undo unseat: mark table as occupied again
        newState.tables = state.tables.map((t) =>
          t.id === lastAction.tableId
            ? { ...t, status: lastAction.previousStatus, seatedAt: new Date() }
            : t
        )
      } else if (lastAction.type === 'status_change') {
        // Undo status change
        newState.tables = state.tables.map((t) =>
          t.id === lastAction.tableId
            ? { ...t, status: lastAction.previousStatus }
            : t
        )
      }

      return newState
    })

    get().addActivity({
      type: 'table_status_change',
      message: 'Action undone',
      priority: 'low',
    })
  },

  addGuest: (guestData) => {
    const newGuest: Guest = {
      ...guestData,
      id: `w${Date.now()}`,
      addedAt: new Date(),
      status: 'waiting',
    }

    set((state) => ({
      guests: [...state.guests, newGuest],
    }))

    get().addActivity({
      type: 'wait_added',
      message: `${newGuest.name} (${newGuest.partySize}) added to waitlist`,
      guestId: newGuest.id,
      priority: 'low',
    })
  },

  removeGuest: (guestId) => {
    set((state) => ({
      guests: state.guests.filter((g) => g.id !== guestId),
    }))
  },

  addActivity: (activityData) => {
    const newActivity: ActivityItem = {
      ...activityData,
      id: `a${Date.now()}`,
      timestamp: new Date(),
      read: false,
    }

    set((state) => ({
      activity: [newActivity, ...state.activity].slice(0, 20),
    }))
  },

  // Demo actions
  initializeFromBackend: async (restaurantId) => {
    try {
      // Fetch tables from backend using section-view endpoint
      const tablesResponse = await apiClient.get<BackendTable[]>(
        ENDPOINTS.restaurantTables(restaurantId) + '/section-view'
      )

      // For demo: always use mock data (50 tables) since backend tables don't match our floor plan
      // Backend has different table numbering (B1, M1, O1) vs our mockData (T1-T50)
      console.log('[Store] Using mock data (50 tables) for demo - backend has', tablesResponse?.length || 0, 'tables')
      set({
        tables: mockTables,
        sections: mockSections,
        servers: mockServers,
      })
    } catch (error) {
      console.error('[Store] Failed to initialize from backend:', error)
      // Fall back to mock data
      set({
        tables: mockTables,
        sections: mockSections,
        servers: mockServers,
      })
    }
  },

  startDemo: async (restaurantId) => {
    try {
      const DEMO_VIDEOS_PATH = '/Users/huntercameronkuperman/Downloads/demovids copy'

      await apiClient.post(ENDPOINTS.demoInitiate(), {
        restaurant_id: restaurantId,
        speed: 1.0,
        overwrite: true,
        loop: true,  // Continuous loop
        mapping_mode: 'auto',
        seed_shift_snapshot: {
          enabled: true,
          waiters: [
            { name: 'Sarah', section_name: 'Main Dining', tier: 'strong', composite_score: 82, tables_served: 8, current_tables: 3, total_tips: 240, total_covers: 18 },
            { name: 'Tyler', section_name: 'Main Dining', tier: 'standard', composite_score: 62, tables_served: 6, current_tables: 2, total_tips: 180, total_covers: 12 },
            { name: 'Maria', section_name: 'Outdoor Patio', tier: 'standard', composite_score: 58, tables_served: 6, current_tables: 2, total_tips: 165, total_covers: 10 },
            { name: 'James', section_name: 'Bar', tier: 'developing', composite_score: 42, tables_served: 2, current_tables: 0, total_tips: 40, total_covers: 4 },
          ],
        },
        demos: [
          {
            camera_id: 'cam-2',
            results_path: `${DEMO_VIDEOS_PATH}/2_Mimosas/results.json`,
          },
          {
            camera_id: 'cam-3',
            results_path: `${DEMO_VIDEOS_PATH}/3_Mimosas/results.json`,
            table_map: { 'T5': '1', 'T0': '2', 'T2': '3', 'T6': '8', 'T1': '12', 'T10': '10', 'T9': '14', 'T3': '13', 'T4': '16', 'T7': '17', 'T8': '18' },
          },
          {
            camera_id: 'cam-4',
            results_path: `${DEMO_VIDEOS_PATH}/4_Mimosas/results.json`,
            table_map: { 'T6': '23', 'T4': '21', 'T1': '24', 'T5': '20', 'T0': '22', 'T2': '19', 'T3': '11', 'T8': '16', 'T7': '10', 'T9': '9' },
          },
          {
            camera_id: 'cam-5',
            results_path: `${DEMO_VIDEOS_PATH}/5_Mimosas/results.json`,
            table_map: { 'T1': '27', 'T0': '25', 'T2': '28', 'T3': '26', 'T4': '29', 'T5': '30', 'T6': '31' },
          },
          {
            camera_id: 'cam-6',
            results_path: `${DEMO_VIDEOS_PATH}/6_Mimosas/results.json`,
            table_map: { 'T3': '34', 'T9': '35', 'T7': '36', 'T0': '38', 'T6': '39', 'T2': '40', 'T5': '41', 'T8': '37', 'T1': '32', 'T4': '33' },
          },
          {
            camera_id: 'cam-7',
            results_path: `${DEMO_VIDEOS_PATH}/7_Mimosas/results.json`,
            table_map: { 'T2': '43', 'T0': '44', 'T4': '46', 'T5': '47', 'T3': '48', 'T1': '49', 'T6': '42', 'T7': '45', 'T8': '50' },
          },
          {
            camera_id: 'cam-8',
            results_path: `${DEMO_VIDEOS_PATH}/8_Mimosas/results.json`,
            table_map: { 'T0': '49', 'T1': '50' },
          },
          {
            camera_id: 'cam-9',
            results_path: `${DEMO_VIDEOS_PATH}/9_Mimosas/results.json`,
          },
          {
            camera_id: 'cam-11',
            results_path: `${DEMO_VIDEOS_PATH}/11_Mimosas/results.json`,
          },
        ],
      })

      set({
        demoActive: true,
        demoStatus: { speed: 1.0, cameras: ['cam-2', 'cam-3', 'cam-4', 'cam-5', 'cam-6', 'cam-7', 'cam-8', 'cam-9', 'cam-11'] },
      })

      console.log('[Store] Demo started with 9 cameras and seed_shift_snapshot')
    } catch (error) {
      console.error('[Store] Failed to start demo:', error)
    }
  },

  handleTableStateUpdate: (event) => {
    const newStatus = mapBackendState(event.state)

    set((state) => ({
      tables: state.tables.map((t) => {
        // Match by table_id or by parsing table_number
        const isMatch = t.id === event.table_id || t.number === parseInt(event.table_number.replace('T', ''))

        if (!isMatch) {
          return { ...t, _justUpdated: false }
        }

        // Only flash if the actual STATUS changed, not just confidence
        const stateChanged = t.status !== newStatus

        return {
          ...t,
          status: newStatus,
          cvConfidence: event.confidence,
          _justUpdated: stateChanged,  // Only flash on actual state change
        }
      }),
      lastCvUpdate: new Date(event.timestamp),
    }))

    // Always log confidence changes to console
    console.log(`[CV] Table ${event.table_number}: ${event.state} (${Math.round(event.confidence * 100)}%)`)

    // Only add activity feed entry on actual state changes
    const table = get().tables.find(t =>
      t.id === event.table_id || t.number === parseInt(event.table_number.replace('T', ''))
    )
    if (table && table._justUpdated) {
      get().addActivity({
        type: 'cv_alert',
        message: `CV: Table ${event.table_number} → ${event.state}`,
        priority: 'low',
      })
    }
  },

  setWsConnected: (connected) => {
    set({ wsConnected: connected })
  },

  getRoutingRecommendations: async (restaurantId, partySize, preferences = []) => {
    try {
      // Extract table_preference and location_preference from preferences array
      const tablePrefs = ['booth', 'bar', 'table']
      const locationPrefs = ['inside', 'outside', 'patio']
      const tablePreference = preferences.find(p => tablePrefs.includes(p)) || 'none'
      const locationPreference = preferences.find(p => locationPrefs.includes(p)) || 'none'

      const response = await apiClient.post<any>(
        ENDPOINTS.routingRecommend(restaurantId),
        {
          party_size: partySize,
          table_preference: tablePreference,
          location_preference: locationPreference,
        }
      )

      // Backend returns single RouteResponse object, not array
      if (!response.success) {
        console.warn('[Store] No routing match:', response.message)
        return []
      }

      // 🛡️ SAFETY CHECK: Validate table capacity
      if (response.table_capacity < partySize) {
        console.error(
          `[Store] 🚨 CAPACITY MISMATCH! Backend recommended Table ${response.table_number} (${response.table_capacity}-top) for party of ${partySize}. Finding better options...`
        )

        // Fall back to manual search for suitable tables
        const suitableTables = get().tables.filter(
          t => t.status === 'available' && t.capacity >= partySize
        )

        if (suitableTables.length === 0) {
          console.warn('[Store] No suitable tables found for party of', partySize)
          return []
        }

        // Sort by best fit (closest capacity without being too large)
        suitableTables.sort((a, b) => {
          const fitA = a.capacity - partySize
          const fitB = b.capacity - partySize
          return fitA - fitB // Smaller difference = better fit
        })

        return suitableTables.slice(0, 3).map((t, idx) => ({
          table_id: t.id,
          table_number: t.tableNumber, // Use original backend table_number
          score: 100 - (idx * 10), // Best fit gets highest score
          reason: `${t.capacity}-top • Perfect fit for ${partySize}`,
        }))
      }

      // Convert single RouteResponse to array with one recommendation
      const recommendation: TableRecommendation = {
        table_id: response.table_id,
        table_number: response.table_number,
        score: 100, // Primary recommendation
        reason: `${response.table_type} • ${response.table_location} • Server: ${response.waiter_name}`,
        table_capacity: response.table_capacity, // ✅ Include capacity from backend
        table_type: response.table_type,
        table_location: response.table_location,
      }

      return [recommendation]
    } catch (error) {
      console.error('[Store] Failed to get routing recommendations:', error)
      return []
    }
  },

  seedDemoData: async () => {
    try {
      console.log('[Store] Seeding demo data...')
      await apiClient.post(ENDPOINTS.seedDemo())
      console.log('[Store] Demo data seeded successfully')
      // Re-initialize to load the new data
      await get().initializeFromBackend('default')
    } catch (error) {
      console.error('[Store] Failed to seed demo data:', error)
    }
  },

  fetchDemoSummary: async (restaurantId) => {
    try {
      const response = await apiClient.get<DemoSummaryResponse>(
        ENDPOINTS.demoSummary(restaurantId)
      )

      // Map backend waiters to frontend Server format
      const mappedServers: Server[] = response.waiters.map((w, index) => ({
        id: w.waiter_id,
        name: w.name,
        initials: w.name.split(' ').map(n => n[0]).join('').toUpperCase(),
        color: ['#0A84FF', '#30D158', '#FF9F0A', '#BF5AF2'][index % 4], // Cycle through colors
        sectionIds: [w.section_id],
        activeTableCount: w.current_tables,
        rotationPosition: w.rank,
        status: w.status === 'active' ? 'active' : 'off',
        efficiency: Math.round(w.priority_score * 10), // Convert score to percentage
        totalTips: w.current_tips,
      }))

      set({ servers: mappedServers })
      console.log('[Store] Demo summary fetched:', mappedServers.length, 'waiters')
    } catch (error) {
      console.error('[Store] Failed to fetch demo summary:', error)
    }
  },
}))

// Helper function to map backend state to frontend TableStatus
function mapBackendState(state: string): TableStatus {
  const mapping: Record<string, TableStatus> = {
    'available': 'available',
    'clean': 'available',  // Backend uses "clean" for routing-eligible tables
    'occupied': 'occupied',
    'dirty': 'dirty',
    'needs_service': 'needs_server',
    'blocked': 'blocked',
    'reserved': 'reserved',
  }
  return mapping[state] || 'available'
}

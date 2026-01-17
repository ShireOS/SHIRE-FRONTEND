import { create } from 'zustand'
import type { Table, Guest, Reservation, Server, Section, ActivityItem, SmartRecommendation, ServerMode, TableStatus } from '../types'
import { mockTables, mockGuests, mockReservations, mockServers, mockSections, mockActivity, mockRecommendations } from '../data/mockData'

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
    set((state) => ({
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
      // Clear selection
      selectedGuestId: null,
      selectedTableId: null,
    }))

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
}))

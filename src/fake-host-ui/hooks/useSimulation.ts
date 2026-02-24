import { useEffect, useRef } from 'react'
import { useRestaurantStore } from '../../host/stores/restaurantStore'
import type { TableStatus } from '../../host/types'

const GUEST_NAMES = [
  'Anderson', 'Baker', 'Campbell', 'Douglas', 'Edwards', 'Fisher',
  'Graham', 'Harris', 'Irving', 'Jackson', 'Kennedy', 'Lawrence',
  'Mitchell', 'Nelson', 'Owens', 'Patterson', 'Quinn', 'Richardson',
  'Sullivan', 'Turner', 'Underwood', 'Vargas', 'Wallace', 'Young',
  'Zimmerman', 'Nguyen', 'Patel', 'Ortiz', 'Lee', 'Brooks',
]

const NOTES = [
  '', '', '', // Most have no notes
  'High chair needed',
  'Birthday brunch',
  'Gluten-free options',
  'Window seat preferred',
  'Celebrating anniversary',
  'First time visiting',
  'Allergic to shellfish',
]

const PREFERENCES_POOL: string[][] = [
  [], [], [], // Most have no preferences
  ['booth'],
  ['patio'],
  ['window'],
  ['quiet'],
  ['booth', 'quiet'],
  ['patio', 'window'],
]

const TAGS_POOL: string[][] = [
  [], [], [], [], // Most have no tags
  ['Regular'],
  ['VIP'],
  ['Birthday'],
]

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function useSimulation() {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    // Table state transitions every 8-15 seconds
    const tableInterval = setInterval(() => {
      const store = useRestaurantStore.getState()
      const tables = store.tables

      // Pick a random table
      const table = pickRandom(tables)
      if (!table) return

      let newStatus: TableStatus | null = null
      let message = ''

      if (table.status === 'occupied' && Math.random() < 0.3) {
        // Some occupied tables finish eating -> dirty
        newStatus = 'dirty'
        message = `Table ${table.number} cleared - needs bus`
      } else if (table.status === 'dirty') {
        // Dirty tables get cleaned -> available
        newStatus = 'available'
        message = `Table ${table.number} cleaned and ready`
      } else if (table.status === 'needs_server' && Math.random() < 0.5) {
        // Needs server gets attended to -> occupied
        newStatus = 'occupied'
        message = `Server attending Table ${table.number}`
      } else if (table.status === 'available' && Math.random() < 0.15) {
        // Occasionally an available table gets a walk-in
        newStatus = 'occupied'
        message = `Walk-in seated at Table ${table.number}`
      }

      if (newStatus && newStatus !== table.status) {
        useRestaurantStore.setState((state) => ({
          tables: state.tables.map((t) =>
            t.id === table.id
              ? {
                  ...t,
                  status: newStatus!,
                  seatedAt: newStatus === 'occupied' ? new Date() : null,
                  currentGuestId: newStatus === 'occupied' ? `sim-${Date.now()}` : null,
                  cvConfidence: 0.92 + Math.random() * 0.07,
                  _justUpdated: true,
                }
              : { ...t, _justUpdated: false }
          ),
          activity: [
            {
              id: `sim-a-${Date.now()}`,
              type: 'table_status_change' as const,
              message,
              timestamp: new Date(),
              tableId: table.id,
              priority: table.status === 'needs_server' ? 'high' as const : 'low' as const,
              read: false,
            },
            ...state.activity,
          ].slice(0, 20),
        }))
      }
    }, randomBetween(8000, 15000))

    // New guest arrivals every 25-45 seconds
    const guestInterval = setInterval(() => {
      const name = pickRandom(GUEST_NAMES)
      const partySize = pickRandom([2, 2, 2, 3, 4, 4, 4, 5, 6])
      const notes = pickRandom(NOTES)
      const preferences = pickRandom(PREFERENCES_POOL)
      const tags = pickRandom(TAGS_POOL)

      const newGuest = {
        id: `sim-g-${Date.now()}`,
        name,
        partySize,
        phone: `(843) ${randomBetween(200, 999)}-${randomBetween(1000, 9999)}`,
        addedAt: new Date(),
        estimatedWait: randomBetween(5, 20),
        status: 'waiting' as const,
        notes,
        preferences,
        visitCount: Math.random() < 0.3 ? randomBetween(2, 15) : 0,
        tags,
      }

      useRestaurantStore.setState((state) => ({
        guests: [...state.guests, newGuest],
        activity: [
          {
            id: `sim-a-${Date.now()}`,
            type: 'wait_added' as const,
            message: `${name} (${partySize}) added to waitlist`,
            timestamp: new Date(),
            guestId: newGuest.id,
            priority: 'low' as const,
            read: false,
          },
          ...state.activity,
        ].slice(0, 20),
      }))
    }, randomBetween(25000, 45000))

    // Auto-seat oldest guest every 35-60 seconds
    const seatInterval = setInterval(() => {
      const store = useRestaurantStore.getState()
      const waitingGuests = store.guests.filter((g) => g.status === 'waiting')
      if (waitingGuests.length === 0) return

      const guest = waitingGuests[0] // Oldest
      const availableTable = store.tables.find(
        (t) => t.status === 'available' && t.capacity >= guest.partySize
      )
      if (!availableTable) return

      store.seatGuest(guest.id, availableTable.id)
    }, randomBetween(35000, 60000))

    // CV confidence updates every 5-10 seconds (subtle)
    const cvInterval = setInterval(() => {
      useRestaurantStore.setState((state) => ({
        tables: state.tables.map((t) => ({
          ...t,
          cvConfidence: Math.max(0.88, Math.min(0.99, t.cvConfidence + (Math.random() - 0.5) * 0.03)),
          _justUpdated: false,
        })),
        lastCvUpdate: new Date(),
      }))
    }, randomBetween(5000, 10000))

    return () => {
      clearInterval(tableInterval)
      clearInterval(guestInterval)
      clearInterval(seatInterval)
      clearInterval(cvInterval)
    }
  }, [])
}

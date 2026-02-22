import type { Table, Guest, Reservation, Server, Section, ActivityItem, SmartRecommendation } from '../../host/types'

type FloorLayoutNode = {
  id: string
  order: number
  width: number
  height: number
  x: number
  y: number
  anchorX: number
  anchorY: number
}

const FLOOR_LAYOUT_SCALE = { x: 1.22, y: 1.16 }
const FLOOR_LAYOUT_GAP = { x: 10, y: 8 }
const FLOOR_LAYOUT_ANCHOR_PULL = 0.08
const FLOOR_LAYOUT_ITERATIONS = 36
const FLOOR_LAYOUT_ORIGIN = { x: 26, y: 56 }

const TABLE_SIZE_LOOKUP = {
  round: {
    2: { width: 48, height: 48 },
    4: { width: 56, height: 56 },
    6: { width: 64, height: 64 },
    8: { width: 80, height: 80 },
    10: { width: 96, height: 96 },
  },
  square: {
    2: { width: 48, height: 48 },
    4: { width: 56, height: 56 },
    6: { width: 64, height: 64 },
    8: { width: 80, height: 80 },
    10: { width: 96, height: 96 },
  },
  rectangle: {
    2: { width: 64, height: 40 },
    4: { width: 80, height: 48 },
    6: { width: 96, height: 56 },
    8: { width: 112, height: 64 },
    10: { width: 128, height: 72 },
  },
} as const

function getTableSize(table: Table) {
  const sizes = TABLE_SIZE_LOOKUP[table.shape]
  const capacity = [2, 4, 6, 8, 10].find((value) => value >= table.capacity) ?? 10
  return sizes[capacity as 2 | 4 | 6 | 8 | 10] || sizes[4]
}

function getTableOrder(id: string) {
  const parsed = Number.parseInt(id.replace(/\D+/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function addBreathingRoom(tables: Table[]): Table[] {
  const nodes: FloorLayoutNode[] = tables.map((table) => {
    const size = getTableSize(table)
    const anchorX = table.position.x * FLOOR_LAYOUT_SCALE.x
    const anchorY = table.position.y * FLOOR_LAYOUT_SCALE.y

    return {
      id: table.id,
      order: getTableOrder(table.id),
      width: size.width,
      height: size.height,
      x: anchorX,
      y: anchorY,
      anchorX,
      anchorY,
    }
  })

  for (let iteration = 0; iteration < FLOOR_LAYOUT_ITERATIONS; iteration += 1) {
    let moved = false

    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i]
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j]
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
        const pushX = overlapX + FLOOR_LAYOUT_GAP.x
        const pushY = overlapY + FLOOR_LAYOUT_GAP.y

        if (pushX <= 0 || pushY <= 0) continue
        moved = true

        if (pushX < pushY) {
          const aCenterX = a.x + a.width / 2
          const bCenterX = b.x + b.width / 2
          const direction = aCenterX === bCenterX ? (a.order < b.order ? -1 : 1) : Math.sign(bCenterX - aCenterX)
          const push = pushX / 2
          a.x -= direction * push
          b.x += direction * push
        } else {
          const aCenterY = a.y + a.height / 2
          const bCenterY = b.y + b.height / 2
          const direction = aCenterY === bCenterY ? (a.order < b.order ? -1 : 1) : Math.sign(bCenterY - aCenterY)
          const push = pushY / 2
          a.y -= direction * push
          b.y += direction * push
        }
      }
    }

    for (const node of nodes) {
      node.x += (node.anchorX - node.x) * FLOOR_LAYOUT_ANCHOR_PULL
      node.y += (node.anchorY - node.y) * FLOOR_LAYOUT_ANCHOR_PULL
    }

    if (!moved && iteration > 6) {
      break
    }
  }

  const minX = Math.min(...nodes.map((node) => node.x))
  const minY = Math.min(...nodes.map((node) => node.y))
  const offsetX = FLOOR_LAYOUT_ORIGIN.x - minX
  const offsetY = FLOOR_LAYOUT_ORIGIN.y - minY
  const byId = new Map(nodes.map((node) => [node.id, node]))

  return tables.map((table) => {
    const node = byId.get(table.id)
    if (!node) return table

    return {
      ...table,
      position: {
        x: Math.round(node.x + offsetX),
        y: Math.round(node.y + offsetY),
      },
    }
  })
}

// =============================================================================
// Mimosas Southern Kitchen & Bar - 7430 N Kings Hwy, Myrtle Beach, SC 29572
// Saturday morning snapshot at ~9:30 AM during brunch rush
// Open 7 AM - 2 PM | ~235 seats | ~50 tables + bar
// =============================================================================

// Sections matching Mimosas floor plan color zones
export const mockSections: Section[] = [
  { id: 'section-a', name: 'Main Dining A', color: '#E07B39', tableIds: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12', 't13', 't14', 't46', 't49'], serverId: 's1' },
  { id: 'section-b', name: 'Main Dining B', color: '#F4D03F', tableIds: ['t15', 't16', 't17', 't18', 't47'], serverId: 's2' },
  { id: 'section-c', name: 'Back Section', color: '#9B59B6', tableIds: ['t19', 't20', 't21', 't22', 't23', 't24', 't25', 't26', 't27', 't28', 't48'], serverId: 's3' },
  { id: 'outdoor', name: 'Outdoor Patio', color: '#27AE60', tableIds: ['t29', 't30', 't31', 't32', 't33', 't34', 't35', 't36'], serverId: 's4' },
  { id: 'section-d', name: 'Bar Area', color: '#3498DB', tableIds: ['t37', 't38', 't39', 't40', 't41', 't42', 't43', 't44', 't45', 't50'], serverId: 's5' },
]

// 50 tables scaled to ~700x420 viewport
// Saturday 9:30 AM: ~60% available, ~25% occupied, ~5% needs_server, ~5% dirty, ~5% reserved
const baseMockTables: Table[] = [
  // =========================================================================
  // SECTION A: Main Dining A (14 tables) - Left/center main room
  // Large southern dining room with square and rectangle tops, family-style
  // =========================================================================

  // Left wall booths (t1-t4) - 4-tops along the wall
  { id: 't1', number: 1, tableNumber: 'T1', shape: 'rectangle', capacity: 4, position: { x: 25, y: 60 }, rotation: 0, sectionId: 'section-a', status: 'occupied', assignedServerId: 's1', currentGuestId: 'g1', seatedAt: new Date(Date.now() - 42 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't2', number: 2, tableNumber: 'T2', shape: 'rectangle', capacity: 4, position: { x: 25, y: 115 }, rotation: 0, sectionId: 'section-a', status: 'occupied', assignedServerId: 's1', currentGuestId: 'g2', seatedAt: new Date(Date.now() - 28 * 60000), reservedFor: null, cvConfidence: 0.97 },
  { id: 't3', number: 3, tableNumber: 'T3', shape: 'rectangle', capacity: 4, position: { x: 25, y: 170 }, rotation: 0, sectionId: 'section-a', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.99 },
  { id: 't4', number: 4, tableNumber: 'T4', shape: 'rectangle', capacity: 6, position: { x: 25, y: 225 }, rotation: 0, sectionId: 'section-a', status: 'dirty', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.91 },

  // Center cluster row 1 (t5-t8) - mix of 2 and 4 tops
  { id: 't5', number: 5, tableNumber: 'T5', shape: 'square', capacity: 4, position: { x: 95, y: 60 }, rotation: 0, sectionId: 'section-a', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't6', number: 6, tableNumber: 'T6', shape: 'square', capacity: 4, position: { x: 150, y: 60 }, rotation: 0, sectionId: 'section-a', status: 'occupied', assignedServerId: 's1', currentGuestId: 'g3', seatedAt: new Date(Date.now() - 15 * 60000), reservedFor: null, cvConfidence: 0.95 },
  { id: 't7', number: 7, tableNumber: 'T7', shape: 'square', capacity: 2, position: { x: 205, y: 60 }, rotation: 0, sectionId: 'section-a', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't8', number: 8, tableNumber: 'T8', shape: 'square', capacity: 2, position: { x: 255, y: 60 }, rotation: 0, sectionId: 'section-a', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },

  // Center cluster row 2 (t9-t11) - 4-tops
  { id: 't9', number: 9, tableNumber: 'T9', shape: 'square', capacity: 4, position: { x: 95, y: 115 }, rotation: 0, sectionId: 'section-a', status: 'needs_server', assignedServerId: 's1', currentGuestId: 'g4', seatedAt: new Date(Date.now() - 6 * 60000), reservedFor: null, cvConfidence: 0.93 },
  { id: 't10', number: 10, tableNumber: 'T10', shape: 'square', capacity: 4, position: { x: 150, y: 115 }, rotation: 0, sectionId: 'section-a', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't11', number: 11, tableNumber: 'T11', shape: 'square', capacity: 4, position: { x: 205, y: 115 }, rotation: 0, sectionId: 'section-a', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },

  // Center cluster row 3 (t12-t14) - mix with one 6-top
  { id: 't12', number: 12, tableNumber: 'T12', shape: 'square', capacity: 4, position: { x: 95, y: 170 }, rotation: 0, sectionId: 'section-a', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.99 },
  { id: 't13', number: 13, tableNumber: 'T13', shape: 'rectangle', capacity: 6, position: { x: 150, y: 170 }, rotation: 0, sectionId: 'section-a', status: 'occupied', assignedServerId: 's1', currentGuestId: 'g5', seatedAt: new Date(Date.now() - 50 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't14', number: 14, tableNumber: 'T14', shape: 'square', capacity: 4, position: { x: 220, y: 170 }, rotation: 0, sectionId: 'section-a', status: 'reserved', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: 'r2', cvConfidence: 0.98 },

  // =========================================================================
  // SECTION B: Main Dining B (4 tables) - Center feature area, incl. 8-top
  // Community/big party zone near the kitchen pass
  // =========================================================================

  { id: 't15', number: 15, tableNumber: 'T15', shape: 'square', capacity: 4, position: { x: 310, y: 60 }, rotation: 0, sectionId: 'section-b', status: 'available', assignedServerId: 's2', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't16', number: 16, tableNumber: 'T16', shape: 'rectangle', capacity: 8, position: { x: 310, y: 115 }, rotation: 0, sectionId: 'section-b', status: 'occupied', assignedServerId: 's2', currentGuestId: 'g6', seatedAt: new Date(Date.now() - 35 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't17', number: 17, tableNumber: 'T17', shape: 'square', capacity: 4, position: { x: 310, y: 175 }, rotation: 0, sectionId: 'section-b', status: 'available', assignedServerId: 's2', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  { id: 't18', number: 18, tableNumber: 'T18', shape: 'rectangle', capacity: 6, position: { x: 310, y: 230 }, rotation: 0, sectionId: 'section-b', status: 'reserved', assignedServerId: 's2', currentGuestId: null, seatedAt: null, reservedFor: 'r3', cvConfidence: 0.98 },

  // =========================================================================
  // SECTION C: Back Section (10 tables) - Quieter back room
  // Mix of square 4-tops and rectangle 6-tops for larger groups
  // =========================================================================

  { id: 't19', number: 19, tableNumber: 'T19', shape: 'square', capacity: 4, position: { x: 390, y: 50 }, rotation: 0, sectionId: 'section-c', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.99 },
  { id: 't20', number: 20, tableNumber: 'T20', shape: 'square', capacity: 4, position: { x: 445, y: 50 }, rotation: 0, sectionId: 'section-c', status: 'occupied', assignedServerId: 's3', currentGuestId: 'g7', seatedAt: new Date(Date.now() - 22 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't21', number: 21, tableNumber: 'T21', shape: 'square', capacity: 4, position: { x: 500, y: 50 }, rotation: 0, sectionId: 'section-c', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't22', number: 22, tableNumber: 'T22', shape: 'rectangle', capacity: 6, position: { x: 390, y: 105 }, rotation: 0, sectionId: 'section-c', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  { id: 't23', number: 23, tableNumber: 'T23', shape: 'rectangle', capacity: 6, position: { x: 460, y: 105 }, rotation: 0, sectionId: 'section-c', status: 'occupied', assignedServerId: 's3', currentGuestId: 'g8', seatedAt: new Date(Date.now() - 38 * 60000), reservedFor: null, cvConfidence: 0.95 },
  { id: 't24', number: 24, tableNumber: 'T24', shape: 'square', capacity: 4, position: { x: 390, y: 160 }, rotation: 0, sectionId: 'section-c', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't25', number: 25, tableNumber: 'T25', shape: 'square', capacity: 4, position: { x: 445, y: 160 }, rotation: 0, sectionId: 'section-c', status: 'dirty', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.90 },
  { id: 't26', number: 26, tableNumber: 'T26', shape: 'square', capacity: 2, position: { x: 500, y: 160 }, rotation: 0, sectionId: 'section-c', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  { id: 't27', number: 27, tableNumber: 'T27', shape: 'rectangle', capacity: 6, position: { x: 420, y: 215 }, rotation: 0, sectionId: 'section-c', status: 'occupied', assignedServerId: 's3', currentGuestId: 'g9', seatedAt: new Date(Date.now() - 55 * 60000), reservedFor: null, cvConfidence: 0.94 },
  { id: 't28', number: 28, tableNumber: 'T28', shape: 'square', capacity: 4, position: { x: 500, y: 215 }, rotation: 0, sectionId: 'section-c', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },

  // =========================================================================
  // OUTDOOR PATIO (8 tables) - All round tops, breezy morning seating
  // Wrought iron rounds under umbrellas, popular in good weather
  // =========================================================================

  { id: 't29', number: 29, tableNumber: 'T29', shape: 'round', capacity: 4, position: { x: 575, y: 40 }, rotation: 0, sectionId: 'outdoor', status: 'occupied', assignedServerId: 's4', currentGuestId: 'g10', seatedAt: new Date(Date.now() - 18 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't30', number: 30, tableNumber: 'T30', shape: 'round', capacity: 4, position: { x: 635, y: 40 }, rotation: 0, sectionId: 'outdoor', status: 'available', assignedServerId: 's4', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't31', number: 31, tableNumber: 'T31', shape: 'round', capacity: 2, position: { x: 575, y: 95 }, rotation: 0, sectionId: 'outdoor', status: 'available', assignedServerId: 's4', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.99 },
  { id: 't32', number: 32, tableNumber: 'T32', shape: 'round', capacity: 2, position: { x: 635, y: 95 }, rotation: 0, sectionId: 'outdoor', status: 'occupied', assignedServerId: 's4', currentGuestId: 'g11', seatedAt: new Date(Date.now() - 25 * 60000), reservedFor: null, cvConfidence: 0.95 },
  { id: 't33', number: 33, tableNumber: 'T33', shape: 'round', capacity: 4, position: { x: 575, y: 150 }, rotation: 0, sectionId: 'outdoor', status: 'available', assignedServerId: 's4', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  { id: 't34', number: 34, tableNumber: 'T34', shape: 'round', capacity: 4, position: { x: 635, y: 150 }, rotation: 0, sectionId: 'outdoor', status: 'needs_server', assignedServerId: 's4', currentGuestId: 'g12', seatedAt: new Date(Date.now() - 7 * 60000), reservedFor: null, cvConfidence: 0.93 },
  { id: 't35', number: 35, tableNumber: 'T35', shape: 'round', capacity: 6, position: { x: 575, y: 205 }, rotation: 0, sectionId: 'outdoor', status: 'available', assignedServerId: 's4', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't36', number: 36, tableNumber: 'T36', shape: 'round', capacity: 4, position: { x: 635, y: 205 }, rotation: 0, sectionId: 'outdoor', status: 'available', assignedServerId: 's4', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },

  // =========================================================================
  // SECTION D: Bar Area (9 tables) - High-tops, bar-side smalls, cocktail zone
  // Mix of square high-tops and small rounds for bar/lounge feel
  // =========================================================================

  // Bar-adjacent high-tops (t37-t40)
  { id: 't37', number: 37, tableNumber: 'T37', shape: 'square', capacity: 2, position: { x: 95, y: 290 }, rotation: 0, sectionId: 'section-d', status: 'occupied', assignedServerId: 's5', currentGuestId: 'g13', seatedAt: new Date(Date.now() - 12 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't38', number: 38, tableNumber: 'T38', shape: 'square', capacity: 2, position: { x: 155, y: 290 }, rotation: 0, sectionId: 'section-d', status: 'available', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't39', number: 39, tableNumber: 'T39', shape: 'square', capacity: 2, position: { x: 215, y: 290 }, rotation: 0, sectionId: 'section-d', status: 'available', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  { id: 't40', number: 40, tableNumber: 'T40', shape: 'square', capacity: 2, position: { x: 275, y: 290 }, rotation: 0, sectionId: 'section-d', status: 'occupied', assignedServerId: 's5', currentGuestId: 'g14', seatedAt: new Date(Date.now() - 30 * 60000), reservedFor: null, cvConfidence: 0.95 },

  // Lounge area near bar (t41-t43) - 4-tops
  { id: 't41', number: 41, tableNumber: 'T41', shape: 'round', capacity: 4, position: { x: 345, y: 290 }, rotation: 0, sectionId: 'section-d', status: 'available', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't42', number: 42, tableNumber: 'T42', shape: 'round', capacity: 4, position: { x: 410, y: 290 }, rotation: 0, sectionId: 'section-d', status: 'available', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  { id: 't43', number: 43, tableNumber: 'T43', shape: 'square', capacity: 4, position: { x: 475, y: 290 }, rotation: 0, sectionId: 'section-d', status: 'dirty', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.89 },

  // Bar rail small tops (t44-t45)
  { id: 't44', number: 44, tableNumber: 'T44', shape: 'round', capacity: 2, position: { x: 540, y: 290 }, rotation: 0, sectionId: 'section-d', status: 'available', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't45', number: 45, tableNumber: 'T45', shape: 'round', capacity: 2, position: { x: 600, y: 290 }, rotation: 0, sectionId: 'section-d', status: 'available', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },

  // =========================================================================
  // Extra tables to reach 50 total - tucked into various sections
  // =========================================================================

  // Additional hallway/transition 2-tops in Section A
  { id: 't46', number: 46, tableNumber: 'T46', shape: 'square', capacity: 2, position: { x: 255, y: 115 }, rotation: 0, sectionId: 'section-a', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  // Window 4-top in Section B
  { id: 't47', number: 47, tableNumber: 'T47', shape: 'square', capacity: 4, position: { x: 310, y: 285 }, rotation: 0, sectionId: 'section-b', status: 'available', assignedServerId: 's2', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  // Two more in Back Section
  { id: 't48', number: 48, tableNumber: 'T48', shape: 'square', capacity: 2, position: { x: 555, y: 50 }, rotation: 0, sectionId: 'section-c', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.99 },
  { id: 't49', number: 49, tableNumber: 'T49', shape: 'rectangle', capacity: 4, position: { x: 25, y: 280 }, rotation: 0, sectionId: 'section-a', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't50', number: 50, tableNumber: 'T50', shape: 'square', capacity: 4, position: { x: 660, y: 290 }, rotation: 0, sectionId: 'section-d', status: 'available', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
]

export const mockTables: Table[] = addBreathingRoom(baseMockTables)

// Servers matching Mimosas sections
export const mockServers: Server[] = [
  { id: 's1', name: 'Destiny Williams', initials: 'DW', color: '#E07B39', sectionIds: ['section-a'], activeTableCount: 5, rotationPosition: 1, status: 'active', efficiency: 94, totalTips: 218 },
  { id: 's2', name: 'Marcus Johnson', initials: 'MJ', color: '#F4D03F', sectionIds: ['section-b'], activeTableCount: 1, rotationPosition: 2, status: 'active', efficiency: 89, totalTips: 156 },
  { id: 's3', name: 'Tiffany Robinson', initials: 'TR', color: '#9B59B6', sectionIds: ['section-c'], activeTableCount: 4, rotationPosition: 3, status: 'active', efficiency: 91, totalTips: 184 },
  { id: 's4', name: 'Carlos Mendez', initials: 'CM', color: '#27AE60', sectionIds: ['outdoor'], activeTableCount: 3, rotationPosition: 4, status: 'active', efficiency: 87, totalTips: 142 },
  { id: 's5', name: 'Jordan Kim', initials: 'JK', color: '#3498DB', sectionIds: ['section-d'], activeTableCount: 2, rotationPosition: 5, status: 'active', efficiency: 78, totalTips: 67 },
]

// Waitlist Guests - Saturday 9:30 AM brunch rush at Mimosas
// Mix of Myrtle Beach tourists, locals, and beach-weekend visitors
export const mockGuests: Guest[] = [
  {
    id: 'w1',
    name: 'Henderson',
    partySize: 4,
    phone: '(843) 267-4419',
    addedAt: new Date(Date.now() - 22 * 60000),
    estimatedWait: 15,
    status: 'waiting',
    notes: 'High chair needed, asked about shrimp & grits',
    preferences: ['booth'],
    visitCount: 14,
    tags: ['Regular', 'VIP'],
  },
  {
    id: 'w2',
    name: 'Kowalski',
    partySize: 2,
    phone: '(717) 445-8832',
    addedAt: new Date(Date.now() - 16 * 60000),
    estimatedWait: 8,
    status: 'notified',
    notes: 'Visiting from PA, first time',
    preferences: ['patio'],
    visitCount: 0,
    tags: [],
  },
  {
    id: 'w3',
    name: 'Washington',
    partySize: 6,
    phone: '(843) 602-1157',
    addedAt: new Date(Date.now() - 12 * 60000),
    estimatedWait: 20,
    status: 'waiting',
    notes: 'Birthday brunch for grandma, need space for gift bags',
    preferences: ['quiet'],
    visitCount: 7,
    tags: ['Birthday', 'Regular'],
  },
  {
    id: 'w4',
    name: 'Nowak',
    partySize: 3,
    phone: '(910) 334-7291',
    addedAt: new Date(Date.now() - 8 * 60000),
    estimatedWait: 12,
    status: 'waiting',
    notes: 'Gluten-free options needed for one guest',
    preferences: ['window'],
    visitCount: 2,
    tags: [],
  },
  {
    id: 'w5',
    name: 'Beaumont',
    partySize: 8,
    phone: '(843) 915-2206',
    addedAt: new Date(Date.now() - 5 * 60000),
    estimatedWait: 25,
    status: 'waiting',
    notes: 'Bachelorette group, wants mimosa flight for the table',
    preferences: ['patio'],
    visitCount: 0,
    tags: ['Large Party'],
  },
  {
    id: 'w6',
    name: 'Drayton',
    partySize: 2,
    phone: '(843) 448-6630',
    addedAt: new Date(Date.now() - 3 * 60000),
    estimatedWait: 5,
    status: 'waiting',
    notes: '',
    preferences: [],
    visitCount: 22,
    tags: ['VIP', 'Regular'],
  },
  {
    id: 'w7',
    name: 'Gutierrez',
    partySize: 4,
    phone: '(704) 889-1042',
    addedAt: new Date(Date.now() - 1 * 60000),
    estimatedWait: 15,
    status: 'waiting',
    notes: 'Booster seat needed, dairy allergy for the child',
    preferences: ['booth', 'quiet'],
    visitCount: 0,
    tags: [],
  },
]

// Reservations - Saturday morning at Mimosas
export const mockReservations: Reservation[] = [
  {
    id: 'r1',
    guestName: 'Patterson',
    partySize: 4,
    phone: '(843) 236-8801',
    email: 'lpatterson@gmail.com',
    dateTime: new Date(new Date().setHours(8, 30, 0, 0)),
    status: 'seated',
    tableId: 't1',
    notes: 'Weekly Saturday brunch, regulars since 2022',
    specialRequests: ['Usual booth by the window'],
    source: 'phone',
  },
  {
    id: 'r2',
    guestName: 'Caldwell',
    partySize: 4,
    phone: '(843) 399-2247',
    email: 'brianne.caldwell@yahoo.com',
    dateTime: new Date(new Date().setHours(9, 0, 0, 0)),
    status: 'arriving_soon',
    tableId: 't14',
    notes: 'Anniversary brunch',
    specialRequests: ['Mimosa flight pre-ordered', 'Window table if possible'],
    source: 'online',
  },
  {
    id: 'r3',
    guestName: 'Okafor',
    partySize: 6,
    phone: '(843) 457-3318',
    email: 'chiokafor@hotmail.com',
    dateTime: new Date(new Date().setHours(9, 45, 0, 0)),
    status: 'confirmed',
    tableId: 't18',
    notes: 'Family visiting from Charlotte',
    specialRequests: ['High chair needed', 'Nut allergy at table'],
    source: 'opentable',
  },
  {
    id: 'r4',
    guestName: 'Jennings',
    partySize: 2,
    phone: '(910) 520-7761',
    email: 'mike.jennings@outlook.com',
    dateTime: new Date(new Date().setHours(10, 30, 0, 0)),
    status: 'confirmed',
    tableId: null,
    notes: 'Proposing at brunch, need a quiet corner',
    specialRequests: ['Champagne bottle ready at table', 'Quiet table away from kitchen'],
    source: 'phone',
  },
  {
    id: 'r5',
    guestName: 'Thornton-Blake',
    partySize: 8,
    phone: '(843) 280-5543',
    email: 'thorntonblake.events@gmail.com',
    dateTime: new Date(new Date().setHours(11, 15, 0, 0)),
    status: 'upcoming',
    tableId: null,
    notes: 'Birthday celebration for Diane, 65th',
    specialRequests: ['Birthday celebration - need cake brought out', 'Bottomless mimosa package for 8', 'Balloons OK to bring?'],
    source: 'online',
  },
]

// Activity Feed - Saturday morning at Mimosas, brunch rush in full swing
export const mockActivity: ActivityItem[] = [
  {
    id: 'a1',
    type: 'seated',
    message: 'Party of 7 seated at Table 16 - large brunch group, mimosa pitchers ordered',
    timestamp: new Date(Date.now() - 35 * 60000),
    tableId: 't16',
    guestId: 'g6',
    serverId: 's2',
    priority: 'low',
    read: true,
  },
  {
    id: 'a2',
    type: 'cleared',
    message: 'Table 25 cleared after 48 min turn - shrimp & grits table, heavy reset needed',
    timestamp: new Date(Date.now() - 8 * 60000),
    tableId: 't25',
    serverId: 's3',
    priority: 'low',
    read: true,
  },
  {
    id: 'a3',
    type: 'cv_alert',
    message: 'Table 9 guests waiting 6+ min with no greeting - Destiny may be in the weeds',
    timestamp: new Date(Date.now() - 4 * 60000),
    tableId: 't9',
    serverId: 's1',
    priority: 'high',
    read: false,
  },
  {
    id: 'a4',
    type: 'reservation_arrived',
    message: 'Caldwell party (4) arriving soon - anniversary brunch, mimosa flight pre-ordered',
    timestamp: new Date(Date.now() - 2 * 60000),
    priority: 'medium',
    read: false,
  },
  {
    id: 'a5',
    type: 'table_status_change',
    message: 'Table 43 marked dirty - bar brunch couple left, quick 2-top turnover',
    timestamp: new Date(Date.now() - 1 * 60000),
    tableId: 't43',
    serverId: 's5',
    priority: 'medium',
    read: false,
  },
  {
    id: 'a6',
    type: 'wait_added',
    message: 'Beaumont bachelorette party of 8 added to waitlist - requesting patio & mimosa flights',
    timestamp: new Date(Date.now() - 5 * 60000),
    guestId: 'w5',
    priority: 'medium',
    read: true,
  },
]

// Smart Recommendations - Mimosas-specific AI suggestions
export const mockRecommendations: SmartRecommendation[] = [
  {
    id: 'rec1',
    type: 'seat_suggestion',
    title: 'Seat Henderson (4) at T12',
    description: 'Regular VIP waiting 22 min - Table 12 is a booth in Section A, Destiny knows them by name. Party includes toddler, high chair already staged.',
    priority: 97,
    actionLabel: 'Seat Now',
    tableId: 't12',
    guestId: 'w1',
    serverId: 's1',
    cvReason: 'VIP regular, longest wait, booth preference matched, high chair pre-staged nearby',
  },
  {
    id: 'rec2',
    type: 'alert',
    title: 'Table 9 Needs Greeting',
    description: 'Party of 3 seated 6 min ago with no server contact. Destiny has 5 active tables - consider having Marcus assist.',
    priority: 92,
    actionLabel: 'Alert Destiny',
    tableId: 't9',
    serverId: 's1',
    cvReason: 'CV detected guests looking around, no menu interaction, 6 min without server visit',
  },
  {
    id: 'rec3',
    type: 'seat_suggestion',
    title: 'Seat Drayton (2) at Bar T38',
    description: 'Local regulars, 22 visits. Quick bar 2-top available, they usually order the chicken & waffles combo and are in and out in 35 min.',
    priority: 80,
    actionLabel: 'Seat at Bar',
    tableId: 't38',
    guestId: 'w6',
    serverId: 's5',
    cvReason: 'Party of 2, frequent visitors, bar 2-top open, fast expected turnover',
  },
  {
    id: 'rec4',
    type: 'optimization',
    title: 'Prep Table 27 for Turnover',
    description: 'Party of 5 at Table 27 has been seated 55 min, checks dropped 12 min ago. Washington birthday party of 6 needs a 6-top - this will be the first available.',
    priority: 72,
    actionLabel: 'Watch Table',
    tableId: 't27',
    guestId: 'w3',
    serverId: 's3',
    cvReason: 'Predicted turnover in ~8 min based on payment activity, matches pending 6-top waitlist need',
  },
  {
    id: 'rec5',
    type: 'server_stat',
    title: 'Rebalance: Jordan Needs Tables',
    description: 'Jordan has 2 active tables at bar (78% efficiency). Marcus has 1 table in Section B. Route next walk-in 2-tops to bar area to build Jordan\'s rhythm.',
    priority: 55,
    actionLabel: 'View Rotation',
    serverId: 's5',
    cvReason: 'Newer server below load average, building confidence with smaller parties recommended',
  },
]

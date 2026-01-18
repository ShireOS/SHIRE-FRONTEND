import type { Table, Guest, Reservation, Server, Section, ActivityItem, SmartRecommendation } from '../types'

// Sections matching floor plan color zones
export const mockSections: Section[] = [
  { id: 'busser3', name: 'Section A', color: '#E07B39', tableIds: ['t1', 't2', 't3', 't8', 't9', 't10', 't11', 't12', 't13', 't14', 't16', 't17', 't18', 't19'], serverId: 's1' },
  { id: 'busser2', name: 'Section B', color: '#F4D03F', tableIds: ['t20', 't21', 't22', 't23'], serverId: 's2' },
  { id: 'purple', name: 'Section C', color: '#9B59B6', tableIds: ['t24', 't25', 't26', 't27', 't28', 't29', 't38', 't39', 't40', 't41'], serverId: 's3' },
  { id: 'outdoor', name: 'Outdoor', color: '#27AE60', tableIds: ['t30', 't31', 't32', 't33', 't34', 't35', 't36', 't37'], serverId: 's4' },
  { id: 'busser1', name: 'Section D', color: '#3498DB', tableIds: ['t42', 't43', 't44', 't45', 't46', 't47', 't48', 't49', 't50'], serverId: 's5' },
]

// Tables matching floor plan layout (excluding tables 4-7 and bar stools)
export const mockTables: Table[] = [
  // Far left column (1, 2, 3)
  { id: 't1', number: 1, tableNumber: 'T1', shape: 'square', capacity: 4, position: { x: 30, y: 340 }, rotation: 0, sectionId: 'busser3', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't2', number: 2, tableNumber: 'T2', shape: 'square', capacity: 4, position: { x: 30, y: 260 }, rotation: 0, sectionId: 'busser3', status: 'occupied', assignedServerId: 's1', currentGuestId: 'g1', seatedAt: new Date(Date.now() - 35 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't3', number: 3, tableNumber: 'T3', shape: 'square', capacity: 4, position: { x: 30, y: 180 }, rotation: 0, sectionId: 'busser3', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.99 },

  // Pink/Orange section - Row 8-11
  { id: 't8', number: 8, tableNumber: 'T8', shape: 'square', capacity: 4, position: { x: 100, y: 220 }, rotation: 0, sectionId: 'busser3', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't9', number: 9, tableNumber: 'T9', shape: 'square', capacity: 4, position: { x: 160, y: 220 }, rotation: 0, sectionId: 'busser3', status: 'occupied', assignedServerId: 's1', currentGuestId: 'g2', seatedAt: new Date(Date.now() - 20 * 60000), reservedFor: null, cvConfidence: 0.97 },
  { id: 't10', number: 10, tableNumber: 'T10', shape: 'square', capacity: 4, position: { x: 220, y: 220 }, rotation: 0, sectionId: 'busser3', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  { id: 't11', number: 11, tableNumber: 'T11', shape: 'square', capacity: 4, position: { x: 280, y: 220 }, rotation: 0, sectionId: 'busser3', status: 'needs_server', assignedServerId: 's1', currentGuestId: 'g3', seatedAt: new Date(Date.now() - 5 * 60000), reservedFor: null, cvConfidence: 0.94 },

  // Orange section - Row 12-14
  { id: 't12', number: 12, tableNumber: 'T12', shape: 'square', capacity: 4, position: { x: 100, y: 150 }, rotation: 0, sectionId: 'busser3', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't13', number: 13, tableNumber: 'T13', shape: 'square', capacity: 4, position: { x: 160, y: 150 }, rotation: 0, sectionId: 'busser3', status: 'occupied', assignedServerId: 's1', currentGuestId: 'g4', seatedAt: new Date(Date.now() - 45 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't14', number: 14, tableNumber: 'T14', shape: 'square', capacity: 4, position: { x: 220, y: 150 }, rotation: 0, sectionId: 'busser3', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },

  // Top orange row 16-19
  { id: 't16', number: 16, tableNumber: 'T16', shape: 'square', capacity: 4, position: { x: 100, y: 80 }, rotation: 0, sectionId: 'busser3', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.99 },
  { id: 't17', number: 17, tableNumber: 'T17', shape: 'square', capacity: 4, position: { x: 160, y: 80 }, rotation: 0, sectionId: 'busser3', status: 'dirty', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.92 },
  { id: 't18', number: 18, tableNumber: 'T18', shape: 'square', capacity: 4, position: { x: 220, y: 80 }, rotation: 0, sectionId: 'busser3', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't19', number: 19, tableNumber: 'T19', shape: 'square', capacity: 4, position: { x: 280, y: 80 }, rotation: 0, sectionId: 'busser3', status: 'occupied', assignedServerId: 's1', currentGuestId: 'g5', seatedAt: new Date(Date.now() - 15 * 60000), reservedFor: null, cvConfidence: 0.95 },

  // Yellow center section 20-23
  { id: 't20', number: 20, tableNumber: 'T20', shape: 'square', capacity: 4, position: { x: 350, y: 170 }, rotation: 0, sectionId: 'busser2', status: 'available', assignedServerId: 's2', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't21', number: 21, tableNumber: 'T21', shape: 'rectangle', capacity: 6, position: { x: 350, y: 230 }, rotation: 0, sectionId: 'busser2', status: 'occupied', assignedServerId: 's2', currentGuestId: 'g6', seatedAt: new Date(Date.now() - 30 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't22', number: 22, tableNumber: 'T22', shape: 'square', capacity: 4, position: { x: 350, y: 110 }, rotation: 0, sectionId: 'busser2', status: 'available', assignedServerId: 's2', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  { id: 't23', number: 23, tableNumber: 'T23', shape: 'square', capacity: 4, position: { x: 350, y: 50 }, rotation: 0, sectionId: 'busser2', status: 'reserved', assignedServerId: 's2', currentGuestId: null, seatedAt: null, reservedFor: 'r1', cvConfidence: 0.98 },

  // Top purple/center area 24-29
  { id: 't24', number: 24, tableNumber: 'T24', shape: 'round', capacity: 4, position: { x: 440, y: 60 }, rotation: 0, sectionId: 'purple', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.99 },
  { id: 't25', number: 25, tableNumber: 'T25', shape: 'square', capacity: 4, position: { x: 440, y: 120 }, rotation: 0, sectionId: 'purple', status: 'occupied', assignedServerId: 's3', currentGuestId: 'g7', seatedAt: new Date(Date.now() - 25 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't26', number: 26, tableNumber: 'T26', shape: 'square', capacity: 4, position: { x: 500, y: 60 }, rotation: 0, sectionId: 'purple', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't27', number: 27, tableNumber: 'T27', shape: 'round', capacity: 4, position: { x: 560, y: 30 }, rotation: 0, sectionId: 'purple', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  { id: 't28', number: 28, tableNumber: 'T28', shape: 'round', capacity: 4, position: { x: 620, y: 30 }, rotation: 0, sectionId: 'purple', status: 'occupied', assignedServerId: 's3', currentGuestId: 'g8', seatedAt: new Date(Date.now() - 40 * 60000), reservedFor: null, cvConfidence: 0.95 },
  { id: 't29', number: 29, tableNumber: 'T29', shape: 'square', capacity: 4, position: { x: 500, y: 120 }, rotation: 0, sectionId: 'purple', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },

  // Green outdoor section 30-37
  { id: 't30', number: 30, tableNumber: 'T30', shape: 'round', capacity: 4, position: { x: 680, y: 30 }, rotation: 0, sectionId: 'outdoor', status: 'available', assignedServerId: 's4', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.99 },
  { id: 't31', number: 31, tableNumber: 'T31', shape: 'round', capacity: 4, position: { x: 740, y: 30 }, rotation: 0, sectionId: 'outdoor', status: 'occupied', assignedServerId: 's4', currentGuestId: 'g9', seatedAt: new Date(Date.now() - 20 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't32', number: 32, tableNumber: 'T32', shape: 'round', capacity: 4, position: { x: 680, y: 90 }, rotation: 0, sectionId: 'outdoor', status: 'available', assignedServerId: 's4', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't33', number: 33, tableNumber: 'T33', shape: 'round', capacity: 4, position: { x: 740, y: 90 }, rotation: 0, sectionId: 'outdoor', status: 'available', assignedServerId: 's4', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  { id: 't34', number: 34, tableNumber: 'T34', shape: 'round', capacity: 4, position: { x: 680, y: 150 }, rotation: 0, sectionId: 'outdoor', status: 'needs_server', assignedServerId: 's4', currentGuestId: 'g10', seatedAt: new Date(Date.now() - 8 * 60000), reservedFor: null, cvConfidence: 0.94 },
  { id: 't35', number: 35, tableNumber: 'T35', shape: 'round', capacity: 4, position: { x: 740, y: 150 }, rotation: 0, sectionId: 'outdoor', status: 'available', assignedServerId: 's4', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't36', number: 36, tableNumber: 'T36', shape: 'round', capacity: 4, position: { x: 680, y: 210 }, rotation: 0, sectionId: 'outdoor', status: 'occupied', assignedServerId: 's4', currentGuestId: 'g11', seatedAt: new Date(Date.now() - 35 * 60000), reservedFor: null, cvConfidence: 0.95 },
  { id: 't37', number: 37, tableNumber: 'T37', shape: 'round', capacity: 4, position: { x: 740, y: 210 }, rotation: 0, sectionId: 'outdoor', status: 'available', assignedServerId: 's4', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },

  // Purple right section 38-41
  { id: 't38', number: 38, tableNumber: 'T38', shape: 'round', capacity: 4, position: { x: 600, y: 150 }, rotation: 0, sectionId: 'purple', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't39', number: 39, tableNumber: 'T39', shape: 'square', capacity: 4, position: { x: 600, y: 210 }, rotation: 0, sectionId: 'purple', status: 'occupied', assignedServerId: 's3', currentGuestId: 'g12', seatedAt: new Date(Date.now() - 50 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't40', number: 40, tableNumber: 'T40', shape: 'square', capacity: 4, position: { x: 600, y: 270 }, rotation: 0, sectionId: 'purple', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  { id: 't41', number: 41, tableNumber: 'T41', shape: 'round', capacity: 4, position: { x: 560, y: 300 }, rotation: 0, sectionId: 'purple', status: 'dirty', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.92 },

  // Bottom right orange 42-45
  { id: 't42', number: 42, tableNumber: 'T42', shape: 'square', capacity: 4, position: { x: 620, y: 400 }, rotation: 0, sectionId: 'busser1', status: 'available', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't43', number: 43, tableNumber: 'T43', shape: 'square', capacity: 4, position: { x: 560, y: 400 }, rotation: 0, sectionId: 'busser1', status: 'occupied', assignedServerId: 's5', currentGuestId: 'g13', seatedAt: new Date(Date.now() - 18 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't44', number: 44, tableNumber: 'T44', shape: 'square', capacity: 4, position: { x: 500, y: 400 }, rotation: 0, sectionId: 'busser1', status: 'available', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  { id: 't45', number: 45, tableNumber: 'T45', shape: 'round', capacity: 4, position: { x: 440, y: 380 }, rotation: 0, sectionId: 'busser1', status: 'available', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },

  // Bottom yellow 46-47
  { id: 't46', number: 46, tableNumber: 'T46', shape: 'rectangle', capacity: 6, position: { x: 320, y: 400 }, rotation: 0, sectionId: 'busser1', status: 'occupied', assignedServerId: 's5', currentGuestId: 'g14', seatedAt: new Date(Date.now() - 55 * 60000), reservedFor: null, cvConfidence: 0.95 },
  { id: 't47', number: 47, tableNumber: 'T47', shape: 'rectangle', capacity: 6, position: { x: 240, y: 400 }, rotation: 0, sectionId: 'busser1', status: 'available', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },

  // Bottom left blue 48-50
  { id: 't48', number: 48, tableNumber: 'T48', shape: 'square', capacity: 4, position: { x: 160, y: 400 }, rotation: 0, sectionId: 'busser1', status: 'available', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't49', number: 49, tableNumber: 'T49', shape: 'square', capacity: 4, position: { x: 100, y: 400 }, rotation: 0, sectionId: 'busser1', status: 'reserved', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: 'r2', cvConfidence: 0.98 },
  { id: 't50', number: 50, tableNumber: 'T50', shape: 'square', capacity: 4, position: { x: 40, y: 400 }, rotation: 0, sectionId: 'busser1', status: 'available', assignedServerId: 's5', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
]

// Servers matching floor plan sections
export const mockServers: Server[] = [
  { id: 's1', name: 'Sarah', initials: 'SM', color: '#E07B39', sectionIds: ['busser3'], activeTableCount: 5, rotationPosition: 1, status: 'active', efficiency: 94, totalTips: 187 },
  { id: 's2', name: 'Tyler', initials: 'TP', color: '#F4D03F', sectionIds: ['busser2'], activeTableCount: 2, rotationPosition: 2, status: 'active', efficiency: 88, totalTips: 142 },
  { id: 's3', name: 'Maria', initials: 'MR', color: '#9B59B6', sectionIds: ['purple'], activeTableCount: 4, rotationPosition: 3, status: 'active', efficiency: 91, totalTips: 165 },
  { id: 's4', name: 'James', initials: 'JK', color: '#27AE60', sectionIds: ['outdoor'], activeTableCount: 3, rotationPosition: 4, status: 'active', efficiency: 96, totalTips: 210 },
  { id: 's5', name: 'Alex', initials: 'AL', color: '#3498DB', sectionIds: ['busser1'], activeTableCount: 3, rotationPosition: 5, status: 'active', efficiency: 85, totalTips: 98 },
]

// Waitlist Guests
export const mockGuests: Guest[] = [
  { id: 'w1', name: 'Thompson', partySize: 4, phone: '(555) 123-4567', addedAt: new Date(Date.now() - 18 * 60000), estimatedWait: 12, status: 'waiting', notes: 'Prefers booth', preferences: ['booth', 'quiet'], visitCount: 8, tags: ['VIP'] },
  { id: 'w2', name: 'Chen', partySize: 2, phone: '(555) 234-5678', addedAt: new Date(Date.now() - 12 * 60000), estimatedWait: 8, status: 'waiting', notes: '', preferences: [], visitCount: 1, tags: [] },
  { id: 'w3', name: 'Rodriguez', partySize: 6, phone: '(555) 345-6789', addedAt: new Date(Date.now() - 8 * 60000), estimatedWait: 15, status: 'waiting', notes: 'Birthday celebration', preferences: ['patio'], visitCount: 3, tags: ['Birthday'] },
  { id: 'w4', name: 'Kim', partySize: 3, phone: '(555) 456-7890', addedAt: new Date(Date.now() - 5 * 60000), estimatedWait: 10, status: 'notified', notes: '', preferences: [], visitCount: 0, tags: [] },
  { id: 'w5', name: 'Patel', partySize: 2, phone: '(555) 567-8901', addedAt: new Date(Date.now() - 2 * 60000), estimatedWait: 5, status: 'waiting', notes: 'Window seat if possible', preferences: ['window'], visitCount: 12, tags: ['Regular'] },
]

// Reservations
export const mockReservations: Reservation[] = [
  { id: 'r1', guestName: 'Martinez', partySize: 4, phone: '(555) 678-9012', email: 'martinez@email.com', dateTime: new Date(Date.now() + 15 * 60000), status: 'arriving_soon', tableId: 't12', notes: 'Anniversary dinner', specialRequests: ['Champagne at table'], source: 'online' },
  { id: 'r2', guestName: 'Williams', partySize: 8, phone: '(555) 789-0123', email: 'williams@email.com', dateTime: new Date(Date.now() + 45 * 60000), status: 'confirmed', tableId: 't16', notes: 'Business dinner', specialRequests: ['Private room', 'Projector'], source: 'phone' },
  { id: 'r3', guestName: 'Davis', partySize: 2, phone: '(555) 890-1234', email: 'davis@email.com', dateTime: new Date(Date.now() + 90 * 60000), status: 'upcoming', tableId: null, notes: '', specialRequests: [], source: 'opentable' },
  { id: 'r4', guestName: 'Wilson', partySize: 6, phone: '(555) 901-2345', email: 'wilson@email.com', dateTime: new Date(Date.now() + 120 * 60000), status: 'upcoming', tableId: null, notes: 'Celebrating promotion', specialRequests: ['Cake at 8pm'], source: 'online' },
]

// Activity Feed
export const mockActivity: ActivityItem[] = [
  { id: 'a1', type: 'seated', message: 'Party of 4 seated at Table 5', timestamp: new Date(Date.now() - 2 * 60000), tableId: 't5', priority: 'low', read: true },
  { id: 'a2', type: 'cv_alert', message: 'Table 4 guests waiting 5+ min for service', timestamp: new Date(Date.now() - 1 * 60000), tableId: 't4', priority: 'high', read: false },
  { id: 'a3', type: 'table_status_change', message: 'Table 6 marked as dirty', timestamp: new Date(Date.now() - 30000), tableId: 't6', priority: 'medium', read: false },
  { id: 'a4', type: 'reservation_arrived', message: 'Martinez reservation arriving in 15 min', timestamp: new Date(), priority: 'medium', read: false },
]

// Smart Recommendations
export const mockRecommendations: SmartRecommendation[] = [
  {
    id: 'rec1',
    type: 'seat_suggestion',
    title: 'Seat Thompson (4)',
    description: 'Table 3 is optimal - matches party size, server Sarah at 67% capacity',
    priority: 95,
    actionLabel: 'Seat Now',
    tableId: 't3',
    guestId: 'w1',
    serverId: 's1',
    cvReason: 'Best fit: 4-top available, balanced server load'
  },
  {
    id: 'rec2',
    type: 'alert',
    title: 'Table 4 Needs Server',
    description: 'Guests waiting 5 minutes - Sarah should check on them',
    priority: 90,
    actionLabel: 'Notify Sarah',
    tableId: 't4',
    serverId: 's1',
    cvReason: 'CV detected no server interaction for 5+ minutes'
  },
  {
    id: 'rec3',
    type: 'seat_suggestion',
    title: 'Seat Chen (2) at Bar',
    description: 'Table 8 or 9 available - quick turnover area',
    priority: 75,
    actionLabel: 'Seat at Bar',
    tableId: 't8',
    guestId: 'w2',
    serverId: 's2',
    cvReason: 'Party of 2, bar has fastest availability'
  },
  {
    id: 'rec4',
    type: 'server_stat',
    title: 'Rotation: James Next',
    description: 'James has 0 active tables, highest priority for next seating',
    priority: 60,
    actionLabel: 'View Rotation',
    serverId: 's4',
    cvReason: 'Fair rotation algorithm - James due for next table'
  },
  {
    id: 'rec5',
    type: 'optimization',
    title: 'Table 6 Ready Soon',
    description: 'Cleaning in progress - will be available in ~3 min for Rodriguez (6)',
    priority: 50,
    actionLabel: 'Reserve',
    tableId: 't6',
    guestId: 'w3',
    cvReason: 'Predicted turnover based on cleaning patterns'
  },
]

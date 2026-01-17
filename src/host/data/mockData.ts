import type { Table, Guest, Reservation, Server, Section, ActivityItem, SmartRecommendation } from '../types'

// Sections
export const mockSections: Section[] = [
  { id: 'main', name: 'Main Dining', color: '#0A84FF', tableIds: ['t1', 't2', 't3', 't4', 't5', 't6'], serverId: 's1' },
  { id: 'bar', name: 'Bar', color: '#FF9500', tableIds: ['t7', 't8', 't9', 't10'], serverId: 's2' },
  { id: 'patio', name: 'Patio', color: '#34C759', tableIds: ['t11', 't12', 't13', 't14'], serverId: 's3' },
  { id: 'private', name: 'Private', color: '#AF52DE', tableIds: ['t15', 't16'], serverId: 's4' },
]

// Tables
export const mockTables: Table[] = [
  // Main Dining
  { id: 't1', number: 1, shape: 'round', capacity: 2, position: { x: 80, y: 100 }, rotation: 0, sectionId: 'main', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't2', number: 2, shape: 'round', capacity: 2, position: { x: 180, y: 100 }, rotation: 0, sectionId: 'main', status: 'occupied', assignedServerId: 's1', currentGuestId: 'g1', seatedAt: new Date(Date.now() - 35 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't3', number: 3, shape: 'square', capacity: 4, position: { x: 280, y: 100 }, rotation: 0, sectionId: 'main', status: 'available', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.99 },
  { id: 't4', number: 4, shape: 'square', capacity: 4, position: { x: 80, y: 220 }, rotation: 0, sectionId: 'main', status: 'needs_server', assignedServerId: 's1', currentGuestId: 'g2', seatedAt: new Date(Date.now() - 5 * 60000), reservedFor: null, cvConfidence: 0.94 },
  { id: 't5', number: 5, shape: 'rectangle', capacity: 6, position: { x: 200, y: 220 }, rotation: 0, sectionId: 'main', status: 'occupied', assignedServerId: 's1', currentGuestId: 'g3', seatedAt: new Date(Date.now() - 55 * 60000), reservedFor: null, cvConfidence: 0.97 },
  { id: 't6', number: 6, shape: 'square', capacity: 4, position: { x: 340, y: 220 }, rotation: 0, sectionId: 'main', status: 'dirty', assignedServerId: 's1', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.92 },
  // Bar
  { id: 't7', number: 7, shape: 'round', capacity: 2, position: { x: 80, y: 380 }, rotation: 0, sectionId: 'bar', status: 'occupied', assignedServerId: 's2', currentGuestId: 'g4', seatedAt: new Date(Date.now() - 20 * 60000), reservedFor: null, cvConfidence: 0.95 },
  { id: 't8', number: 8, shape: 'round', capacity: 2, position: { x: 160, y: 380 }, rotation: 0, sectionId: 'bar', status: 'available', assignedServerId: 's2', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.98 },
  { id: 't9', number: 9, shape: 'round', capacity: 2, position: { x: 240, y: 380 }, rotation: 0, sectionId: 'bar', status: 'available', assignedServerId: 's2', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  { id: 't10', number: 10, shape: 'round', capacity: 2, position: { x: 320, y: 380 }, rotation: 0, sectionId: 'bar', status: 'occupied', assignedServerId: 's2', currentGuestId: 'g5', seatedAt: new Date(Date.now() - 45 * 60000), reservedFor: null, cvConfidence: 0.93 },
  // Patio
  { id: 't11', number: 11, shape: 'round', capacity: 4, position: { x: 480, y: 100 }, rotation: 0, sectionId: 'patio', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.99 },
  { id: 't12', number: 12, shape: 'round', capacity: 4, position: { x: 580, y: 100 }, rotation: 0, sectionId: 'patio', status: 'reserved', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: 'r1', cvConfidence: 0.98 },
  { id: 't13', number: 13, shape: 'square', capacity: 6, position: { x: 530, y: 200 }, rotation: 0, sectionId: 'patio', status: 'occupied', assignedServerId: 's3', currentGuestId: 'g6', seatedAt: new Date(Date.now() - 25 * 60000), reservedFor: null, cvConfidence: 0.96 },
  { id: 't14', number: 14, shape: 'round', capacity: 2, position: { x: 640, y: 200 }, rotation: 0, sectionId: 'patio', status: 'available', assignedServerId: 's3', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 0.97 },
  // Private
  { id: 't15', number: 15, shape: 'rectangle', capacity: 8, position: { x: 500, y: 340 }, rotation: 0, sectionId: 'private', status: 'blocked', assignedServerId: 's4', currentGuestId: null, seatedAt: null, reservedFor: null, cvConfidence: 1.0 },
  { id: 't16', number: 16, shape: 'rectangle', capacity: 10, position: { x: 500, y: 420 }, rotation: 0, sectionId: 'private', status: 'reserved', assignedServerId: 's4', currentGuestId: null, seatedAt: null, reservedFor: 'r2', cvConfidence: 1.0 },
]

// Servers
export const mockServers: Server[] = [
  { id: 's1', name: 'Sarah', initials: 'SM', color: '#0A84FF', sectionIds: ['main'], activeTableCount: 3, rotationPosition: 1, status: 'active', efficiency: 94, totalTips: 187 },
  { id: 's2', name: 'Tyler', initials: 'TP', color: '#FF9500', sectionIds: ['bar'], activeTableCount: 2, rotationPosition: 2, status: 'active', efficiency: 88, totalTips: 142 },
  { id: 's3', name: 'Maria', initials: 'MR', color: '#34C759', sectionIds: ['patio'], activeTableCount: 2, rotationPosition: 3, status: 'active', efficiency: 91, totalTips: 165 },
  { id: 's4', name: 'James', initials: 'JK', color: '#AF52DE', sectionIds: ['private'], activeTableCount: 0, rotationPosition: 4, status: 'active', efficiency: 96, totalTips: 210 },
  { id: 's5', name: 'Alex', initials: 'AL', color: '#FF453A', sectionIds: [], activeTableCount: 0, rotationPosition: 5, status: 'on_break', efficiency: 85, totalTips: 98 },
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

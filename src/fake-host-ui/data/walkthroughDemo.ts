import type {
  ActivityItem,
  DemoScene,
  Guest,
  Reservation,
  Section,
  Server,
  SmartRecommendation,
  Table,
} from '../../host/types'
import {
  mockActivity,
  mockGuests,
  mockRecommendations,
  mockReservations,
  mockSections,
  mockServers,
  mockTables,
} from './mimosasMockData'

export interface WalkthroughSceneSnapshot {
  tables: Table[]
  guests: Guest[]
  reservations: Reservation[]
  servers: Server[]
  sections: Section[]
  activity: ActivityItem[]
  recommendations: SmartRecommendation[]
  activeTab: 'waitlist' | 'reservations'
  serverMode: 'sections' | 'rotations'
  demoScene: DemoScene
}

export interface WalkthroughScene {
  id: string
  autoAdvanceMs: number
  snapshot: WalkthroughSceneSnapshot
}

const CAMERA_IDS = ['cam-2', 'cam-3', 'cam-4', 'cam-5', 'cam-6', 'cam-7', 'cam-8', 'cam-9', 'cam-11']
const TOTAL_STEPS = 6
const PRIMARY_ROUTE_TABLE_ID = 't16'
const PRIMARY_ROUTE_TABLE_NUMBER = 16
export const START_SCENE_INDEX = 1

function cloneTables(tables: Table[]) {
  return tables.map((table) => ({
    ...table,
    position: { ...table.position },
    seatedAt: table.seatedAt ? new Date(table.seatedAt) : null,
  }))
}

function cloneGuests(guests: Guest[]) {
  return guests.map((guest) => ({
    ...guest,
    addedAt: new Date(guest.addedAt),
    preferences: [...guest.preferences],
    tags: [...guest.tags],
  }))
}

function cloneReservations(reservations: Reservation[]) {
  return reservations.map((reservation) => ({
    ...reservation,
    dateTime: new Date(reservation.dateTime),
    specialRequests: [...reservation.specialRequests],
  }))
}

function cloneServers(servers: Server[]) {
  return servers.map((server) => ({
    ...server,
    sectionIds: [...server.sectionIds],
  }))
}

function cloneSections(sections: Section[]) {
  return sections.map((section) => ({
    ...section,
    tableIds: [...section.tableIds],
  }))
}

function cloneActivity(activity: ActivityItem[]) {
  return activity.map((item) => ({
    ...item,
    timestamp: new Date(item.timestamp),
  }))
}

function cloneRecommendations(recommendations: SmartRecommendation[]) {
  return recommendations.map((recommendation) => ({
    ...recommendation,
  }))
}

function createSceneMeta(
  step: number,
  id: string,
  title: string,
  description: string,
  scriptCue: string,
  highlights: string[]
): DemoScene {
  return {
    id,
    step,
    totalSteps: TOTAL_STEPS,
    title,
    description,
    scriptCue,
    highlights,
    cameraId: 'cam-4',
    cameraLabel: 'Camera 4 · Main dining + host line',
    cameraPath: '/demovids/4_Mimosas/demo1.mp4',
  }
}

function createBaseTables(): Table[] {
  return cloneTables(mockTables).map((table) => {
    if (table.id === PRIMARY_ROUTE_TABLE_ID) {
      return {
        ...table,
        capacity: 4,
        status: 'available' as const,
        assignedServerId: 's2',
        currentGuestId: null,
        seatedAt: null,
        cvConfidence: 0.98,
      }
    }

    if (table.id === 't12') {
      return {
        ...table,
        status: 'available' as const,
        cvConfidence: 0.98,
      }
    }

    if (table.id === 't27') {
      return {
        ...table,
        currentGuestId: 'g9',
        status: 'occupied' as const,
        seatedAt: new Date(Date.now() - 54 * 60000),
        cvConfidence: 0.95,
      }
    }

    return table
  })
}

function createBaseServers() {
  return cloneServers(mockServers).map((server) => {
    if (server.id === 's2') {
      return {
        ...server,
        name: 'Fabian',
        initials: 'FA',
        activeTableCount: 1,
        rotationPosition: 1,
        efficiency: 92,
        totalTips: 164,
      }
    }

    if (server.id === 's1') {
      return {
        ...server,
        activeTableCount: 5,
        rotationPosition: 2,
      }
    }

    if (server.id === 's3') {
      return {
        ...server,
        activeTableCount: 4,
        rotationPosition: 3,
      }
    }

    if (server.id === 's4') {
      return {
        ...server,
        activeTableCount: 3,
        rotationPosition: 4,
      }
    }

    if (server.id === 's5') {
      return {
        ...server,
        activeTableCount: 2,
        rotationPosition: 5,
      }
    }

    return server
  })
}

function createBaseGuests() {
  return cloneGuests(mockGuests).filter((guest) => guest.id !== 'w2')
}

function createLaneGuest(minutesAgo: number, status: Guest['status'] = 'waiting'): Guest {
  return {
    id: 'w-demo-lane',
    name: 'Lane',
    partySize: 2,
    phone: '(843) 204-1188',
    addedAt: new Date(Date.now() - minutesAgo * 60000),
    estimatedWait: 4,
    status,
    notes: 'Walk-in couple heading to the beach after brunch',
    preferences: ['inside'],
    visitCount: 1,
    tags: ['Walk-in'],
  }
}

function createScene0(): WalkthroughSceneSnapshot {
  const guests = createBaseGuests()
  const recommendations = cloneRecommendations(mockRecommendations)
  const activity = cloneActivity(mockActivity)
  const servers = createBaseServers()

  recommendations[0] = {
    id: 'walk-0-rec-1',
    type: 'seat_suggestion',
    title: 'Seat Henderson (4) at T12',
    description: 'Longest wait on the board, booth preference matched, and the host stand is already staging a high chair.',
    priority: 95,
    actionLabel: 'Seat Now',
    tableId: 't12',
    guestId: 'w1',
    serverId: 's1',
    cvReason: 'Live floor context + waitlist history suggest an immediate fit.',
  }

  activity.unshift({
    id: 'walk-0-activity-1',
    type: 'cv_alert',
    message: 'Nine camera feeds are live. Shire is tracking seated, dining, and turning tables in real time.',
    timestamp: new Date(Date.now() - 30 * 1000),
    priority: 'medium',
    read: false,
  })

  return {
    tables: createBaseTables(),
    guests,
    reservations: cloneReservations(mockReservations),
    servers,
    sections: cloneSections(mockSections),
    activity: activity.slice(0, 8),
    recommendations: recommendations.slice(0, 3),
    activeTab: 'waitlist',
    serverMode: 'sections',
    demoScene: createSceneMeta(
      1,
      'live-floor',
      'Live Floor Context',
      'Camera detections and host software stay in sync without any manual table updates.',
      'Open on the live floor first and point out that Shire sees what is actually happening in the room.',
      ['9 cameras synced locally', 'Automatic table-state tracking', 'No backend required for the demo']
    ),
  }
}

function createScene1(): WalkthroughSceneSnapshot {
  const guests = [createLaneGuest(1), ...createBaseGuests()]
  const activity: ActivityItem[] = [
    {
      id: 'walk-1-activity-1',
      type: 'wait_added',
      message: 'Camera 4 detected a party of 2 entering the host line. Lane added to the waitlist automatically.',
      timestamp: new Date(Date.now() - 20 * 1000),
      guestId: 'w-demo-lane',
      priority: 'medium',
      read: false,
    },
    {
      id: 'walk-1-activity-2',
      type: 'server_assigned',
      message: `Shire recommends Table ${PRIMARY_ROUTE_TABLE_NUMBER} with Fabian because he has the lightest section load.`,
      timestamp: new Date(Date.now() - 12 * 1000),
      tableId: PRIMARY_ROUTE_TABLE_ID,
      serverId: 's2',
      priority: 'high',
      read: false,
    },
    ...cloneActivity(mockActivity).slice(0, 5),
  ]

  const recommendations: SmartRecommendation[] = [
    {
      id: 'walk-1-rec-1',
      type: 'seat_suggestion',
      title: `Seat Lane (2) at T${PRIMARY_ROUTE_TABLE_NUMBER}`,
      description: `Fabian has the lightest section right now, Table ${PRIMARY_ROUTE_TABLE_NUMBER} is clear, and this keeps the floor balanced before the next rush wave.`,
      priority: 99,
      actionLabel: 'Seat Now',
      tableId: PRIMARY_ROUTE_TABLE_ID,
      guestId: 'w-demo-lane',
      serverId: 's2',
      cvReason: 'Best fit from live floor load, server rotation, and walk-in timing.',
    },
    {
      id: 'walk-1-rec-2',
      type: 'alert',
      title: 'Patio Table 34 Needs Follow-up',
      description: 'A patio 4-top has waited 7 minutes for a greet. Keep Fabian on the next interior seat and let Fernando recover outside.',
      priority: 87,
      actionLabel: 'Rebalance Floor',
      tableId: 't34',
      serverId: 's4',
      cvReason: 'Patio is running hotter than the main room this cycle.',
    },
    {
      id: 'walk-1-rec-3',
      type: 'optimization',
      title: 'Capacity Opening in 8 Minutes',
      description: 'Table 27 has checks down and Table 43 is nearly cleared. The next 10-minute window opens three more turns.',
      priority: 78,
      actionLabel: 'Watch Turns',
      tableId: 't27',
      serverId: 's3',
      cvReason: 'Predicted turns based on dwell time and payment behavior.',
    },
  ]

  return {
    tables: createBaseTables(),
    guests,
    reservations: cloneReservations(mockReservations),
    servers: createBaseServers(),
    sections: cloneSections(mockSections),
    activity: activity.slice(0, 8),
    recommendations,
    activeTab: 'waitlist',
    serverMode: 'sections',
    demoScene: createSceneMeta(
      2,
      'walk-in-detected',
      'Party Of Two Arrives',
      `Shire routes the next walk-in to Fabian and Table ${PRIMARY_ROUTE_TABLE_NUMBER} based on live floor balance.`,
      `Call out the new party, then point to the Best Match card showing Table ${PRIMARY_ROUTE_TABLE_NUMBER} and Fabian.`,
      ['Lane party added to waitlist', `Table ${PRIMARY_ROUTE_TABLE_NUMBER} selected automatically`, 'Fabian is the lightest section']
    ),
  }
}

function createScene2(): WalkthroughSceneSnapshot {
  const tables = createBaseTables().map((table) => {
    if (table.id === PRIMARY_ROUTE_TABLE_ID) {
      return {
        ...table,
        status: 'occupied' as const,
        currentGuestId: 'w-demo-lane',
        seatedAt: new Date(Date.now() - 6 * 60000),
        cvConfidence: 0.99,
        _justUpdated: true,
      }
    }

    return table
  })

  const servers = createBaseServers().map((server) => {
    if (server.id === 's2') {
      return {
        ...server,
        activeTableCount: 2,
        rotationPosition: 5,
        totalTips: 176,
      }
    }

    if (server.rotationPosition > 1) {
      return {
        ...server,
        rotationPosition: server.rotationPosition - 1,
      }
    }

    return server
  })

  const recommendations: SmartRecommendation[] = [
    {
      id: 'walk-2-rec-1',
      type: 'optimization',
      title: 'Fabian Balanced Back Into Rotation',
      description: `Table ${PRIMARY_ROUTE_TABLE_NUMBER} is seated and Fabian rotates to the back. The next two likely turns are Table 27 and Patio 34.`,
      priority: 94,
      actionLabel: 'Watch Floor',
      tableId: PRIMARY_ROUTE_TABLE_ID,
      serverId: 's2',
      cvReason: 'Routing decision completed successfully from camera-confirmed seating.',
    },
    {
      id: 'walk-2-rec-2',
      type: 'alert',
      title: 'Jaime Needs Support',
      description: 'Jaime has two bar tables turning at once. Keep the next four-top away from the bar until one clears.',
      priority: 82,
      actionLabel: 'Hold Next Seat',
      serverId: 's5',
      cvReason: 'Server load is about to spike on the bar side.',
    },
    {
      id: 'walk-2-rec-3',
      type: 'seat_suggestion',
      title: 'Queue Beaumont (8) For Patio 35',
      description: 'Large-party demand lines up with the next patio opening. Keep the floor moving instead of overloading the main room.',
      priority: 75,
      actionLabel: 'Prep Table',
      tableId: 't35',
      guestId: 'w5',
      serverId: 's4',
      cvReason: 'Capacity planning from live turns and current waitlist mix.',
    },
  ]

  const activity: ActivityItem[] = [
    {
      id: 'walk-2-activity-1',
      type: 'seated',
      message: `Lane (2) sat at Table ${PRIMARY_ROUTE_TABLE_NUMBER}. Camera confirmation updated the floor automatically in under 2 seconds.`,
      timestamp: new Date(Date.now() - 18 * 1000),
      tableId: PRIMARY_ROUTE_TABLE_ID,
      guestId: 'w-demo-lane',
      serverId: 's2',
      priority: 'low',
      read: false,
    },
    {
      id: 'walk-2-activity-2',
      type: 'server_assigned',
      message: `Fabian rotated to the back after taking Table ${PRIMARY_ROUTE_TABLE_NUMBER}. Section load is now even across the main room.`,
      timestamp: new Date(Date.now() - 12 * 1000),
      serverId: 's2',
      priority: 'medium',
      read: false,
    },
    ...cloneActivity(mockActivity).slice(0, 5),
  ]

  return {
    tables,
    guests: createBaseGuests(),
    reservations: cloneReservations(mockReservations),
    servers,
    sections: cloneSections(mockSections),
    activity: activity.slice(0, 8),
    recommendations,
    activeTab: 'waitlist',
    serverMode: 'sections',
    demoScene: createSceneMeta(
      3,
      'auto-seated',
      'Automatic Table State',
      'As soon as guests sit down, the floor state updates without a host touching the screen.',
      `Show that Table ${PRIMARY_ROUTE_TABLE_NUMBER} is now occupied and Fabian moved to the back of rotation automatically.`,
      [`Table ${PRIMARY_ROUTE_TABLE_NUMBER} changed to occupied`, 'Fabian rotated automatically', 'Floor rebalanced in real time']
    ),
  }
}

function createScene3(): WalkthroughSceneSnapshot {
  const tables = createScene2().tables.map((table) => {
    if (table.id === PRIMARY_ROUTE_TABLE_ID) {
      return {
        ...table,
        seatedAt: new Date(Date.now() - 21 * 60000),
        cvConfidence: 0.97,
      }
    }

    if (table.id === 't12') {
      return {
        ...table,
        status: 'occupied' as const,
        currentGuestId: 'g16',
        seatedAt: new Date(Date.now() - 14 * 60000),
        cvConfidence: 0.96,
      }
    }

    if (table.id === 't43') {
      return {
        ...table,
        status: 'available' as const,
        currentGuestId: null,
        seatedAt: null,
        cvConfidence: 0.98,
      }
    }

    return table
  })

  const servers = createScene2().servers.map((server) => {
    if (server.id === 's1') {
      return {
        ...server,
        activeTableCount: 6,
        efficiency: 93,
      }
    }

    if (server.id === 's2') {
      return {
        ...server,
        activeTableCount: 2,
      }
    }

    if (server.id === 's5') {
      return {
        ...server,
        activeTableCount: 3,
        efficiency: 80,
      }
    }

    return server
  })

  const recommendations: SmartRecommendation[] = [
    {
      id: 'walk-3-rec-1',
      type: 'optimization',
      title: 'Three Turns Coming Open',
      description: 'Table 27 is cashing out, Table 43 is already clear, and Patio 34 is close behind. Capacity is about to open without adding staff.',
      priority: 97,
      actionLabel: 'View Turns',
      tableId: 't27',
      serverId: 's3',
      cvReason: 'Live dwell time + payment activity show the next turn wave.',
    },
    {
      id: 'walk-3-rec-2',
      type: 'alert',
      title: 'Adriana Is Running Hot',
      description: 'Adriana is carrying six active tables while Fabian holds steady at two. Route the next interior two-top away from Section A.',
      priority: 90,
      actionLabel: 'Protect Load',
      serverId: 's1',
      cvReason: 'Current covers and predicted turns show an imbalance building.',
    },
    {
      id: 'walk-3-rec-3',
      type: 'seat_suggestion',
      title: 'Hold Drayton (2) For T43',
      description: 'A quick-turn two-top just opened in the bar-side zone, giving you a clean capacity release without stressing the patio.',
      priority: 84,
      actionLabel: 'Stage Seat',
      tableId: 't43',
      guestId: 'w6',
      serverId: 's5',
      cvReason: 'Opening up smaller tables preserves larger-party flexibility.',
    },
  ]

  const activity: ActivityItem[] = [
    {
      id: 'walk-3-activity-1',
      type: 'table_status_change',
      message: 'Table 43 just opened. Shire marked the turn instantly and surfaced the new capacity.',
      timestamp: new Date(Date.now() - 16 * 1000),
      tableId: 't43',
      serverId: 's5',
      priority: 'medium',
      read: false,
    },
    {
      id: 'walk-3-activity-2',
      type: 'cv_alert',
      message: 'Predicted turn wave: Tables 27, 34, and 43 likely to free up in the next 10 minutes.',
      timestamp: new Date(Date.now() - 8 * 1000),
      priority: 'high',
      read: false,
    },
    ...cloneActivity(mockActivity).slice(0, 4),
  ]

  return {
    tables,
    guests: createBaseGuests(),
    reservations: cloneReservations(mockReservations),
    servers,
    sections: cloneSections(mockSections),
    activity: activity.slice(0, 8),
    recommendations,
    activeTab: 'waitlist',
    serverMode: 'sections',
    demoScene: createSceneMeta(
      4,
      'shift-in-motion',
      'Live Room State',
      'Now the room is readable: who is overloaded, which tables are about to turn, and where capacity is opening.',
      'Point to the rotation rail, the activity feed, and the new open tables showing how the floor is becoming legible.',
      ['Turns predicted before they happen', 'Server load imbalance visible', 'Open capacity surfaces automatically']
    ),
  }
}

function createScene4(): WalkthroughSceneSnapshot {
  const tables = createScene3().tables.map((table) => {
    if (table.id === PRIMARY_ROUTE_TABLE_ID) {
      return {
        ...table,
        status: 'needs_server' as const,
        seatedAt: new Date(Date.now() - 38 * 60000),
        cvConfidence: 0.95,
        _justUpdated: true,
      }
    }

    if (table.id === 't27') {
      return {
        ...table,
        status: 'needs_server' as const,
        seatedAt: new Date(Date.now() - 58 * 60000),
        cvConfidence: 0.93,
      }
    }

    return table
  })

  const recommendations: SmartRecommendation[] = [
    {
      id: 'walk-4-rec-1',
      type: 'optimization',
      title: `Table ${PRIMARY_ROUTE_TABLE_NUMBER} Is About To Turn`,
      description: 'Checks are down and the guests have slowed to closing behavior. Shire is already counting this seat as a near-term capacity opening.',
      priority: 98,
      actionLabel: 'Track Turn',
      tableId: PRIMARY_ROUTE_TABLE_ID,
      serverId: 's2',
      cvReason: 'Meal phase and payment behavior indicate the table is nearly done.',
    },
    {
      id: 'walk-4-rec-2',
      type: 'alert',
      title: 'Window Seat Pressure',
      description: 'Inside two-tops are running tight for the next 15 minutes. Use the patio only if the guest explicitly wants it.',
      priority: 83,
      actionLabel: 'Hold Inventory',
      serverId: 's4',
      cvReason: 'Upcoming reservation mix is heavier on two-tops than four-tops.',
    },
    {
      id: 'walk-4-rec-3',
      type: 'server_stat',
      title: 'Fabian Still Has Room',
      description: 'Fabian is stable at two active tables while Adriana and Maria are stretched. Keep the next turn in Fabian’s lane.',
      priority: 79,
      actionLabel: 'Use Rotation',
      serverId: 's2',
      cvReason: 'Live floor context shows where the next seat belongs.',
    },
  ]

  const activity: ActivityItem[] = [
    {
      id: 'walk-4-activity-1',
      type: 'cv_alert',
      message: `Table ${PRIMARY_ROUTE_TABLE_NUMBER} is in late meal phase. Shire flagged it as a likely turn in the next 4 minutes.`,
      timestamp: new Date(Date.now() - 14 * 1000),
      tableId: PRIMARY_ROUTE_TABLE_ID,
      serverId: 's2',
      priority: 'high',
      read: false,
    },
    {
      id: 'walk-4-activity-2',
      type: 'cv_alert',
      message: `Table 27 and Table ${PRIMARY_ROUTE_TABLE_NUMBER} are both nearing check close. Capacity is about to release across two sections.`,
      timestamp: new Date(Date.now() - 8 * 1000),
      priority: 'medium',
      read: false,
    },
    ...cloneActivity(mockActivity).slice(0, 4),
  ]

  return {
    tables,
    guests: createBaseGuests(),
    reservations: cloneReservations(mockReservations),
    servers: createScene3().servers,
    sections: cloneSections(mockSections),
    activity: activity.slice(0, 8),
    recommendations,
    activeTab: 'waitlist',
    serverMode: 'sections',
    demoScene: createSceneMeta(
      5,
      'turn-prediction',
      'Predicted Turn Window',
      'Shire knows which tables are nearly done before anyone radios the host stand.',
      'This is the moment to talk about predicted turns, overloaded sections, and capacity opening up in real time.',
      [`Table ${PRIMARY_ROUTE_TABLE_NUMBER} flagged as near-turn`, 'Two sections freeing up together', 'Next seat can be staged early']
    ),
  }
}

function createScene5(): WalkthroughSceneSnapshot {
  const tables = createScene4().tables.map((table) => {
    if (table.id === PRIMARY_ROUTE_TABLE_ID) {
      return {
        ...table,
        status: 'dirty' as const,
        currentGuestId: null,
        seatedAt: null,
        cvConfidence: 0.97,
        _justUpdated: true,
      }
    }

    if (table.id === 't43') {
      return {
        ...table,
        status: 'occupied' as const,
        currentGuestId: 'w6',
        seatedAt: new Date(Date.now() - 3 * 60000),
        cvConfidence: 0.96,
      }
    }

    if (table.id === 't27') {
      return {
        ...table,
        status: 'dirty' as const,
        currentGuestId: null,
        seatedAt: null,
        cvConfidence: 0.92,
      }
    }

    return table
  })

  const recommendations: SmartRecommendation[] = [
    {
      id: 'walk-5-rec-1',
      type: 'optimization',
      title: 'Capacity Re-opened Across The Floor',
      description: `Table ${PRIMARY_ROUTE_TABLE_NUMBER} and Table 27 both turned, Table 43 was immediately reseated, and Fabian is ready for the next interior two-top.`,
      priority: 99,
      actionLabel: 'Keep Routing',
      tableId: PRIMARY_ROUTE_TABLE_ID,
      serverId: 's2',
      cvReason: 'The system can now roll this live context into staffing, pricing, and end-of-shift reporting.',
    },
    {
      id: 'walk-5-rec-2',
      type: 'alert',
      title: 'Bus Two Tables Now',
      description: `Table ${PRIMARY_ROUTE_TABLE_NUMBER} and Table 27 are both dirty. Clearing them quickly preserves the next 15-minute revenue window.`,
      priority: 88,
      actionLabel: 'Dispatch Busser',
      tableId: PRIMARY_ROUTE_TABLE_ID,
      cvReason: 'Dirty-table dwell is now the bottleneck, not demand.',
    },
    {
      id: 'walk-5-rec-3',
      type: 'server_stat',
      title: 'Fabian Can Take The Next Turn',
      description: 'Fabian remains the cleanest lane for the next inside walk-in. Shire can keep routing without slowing the room.',
      priority: 77,
      actionLabel: 'Hold Next Seat',
      serverId: 's2',
      cvReason: 'Balanced sections protect both turn time and guest experience.',
    },
  ]

  const activity: ActivityItem[] = [
    {
      id: 'walk-5-activity-1',
      type: 'cleared',
      message: `Table ${PRIMARY_ROUTE_TABLE_NUMBER} cleared and left. Shire rolled the seat into the next capacity window automatically.`,
      timestamp: new Date(Date.now() - 18 * 1000),
      tableId: PRIMARY_ROUTE_TABLE_ID,
      serverId: 's2',
      priority: 'medium',
      read: false,
    },
    {
      id: 'walk-5-activity-2',
      type: 'seated',
      message: 'Drayton (2) was routed to Table 43 as soon as the bar-side turn opened.',
      timestamp: new Date(Date.now() - 10 * 1000),
      tableId: 't43',
      guestId: 'w6',
      serverId: 's5',
      priority: 'low',
      read: false,
    },
    {
      id: 'walk-5-activity-3',
      type: 'cv_alert',
      message: 'This live floor context is now ready to feed pricing, labor, and end-of-day performance reporting.',
      timestamp: new Date(Date.now() - 4 * 1000),
      priority: 'high',
      read: false,
    },
    ...cloneActivity(mockActivity).slice(0, 3),
  ]

  return {
    tables,
    guests: createBaseGuests(),
    reservations: cloneReservations(mockReservations),
    servers: createScene3().servers,
    sections: cloneSections(mockSections),
    activity: activity.slice(0, 8),
    recommendations,
    activeTab: 'waitlist',
    serverMode: 'sections',
    demoScene: createSceneMeta(
      6,
      'turn-complete',
      'Turn Complete',
      'By the end of the cycle, Shire knows what turned, what reopened, and what to do next.',
      'Use this as the handoff moment into the pricing engine and nightly rollup on the dashboard side.',
      [`Table ${PRIMARY_ROUTE_TABLE_NUMBER} cleared automatically`, 'Open seats rolled into next demand window', 'Ready to pivot into pricing + rollup']
    ),
  }
}

export const WALKTHROUGH_SCENES: WalkthroughScene[] = [
  { id: 'scene-0', autoAdvanceMs: 9000, snapshot: createScene0() },
  { id: 'scene-1', autoAdvanceMs: 9000, snapshot: createScene1() },
  { id: 'scene-2', autoAdvanceMs: 10000, snapshot: createScene2() },
  { id: 'scene-3', autoAdvanceMs: 10000, snapshot: createScene3() },
  { id: 'scene-4', autoAdvanceMs: 2000, snapshot: createScene4() },
  { id: 'scene-5', autoAdvanceMs: 12000, snapshot: createScene5() },
]

function cloneSceneSnapshot(snapshot: WalkthroughSceneSnapshot): WalkthroughSceneSnapshot {
  return {
    tables: cloneTables(snapshot.tables),
    guests: cloneGuests(snapshot.guests),
    reservations: cloneReservations(snapshot.reservations),
    servers: cloneServers(snapshot.servers),
    sections: cloneSections(snapshot.sections),
    activity: cloneActivity(snapshot.activity),
    recommendations: cloneRecommendations(snapshot.recommendations),
    activeTab: snapshot.activeTab,
    serverMode: snapshot.serverMode,
    demoScene: {
      ...snapshot.demoScene,
      highlights: [...snapshot.demoScene.highlights],
    },
  }
}

export function getWalkthroughSnapshot(index: number) {
  const scene = WALKTHROUGH_SCENES[((index % WALKTHROUGH_SCENES.length) + WALKTHROUGH_SCENES.length) % WALKTHROUGH_SCENES.length]
  return cloneSceneSnapshot(scene.snapshot)
}

export function getWalkthroughCameras() {
  return CAMERA_IDS
}

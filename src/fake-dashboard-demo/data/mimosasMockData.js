// ============================================================================
// Mimosas Southern Kitchen & Bar - Mock Data
// Myrtle Beach, SC | Southern Breakfast House | Open 7AM-2PM
// Snapshot: Saturday ~11:00 AM (peak brunch rush)
// ============================================================================

// Today's Key Metrics
export const todayMetrics = {
  revenue: { value: 4228, change: 11, goal: 5600 },
  covers: { value: 185, change: 10, goal: 240 },
  avgCheck: { value: 22.85, change: 1.4, goal: 24 },
  avgWait: { value: 11, change: -5, goal: 10 }
}

// Table Status (50 tables: main dining 20, patio 12, bar-adjacent 8, private 4, communal 6)
export const tables = [
  // Main Dining (Tables 1-20)
  { id: 1, status: 'occupied', server: 'Adriana', covers: 4 },
  { id: 2, status: 'occupied', server: 'Adriana', covers: 2 },
  { id: 3, status: 'occupied', server: 'Fabian', covers: 6 },
  { id: 4, status: 'occupied', server: 'Adriana', covers: 3 },
  { id: 5, status: 'occupied', server: 'Fabian', covers: 4 },
  { id: 6, status: 'occupied', server: 'Maria', covers: 2 },
  { id: 7, status: 'needsAttention', server: 'Fabian', covers: 4 },
  { id: 8, status: 'occupied', server: 'Maria', covers: 5 },
  { id: 9, status: 'occupied', server: 'Adriana', covers: 2 },
  { id: 10, status: 'occupied', server: 'Maria', covers: 4 },
  { id: 11, status: 'occupied', server: 'Fabian', covers: 3 },
  { id: 12, status: 'open', server: null, covers: 0 },
  { id: 13, status: 'occupied', server: 'Maria', covers: 2 },
  { id: 14, status: 'occupied', server: 'Adriana', covers: 4 },
  { id: 15, status: 'dirty', server: null, covers: 0 },
  { id: 16, status: 'occupied', server: 'Fabian', covers: 2 },
  { id: 17, status: 'dirty', server: null, covers: 0 },
  { id: 18, status: 'occupied', server: 'Maria', covers: 6 },
  { id: 19, status: 'occupied', server: 'Jaime', covers: 2 },
  { id: 20, status: 'occupied', server: 'Adriana', covers: 3 },
  // Patio (Tables 21-32)
  { id: 21, status: 'occupied', server: 'Fernando', covers: 4 },
  { id: 22, status: 'occupied', server: 'Fernando', covers: 2 },
  { id: 23, status: 'occupied', server: 'Fernando', covers: 6 },
  { id: 24, status: 'open', server: null, covers: 0 },
  { id: 25, status: 'occupied', server: 'Fernando', covers: 3 },
  { id: 26, status: 'occupied', server: 'Fernando', covers: 2 },
  { id: 27, status: 'occupied', server: 'Fernando', covers: 4 },
  { id: 28, status: 'dirty', server: null, covers: 0 },
  { id: 29, status: 'occupied', server: 'Jaime', covers: 2 },
  { id: 30, status: 'occupied', server: 'Fernando', covers: 4 },
  { id: 31, status: 'open', server: null, covers: 0 },
  { id: 32, status: 'occupied', server: 'Fernando', covers: 2 },
  // Patio continued - Table 34 (outdoor, needing attention)
  { id: 33, status: 'occupied', server: 'Jaime', covers: 3 },
  { id: 34, status: 'needsAttention', server: 'Jaime', covers: 4 },
  // Bar-Adjacent (Tables 35-42)
  { id: 35, status: 'occupied', server: 'Adriana', covers: 2 },
  { id: 36, status: 'occupied', server: 'Fabian', covers: 2 },
  { id: 37, status: 'open', server: null, covers: 0 },
  { id: 38, status: 'occupied', server: 'Maria', covers: 3 },
  { id: 39, status: 'occupied', server: 'Fabian', covers: 2 },
  { id: 40, status: 'occupied', server: 'Jaime', covers: 2 },
  { id: 41, status: 'dirty', server: null, covers: 0 },
  { id: 42, status: 'occupied', server: 'Maria', covers: 2 },
  // Private Dining (Tables 43-46)
  { id: 43, status: 'occupied', server: 'Adriana', covers: 8 },
  { id: 44, status: 'open', server: null, covers: 0 },
  { id: 45, status: 'occupied', server: 'Fabian', covers: 6 },
  { id: 46, status: 'open', server: null, covers: 0 },
  // Communal (Tables 47-50)
  { id: 47, status: 'occupied', server: 'Maria', covers: 4 },
  { id: 48, status: 'occupied', server: 'Jaime', covers: 3 },
  { id: 49, status: 'occupied', server: 'Fabian', covers: 2 },
  { id: 50, status: 'occupied', server: 'Adriana', covers: 2 }
]

// Alerts
export const alerts = [
  { id: 1, severity: 'high', message: '7 tables projected to turn in the next 18 min - pace the host stand now', action: 'View turns', icon: 'clock' },
  { id: 2, severity: 'medium', message: 'Fabian still has the lightest interior section - route the next 2-top to keep the floor balanced', action: 'Use route', icon: 'utensils' },
  { id: 3, severity: 'medium', message: 'Classic Mimosa discount window is underperforming by 3 checks - push flights at Tables 21, 25, and 30', action: 'Open pricing', icon: 'spray' },
  { id: 4, severity: 'low', message: '11:00 AM reservations are confirmed and pacing within capacity', action: null, icon: 'check' }
]

// Staff Today (for dashboard leaderboard)
export const staffToday = [
  { id: 'destiny-w', name: 'Adriana', tips: 218, covers: 28, avgTip: 7.79, rank: 1 },
  { id: 'marcus-j', name: 'Fabian', tips: 195, covers: 24, avgTip: 8.13, rank: 2 },
  { id: 'tiffany-r', name: 'Maria', tips: 162, covers: 20, avgTip: 8.10, rank: 3 },
  { id: 'carlos-m', name: 'Fernando', tips: 148, covers: 18, avgTip: 8.22, rank: 4 },
  { id: 'jordan-k', name: 'Jaime', tips: 72, covers: 10, avgTip: 7.20, rank: 5, isNew: true }
]

// Full Staff List
export const staff = [
  {
    id: 'destiny-w',
    name: 'Adriana',
    role: 'Server',
    tenure: '3.1 years',
    avatar: null,
    badges: ['topPerformer'],
    thisMonth: { covers: 312, tips: 2840, avgTip: 9.10, efficiency: 94, revenue: 7150 },
    trend: 'up',
    tipPercent: 19,
    strengths: ['Fastest table turns (33min avg)', 'Highest mimosa upsell rate (68%)', 'Zero complaints this quarter', 'Regulars request her by name'],
    areasToWatch: ['Could delegate more during peak rush'],
    recentShifts: [
      { date: 'Sat Feb 21', hours: '6am-2pm', covers: 28, tips: 218, efficiency: 95 },
      { date: 'Fri Feb 20', hours: '6am-2pm', covers: 24, tips: 196, efficiency: 93 },
      { date: 'Thu Feb 19', hours: '7am-2pm', covers: 19, tips: 158, efficiency: 94 }
    ],
    trendData: [
      { month: 'Sep', tips: 2180, efficiency: 90 },
      { month: 'Oct', tips: 2350, efficiency: 91 },
      { month: 'Nov', tips: 2480, efficiency: 92 },
      { month: 'Dec', tips: 2640, efficiency: 93 },
      { month: 'Jan', tips: 2720, efficiency: 94 },
      { month: 'Feb', tips: 2840, efficiency: 94 }
    ]
  },
  {
    id: 'marcus-j',
    name: 'Fabian',
    role: 'Server',
    tenure: '2 years',
    avatar: null,
    badges: [],
    thisMonth: { covers: 274, tips: 2410, avgTip: 8.80, efficiency: 89, revenue: 6280 },
    trend: 'up',
    tipPercent: 18,
    strengths: ['Consistent performer', 'Great with walk-ins and small-party routing', 'Strong knowledge of the brunch menu', 'Reliable weekend availability'],
    areasToWatch: ['Table turn time could improve on busy mornings', 'Sometimes slow to greet new tables'],
    recentShifts: [
      { date: 'Sat Feb 21', hours: '6am-2pm', covers: 24, tips: 195, efficiency: 90 },
      { date: 'Fri Feb 20', hours: '6am-2pm', covers: 21, tips: 172, efficiency: 88 },
      { date: 'Thu Feb 19', hours: '7am-2pm', covers: 17, tips: 144, efficiency: 89 }
    ],
    trendData: [
      { month: 'Sep', tips: 1920, efficiency: 85 },
      { month: 'Oct', tips: 2050, efficiency: 86 },
      { month: 'Nov', tips: 2180, efficiency: 87 },
      { month: 'Dec', tips: 2290, efficiency: 88 },
      { month: 'Jan', tips: 2360, efficiency: 89 },
      { month: 'Feb', tips: 2410, efficiency: 89 }
    ]
  },
  {
    id: 'tiffany-r',
    name: 'Maria',
    role: 'Server',
    tenure: '1.5 years',
    avatar: null,
    badges: [],
    thisMonth: { covers: 248, tips: 2280, avgTip: 9.19, efficiency: 91, revenue: 5690 },
    trend: 'stable',
    tipPercent: 19,
    strengths: ['Excellent mimosa and drink upselling', 'Warm personality, great with tourists', 'Very organized - rarely misses a check-back'],
    areasToWatch: ['Can get flustered during 9-11am peak', 'Needs to pre-bus tables faster'],
    recentShifts: [
      { date: 'Sat Feb 21', hours: '6am-2pm', covers: 20, tips: 162, efficiency: 91 },
      { date: 'Fri Feb 20', hours: '6am-2pm', covers: 18, tips: 148, efficiency: 90 },
      { date: 'Thu Feb 19', hours: '7am-2pm', covers: 15, tips: 128, efficiency: 92 }
    ],
    trendData: [
      { month: 'Sep', tips: 1780, efficiency: 87 },
      { month: 'Oct', tips: 1900, efficiency: 88 },
      { month: 'Nov', tips: 2020, efficiency: 89 },
      { month: 'Dec', tips: 2140, efficiency: 90 },
      { month: 'Jan', tips: 2210, efficiency: 91 },
      { month: 'Feb', tips: 2280, efficiency: 91 }
    ]
  },
  {
    id: 'carlos-m',
    name: 'Fernando',
    role: 'Server',
    tenure: '10 months',
    avatar: null,
    badges: ['patioSpecialist'],
    thisMonth: { covers: 218, tips: 1860, avgTip: 8.53, efficiency: 87, revenue: 4990 },
    trend: 'up',
    tipPercent: 17,
    strengths: ['Patio expert - manages outdoor flow well', 'Bilingual (English/Spanish) - helpful with tourist groups', 'Strong drink knowledge'],
    areasToWatch: ['Indoor section management needs work', 'Ticket accuracy - 2 comps this month from wrong orders'],
    recentShifts: [
      { date: 'Sat Feb 21', hours: '6am-2pm', covers: 18, tips: 148, efficiency: 88 },
      { date: 'Fri Feb 20', hours: '6am-2pm', covers: 15, tips: 124, efficiency: 86 },
      { date: 'Thu Feb 19', hours: '7am-2pm', covers: 12, tips: 102, efficiency: 87 }
    ],
    trendData: [
      { month: 'Sep', tips: 1240, efficiency: 80 },
      { month: 'Oct', tips: 1380, efficiency: 82 },
      { month: 'Nov', tips: 1520, efficiency: 84 },
      { month: 'Dec', tips: 1640, efficiency: 85 },
      { month: 'Jan', tips: 1760, efficiency: 86 },
      { month: 'Feb', tips: 1860, efficiency: 87 }
    ]
  },
  {
    id: 'jordan-k',
    name: 'Jaime',
    role: 'Server',
    tenure: '6 weeks',
    avatar: null,
    badges: ['new'],
    thisMonth: { covers: 98, tips: 720, avgTip: 7.35, efficiency: null, revenue: 2240 },
    trend: 'new',
    tipPercent: 15,
    strengths: ['Quick learner', 'Enthusiastic attitude', 'Good energy with younger crowds'],
    areasToWatch: ['Still learning the full menu', 'Needs confidence recommending specials', 'Ticket times higher than average - rely on expo more'],
    recentShifts: [
      { date: 'Sat Feb 21', hours: '7am-2pm', covers: 10, tips: 72, efficiency: null },
      { date: 'Fri Feb 20', hours: '7am-2pm', covers: 8, tips: 58, efficiency: null },
      { date: 'Wed Feb 18', hours: '7am-1pm', covers: 6, tips: 42, efficiency: null }
    ],
    trendData: []
  }
]

// Reservations (Breakfast Timeline - Next slots)
export const reservations = [
  { time: '8:00 AM', covers: 14, parties: ['Henderson (4)', 'Walker (2)', 'Simmons (2)', 'Walk-in (4)', 'Walk-in (2)'], capacity: 45 },
  { time: '9:00 AM', covers: 28, parties: ['VIP: Thompson Party (8)', 'Nguyen (4)', 'Mitchell (6)', 'Davis (4)', 'Clarke (2)', '+4 walk-ins'], capacity: 75 },
  { time: '10:00 AM', covers: 42, parties: ['Birthday: Collins (12)', 'Jackson (6)', 'Rivera (4)', 'Morgan (4)', 'Bell (2)', '+14 walk-ins'], capacity: 95, warning: true },
  { time: '11:00 AM', covers: 38, parties: ['Brunch Group: Adams (10)', 'Turner (6)', 'Campbell (4)', 'Parker (4)', '+14 walk-ins'], capacity: 90, warning: true }
]

// AI Insights
export const aiInsights = [
  "Seven tables are likely to turn in the next 18 minutes. Pace the host stand against those seats instead of holding walk-ins too long.",
  "Fabian is still the lightest interior section while Adriana is carrying the heaviest load. Route the next two 2-tops to Fabian to keep sections balanced.",
  "Covers are pacing about 10% ahead of last Saturday with the same floor staffing. The gain is coming from shorter turns and fewer idle seats."
]

// Weekly Trend Data (breakfast restaurant pattern: weekends strongest)
export const weeklyTrend = {
  thisWeek: [
    { day: 'Mon', revenue: 2840 },
    { day: 'Tue', revenue: 3120 },
    { day: 'Wed', revenue: 3380 },
    { day: 'Thu', revenue: 3650 },
    { day: 'Fri', revenue: 4480 },
    { day: 'Sat', revenue: 3847 },
    { day: 'Sun', revenue: null }
  ],
  lastWeek: [
    { day: 'Mon', revenue: 2680 },
    { day: 'Tue', revenue: 2940 },
    { day: 'Wed', revenue: 3180 },
    { day: 'Thu', revenue: 3440 },
    { day: 'Fri', revenue: 4220 },
    { day: 'Sat', revenue: 5640 },
    { day: 'Sun', revenue: 5820 }
  ]
}

// Quick Stats (Right Sidebar)
export const quickStats = {
  tablesOpen: 8,
  staffOn: 5,
  waitList: 6
}

// Schedule Data (Breakfast shifts: Open 6AM-2PM, Close 7AM-3PM)
export const schedule = {
  weekOf: 'Feb 23 - Mar 1',
  days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
  dayTypes: ['slow', 'slow', 'avg', 'avg', 'busy', 'busy', 'busy'],
  staff: [
    // ── MANAGEMENT ──
    { name: 'Genta T.', role: 'GM', shifts: ['7-3', '7-3', '7-3', '7-3', '7-3', '7-3', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Besim T.', role: 'AGM', shifts: ['OFF', '7-3', '7-3', '7-3', '7-3', '7-3', '7-3'], isTraining: [false, false, false, false, false, false, false] },
    // ── SERVERS ──
    { name: 'Adriana', role: 'Server', shifts: ['OFF', '6-2', '6-2', 'OFF', '6-2', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Fabian', role: 'Server', shifts: ['7-2', 'OFF', '7-2', '6-2', '6-2', '6-2', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Maria', role: 'Server', shifts: ['6-2', '6-2', 'OFF', '7-2', '6-2', 'OFF', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Fernando', role: 'Server', shifts: ['7-2', '7-2', '7-2', '7-2', 'OFF', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Jaime', role: 'Server', shifts: ['OFF', '7-1', 'OFF', '7-1', '7-2', '7-2', 'OFF'], isTraining: [false, true, false, true, true, false, false] },
    { name: 'Aaliyah B.', role: 'Server', shifts: ['6-2', 'OFF', '6-2', '6-2', '6-2', '6-2', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Dominique P.', role: 'Server', shifts: ['OFF', '6-2', '6-2', 'OFF', '6-2', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Keisha L.', role: 'Server', shifts: ['7-2', '7-2', 'OFF', '7-2', 'OFF', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Tyler H.', role: 'Server', shifts: ['OFF', 'OFF', '7-2', '7-2', '6-2', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Jasmine C.', role: 'Server', shifts: ['6-2', '6-2', '6-2', 'OFF', 'OFF', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    // ── HOSTS ──
    { name: 'Mia S.', role: 'Host', shifts: ['7-2', '7-2', 'OFF', '7-2', '7-2', '7-2', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Deja W.', role: 'Host', shifts: ['OFF', 'OFF', '7-2', '7-2', '7-2', '7-2', '7-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Elijah N.', role: 'Host', shifts: ['7-12', '7-12', '7-12', 'OFF', 'OFF', '7-2', '7-2'], isTraining: [true, true, true, false, false, false, false] },
    // ── BARTENDERS ──
    { name: 'Andre F.', role: 'Bartender', shifts: ['8-2', '8-2', 'OFF', '8-2', '8-2', '7-2', '7-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Skylar D.', role: 'Bartender', shifts: ['OFF', '8-2', '8-2', '8-2', '8-2', '7-2', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    // ── KITCHEN ──
    { name: 'DeShawn H.', role: 'Exec Chef', shifts: ['5-1', '5-1', '5-1', '5-1', '5-1', '5-1', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Marco V.', role: 'Sous Chef', shifts: ['OFF', '5-1', '5-1', '5-1', '5-1', '5-1', '5-1'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Tamika G.', role: 'Line Cook', shifts: ['5-1', '5-1', 'OFF', '5-1', '5-1', '5-1', '5-1'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Ricky A.', role: 'Line Cook', shifts: ['5-1', 'OFF', '5-1', '5-1', '5-1', '5-1', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Priya N.', role: 'Line Cook', shifts: ['OFF', '5-1', '5-1', 'OFF', '5-1', '5-1', '5-1'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Jamal T.', role: 'Line Cook', shifts: ['6-1', '6-1', '6-1', '6-1', 'OFF', '5-1', '5-1'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Nina O.', role: 'Prep Cook', shifts: ['4-10', '4-10', '4-10', '4-10', '4-10', '4-10', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Luis R.', role: 'Prep Cook', shifts: ['OFF', '4-10', '4-10', '4-10', '4-10', '4-10', '4-10'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Hakeem W.', role: 'Dishwasher', shifts: ['6-2', '6-2', 'OFF', '6-2', '6-2', '6-2', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Santiago M.', role: 'Dishwasher', shifts: ['6-2', 'OFF', '6-2', '6-2', '6-2', 'OFF', '6-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Chris B.', role: 'Expo', shifts: ['7-2', '7-2', '7-2', 'OFF', '7-2', '7-2', '7-2'], isTraining: [false, false, false, false, false, false, false] },
    // ── BUSSERS / RUNNERS ──
    { name: 'Jaylen P.', role: 'Busser', shifts: ['7-2', '7-2', 'OFF', '7-2', '7-2', '7-2', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Bianca Q.', role: 'Busser', shifts: ['OFF', '7-2', '7-2', 'OFF', '7-2', '7-2', '7-2'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Malik E.', role: 'Busser', shifts: ['OFF', 'OFF', '7-1', '7-1', '7-2', '7-2', '7-2'], isTraining: [true, false, true, true, false, false, false] },
    { name: 'Savannah T.', role: 'Runner', shifts: ['7-2', '7-2', '7-2', 'OFF', '7-2', '7-2', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Devon J.', role: 'Runner', shifts: ['OFF', '7-2', 'OFF', '7-2', '7-2', '7-2', '7-2'], isTraining: [false, false, false, false, false, false, false] },
  ],
  laborCost: 14850,
  laborPercent: 28,
  warnings: ['Saturday and Sunday may need extra support - spring break traffic picking up', 'Jaime and Elijah both in training — avoid scheduling solo on peak days']
}

export const aiScheduleSuggestion = {
  text: "Based on last week's Saturday/Sunday traffic and the spring break uptick, I recommend adding 1 server and 1 busser Saturday 8AM-1PM for patio overflow, converting Jaime's Friday training to a regular shift, and shifting Priya to Saturday opening to strengthen the weekend line.",
  changes: [
    { type: 'add', staff: 'Extra server', day: 'SAT', shift: '8am-1pm' },
    { type: 'add', staff: 'Extra busser', day: 'SAT', shift: '8am-1pm' },
    { type: 'add', staff: 'Extra server', day: 'SUN', shift: '8am-1pm' },
    { type: 'remove', staff: 'Jaime (training)', day: 'FRI', shift: 'convert to regular' },
    { type: 'add', staff: 'Priya N.', day: 'SAT', shift: '5am-1pm (opening)' }
  ]
}

// Menu Items (BCG matrix: star, cow, puzzle, dog)
export const menuItems = [
  // Stars - High popularity, high margin
  { id: 'fried-lobster-waffles', name: 'Fried Lobster & Waffles', category: 'star', sold: 18, revenue: 432, margin: 11, price: 24, cost: 13 },
  { id: 'shrimp-grits', name: 'Shrimp & Grits', category: 'star', sold: 22, revenue: 396, margin: 10, price: 18, cost: 8 },
  { id: 'crab-cake-benedict', name: 'Crab Cake Benedict', category: 'star', sold: 16, revenue: 304, margin: 10, price: 19, cost: 9 },
  { id: 'mimosa-flight', name: 'Mimosa Flight (4 flavors)', category: 'star', sold: 28, revenue: 504, margin: 13, price: 18, cost: 5 },
  { id: 'seafood-omelet', name: 'Seafood Lovers Omelet', category: 'star', sold: 14, revenue: 280, margin: 9, price: 20, cost: 11 },
  // Cows - High popularity, steady margin
  { id: 'chicken-waffles', name: 'Chicken & Waffles', category: 'cow', sold: 26, revenue: 442, margin: 10, price: 17, cost: 7 },
  { id: 'creme-brulee-french-toast', name: 'Creme Brulee French Toast', category: 'cow', sold: 20, revenue: 320, margin: 10, price: 16, cost: 6 },
  { id: 'classic-mimosa', name: 'Classic Mimosa', category: 'cow', sold: 42, revenue: 420, margin: 8, price: 10, cost: 2 },
  { id: 'biscuits-gravy', name: 'Biscuits & Gravy', category: 'cow', sold: 18, revenue: 198, margin: 7, price: 11, cost: 4 },
  { id: 'southern-breakfast-platter', name: 'Southern Breakfast Platter', category: 'cow', sold: 15, revenue: 210, margin: 7, price: 14, cost: 7 },
  { id: 'bottomless-coffee', name: 'Bottomless Coffee', category: 'cow', sold: 58, revenue: 232, margin: 3, price: 4, cost: 1 },
  { id: 'pecan-pancakes', name: 'Pecan Praline Pancakes', category: 'cow', sold: 16, revenue: 224, margin: 8, price: 14, cost: 6 },
  { id: 'loaded-hash-browns', name: 'Loaded Hash Browns', category: 'cow', sold: 19, revenue: 228, margin: 7, price: 12, cost: 5 },
  { id: 'bellini', name: 'Peach Bellini', category: 'cow', sold: 14, revenue: 168, margin: 8, price: 12, cost: 4 },
  // Puzzles - Lower popularity, high margin potential
  { id: 'lobster-shrimp-omelet', name: 'Lobster Shrimp Omelet', category: 'puzzle', sold: 6, revenue: 132, margin: 10, price: 22, cost: 12 },
  { id: 'seared-tuna', name: 'Seared Tuna Benedict', category: 'puzzle', sold: 5, revenue: 95, margin: 9, price: 19, cost: 10 },
  { id: 'red-velvet-waffles', name: 'Red Velvet Waffles', category: 'puzzle', sold: 7, revenue: 112, margin: 9, price: 16, cost: 7 },
  { id: 'bourbon-french-toast', name: 'Bourbon Vanilla French Toast', category: 'puzzle', sold: 4, revenue: 68, margin: 10, price: 17, cost: 7 },
  // Dogs - Low popularity, low margin
  { id: 'greek-yogurt-bowl', name: 'Greek Yogurt Bowl', category: 'dog', sold: 3, revenue: 33, margin: 5, price: 11, cost: 6 },
  { id: 'soup-of-day', name: 'Soup of the Day', category: 'dog', sold: 4, revenue: 32, margin: 3, price: 8, cost: 5 },
  { id: 'side-fruit', name: 'Fresh Fruit Cup', category: 'dog', sold: 8, revenue: 48, margin: 3, price: 6, cost: 3 },
  { id: 'plain-toast', name: 'Toast & Jam', category: 'dog', sold: 5, revenue: 25, margin: 2, price: 5, cost: 3 }
]

export const items86d = [
  { name: 'Mussels Appetizer', reason: 'Supplier issue - shipment delayed', since: 'Feb 20' },
  { name: 'Tiramisu French Toast', reason: 'Out of ladyfingers', since: 'Feb 21' }
]

export const menuInsight = "Mimosa Flights have the highest margin ($13/unit) and outsell every other drink 2:1. Consider a 'Build Your Own Flight' upsell at $22 (4 premium flavors) and brief servers to suggest it to every table of 2+ during the 9-11 AM window."

export const pricingSummary = {
  title: 'Pricing Recommendations',
  description: 'These recommendations use floor turns, POS mix, reservations, and staffing data to suggest small menu moves the room can support right now.',
  weeklyLift: 1280,
  sameStaffLift: 10,
  monitoredSignals: ['Live floor turns', 'POS sell-through', 'Reservation pacing', 'Server load'],
}

export const pricingRecommendations = [
  {
    id: 'price-lobster',
    mode: 'increase',
    item: 'Fried Lobster & Waffles',
    currentPrice: 24,
    nextPrice: 26,
    window: '10:30 AM - 12:00 PM',
    reason: 'Premium demand stays strong once the room is above 82% full and tables are already waiting on turns.',
    expectedLift: 540,
    signal: 'Floor utilization 84% and premium-item conversion running 19% above baseline.',
  },
  {
    id: 'price-mimosa',
    mode: 'decrease',
    item: 'Classic Mimosa',
    currentPrice: 10,
    nextPrice: 9.5,
    window: '8:00 AM - 9:15 AM',
    reason: 'A small early-window discount fills lower-demand seats, then feeds guests into higher-margin flights later in service.',
    expectedLift: 220,
    signal: 'Early-hour fill rate lags by 8 seats, but flight attachment spikes after the first round.',
  },
  {
    id: 'price-bundle',
    mode: 'bundle',
    item: 'Flight + Benedict Window',
    currentPrice: null,
    nextPrice: 34,
    window: '10:30 AM - 11:30 AM',
    reason: 'Bundle Mimosa Flight with Crab Cake Benedict during the heaviest turn window to raise check average without slowing the kitchen.',
    expectedLift: 520,
    signal: '10:30 window has the strongest mix of open capacity, fast turns, and high-brunch intent.',
  },
]

export const nightlyRollup = {
  headline: 'Shift Summary',
  summary: 'The shift is pacing about 10% ahead of last Saturday on covers while staffing stays flat. The main drivers are faster turns, steadier section balance, and fewer idle seats.',
  metrics: [
    { id: 'utilization', label: 'Utilization', value: '86%', delta: '+9 pts', detail: 'Dining room + patio seats captured during peak window' },
    { id: 'turns', label: 'Avg Turn Time', value: '34 min', delta: '-4 min', detail: 'Down versus the recent Saturday average' },
    { id: 'server-load', label: 'Server Load Variance', value: '1.2x', delta: '-31%', detail: 'Tighter spread between lightest and heaviest sections' },
    { id: 'labor', label: 'Labor As % Of Sales', value: '27.4%', delta: '-1.6 pts', detail: 'Sales pace improved without adding another floor position' },
    { id: 'pricing', label: 'Pricing Lift', value: '+$1,280', delta: '/ week', detail: 'Estimated 7-day impact from current menu adjustments' },
    { id: 'left-on-table', label: 'Revenue Left On Table', value: '$410', delta: '-37%', detail: 'Missed turns, idle seats, and mistimed pricing are down' },
  ],
}

// Educational Cards
export const educationalCards = [
  { id: 1, title: 'Brunch Turn Times', description: 'How reducing your average turn from 38min to 32min could add $600/day in breakfast revenue', image: null },
  { id: 2, title: 'Upselling Drinks at Breakfast', description: 'Mimosa flights, bellinis, and specialty coffees - proven scripts that increase avg check by 18%', image: null },
  { id: 3, title: 'Managing the Weekend Rush', description: 'Staggering reservations and optimizing the waitlist to minimize walkouts during peak brunch', image: null },
  { id: 4, title: 'Training New Servers Fast', description: 'A 4-week onboarding plan that gets new hires to 80% efficiency for breakfast service', image: null }
]

// Analytics Data (BREAKFAST HOURS 7AM-2PM)
export const analyticsData = {
  // Table Turn Times
  tableTurns: {
    average: 38, // minutes - breakfast is faster than dinner
    goal: 35,
    trend: 'up', // getting slightly slower (bad) - brunch lingers
    byDayOfWeek: [
      { day: 'Mon', turnTime: 32 },
      { day: 'Tue', turnTime: 33 },
      { day: 'Wed', turnTime: 35 },
      { day: 'Thu', turnTime: 36 },
      { day: 'Fri', turnTime: 40 },
      { day: 'Sat', turnTime: 44 },
      { day: 'Sun', turnTime: 42 }
    ]
  },
  // Wait Times
  waitTimes: {
    average: 14, // minutes
    goal: 10,
    peakWait: 25,
    byHour: [
      { hour: '7am', wait: 2 },
      { hour: '8am', wait: 8 },
      { hour: '9am', wait: 18 },
      { hour: '10am', wait: 25 },
      { hour: '11am', wait: 20 },
      { hour: '12pm', wait: 12 },
      { hour: '1pm', wait: 5 }
    ]
  },
  // Kitchen Speed
  kitchenSpeed: {
    avgTicketTime: 11, // minutes - faster than dinner
    goal: 9,
    ticketsOver15: 8, // count this week
    byStation: [
      { station: 'Waffle Station', avgTime: 13 },
      { station: 'Griddle', avgTime: 10 },
      { station: 'Fry', avgTime: 9 },
      { station: 'Cold/Salad', avgTime: 5 },
      { station: 'Bar/Drinks', avgTime: 7 }
    ]
  },
  // Peak Hours Heatmap (covers by hour/day - breakfast hours 7am-1pm)
  peakHours: [
    { day: 'Mon', hours: { '7am': 8, '8am': 18, '9am': 28, '10am': 24, '11am': 20, '12pm': 14, '1pm': 6 } },
    { day: 'Tue', hours: { '7am': 10, '8am': 20, '9am': 32, '10am': 28, '11am': 24, '12pm': 16, '1pm': 8 } },
    { day: 'Wed', hours: { '7am': 12, '8am': 24, '9am': 36, '10am': 32, '11am': 26, '12pm': 18, '1pm': 10 } },
    { day: 'Thu', hours: { '7am': 14, '8am': 28, '9am': 42, '10am': 38, '11am': 30, '12pm': 20, '1pm': 12 } },
    { day: 'Fri', hours: { '7am': 18, '8am': 35, '9am': 52, '10am': 48, '11am': 42, '12pm': 28, '1pm': 16 } },
    { day: 'Sat', hours: { '7am': 22, '8am': 42, '9am': 68, '10am': 72, '11am': 65, '12pm': 45, '1pm': 22 } },
    { day: 'Sun', hours: { '7am': 20, '8am': 40, '9am': 62, '10am': 68, '11am': 58, '12pm': 40, '1pm': 18 } }
  ],
  // Monthly Revenue Trend (Myrtle Beach seasonality: summer peak, winter dip, spring break uptick)
  monthlyRevenue: [
    { month: 'Aug', revenue: 98000 },
    { month: 'Sep', revenue: 88000 },
    { month: 'Oct', revenue: 78000 },
    { month: 'Nov', revenue: 72000 },
    { month: 'Dec', revenue: 82000 },
    { month: 'Jan', revenue: 76000 },
    { month: 'Feb', revenue: 85000 }
  ],
  // This Week vs Last Week
  weekComparison: {
    thisWeek: { revenue: 22140, covers: 954, avgCheck: 23.21 },
    lastWeek: { revenue: 20110, covers: 868, avgCheck: 22.90 }
  }
}

// Reviews Data (15-20 reviews, realistic Mimosas themes)
export const reviews = [
  { id: 1, source: 'google', rating: 5, date: 'Feb 21', author: 'Christine B.', text: 'The Fried Lobster & Waffles are absolutely INCREDIBLE. Came here on vacation and this was the highlight of our trip. Adriana was our server and she was so sweet - gave us the best recommendations. Already planning our next visit!', sentiment: 'positive' },
  { id: 2, source: 'yelp', rating: 5, date: 'Feb 20', author: 'Marcus P.', text: 'Best brunch spot in Myrtle Beach, hands down. The mimosa flights are so fun - we tried all four flavors and the peach was our favorite. Gorgeous decor inside too, very Instagrammable. Shrimp & Grits were perfection.', sentiment: 'positive' },
  { id: 3, source: 'google', rating: 2, date: 'Feb 19', author: 'Rachel T.', text: 'Came for Saturday brunch and waited 35 minutes even with a reservation. The food was good but by the time we sat down we were already frustrated. The Crab Cake Benedict was delicious though, I will give them that.', sentiment: 'negative' },
  { id: 4, source: 'google', rating: 4, date: 'Feb 18', author: 'James W.', text: 'Great food, amazing atmosphere. The southern decor is on point. Only knock is the noise level - during peak brunch it gets LOUD. Hard to hear our server. But the Chicken & Waffles were worth it.', sentiment: 'positive' },
  { id: 5, source: 'opentable', rating: 5, date: 'Feb 18', author: 'Linda S.', text: 'We come every time we visit Myrtle Beach. The Creme Brulee French Toast is to die for. Our server Adriana remembered us from last year! That kind of service keeps us coming back.', sentiment: 'positive' },
  { id: 6, source: 'yelp', rating: 3, date: 'Feb 17', author: 'Devon K.', text: 'Food is genuinely good but the mimosa glasses are tiny for what you pay. $10 for what is basically a juice glass of mimosa? The flight is a better deal but still feels small. Great food, just manage your drink expectations.', sentiment: 'mixed' },
  { id: 7, source: 'google', rating: 1, date: 'Feb 16', author: 'Karen M.', text: 'Waited 40 minutes on a Sunday with no communication from the host stand. When we finally sat down, our food took another 30 minutes. For breakfast! I could have made pancakes at home three times over. Beautiful restaurant but the operations need serious work on weekends.', sentiment: 'negative' },
  { id: 8, source: 'opentable', rating: 5, date: 'Feb 15', author: 'Antonio R.', text: 'Outstanding experience from start to finish. The Lobster Shrimp Omelet is a hidden gem - not enough people order it. Patio was gorgeous on a sunny morning. Fabian was a fantastic server.', sentiment: 'positive' },
  { id: 9, source: 'google', rating: 4, date: 'Feb 14', author: 'Stephanie H.', text: 'Valentines Day brunch was magical. The place is beautifully decorated. Shrimp & Grits were incredible. Only issue was parking - we circled for 15 minutes. They need a valet or better lot.', sentiment: 'positive' },
  { id: 10, source: 'yelp', rating: 2, date: 'Feb 13', author: 'Tyler G.', text: 'Overhyped. Food was fine but nothing that justified the prices or the 30-minute wait. The Pecan Pancakes were good but $14 for pancakes? And the portions are not huge. Plenty of better brunch options in Myrtle Beach for less.', sentiment: 'negative' },
  { id: 11, source: 'google', rating: 5, date: 'Feb 12', author: 'Denise F.', text: 'I am OBSESSED with this place. The Fried Lobster & Waffles haunt my dreams. Brought my whole family (party of 8) and everyone loved their meal. The Biscuits & Gravy are the real deal - reminds me of my grandma\'s cooking.', sentiment: 'positive' },
  { id: 12, source: 'internal', rating: null, date: 'Feb 11', author: 'Table 23', text: 'Customer complained about cold Shrimp & Grits - kitchen remake. Also noted the patio table was wobbly. Comped a mimosa. Fixed table leg after service.', sentiment: 'negative' },
  { id: 13, source: 'opentable', rating: 4, date: 'Feb 10', author: 'Brian N.', text: 'Really solid brunch. The Mimosa Flight is a must - great way to try different flavors. Chicken & Waffles were crispy and perfectly seasoned. Would come back for sure. Service was prompt and friendly.', sentiment: 'positive' },
  { id: 14, source: 'google', rating: 3, date: 'Feb 9', author: 'Yolanda C.', text: 'The food is great but it is SO LOUD in there during Saturday brunch. We could barely talk. Also our food took about 25 minutes which felt long for eggs and waffles. The Crab Cake Benedict was delicious though.', sentiment: 'mixed' },
  { id: 15, source: 'yelp', rating: 5, date: 'Feb 8', author: 'Nathan R.', text: 'If you visit Myrtle Beach and don\'t eat at Mimosas, you\'re making a mistake. The Fried Lobster & Waffles alone are worth the trip. Beautiful restaurant, friendly staff, and the bottomless coffee kept flowing. 10/10.', sentiment: 'positive' },
  { id: 16, source: 'google', rating: 4, date: 'Feb 7', author: 'Priya M.', text: 'Really enjoyed our brunch here. The Southern Breakfast Platter is huge and filling. Mimosa flight was a fun touch. Only complaint is the wait - even on a Thursday at 10am we waited 10 minutes with an open table right there. Seemed like a staffing thing.', sentiment: 'positive' },
  { id: 17, source: 'internal', rating: null, date: 'Feb 6', author: 'Table 42', text: 'Guest praised Maria for upselling the mimosa flight - said it was the best recommendation. Party of 4, all ordered flights. $72 in drinks alone from one table.', sentiment: 'positive' },
  { id: 18, source: 'yelp', rating: 3, date: 'Feb 5', author: 'Greg L.', text: 'Good food, beautiful place, but the value proposition is off for me. $24 for lobster and waffles is steep for a breakfast spot. Portions are decent but not generous. I\'d come back for a special occasion but not a regular thing.', sentiment: 'mixed' }
]

export const reviewsSummary = {
  avgRating: 4.2,
  totalReviews: 856,
  thisMonth: 47,
  ratingBreakdown: { 5: 384, 4: 248, 3: 112, 2: 68, 1: 44 },
  bySource: { google: 4.3, yelp: 3.8, opentable: 4.6 }
}

export const reviewsAISynthesis = {
  summary: "Based on 47 reviews this month, customers rave about the Fried Lobster & Waffles (mentioned 14 times) and the mimosa flights (mentioned 11 times). The decor and atmosphere receive consistent praise. Server Adriana is mentioned by name in 6 positive reviews. However, weekend wait times are the top complaint (mentioned 12 times), with guests reporting 30-40 minute waits even with reservations. Secondary concerns include food wait times during the 9-11 AM peak, noise level inside during busy brunch, and perceived drink portion size vs. price for individual mimosas.",
  topPraises: [
    'Fried Lobster & Waffles consistently called "incredible" and "best in Myrtle Beach"',
    'Mimosa flights praised as fun and great value',
    'Beautiful decor and atmosphere - multiple "Instagrammable" mentions',
    'Server Adriana mentioned by name 6 times for excellent service',
    'Shrimp & Grits and Crab Cake Benedict frequently praised'
  ],
  topIssues: [
    'Weekend wait times of 30-40min even with reservations (12 mentions)',
    'Food wait times during 9-11 AM peak rush (7 mentions)',
    'Individual mimosa glass size perceived as small for $10 (4 mentions)',
    'Noise level during peak brunch makes conversation difficult (3 mentions)',
    'Parking difficulties, especially weekends (3 mentions)'
  ],
  actionItems: [
    'Add 1 server to Saturday/Sunday 9 AM-12 PM to reduce table wait and food delivery times',
    'Consider a "reservation priority seating" system to honor reservation times within 10 minutes',
    'Evaluate mimosa glass size or add a "large mimosa" option at $14 to address value perception',
    'Explore sound-dampening panels or soft furnishings to reduce noise during peak hours',
    'Partner with nearby lot or offer validated parking to ease weekend parking complaints'
  ]
}

// Restaurant Profile (Settings)
export const restaurantProfile = {
  name: 'Mimosas Southern Kitchen & Bar',
  address: '9809 N Kings Hwy, Myrtle Beach, SC 29572',
  phone: '(843) 497-2797',
  email: 'info@mimosasmyrtlebeach.com',
  website: 'www.mimosasmyrtlebeach.com',
  hours: {
    monday: { open: '7:00 AM', close: '2:00 PM' },
    tuesday: { open: '7:00 AM', close: '2:00 PM' },
    wednesday: { open: '7:00 AM', close: '2:00 PM' },
    thursday: { open: '7:00 AM', close: '2:00 PM' },
    friday: { open: '7:00 AM', close: '2:00 PM' },
    saturday: { open: '7:00 AM', close: '2:00 PM' },
    sunday: { open: '7:00 AM', close: '2:00 PM' }
  },
  capacity: {
    totalSeats: 235,
    tables: 50,
    barSeats: 18,
    patioSeats: 56,
    mainDining: 96,
    privateDining: 32,
    communal: 33
  },
  tableLayout: [
    { id: 1, seats: 4, section: 'main' },
    { id: 2, seats: 2, section: 'main' },
    { id: 3, seats: 6, section: 'main' },
    { id: 4, seats: 4, section: 'main' },
    { id: 5, seats: 4, section: 'main' },
    { id: 6, seats: 2, section: 'main' },
    { id: 7, seats: 4, section: 'main' },
    { id: 8, seats: 6, section: 'main' },
    { id: 9, seats: 2, section: 'main' },
    { id: 10, seats: 4, section: 'main' },
    { id: 11, seats: 4, section: 'main' },
    { id: 12, seats: 2, section: 'main' },
    { id: 13, seats: 2, section: 'main' },
    { id: 14, seats: 4, section: 'main' },
    { id: 15, seats: 4, section: 'main' },
    { id: 16, seats: 2, section: 'main' },
    { id: 17, seats: 4, section: 'main' },
    { id: 18, seats: 6, section: 'main' },
    { id: 19, seats: 2, section: 'main' },
    { id: 20, seats: 4, section: 'main' },
    { id: 21, seats: 4, section: 'patio' },
    { id: 22, seats: 2, section: 'patio' },
    { id: 23, seats: 6, section: 'patio' },
    { id: 24, seats: 4, section: 'patio' },
    { id: 25, seats: 4, section: 'patio' },
    { id: 26, seats: 2, section: 'patio' },
    { id: 27, seats: 4, section: 'patio' },
    { id: 28, seats: 4, section: 'patio' },
    { id: 29, seats: 2, section: 'patio' },
    { id: 30, seats: 4, section: 'patio' },
    { id: 31, seats: 4, section: 'patio' },
    { id: 32, seats: 2, section: 'patio' },
    { id: 33, seats: 4, section: 'patio' },
    { id: 34, seats: 6, section: 'patio' },
    { id: 35, seats: 2, section: 'bar' },
    { id: 36, seats: 2, section: 'bar' },
    { id: 37, seats: 2, section: 'bar' },
    { id: 38, seats: 4, section: 'bar' },
    { id: 39, seats: 2, section: 'bar' },
    { id: 40, seats: 2, section: 'bar' },
    { id: 41, seats: 2, section: 'bar' },
    { id: 42, seats: 2, section: 'bar' },
    { id: 43, seats: 10, section: 'private' },
    { id: 44, seats: 8, section: 'private' },
    { id: 45, seats: 8, section: 'private' },
    { id: 46, seats: 6, section: 'private' },
    { id: 47, seats: 8, section: 'communal' },
    { id: 48, seats: 8, section: 'communal' },
    { id: 49, seats: 8, section: 'communal' },
    { id: 50, seats: 9, section: 'communal' }
  ]
}

// Users & Permissions (Settings)
export const users = [
  { id: 1, name: 'Genta T.', email: 'genta@mimosasmb.com', role: 'owner', status: 'active', lastLogin: 'Today, 6:15 AM' },
  { id: 2, name: 'Besim T.', email: 'besim@mimosasmb.com', role: 'manager', status: 'active', lastLogin: 'Today, 6:00 AM' },
  { id: 3, name: 'Adriana', email: 'adriana@mimosasmb.com', role: 'server', status: 'active', lastLogin: 'Today, 5:55 AM' },
  { id: 4, name: 'Fabian', email: 'fabian@mimosasmb.com', role: 'server', status: 'active', lastLogin: 'Today, 5:50 AM' },
  { id: 5, name: 'Maria', email: 'maria@mimosasmb.com', role: 'server', status: 'active', lastLogin: 'Today, 5:58 AM' },
  { id: 6, name: 'Fernando', email: 'fernando@mimosasmb.com', role: 'server', status: 'active', lastLogin: 'Today, 5:52 AM' },
  { id: 7, name: 'Jaime', email: 'jaime@mimosasmb.com', role: 'server', status: 'active', lastLogin: 'Today, 6:45 AM' },
  { id: 8, name: 'DeShawn Harris', email: 'deshawn@mimosasmb.com', role: 'kitchen', status: 'active', lastLogin: 'Today, 5:30 AM' },
  { id: 9, name: 'Aaliyah Brooks', email: 'aaliyah@mimosasmb.com', role: 'host', status: 'active', lastLogin: 'Today, 6:30 AM' }
]

export const roles = {
  owner: { label: 'Owner', permissions: ['all'], color: 'purple' },
  manager: { label: 'Manager', permissions: ['schedule', 'staff', 'analytics', 'menu', 'reviews'], color: 'blue' },
  server: { label: 'Server', permissions: ['floor', 'tables'], color: 'green' },
  host: { label: 'Host', permissions: ['floor', 'reservations'], color: 'amber' },
  kitchen: { label: 'Kitchen', permissions: ['orders', 'menu'], color: 'red' }
}

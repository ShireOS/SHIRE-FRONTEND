// Today's Key Metrics
export const todayMetrics = {
  revenue: { value: 4832, change: 12, goal: 6000 },
  covers: { value: 67, change: 8, goal: 85 },
  avgCheck: { value: 72.12, change: -3.2, goal: 75 },
  avgWait: { value: 8, change: 2, goal: 5 }
}

// Table Status
export const tables = [
  { id: 1, status: 'occupied', server: 'Sarah M.', covers: 4 },
  { id: 2, status: 'needsAttention', server: 'Mike R.', covers: 2 },
  { id: 3, status: 'dirty', server: null, covers: 0 },
  { id: 4, status: 'occupied', server: 'Sarah M.', covers: 6 },
  { id: 5, status: 'occupied', server: 'Lisa P.', covers: 3 },
  { id: 6, status: 'open', server: null, covers: 0 },
  { id: 7, status: 'needsAttention', server: 'James K.', covers: 4 },
  { id: 8, status: 'occupied', server: 'Mike R.', covers: 2 }
]

// Alerts
export const alerts = [
  { id: 1, severity: 'high', message: 'Table 7 waiting 12min for server', action: 'Assign Sarah', icon: 'clock' },
  { id: 2, severity: 'medium', message: 'Kitchen backup - 4 tickets over 15min', action: 'View', icon: 'utensils' },
  { id: 3, severity: 'medium', message: 'Table 12 dirty for 8min', action: 'Alert busser', icon: 'spray' },
  { id: 4, severity: 'low', message: 'All reservations confirmed', action: null, icon: 'check' }
]

// Staff Today (for dashboard leaderboard)
export const staffToday = [
  { id: 'sarah-m', name: 'Sarah M.', tips: 342, covers: 12, avgTip: 28.50, rank: 1 },
  { id: 'mike-r', name: 'Mike R.', tips: 287, covers: 10, avgTip: 28.70, rank: 2 },
  { id: 'james-k', name: 'James K.', tips: 156, covers: 6, avgTip: 26.00, rank: 3, warning: true },
  { id: 'alex-t', name: 'Alex T.', tips: 89, covers: 4, avgTip: 22.25, rank: 4, isNew: true }
]

// Full Staff List
export const staff = [
  {
    id: 'sarah-m',
    name: 'Sarah Martinez',
    role: 'Server',
    tenure: '2.3 years',
    avatar: null,
    badges: ['topPerformer'],
    thisMonth: { covers: 142, tips: 4438, avgTip: 31.25, efficiency: 94, revenue: 2847 },
    trend: 'up',
    tipPercent: 22,
    strengths: ['Fast table turns (47min avg)', 'High tip % (22.1%)', 'Zero complaints', 'Great with large parties'],
    areasToWatch: ['Lower wine upsells than average'],
    recentShifts: [
      { date: 'Sat Jan 4', hours: '4-11pm', covers: 18, tips: 412, efficiency: 95 },
      { date: 'Fri Jan 3', hours: '4-11pm', covers: 16, tips: 378, efficiency: 93 },
      { date: 'Thu Jan 2', hours: '4-10pm', covers: 12, tips: 298, efficiency: 94 }
    ],
    trendData: [
      { month: 'Aug', tips: 3200, efficiency: 90 },
      { month: 'Sep', tips: 3400, efficiency: 91 },
      { month: 'Oct', tips: 3800, efficiency: 92 },
      { month: 'Nov', tips: 4100, efficiency: 93 },
      { month: 'Dec', tips: 4300, efficiency: 94 },
      { month: 'Jan', tips: 4438, efficiency: 94 }
    ]
  },
  {
    id: 'mike-r',
    name: 'Mike Rodriguez',
    role: 'Server',
    tenure: '1.8 years',
    avatar: null,
    badges: [],
    thisMonth: { covers: 128, tips: 3814, avgTip: 29.80, efficiency: 91, revenue: 2412 },
    trend: 'up',
    tipPercent: 21,
    strengths: ['Consistent performance', 'Good with regulars', 'Reliable'],
    areasToWatch: ['Could improve table turnover'],
    recentShifts: [
      { date: 'Sat Jan 4', hours: '4-11pm', covers: 15, tips: 356, efficiency: 90 },
      { date: 'Fri Jan 3', hours: '4-11pm', covers: 14, tips: 338, efficiency: 91 },
      { date: 'Thu Jan 2', hours: '4-10pm', covers: 11, tips: 268, efficiency: 92 }
    ],
    trendData: [
      { month: 'Aug', tips: 2900, efficiency: 88 },
      { month: 'Sep', tips: 3100, efficiency: 89 },
      { month: 'Oct', tips: 3300, efficiency: 90 },
      { month: 'Nov', tips: 3500, efficiency: 90 },
      { month: 'Dec', tips: 3700, efficiency: 91 },
      { month: 'Jan', tips: 3814, efficiency: 91 }
    ]
  },
  {
    id: 'lisa-p',
    name: 'Lisa Park',
    role: 'Server',
    tenure: '1.2 years',
    avatar: null,
    badges: [],
    thisMonth: { covers: 119, tips: 3384, avgTip: 28.44, efficiency: 88, revenue: 2156 },
    trend: 'stable',
    tipPercent: 20,
    strengths: ['Great personality', 'Good upseller'],
    areasToWatch: ['Needs to work on speed'],
    recentShifts: [
      { date: 'Sat Jan 4', hours: '4-11pm', covers: 14, tips: 312, efficiency: 87 },
      { date: 'Fri Jan 3', hours: '4-11pm', covers: 13, tips: 298, efficiency: 88 },
      { date: 'Thu Jan 2', hours: '4-10pm', covers: 10, tips: 245, efficiency: 89 }
    ],
    trendData: [
      { month: 'Aug', tips: 2600, efficiency: 85 },
      { month: 'Sep', tips: 2800, efficiency: 86 },
      { month: 'Oct', tips: 3000, efficiency: 87 },
      { month: 'Nov', tips: 3100, efficiency: 87 },
      { month: 'Dec', tips: 3200, efficiency: 88 },
      { month: 'Jan', tips: 3384, efficiency: 88 }
    ]
  },
  {
    id: 'james-k',
    name: 'James Kim',
    role: 'Server',
    tenure: '8 months',
    avatar: null,
    badges: ['struggling'],
    thisMonth: { covers: 87, tips: 2109, avgTip: 24.24, efficiency: 72, revenue: 1544 },
    trend: 'down',
    tipPercent: 18,
    strengths: ['Friendly with customers'],
    areasToWatch: ['Slow service', 'Missing upsell opportunities', 'Low energy lately'],
    recentShifts: [
      { date: 'Sat Jan 4', hours: '4-11pm', covers: 10, tips: 198, efficiency: 70 },
      { date: 'Fri Jan 3', hours: '4-11pm', covers: 9, tips: 178, efficiency: 71 },
      { date: 'Thu Jan 2', hours: '4-10pm', covers: 8, tips: 156, efficiency: 73 }
    ],
    trendData: [
      { month: 'Aug', tips: 2400, efficiency: 82 },
      { month: 'Sep', tips: 2300, efficiency: 80 },
      { month: 'Oct', tips: 2200, efficiency: 78 },
      { month: 'Nov', tips: 2100, efficiency: 75 },
      { month: 'Dec', tips: 2050, efficiency: 73 },
      { month: 'Jan', tips: 2109, efficiency: 72 }
    ]
  },
  {
    id: 'alex-t',
    name: 'Alex Thompson',
    role: 'Server',
    tenure: '3 weeks',
    avatar: null,
    badges: ['new'],
    thisMonth: { covers: 34, tips: 751, avgTip: 22.09, efficiency: null, revenue: 612 },
    trend: 'new',
    tipPercent: 17,
    strengths: ['Quick learner', 'Enthusiastic'],
    areasToWatch: ['Still learning the menu', 'Needs more confidence'],
    recentShifts: [
      { date: 'Sat Jan 4', hours: '4-10pm', covers: 5, tips: 98, efficiency: null },
      { date: 'Fri Jan 3', hours: '4-10pm', covers: 4, tips: 82, efficiency: null }
    ],
    trendData: []
  }
]

// Reservations (Next 3 Hours)
export const reservations = [
  { time: '6:00', covers: 8, parties: ['Smith (4)', 'Patel (2)', 'Walk-in (2)'], capacity: 60 },
  { time: '6:30', covers: 12, parties: ['Johnson (6)', 'Wong (4)', 'Garcia (2)'], capacity: 80 },
  { time: '7:00', covers: 18, parties: ['VIP: Williams (8)', 'Lee (4)', 'Brown (4)', 'Davis (2)'], capacity: 95 },
  { time: '7:30', covers: 22, parties: ['Anderson (6)', 'Taylor (6)', 'Martinez (4)', '+6 more'], capacity: 100, warning: true }
]

// AI Insights
export const aiInsights = [
  "You're trending 15% above last Saturday. Consider calling in an extra server for 7-9pm.",
  "The salmon has high margins but only sold 3x today. Train servers to recommend it.",
  "James K. is 20% slower than his usual. Check in with him."
]

// Weekly Trend Data
export const weeklyTrend = {
  thisWeek: [
    { day: 'Mon', revenue: 3200 },
    { day: 'Tue', revenue: 3800 },
    { day: 'Wed', revenue: 4100 },
    { day: 'Thu', revenue: 4500 },
    { day: 'Fri', revenue: 5200 },
    { day: 'Sat', revenue: 4832 },
    { day: 'Sun', revenue: null }
  ],
  lastWeek: [
    { day: 'Mon', revenue: 3000 },
    { day: 'Tue', revenue: 3500 },
    { day: 'Wed', revenue: 3800 },
    { day: 'Thu', revenue: 4200 },
    { day: 'Fri', revenue: 4800 },
    { day: 'Sat', revenue: 5100 },
    { day: 'Sun', revenue: 3600 }
  ]
}

// Quick Stats (Right Sidebar)
export const quickStats = {
  tablesOpen: 4,
  staffOn: 6,
  waitList: 3
}

// Schedule Data
export const schedule = {
  weekOf: 'Jan 6-12',
  days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
  dayTypes: ['slow', 'avg', 'avg', 'avg', 'busy', 'busy', 'avg'],
  staff: [
    { name: 'Sarah', shifts: ['OFF', '4-10', '4-10', 'OFF', '4-11', '4-11', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Mike', shifts: ['11-4', 'OFF', '4-10', '4-10', '4-11', 'OFF', '11-8'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Lisa', shifts: ['4-10', '4-10', 'OFF', '4-10', 'OFF', '4-11', '4-10'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'James', shifts: ['11-4', '11-4', '11-4', '11-4', '4-11', '4-11', 'OFF'], isTraining: [false, false, false, false, false, false, false] },
    { name: 'Alex', shifts: ['OFF', '4-10', 'OFF', '4-10', '4-11', 'OFF', 'OFF'], isTraining: [false, true, false, true, true, false, false] }
  ],
  laborCost: 3240,
  laborPercent: 28,
  warnings: ['Friday might be understaffed based on reservations']
}

export const aiScheduleSuggestion = {
  text: "Based on last week's traffic and current reservations, I suggest adding 1 server Friday 6-10pm and removing 1 busser Monday lunch.",
  changes: [
    { type: 'add', staff: 'Any server', day: 'FRI', shift: '6-10pm' },
    { type: 'remove', staff: 'Busser', day: 'MON', shift: 'lunch' }
  ]
}

// Menu Items
export const menuItems = [
  { id: 'chicken-parm', name: 'Chicken Parmesan', category: 'star', sold: 24, revenue: 576, margin: 14, price: 24, cost: 10 },
  { id: 'burger', name: 'Classic Burger', category: 'cow', sold: 31, revenue: 465, margin: 12, price: 15, cost: 3 },
  { id: 'salmon', name: 'Grilled Salmon', category: 'star', sold: 18, revenue: 504, margin: 16, price: 28, cost: 12 },
  { id: 'ribeye', name: 'Ribeye Steak', category: 'star', sold: 12, revenue: 540, margin: 18, price: 45, cost: 27 },
  { id: 'caesar', name: 'Caesar Salad', category: 'cow', sold: 28, revenue: 336, margin: 8, price: 12, cost: 4 },
  { id: 'pasta', name: 'Pasta Primavera', category: 'cow', sold: 22, revenue: 374, margin: 10, price: 17, cost: 7 },
  { id: 'lobster', name: 'Lobster Tail', category: 'puzzle', sold: 8, revenue: 320, margin: 22, price: 40, cost: 18 },
  { id: 'duck', name: 'Duck Confit', category: 'puzzle', sold: 6, revenue: 210, margin: 19, price: 35, cost: 16 },
  { id: 'veggie-wrap', name: 'Veggie Wrap', category: 'dog', sold: 4, revenue: 48, margin: 6, price: 12, cost: 6 },
  { id: 'soup', name: 'Soup of the Day', category: 'dog', sold: 7, revenue: 49, margin: 4, price: 7, cost: 3 }
]

export const items86d = [
  { name: 'Mussels', reason: 'Supplier issue', since: 'Jan 6' },
  { name: 'Tiramisu', reason: 'Out of ladyfingers', since: 'Jan 8' }
]

export const menuInsight = "Lobster Tail has highest margin but only 8 orders this week. Add 'Chef Recommends' tag and brief servers on pairing suggestions."

// Educational Cards
export const educationalCards = [
  { id: 1, title: 'Understanding Turn Times', description: 'Learn how optimizing table turnover can increase revenue by 20%', image: null },
  { id: 2, title: 'Optimizing Your Team', description: 'Best practices for scheduling and staff development', image: null },
  { id: 3, title: 'Peak Hour Strategies', description: 'Maximize covers during your busiest periods', image: null },
  { id: 4, title: 'Maximizing Tips', description: 'Help your servers earn more with proven techniques', image: null }
]

// Analytics Data
export const analyticsData = {
  // Table Turn Times
  tableTurns: {
    average: 52, // minutes
    goal: 45,
    trend: 'up', // getting slower (bad)
    byDayOfWeek: [
      { day: 'Mon', turnTime: 48 },
      { day: 'Tue', turnTime: 50 },
      { day: 'Wed', turnTime: 49 },
      { day: 'Thu', turnTime: 51 },
      { day: 'Fri', turnTime: 58 },
      { day: 'Sat', turnTime: 62 },
      { day: 'Sun', turnTime: 54 }
    ]
  },
  // Wait Times
  waitTimes: {
    average: 8, // minutes
    goal: 5,
    peakWait: 18,
    byHour: [
      { hour: '5pm', wait: 3 },
      { hour: '6pm', wait: 8 },
      { hour: '7pm', wait: 15 },
      { hour: '8pm', wait: 18 },
      { hour: '9pm', wait: 10 },
      { hour: '10pm', wait: 4 }
    ]
  },
  // Kitchen Speed
  kitchenSpeed: {
    avgTicketTime: 14, // minutes
    goal: 12,
    ticketsOver15: 12, // count this week
    byStation: [
      { station: 'Grill', avgTime: 16 },
      { station: 'Sauté', avgTime: 13 },
      { station: 'Fry', avgTime: 10 },
      { station: 'Salad', avgTime: 6 },
      { station: 'Dessert', avgTime: 8 }
    ]
  },
  // Peak Hours Heatmap (covers by hour/day)
  peakHours: [
    { day: 'Mon', hours: { '5pm': 8, '6pm': 22, '7pm': 35, '8pm': 28, '9pm': 15, '10pm': 5 } },
    { day: 'Tue', hours: { '5pm': 10, '6pm': 28, '7pm': 42, '8pm': 38, '9pm': 20, '10pm': 8 } },
    { day: 'Wed', hours: { '5pm': 12, '6pm': 30, '7pm': 45, '8pm': 40, '9pm': 22, '10pm': 10 } },
    { day: 'Thu', hours: { '5pm': 15, '6pm': 35, '7pm': 52, '8pm': 48, '9pm': 28, '10pm': 12 } },
    { day: 'Fri', hours: { '5pm': 20, '6pm': 45, '7pm': 68, '8pm': 72, '9pm': 55, '10pm': 25 } },
    { day: 'Sat', hours: { '5pm': 25, '6pm': 52, '7pm': 78, '8pm': 85, '9pm': 62, '10pm': 30 } },
    { day: 'Sun', hours: { '5pm': 18, '6pm': 38, '7pm': 55, '8pm': 48, '9pm': 32, '10pm': 12 } }
  ],
  // Monthly Revenue Trend
  monthlyRevenue: [
    { month: 'Jul', revenue: 82000 },
    { month: 'Aug', revenue: 88000 },
    { month: 'Sep', revenue: 91000 },
    { month: 'Oct', revenue: 95000 },
    { month: 'Nov', revenue: 102000 },
    { month: 'Dec', revenue: 118000 },
    { month: 'Jan', revenue: 94000 }
  ],
  // This Week vs Last Week
  weekComparison: {
    thisWeek: { revenue: 28500, covers: 412, avgCheck: 69.17 },
    lastWeek: { revenue: 26200, covers: 385, avgCheck: 68.05 }
  }
}

// Reviews Data
export const reviews = [
  { id: 1, source: 'google', rating: 2, date: 'Jan 8', author: 'Mike T.', text: 'Service was extremely slow. Waited 25 minutes for our appetizers and the server seemed overwhelmed. Food was good when it finally arrived but the experience was frustrating.', sentiment: 'negative' },
  { id: 2, source: 'yelp', rating: 1, date: 'Jan 7', author: 'Sarah K.', text: 'Terrible experience. Our order was wrong twice and the manager was dismissive when we complained. Will not be returning.', sentiment: 'negative' },
  { id: 3, source: 'google', rating: 3, date: 'Jan 7', author: 'David L.', text: 'Food is great but the noise level is too high. Hard to have a conversation. Also the wait for a table was longer than quoted.', sentiment: 'mixed' },
  { id: 4, source: 'opentable', rating: 5, date: 'Jan 6', author: 'Jennifer M.', text: 'Outstanding meal! Sarah was our server and she was phenomenal. The ribeye was cooked perfectly and the wine recommendations were spot on.', sentiment: 'positive' },
  { id: 5, source: 'google', rating: 4, date: 'Jan 6', author: 'Robert H.', text: 'Really enjoyed the food and atmosphere. Only complaint is parking is a nightmare on weekends.', sentiment: 'positive' },
  { id: 6, source: 'yelp', rating: 2, date: 'Jan 5', author: 'Amanda C.', text: 'Disappointed with portion sizes for the price. The salmon was tiny for $28. Quality was fine but not good value.', sentiment: 'negative' },
  { id: 7, source: 'opentable', rating: 5, date: 'Jan 5', author: 'Chris W.', text: 'Best restaurant in town! We come here every month for date night. Never had a bad meal.', sentiment: 'positive' },
  { id: 8, source: 'internal', rating: null, date: 'Jan 4', author: 'Table 7', text: 'Customer complained about cold food. Comped dessert. Note: Kitchen was backed up during rush.', sentiment: 'negative' }
]

export const reviewsSummary = {
  avgRating: 4.2,
  totalReviews: 847,
  thisMonth: 23,
  ratingBreakdown: { 5: 412, 4: 245, 3: 98, 2: 52, 1: 40 },
  bySource: { google: 4.3, yelp: 3.9, opentable: 4.5 }
}

export const reviewsAISynthesis = {
  summary: "Based on 23 reviews this month, customers love your food quality (especially the ribeye and salmon) and praise server Sarah frequently. However, there's a consistent pattern of complaints about slow service during peak hours (7-8pm) and long wait times on weekends.",
  topPraises: [
    'Food quality consistently praised',
    'Sarah mentioned by name 5 times',
    'Atmosphere and ambiance appreciated'
  ],
  topIssues: [
    'Slow service during peak hours (mentioned 8 times)',
    'Wait times longer than quoted (5 mentions)',
    'Portion sizes vs price concerns (3 mentions)'
  ],
  actionItems: [
    'Consider adding staff during Friday/Saturday 7-9pm rush',
    'Review portion sizes for salmon dish - multiple complaints',
    'Train hosts on more accurate wait time estimates'
  ]
}

// Restaurant Profile (Settings)
export const restaurantProfile = {
  name: 'The Golden Fork',
  address: '123 Main Street, San Francisco, CA 94102',
  phone: '(415) 555-0123',
  email: 'contact@goldenfork.com',
  website: 'www.goldenfork.com',
  hours: {
    monday: { open: '11:00 AM', close: '10:00 PM' },
    tuesday: { open: '11:00 AM', close: '10:00 PM' },
    wednesday: { open: '11:00 AM', close: '10:00 PM' },
    thursday: { open: '11:00 AM', close: '10:00 PM' },
    friday: { open: '11:00 AM', close: '11:00 PM' },
    saturday: { open: '10:00 AM', close: '11:00 PM' },
    sunday: { open: '10:00 AM', close: '9:00 PM' }
  },
  capacity: {
    totalSeats: 85,
    tables: 24,
    barSeats: 12,
    patioSeats: 18
  },
  tableLayout: [
    { id: 1, seats: 2, section: 'main' },
    { id: 2, seats: 2, section: 'main' },
    { id: 3, seats: 4, section: 'main' },
    { id: 4, seats: 4, section: 'main' },
    { id: 5, seats: 6, section: 'main' },
    { id: 6, seats: 6, section: 'main' },
    { id: 7, seats: 4, section: 'window' },
    { id: 8, seats: 4, section: 'window' },
    { id: 9, seats: 8, section: 'private' },
    { id: 10, seats: 4, section: 'patio' }
  ]
}

// Users & Permissions (Settings)
export const users = [
  { id: 1, name: 'John Martinez', email: 'john@goldenfork.com', role: 'owner', status: 'active', lastLogin: 'Today, 2:30 PM' },
  { id: 2, name: 'Emily Chen', email: 'emily@goldenfork.com', role: 'manager', status: 'active', lastLogin: 'Today, 11:45 AM' },
  { id: 3, name: 'Sarah Martinez', email: 'sarah@goldenfork.com', role: 'server', status: 'active', lastLogin: 'Yesterday' },
  { id: 4, name: 'Mike Rodriguez', email: 'mike@goldenfork.com', role: 'server', status: 'active', lastLogin: 'Today, 3:15 PM' },
  { id: 5, name: 'Lisa Park', email: 'lisa@goldenfork.com', role: 'server', status: 'active', lastLogin: '2 days ago' },
  { id: 6, name: 'James Kim', email: 'james@goldenfork.com', role: 'server', status: 'active', lastLogin: 'Today, 4:00 PM' },
  { id: 7, name: 'Alex Thompson', email: 'alex@goldenfork.com', role: 'server', status: 'active', lastLogin: 'Today, 3:50 PM' },
  { id: 8, name: 'Carlos Ruiz', email: 'carlos@goldenfork.com', role: 'kitchen', status: 'active', lastLogin: 'Today, 10:00 AM' },
  { id: 9, name: 'Tom Wilson', email: 'tom@goldenfork.com', role: 'host', status: 'inactive', lastLogin: '2 weeks ago' }
]

export const roles = {
  owner: { label: 'Owner', permissions: ['all'], color: 'purple' },
  manager: { label: 'Manager', permissions: ['schedule', 'staff', 'analytics', 'menu', 'reviews'], color: 'blue' },
  server: { label: 'Server', permissions: ['floor', 'tables'], color: 'green' },
  host: { label: 'Host', permissions: ['floor', 'reservations'], color: 'amber' },
  kitchen: { label: 'Kitchen', permissions: ['orders', 'menu'], color: 'red' }
}

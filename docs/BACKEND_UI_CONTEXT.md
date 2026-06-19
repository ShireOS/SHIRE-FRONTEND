# Frontend UI Flow - Backend Context

## Architecture Overview

The frontend is split into **two independent apps**:

1. **Host App** (`/host`) - Real-time floor management for restaurant operations
2. **Dashboard App** (`/dashboard`) - Staff scheduling, analytics, and business management

Both apps share common API clients and hooks via `/src/shared`.

---

## Host App - Floor Management

### Purpose
Real-time restaurant floor operations: seating guests, managing tables, tracking servers.

### Main UI Layout
```
┌─────────────────────────────────────────────────────┐
│   TopBar (Add Guest, Undo, Theme Toggle)           │
├────────────┬──────────────────────┬─────────────────┤
│ Waitlist/  │   Interactive        │ Activity Feed   │
│ Reserv.    │   Floor Plan         │ Server Queue    │
│ (Lists)    │   (Tables)           │ (Stats)         │
└────────────┴──────────────────────┴─────────────────┘
```

### Key User Flows

**1. Adding Guests to Waitlist**
- User clicks "Add Walk-in" button
- Creates guest with: name, party size, status, timestamp
- Guest appears in left panel waitlist

**2. Seating Guests**
- Option A: Click "Seat" on guest card → manually assign table
- Option B: Click available table in rotation mode → auto-seats next guest
- Updates table status to "occupied", removes guest from waitlist

**3. Managing Tables**
- Click table → Opens popover with options
- Can mark as: available, dirty, needs_server, blocked
- Can assign servers, unseat tables

**4. Reservations**
- Add reservation with: name, party size, phone, date/time
- Track status: confirmed → arriving_soon → arrived → seated

### Data Types Backend Should Know

**Table Statuses**: `available` | `occupied` | `needs_server` | `dirty` | `blocked` | `reserved`

**Guest Statuses**: `waiting` | `notified` | `arriving` | `seated` | `no_show`

**Reservation Statuses**: `confirmed` | `upcoming` | `arriving_soon` | `arrived` | `seated` | `no_show` | `cancelled`

**Server Statuses**: `active` | `on_break` | `off`

### State Management
- Uses **Zustand** for local state (currently mock data)
- Undo/redo history (last 10 actions)
- Activity feed logs all floor events

---

## Dashboard App - Business Management

### Purpose
Staff management, scheduling, analytics, and business intelligence.

### Main Routes
- `/` - Overview dashboard (metrics, alerts, leaderboard)
- `/staff` - Staff list and individual profiles
- `/schedule` - Shift scheduling with AI suggestions
- `/analytics` - Performance analytics and charts
- `/menu` - Menu rankings and 86 recommendations
- `/reviews` - Customer reviews
- `/settings` - System settings

### Key User Flows

**1. Viewing Staff Performance**
- Navigate to `/staff`
- View table with staff metrics (tips, efficiency, tables served)
- Click individual staff → View detailed profile at `/staff/{id}`

**2. Creating Schedules (Complex Flow)**
- Navigate to `/schedule`
- Select week to schedule
- Click "AI Suggest" → Calls `POST /restaurants/{id}/schedules/run`
- Preview AI-generated schedule in modal
- User can accept or manually edit shifts
- Click "Publish" → Staff notified

**3. Analytics Dashboard**
- Auto-loads on `/` route
- Displays: revenue, covers, avg check, avg wait time
- Floor status visualization
- Staff leaderboard
- Reservation timeline

### API Endpoints Currently Used

**Staff/Waiters:**
- `GET /waiters/{waiterId}/dashboard` - Individual waiter dashboard
- `GET /waiters/{waiterId}/stats?period={period}` - Performance stats
- `GET /restaurants/{id}/waiters` - All waiters for restaurant

**Scheduling (Most Active Area):**
- `GET /restaurants/{id}/schedules?week_start={date}` - Get schedule for week
- `POST /restaurants/{id}/schedules/run` - Run AI scheduler
- `GET /schedule-runs/{runId}` - Check scheduler status
- `POST /schedules/{id}/items` - Create shift
- `PUT /schedule-items/{id}` - Update shift
- `DELETE /schedule-items/{id}` - Delete shift
- `POST /schedules/{id}/publish` - Publish schedule
- `GET /restaurants/{id}/staffing-requirements` - Get staffing needs
- `GET /staff/{id}/availability` - Get staff availability

**Menu:**
- `GET /restaurants/{id}/menu/rankings/top` - Best performers
- `GET /restaurants/{id}/menu/rankings/bottom` - Worst performers
- `GET /restaurants/{id}/menu/86-recommendations` - Items to remove

**Health:**
- `GET /healthz` - Health check

---

## Data Flow Patterns

### Host App (Local State)
```
User Action → Zustand Store Action → State Update → UI Re-render → Activity Log
```
- Currently using mock data
- Future: Will integrate with backend API for real-time updates

### Dashboard App (API Driven)
```
User Action → API Call → Response → State Update → UI Re-render
```
- All data fetched from backend
- Uses custom hooks for API queries
- 10-second timeout on requests
- Detailed error logging in dev mode

---

## Environment Configuration

**API Base URL**: `VITE_API_BASE_URL` (default: `http://localhost:8000/api/v1`)

**Default Restaurant**: "Mimosas" (hardcoded for now)

---

## Key Features Backend Should Support

### For Host App (Future Integration)
- Real-time table status updates
- Guest/reservation CRUD
- Server rotation logic
- Activity event streaming

### For Dashboard App (Active Now)
- Staff performance metrics calculation
- AI scheduling engine (`/schedules/run` endpoint)
- Menu analytics and ranking algorithms
- Shift conflict detection
- Coverage gap warnings
- Labor cost calculations

---

## Notes for Backend Team

1. **Scheduling is the most complex feature** - requires staffing requirements, availability checking, and AI generation
2. **Host app is currently local-only** but will need real-time sync in future
3. **All timestamps** should be in ISO format for frontend parsing
4. **Error messages** are shown directly to users - keep them user-friendly
5. **Restaurant ID** is currently hardcoded but will become dynamic per-user

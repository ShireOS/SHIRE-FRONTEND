# Integration Status - What's Actually Happening

## ✅ YES - We ARE Calling Backend Routing API

### When You Click "Seat" on Waitlist or "Seat Now" on Reservation:

**Code Path** ([restaurantStore.ts:404-462](src/host/stores/restaurantStore.ts#L404-L462)):

```typescript
1. User clicks "Seat" button
   ↓
2. Frontend calls: getRoutingRecommendations(restaurantId, partySize)
   ↓
3. Makes HTTP POST request to backend:
   POST /api/v1/restaurants/default/routing/recommend
   {
     "party_size": 4  // ← REAL data from guest/reservation
   }
   ↓
4. Backend responds with RouteResponse
   ↓
5. Frontend validates capacity and shows recommendations
   ↓
6. User selects table → Guest seated
```

**This is 100% using backend routing API - NO mock data in routing flow!**

---

## ✅ WebSocket Table Updates - ONLY Backend Data

**Code Path** ([MultiCameraView.tsx:70-81](src/host/components/demo/MultiCameraView.tsx#L70-L81)):

```typescript
1. Video button clicked
   ↓
2. Fetches tables from: GET /restaurants/default/tables/section-view
   ↓
3. Starts demo: POST /demo/initiate
   ↓
4. Connects WebSocket: ws://localhost:8000/ws/demo
   ↓
5. Receives table.state events
   ↓
6. Updates tables in real-time
```

**NO mockData fallback anymore - removed!**

---

## 🔴 What Was Fixed

### BEFORE (Bad):
- If WebSocket fails → Falls back to mockData
- If routing API fails → Shows mock tables
- Table numbers reconstructed as "T0" from bad parsing

### AFTER (Good):
- ✅ If WebSocket fails → Shows error, NO fallback
- ✅ Routing API always calls backend
- ✅ Table numbers use original `table_number` string from backend
- ✅ Capacity validation prevents bad recommendations
- ✅ ZERO mock data in production flow

---

## 📊 Current Data Flow (100% Backend)

### Tables Display:
```
GET /restaurants/default/tables/section-view
  → Backend returns tables with table_number: "T1", "T5", etc.
  → Frontend stores as tableNumber: "T1"
  → Displays as "Table T1" (exact backend value)
```

### Routing Recommendations:
```
POST /restaurants/default/routing/recommend { party_size: 4 }
  → Backend returns RouteResponse with table_id, table_number, capacity
  → Frontend validates capacity >= party_size
  → Shows top recommendation + 2 alternatives
  → User selects → Seats guest
```

### WebSocket Live Updates:
```
ws://localhost:8000/ws/demo
  → Receives table.state events
  → Updates table status, cvConfidence
  → Triggers blue highlight animation
  → Logs to activity feed
```

---

## ✅ Summary

**Backend is being used for**:
1. ✅ Initial table data (`/tables/section-view`)
2. ✅ Demo initiation (`/demo/initiate`)
3. ✅ WebSocket table updates (`ws://demo`)
4. ✅ Routing recommendations (`/routing/recommend`)

**Mock data is ONLY used**:
- For table positions (x, y coordinates) - backend doesn't provide these
- For sections/servers - until backend endpoints are added
- That's it!

**If backend is down** → App will show errors, NOT fall back to fake data.

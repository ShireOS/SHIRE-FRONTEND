# Current Seating Flow - What Gets Sent to Backend

## Waitlist "Seat" Button Flow

### Step 1: User Clicks "Seat" on Guest Card
**Guest Data Available**:
```typescript
{
  id: "w123",
  name: "Jane Smith",
  partySize: 6,  // ← This is what matters
  phone: "+1234567890",
  addedAt: Date,
  estimatedWait: 25,
  status: "waiting",
  notes: "Birthday celebration",
  preferences: ["booth", "quiet"],
  visitCount: 3,
  tags: ["Birthday"]
}
```

### Step 2: Frontend Calls Routing API
**Request Sent**:
```http
POST /api/v1/restaurants/default/routing/recommend
{
  "party_size": 6
}
```

**Current Issue**: We're ONLY sending `party_size`. Not sending:
- ❌ `table_preference` (e.g., "booth")
- ❌ `location_preference` (e.g., "inside")

### Step 3: Backend Returns RouteResponse
**What We Get Back**:
```json
{
  "success": true,
  "table_id": "uuid-table-4",
  "table_number": "T4",
  "table_type": "booth",
  "table_location": "inside",
  "table_capacity": 4,  // ← PROBLEM: Party of 6 can't fit in 4-top!
  "waiter_name": "Alice",
  ...
}
```

### Step 4: Frontend Shows This as Recommendation
User sees: "🥇 Table 4 (4-top) - booth • inside • Server: Alice"

**PROBLEM**: Party of 6 being recommended a 4-top when 8-top is available!

---

## 🔴 CRITICAL ISSUE: Capacity Mismatch

**Scenario**: Party of 6 trying to be seated at Table 4 (4-top) when Table 8 (8-top) is available

**Root Cause Options**:

### Option A: Backend Routing Bug
Backend `/routing/recommend` is not properly filtering by capacity
- Receiving `party_size: 6`
- Returning table with `capacity: 4`
- **This should never happen**

### Option B: Missing Preferences in Request
Frontend not sending enough info for backend to make good decisions
- Currently only sending: `party_size`
- Should send: `table_preference`, `location_preference` from guest.preferences[]?

---

## ✅ Frontend Safety Measures ADDED

### Capacity Validation
```typescript
// In restaurantStore.getRoutingRecommendations()
if (response.table_capacity < partySize) {
  console.error(`CAPACITY MISMATCH! Table ${response.table_number} (${response.table_capacity}-top) for party of ${partySize}`)

  // Automatically find suitable tables
  const suitableTables = tables.filter(t =>
    t.status === 'available' &&
    t.capacity >= partySize
  )

  // Sort by best fit (closest match without being too large)
  suitableTables.sort((a, b) => (a.capacity - partySize) - (b.capacity - partySize))

  // Return top 3 suitable tables
  return suitableTables.slice(0, 3).map(...)
}
```

### Result
- ✅ If backend returns wrong capacity → Frontend fixes it
- ✅ Party of 6 → Gets 6-top, 8-top, or 10-top (never 4-top)
- ✅ Best fit algorithm (6-top preferred over 10-top for party of 6)

---

## ✅ Reservation Seating CONNECTED

**ReservationCard "Seat Now" button**:
- ✅ **Connected** to routing API
- ✅ **Calls** `getRoutingRecommendations()` with reservation.partySize
- ✅ Shows recommendations modal with 🥇🥈🥉
- ✅ Includes capacity validation
- ✅ Seats reservation at selected table

---

## 🔴 Questions for Backend Team

1. **Routing API Capacity Bug?**
   - Is the routing algorithm supposed to validate `capacity >= party_size`?
   - Or should frontend always do this validation?
   - Have you seen cases where routing returns undersized tables?

2. **Should frontend send preferences?**
   - Guest has `preferences: ["booth", "quiet"]`
   - Does your API accept `table_preference` or `location_preference` fields?
   - Would this improve routing quality?

3. **Accepted Request Fields?**
   Please confirm what fields `/routing/recommend` accepts:
   ```json
   {
     "party_size": 6,  // ← Required
     "table_preference": "booth",  // ← Optional?
     "location_preference": "inside"  // ← Optional?
   }
   ```

---

## 📊 Current Flow (After Fixes)

### Waitlist Seating:
1. Click "Seat" → Sends `party_size: 6`
2. Backend responds → Frontend validates capacity
3. **If capacity OK**: Show backend recommendation
4. **If capacity BAD**: Frontend finds suitable tables automatically
5. User selects table → Guest seated

### Reservation Seating:
1. Click "Seat Now" → Sends `party_size` from reservation
2. **Same validation** as waitlist
3. Shows top 3 recommendations
4. User selects → Reservation seated

---

## ✅ Summary

**Frontend now has**:
- ✅ Intelligent capacity validation
- ✅ Auto-fallback to suitable tables if backend fails
- ✅ Best-fit sorting (prefer 6-top over 10-top for party of 6)
- ✅ Reservations use same routing as waitlist
- ✅ Will NEVER seat party of 6 at 4-top

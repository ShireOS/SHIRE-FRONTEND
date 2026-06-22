# NEW Backend Endpoints Needed

These are the ONLY new endpoints needed. Demo endpoints you provided are good!

## 🔴 Required for Demo Integration (Phase 1)

### 1. GET Tables
```
GET /api/v1/restaurants/{restaurant_id}/tables
```
**Why**: Initialize floor plan with table positions and statuses

**Response**:
```json
{
  "tables": [
    {
      "id": "uuid",
      "number": 1,
      "capacity": 4,
      "position": { "x": 100, "y": 200 },
      "section_id": "uuid",
      "status": "available",
      "assigned_server_id": null,
      "seated_at": null,
      "cv_confidence": 0.0
    }
  ]
}
```

### 2. GET Sections
```
GET /api/v1/restaurants/{restaurant_id}/sections
```
**Why**: Floor plan section layout

**Response**:
```json
{
  "sections": [
    {
      "id": "uuid",
      "name": "Main Dining",
      "color": "#3b82f6",
      "table_ids": ["uuid1", "uuid2"]
    }
  ]
}
```

---

## 🟡 Optional for Later (Phase 2)

### 3. GET Servers
```
GET /api/v1/restaurants/{restaurant_id}/servers
```
**Why**: Show active servers in rotation queue

### 4. Guests CRUD
```
GET /api/v1/restaurants/{restaurant_id}/guests
POST /api/v1/restaurants/{restaurant_id}/guests
PUT /api/v1/guests/{guest_id}
DELETE /api/v1/guests/{guest_id}
```
**Why**: Manage waitlist

### 5. Reservations CRUD
```
GET /api/v1/restaurants/{restaurant_id}/reservations
POST /api/v1/restaurants/{restaurant_id}/reservations
PUT /api/v1/reservations/{reservation_id}
DELETE /api/v1/reservations/{reservation_id}
```
**Why**: Manage reservations

### 6. Seat Guest
```
POST /api/v1/restaurants/{restaurant_id}/seat
```
**Body**: `{ "guest_id": "uuid", "table_id": "uuid", "server_id": "uuid" }`
**Why**: Execute seating action

### 7. Update Table Status
```
PUT /api/v1/tables/{table_id}/status
```
**Body**: `{ "status": "dirty" }`
**Why**: Manual table status changes

---

## ✅ Summary

**For demo to work**: Just need endpoints #1 and #2 (Tables + Sections)

**Everything else**: Can wait for Phase 2 when we integrate full waitlist/reservation features
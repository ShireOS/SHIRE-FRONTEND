# Backend Questions & Issues - Demo Debugging Session

**Date**: January 18, 2026
**Status**: RESOLVED - Backend fixes deployed, frontend updated
**Frontend State**: Connected to `http://localhost:8000/api/v1`
**Restaurant ID**: `default`

---

## RESOLVED ISSUES

### 1. `/demo/initiate` Timeout - FIXED
**Resolution**: Backend fixed deadlock when re-initiating while demo is running.

**Backend Changes**:
- Endpoint is async and returns immediately after starting replay tasks
- Can poll `GET /api/v1/demo/status` for progress
- Fixed deadlock in `demo_replay_service.py` where re-initiating would hang

**`results_path` format**: Repo-root relative unless absolute. Current format is correct.

---

### 2. WebSocket Disconnecting - FIXED
**Resolution**: Backend added 30-second keepalive ping.

**Backend Changes**:
- Added `{"type":"ping"}` keepalive every 30 seconds
- No auth or handshake required
- No restaurant_id needed in URL

**Frontend Changes**:
- Updated `websocket.ts` to ignore `{"type":"ping"}` messages

---

### 3. Routing "No Available Waiters" - NEEDS SEED DATA
**Resolution**: Call `POST /api/v1/seed/demo` to create proper relationships.

**Requirements for routing to work**:
- Tables must have `state="clean"` (not "available")
- Waiters must have active shifts
- Waiters must be under table limit
- Waiters must be assigned to sections with tables

**Frontend Changes**:
- Added `seedDemo` endpoint
- Added `seedDemoData` action to store
- Updated state mapping: "clean" -> "available"

---

## CONFIRMED DATA FORMATS

### Table Number Format
- Format: `"T1"`, `"T2"`, ... `"T10"` (1-indexed with T prefix)
- String field, max 20 characters
- Frontend parses correctly

### Table-to-Camera Mapping
- `mapping_mode="auto"` does direct mapping if JSON/DB sets match
- Otherwise maps by index order
- `table_map` parameter can override

---

## ENDPOINT STATUS (Updated)

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /restaurants/default/tables/section-view` | Working | Returns 11 tables |
| `POST /restaurants/default/routing/recommend` | Working | Needs seed data first |
| `POST /demo/initiate` | Working | Returns immediately (async) |
| `GET /demo/status` | Available | Poll for demo progress |
| `POST /seed/demo` | Available | Creates full demo data |
| `ws://localhost:8000/ws/demo` | Working | Now with keepalive |

---

## QUICK START

1. **Seed demo data** (one time):
   ```bash
   curl -X POST http://localhost:8000/api/v1/seed/demo
   ```

2. **Start frontend**:
   ```bash
   npm run dev
   ```

3. **Test demo**:
   - Click video icon in top bar
   - WebSocket should stay connected
   - Tables should update in real-time
   - Routing should return recommendations

---

## FRONTEND CHANGES MADE

| File | Change |
|------|--------|
| `src/shared/services/websocket.ts` | Ignore ping messages |
| `src/host/stores/restaurantStore.ts` | Add "clean" state mapping, seedDemoData action |
| `src/shared/api/endpoints.ts` | Add seedDemo endpoint |
| `vite.config.ts` | Add Accept-Ranges header for video files |

---

## REMAINING CONSIDERATION

### Video 416 Errors
- Added `Accept-Ranges: bytes` header to Vite config
- If still failing, videos may need re-encoding for proper streaming
- Try accessing directly: `http://localhost:5173/demovids/demo1.mp4`

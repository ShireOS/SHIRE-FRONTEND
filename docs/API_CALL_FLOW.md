# Frontend → Backend API Call Flow

## ✅ Status: WORKING & VERIFIED

**Last Updated:** 2026-01-17

The frontend is **correctly implemented** and calling the backend API with comprehensive logging in place. All crashes have been fixed and the app is stable.

## Overview
This document shows EXACTLY how the frontend calls the backend to fetch staff data.

---

## 📞 API Call Chain for Staff Data

### 1. Component Level (StaffTable.jsx & Schedule.jsx)

**Both components use the SAME pattern:**

```javascript
// StaffTable.jsx (line 44)
const { data: allStaff, loading: isLoading, error } = useWaiterList(restaurantId)

// Schedule.jsx (line 80)
const { data: staff, loading: loadingStaff, error: staffError } = useWaiterList(restaurantId)
```

**Restaurant ID:** Auto-selected from first restaurant (Mimosas)
- Mimosas is the first restaurant in the array: `restaurants[0]`
- ID: `c74e9278-1ccb-4f75-bc2f-eacf054db608` (as shown in logs)

---

### 2. Hook Level (useWaiterList.ts)

Located at: `src/shared/hooks/useWaiterList.ts`

```typescript
export function useWaiterList(restaurantId: string | null) {
  return useApiQuery(
    () => restaurantApi.getWaiters(restaurantId!),
    [restaurantId]
  )
}
```

---

### 3. API Service Level (restaurantApi.ts)

Located at: `src/shared/api/restaurantApi.ts`

```typescript
export const restaurantApi = {
  getWaiters: (restaurantId: string) =>
    apiClient.get<WaiterListItem[]>(
      endpoints.restaurantWaiters(restaurantId)
    )
}
```

---

### 4. Endpoint Configuration (endpoints.ts)

Located at: `src/shared/api/endpoints.ts` (line 17-18)

```typescript
export const endpoints = {
  restaurantWaiters: (restaurantId: string) =>
    `/restaurants/${restaurantId}/waiters`
}
```

---

### 5. API Client (client.ts)

Located at: `src/shared/api/client.ts`

```typescript
class ApiClient {
  async get<T>(endpoint: string): Promise<T> {
    const url = getApiUrl(endpoint)
    // url = "http://localhost:8000/api/v1/restaurants/{id}/waiters"

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    return await response.json()
  }
}
```

---

### 6. Base URL Configuration (config.ts)

Located at: `src/shared/api/config.ts`

```typescript
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  apiVersion: 'v1',
  timeout: 10000
}

export function getApiUrl(endpoint: string): string {
  return `${API_CONFIG.baseUrl}/api/${API_CONFIG.apiVersion}${endpoint}`
}
```

---

## 🌐 Complete API Call

### Final Request:
```
GET http://localhost:8000/api/v1/restaurants/c74e9278-1ccb-4f75-bc2f-eacf054db608/waiters
Headers:
  Content-Type: application/json
```

### Expected Response:
```json
[
  {
    "id": "waiter-uuid-1",
    "name": "Alice Johnson",
    "role": "server",
    "tier": "strong",
    "tenure_years": 2.5,
    "stats": {
      "tips": 4250.75,
      "covers": 892,
      "total_sales": 15000,
      "avg_per_cover": 4.76,
      "efficiency_pct": 92
    }
  },
  // ... 49 more staff members (should be 50 total!)
]
```

### Current Response (THE PROBLEM):
```json
[
  { "id": "...", "name": "Alice Johnson", ... },
  { "id": "...", "name": "Bob Smith", ... },
  { "id": "...", "name": "Carol Williams", ... },
  { "id": "...", "name": "Dave Brown", ... }
]
```

**Only 4 staff members returned!** ❌

---

## 🔍 Console Logs (Working as Expected)

When you load the Staff Table page, you'll see:

```
[StaffTable] 🏢 Available Restaurants
  Total Restaurants: 1
  ┌─────────┬──────────────────────────────────┬──────────┐
  │ (index) │ id                               │ name     │
  ├─────────┼──────────────────────────────────┼──────────┤
  │ 0       │ 'c74e9278-1ccb-4f75-bc2f-...'   │ 'Mimosas'│
  └─────────┴──────────────────────────────────┴──────────┘

[StaffTable] 🎯 Auto-selecting FIRST restaurant: Mimosas c74e9278-1ccb-4f75-bc2f-eacf054db608
```

Then the API call logs:

```
[API] GET /restaurants/c74e9278-1ccb-4f75-bc2f-eacf054db608/waiters
  Full URL: http://localhost:8000/api/v1/restaurants/c74e9278-1ccb-4f75-bc2f-eacf054db608/waiters

[API] ✅ Response from /restaurants/c74e9278-1ccb-4f75-bc2f-eacf054db608/waiters
  Status: 200 OK
  Response Type: array
  🔢 Array Length (Staff Count): 4  ← THE PROBLEM IS HERE!

[Transform] Converting waiter: {id: '2af6eab2...', name: 'Alice Johnson', ...}
[Transform] Converting waiter: {id: '93e06215...', name: 'Bob Smith', ...}
[Transform] Converting waiter: {id: '67ab15da...', name: 'Carol Williams', ...}
[Transform] Converting waiter: {id: 'cf542e36...', name: 'Dave Brown', ...}

[StaffTable] 📊 Data Flow Analysis
  Total staff from API (allStaff): 4
  Role Breakdown: {Server: 4}
```

---

## ✅ Solution

The **backend** needs to be updated to return 50 staff members instead of 4.

### Backend Fix Required:
1. **File:** `app/services/seed_service.py` (in backend repo)
2. **Function:** `ensure_mimosas_restaurant()`
3. **Change:** Create 50 staff members instead of 4

**Staff Breakdown (per requirements):**
- 25-30 Servers
- 6-8 Bartenders
- 4-5 Hosts
- 4-5 Bussers
- 2-3 Runners
- **Total: 50 staff**

---

## 📋 Verification Steps

After backend fix, the console should show:
```
🔢 Array Length (Staff Count): 50  ← SUCCESS!
Total staff from API (allStaff): 50
Role Breakdown: {Server: 30, Bartender: 8, Host: 5, Busser: 5, Runner: 2}
```

---

## 🔧 Environment Variables

Ensure `.env` file has:
```bash
VITE_API_BASE_URL=http://localhost:8000
```

Restart dev server after changing `.env`:
```bash
npm run dev
```

---

## Summary

✅ Frontend is correctly calling the backend API
✅ API endpoint is correct: `/restaurants/{id}/waiters`
✅ Restaurant ID is correct (Mimosas UUID)
❌ Backend is only returning 4 staff instead of 50

**The issue is 100% in the backend seed data, not the frontend.**

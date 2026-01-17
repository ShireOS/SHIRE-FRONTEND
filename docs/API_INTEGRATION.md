# API Integration Documentation

## Overview

This document describes the API integration layer connecting the SHIRE Frontend to the Waiter Intelligence Backend.

## Quick Start

### Option 1: Use Mock Data (No Backend Required)

Edit `.env.development`:
```
VITE_USE_MOCK_DATA=true
```

Then restart the dev server. The app will use the existing mock data.

### Option 2: Connect to Real Backend

1. **Start your backend** at `http://localhost:8000`
2. **Seed test data:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/seed/default-data
   ```
3. **Update `.env.development`** with the restaurant ID from the seed response:
   ```
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   VITE_USE_MOCK_DATA=false
   VITE_RESTAURANT_ID=<your-restaurant-uuid>
   ```
4. **Restart the frontend:** `npm run dev`

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8000/api/v1` |
| `VITE_USE_MOCK_DATA` | Skip API calls, use mock data | `false` |
| `VITE_RESTAURANT_ID` | Restaurant ID for API calls | `default` |

### Environment Files

- `.env.development` - Used when running `npm run dev`
- `.env.production` - Used when running `npm run build`
- `.env.example` - Template for reference

---

## Architecture

```
src/shared/
├── api/
│   ├── config.ts       # API configuration + env vars
│   ├── client.ts       # Fetch wrapper with error handling
│   ├── endpoints.ts    # API endpoint definitions
│   └── waiterApi.ts    # Waiter/Restaurant API functions
├── types/
│   └── api.ts          # TypeScript types for API responses
├── hooks/
│   ├── index.ts        # Barrel export
│   ├── useApiQuery.ts  # Generic query hook
│   ├── useWaiterList.ts
│   └── useWaiterDashboard.ts
└── utils/
    └── dataTransformers.ts  # API → frontend format

src/dashboard/hooks/
└── useStaffData.js     # Dashboard-specific hooks
```

---

## API Endpoints Used

### Core Waiter Endpoints

| Method | Endpoint | Purpose | Used By |
|--------|----------|---------|---------|
| GET | `/waiters/{waiterId}/dashboard` | Full dashboard data (profile, stats, trends, AI insights) | StaffProfile |
| GET | `/waiters/{waiterId}/stats?period=` | Period-specific statistics | (available) |
| GET | `/waiters/{waiterId}/trends?months=` | Historical performance trends | (available) |
| GET | `/waiters/{waiterId}/insights` | AI-generated performance insights | (available) |
| GET | `/waiters/{waiterId}/shifts?limit=` | Recent shift history | (available) |

### Restaurant Endpoints

| Method | Endpoint | Purpose | Used By |
|--------|----------|---------|---------|
| GET | `/restaurants/{restaurantId}/waiters` | List all waiters for a restaurant | StaffTable, StaffLeaderboard |

### Seeding Endpoints (Development Only)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/seed/default-data` | Create default restaurant + waiters |
| POST | `/restaurants/{restaurantId}/seed/sample-data?days_back=30` | Generate sample shifts/visits |

---

## Components Modified

| Component | Hook Used | Description |
|-----------|-----------|-------------|
| `StaffTable.jsx` | `useStaffWithStatus()` | Staff list table |
| `StaffProfile.jsx` | `useStaffProfileWithStatus()` | Individual staff profile |
| `StaffLeaderboard.jsx` | `useStaffTodayWithStatus()` | Dashboard leaderboard |

---

## Data Transformation

The backend returns data in one format, but the frontend components expect another. The `dataTransformers.ts` handles this:

### Backend → Frontend Mapping

| Backend Field | Frontend Field |
|--------------|----------------|
| `tenure_years` (number) | `tenure` (string: "2.3 years") |
| `tier` ("strong"/"developing") | `badges` (["topPerformer"]) |
| `stats.avg_per_cover` | `thisMonth.avgTip` |
| `insights.strengths` | `strengths` |
| `insights.areas_to_watch` | `areasToWatch` |
| `recent_shifts` | `recentShifts` |
| `trends` | `trendData` |

---

## Error Handling

Errors are **NOT silently swallowed**. They display:
- Error message
- HTTP status code
- Endpoint that failed
- Raw error details

This helps debug backend issues.

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Failed to fetch" | Backend not running | Start backend at localhost:8000 |
| "HTTP 404" | Endpoint doesn't exist | Check backend has the endpoint |
| "HTTP 500" | Backend error | Check backend logs |
| "Request timeout" | Backend too slow | Check backend performance |

---

## Debug Mode

When running `npm run dev`, check your browser console for:

```
=== SHIRE API CONFIG ===
API Base URL: http://localhost:8000/api/v1
Restaurant ID: default
Mock Data Mode: OFF (calling real API)
Debug Mode: ON
```

All API requests/responses are logged:
```
[API] GET http://localhost:8000/api/v1/restaurants/default/waiters
[API] Response from /restaurants/default/waiters: [...]
```

---

## Using Mock Data

To develop without a backend:

1. Set `VITE_USE_MOCK_DATA=true` in `.env.development`
2. Restart dev server
3. The app uses data from `src/dashboard/data/mockData.js`

Mock data is kept as a fallback and includes:
- 5 staff members with full profiles
- Trend data
- Recent shifts
- Dashboard metrics

---

## Production Deployment

The `.env.production` file is configured with:
```
VITE_API_BASE_URL=https://web-production-5c5b4.up.railway.app/api/v1
```

When you run `npm run build`, it uses this URL automatically.

---

## Hooks Reference

### `useStaffWithStatus()`
```javascript
const { staff, isLoading, isError, error, refetch } = useStaffWithStatus()
```

### `useStaffProfileWithStatus(staffId)`
```javascript
const { member, isLoading, isError, error, refetch } = useStaffProfileWithStatus(id)
```

### `useStaffTodayWithStatus()`
```javascript
const { staffToday, isLoading, isError, error, refetch } = useStaffTodayWithStatus()
```

All hooks return:
- `data` - The fetched data (or null)
- `isLoading` - True while fetching
- `isError` - True if fetch failed
- `error` - Error object with details
- `refetch` - Function to retry the fetch

---

## Files Created

| File | Purpose |
|------|---------|
| `.env.development` | Local API URL |
| `.env.production` | Production API URL |
| `.env.example` | Template/documentation |
| `src/shared/api/config.ts` | API configuration |
| `src/shared/api/client.ts` | HTTP client |
| `src/shared/api/endpoints.ts` | Endpoint definitions |
| `src/shared/api/waiterApi.ts` | API functions |
| `src/shared/types/api.ts` | TypeScript types |
| `src/shared/hooks/useApiQuery.ts` | Generic query hook |
| `src/shared/hooks/useWaiterList.ts` | List hook |
| `src/shared/hooks/useWaiterDashboard.ts` | Dashboard hook |
| `src/shared/hooks/index.ts` | Barrel export |
| `src/shared/utils/dataTransformers.ts` | Data transformers |
| `src/dashboard/hooks/useStaffData.js` | Dashboard hooks |

---

## Troubleshooting

### "Cannot Connect to Backend"

1. **Is your backend running?**
   ```bash
   curl http://localhost:8000/healthz
   ```

2. **Is the port correct?**
   Check `.env.development` has the right URL

3. **CORS issues?**
   Backend needs to allow requests from `localhost:5173`

### Want to skip the backend entirely?

Set `VITE_USE_MOCK_DATA=true` and restart.

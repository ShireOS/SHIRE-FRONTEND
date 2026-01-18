# Backend Table Mapping Issue - "Table T0" Bug

## 🔴 CRITICAL: Table Numbers Showing as "T0"

### Observed Behavior
When routing recommendations fail and frontend falls back to showing available tables:
- Shows: **"Table T0 (2-top)"**
- Shows: **"Table T0 (4-top)"**
- Shows: **"Table T0 (4-top)"**

All tables show as "T0" instead of actual table numbers.

---

## Root Cause Analysis

### Backend Response from `/tables/section-view`
```json
[
  {
    "id": "uuid",
    "table_number": "T1",  // ← Backend sends this
    "capacity": 4,
    "table_type": "booth",
    ...
  }
]
```

### Frontend Transformation (restaurantStore.ts:292)
```typescript
number: parseInt(bt.table_number.replace('T', '')) || 0
```

**If `table_number` is**:
- `"T1"` → `parseInt("1")` → `1` ✅
- `"T0"` → `parseInt("0")` → `0` ❌
- `"0"` → `parseInt("0")` → `0` ❌
- `""` → `parseInt("")` → `NaN` → defaults to `0` ❌

### When Fallback Creates Recommendations
```typescript
table_number: `T${t.number}`  // If t.number is 0 → "T0"
```

---

## 🔴 Questions for Backend

1. **What are the actual `table_number` values in your database?**
   - Are they: `"T0"`, `"T1"`, `"T2"`? (0-indexed)
   - Or: `"T1"`, `"T2"`, `"T3"`? (1-indexed)
   - Or: `"0"`, `"1"`, `"2"`? (just numbers)
   - Or: `"Table 1"`, `"Table 2"`? (full names)

2. **From `/tables/section-view`, what are you actually returning?**
   Please paste a real `table_number` value from your response.

3. **Should we use a different field for display?**
   - Is there a `display_name` or `label` field we should use instead?

---

## 🛠️ Possible Fixes

### Option A: Backend Returns 0-Indexed Tables
If backend has `T0`, `T1`, `T2`:
```typescript
// Frontend should display as-is
table_number: bt.table_number  // Show "T0" directly
number: parseInt(bt.table_number.replace('T', ''))  // Store as 0, 1, 2
```

### Option B: Backend Returns 1-Indexed Tables
If backend has `T1`, `T2`, `T3`:
```typescript
// Current code should work
number: parseInt(bt.table_number.replace('T', '')) || 0  // → 1, 2, 3
```

### Option C: Intelligent Parsing
```typescript
// Handle multiple formats
const parseTableNumber = (tableNum: string): number => {
  const cleaned = tableNum.replace(/[^0-9]/g, '')  // Remove all non-digits
  const parsed = parseInt(cleaned)
  return isNaN(parsed) ? 0 : parsed
}
```

---

## 🔍 Debug Request

**Please run this query on your backend and share the results**:
```sql
SELECT id, table_number, capacity FROM tables WHERE restaurant_id = 'default' LIMIT 5;
```

Or share the raw JSON response from:
```
GET /api/v1/restaurants/default/tables/section-view
```

This will help us understand the exact format and fix the mapping properly.

---

## Temporary Frontend Fix Applied

Added better error handling to show "Video not found" when files are missing, but the "T0" issue persists because we need to understand your table numbering scheme first.

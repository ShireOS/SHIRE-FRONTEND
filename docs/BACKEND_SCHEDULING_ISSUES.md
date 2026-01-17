# Backend Scheduling Issues & Required Fixes

**Date:** 2026-01-17
**Frontend:** SHIRE Dashboard
**Backend:** Restaurant Intelligence Platform API

---

## Issue 1: Duplicate Schedule Creation (CRITICAL)

### Error
```
sqlalchemy.exc.PendingRollbackError: duplicate key value violates unique constraint "uq_schedule_week_version"
DETAIL: Key (restaurant_id, week_start_date, version)=(9a513454-fedb-4827-8389-c7db819a423a, 2026-01-12, 1) already exists.
```

### Endpoint
```
POST /api/v1/restaurants/{restaurant_id}/schedules/run
```

### What Happened
1. Frontend calls `/schedules/run` to generate AI schedule
2. Backend starts creating schedule with version=1
3. Discovers schedule already exists for that week with version=1
4. Throws 500 Internal Server Error
5. Frontend receives error, user sees failure

### Expected Behavior

When `/schedules/run` is called for a week that already has a schedule, the backend should:

**Option A (Recommended):** Check first, then decide
```python
# Pseudocode
existing_schedules = get_schedules_for_week(restaurant_id, week_start_date)

if existing_schedules:
    draft_schedules = [s for s in existing_schedules if s.status == 'draft']

    if draft_schedules:
        # Delete old draft(s) before creating new
        for draft in draft_schedules:
            await delete_schedule(draft.id)

    published_schedules = [s for s in existing_schedules if s.status == 'published']

    if published_schedules:
        # Increment version number for new schedule
        max_version = max(s.version for s in published_schedules)
        new_version = max_version + 1
        # Create schedule with version = new_version
    else:
        # Create with version = 1
else:
    # No schedules exist, create version = 1
```

**Option B:** Return existing schedule
```python
# If schedule exists, just return it instead of creating new
if existing_schedules:
    return existing_schedules[0]
```

**Option C:** Add `force_regenerate` parameter
```python
# POST body includes: { "week_start_date": "2026-01-12", "force_regenerate": true }
if force_regenerate and existing_draft:
    delete_schedule(existing_draft.id)
# Then create new schedule
```

### Required Fix

Add logic to the `/schedules/run` endpoint to:
1. ✅ Check if schedule(s) already exist for the week
2. ✅ Delete old drafts (status='draft') for the same week
3. ✅ Handle published schedules by incrementing version
4. ✅ Return proper error message if schedule is published and can't be replaced
5. ✅ Wrap in try/catch to return 409 Conflict instead of 500 Internal Server Error

---

## Issue 2: Missing DELETE /schedules/{id} Endpoint

### Current State
Frontend calls `DELETE /schedules/{schedule_id}` to remove draft schedules.

### Required
Implement this endpoint in the backend:
```python
@router.delete("/schedules/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """
    Delete a schedule and all its items.
    Only allows deleting draft schedules (not published).
    """
    schedule = await session.get(Schedule, schedule_id)

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if schedule.status == 'published':
        raise HTTPException(
            status_code=409,
            detail="Cannot delete published schedule"
        )

    # Delete all schedule items first (cascade should handle this)
    await session.delete(schedule)
    await session.commit()

    return Response(status_code=204)
```

**Validation:**
- Only allow deleting `draft` schedules
- Return 409 if trying to delete published schedule
- Return 404 if schedule doesn't exist

---

## Issue 3: GET /schedules/{id} Returns Schedule Without Items Array (CRITICAL)

### Error in Frontend
```
TypeError: Cannot read properties of undefined (reading 'find')
at transformSchedule - schedule.items is undefined
```

### Root Cause
When frontend calls `GET /api/v1/schedules/{id}`, the response does NOT include the `items` array.

The backend is returning:
```json
{
  "id": "...",
  "restaurant_id": "...",
  "week_start_date": "2026-01-12",
  "status": "draft",
  // Missing: "items": [...]
}
```

But frontend expects:
```json
{
  "id": "...",
  "restaurant_id": "...",
  "week_start_date": "2026-01-12",
  "status": "draft",
  "items": [  // ← THIS IS REQUIRED!
    {
      "id": "item-uuid",
      "waiter_id": "waiter-uuid",
      "role": "server",
      "shift_date": "2026-01-13",
      "shift_start": "07:00:00",
      "shift_end": "15:00:00"
    }
  ]
}
```

### Fix Required
Update the `GET /schedules/{id}` endpoint to include the related `schedule_items` in the response.

**In your Pydantic schema:**
```python
class ScheduleResponse(BaseModel):
    id: UUID
    restaurant_id: UUID
    week_start_date: date
    status: str
    generated_by: str
    version: int
    items: List[ScheduleItemResponse]  # ← Add this!
    created_at: datetime

    class Config:
        from_attributes = True
```

**In your endpoint:**
```python
@router.get("/schedules/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(schedule_id: UUID, session: AsyncSession):
    result = await session.execute(
        select(Schedule)
        .options(selectinload(Schedule.items))  # ← Load items!
        .where(Schedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    # Return with items included
```

**Priority:** CRITICAL - Without items array, schedules cannot be displayed!

---

## Issue 4: Schedule Run API Response

### Current Behavior (from logs)
The `/schedules/run` endpoint creates a `ScheduleRun` object and a `Schedule` object, but we need to verify the response format.

### Expected Response
```json
{
  "id": "run-uuid",
  "run_status": "completed",
  "schedule_id": "schedule-uuid",
  "summary_metrics": {
    "items_created": 32,
    "total_hours": 240.5,
    "coverage_pct": 98.2,
    "fairness_gini": 0.12,
    "preference_avg": 72.5
  }
}
```

Then frontend calls `GET /schedules/{schedule_id}` to get full schedule with items:
```json
{
  "id": "schedule-uuid",
  "restaurant_id": "...",
  "week_start_date": "2026-01-12",
  "status": "draft",
  "generated_by": "engine",
  "version": 1,
  "items": [
    {
      "id": "item-uuid",
      "waiter_id": "waiter-uuid",
      "role": "server",
      "shift_date": "2026-01-13",
      "shift_start": "07:00:00",
      "shift_end": "15:00:00",
      "source": "engine",
      "preference_match_score": 85.5,
      "fairness_impact_score": 12.3
    }
  ],
  "created_at": "..."
}
```

**Verify:** Does `GET /schedules/{id}` return the `items` array? This is critical for displaying the schedule.

---

## Issue 4: Robust Error Handling

### Current Issues
- 500 Internal Server Error when duplicate schedule exists
- No helpful error message to frontend

### Required Error Responses

**409 Conflict** - Schedule already exists:
```json
{
  "detail": "A draft schedule already exists for week starting 2026-01-12. Delete it first or use force_regenerate=true."
}
```

**422 Unprocessable Entity** - Invalid week date:
```json
{
  "detail": "week_start_date must be a Monday"
}
```

**404 Not Found** - Restaurant doesn't exist:
```json
{
  "detail": "Restaurant not found"
}
```

**400 Bad Request** - No staff/requirements configured:
```json
{
  "detail": "Cannot generate schedule: No active staff found for restaurant"
}
```

---

## Testing Checklist for Backend Team

### Test Case 1: First Schedule Generation
```bash
# Should succeed
POST /api/v1/restaurants/{id}/schedules/run
{
  "week_start_date": "2026-01-20"  # New week, no schedule exists
}

# Expected: 200 OK with schedule_id
```

### Test Case 2: Duplicate Draft Schedule
```bash
# Run twice for same week
POST /api/v1/restaurants/{id}/schedules/run
{ "week_start_date": "2026-01-20" }

# Run again
POST /api/v1/restaurants/{id}/schedules/run
{ "week_start_date": "2026-01-20" }

# Expected: Should either:
# - Delete old draft and create new (recommended)
# - Return 409 with helpful message
# - NOT throw 500 error
```

### Test Case 3: Published Schedule Exists
```bash
# Generate schedule
POST /schedules/run { "week_start_date": "2026-01-20" }

# Publish it
POST /schedules/{id}/publish

# Try to generate again
POST /schedules/run { "week_start_date": "2026-01-20" }

# Expected: Either increment version OR return 409 with message
```

### Test Case 4: Delete Draft Schedule
```bash
# Create draft
POST /schedules/run { "week_start_date": "2026-01-27" }

# Delete it
DELETE /schedules/{schedule_id}

# Expected: 204 No Content
```

### Test Case 5: Cannot Delete Published
```bash
# Create and publish
POST /schedules/run { "week_start_date": "2026-02-03" }
POST /schedules/{id}/publish

# Try to delete
DELETE /schedules/{schedule_id}

# Expected: 409 Conflict "Cannot delete published schedule"
```

---

## Current Frontend Implementation

The frontend currently:
1. ✅ Fetches existing schedules for a week
2. ✅ Shows empty state if no schedule exists
3. ✅ Calls `/schedules/run` to generate AI schedule
4. ✅ Polls for completion (if async)
5. ✅ Displays schedule grid with shifts
6. ✅ Deletes draft schedule before regenerating (workaround for Issue 1)

**But this workaround requires the DELETE endpoint (Issue 2) to exist!**

---

## Recommended Backend Changes

### File: `app/api/scheduling.py`

**1. Add DELETE schedule endpoint:**
```python
@router.delete("/schedules/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    # Implementation above in Issue 2
```

**2. Update POST /schedules/run to handle duplicates:**
```python
@router.post("/restaurants/{restaurant_id}/schedules/run")
async def create_schedule_run(
    restaurant_id: UUID,
    data: ScheduleRunRequest,
    session: AsyncSession = Depends(get_session)
):
    # Check for existing schedules BEFORE creating
    existing = await get_schedules_for_week(
        session, restaurant_id, data.week_start_date
    )

    # Delete old drafts
    for schedule in existing:
        if schedule.status == 'draft':
            await session.delete(schedule)
            await session.flush()  # Flush before creating new

    # Calculate new version if published schedules exist
    published = [s for s in existing if s.status == 'published']
    version = max([s.version for s in published], default=0) + 1

    # Now create new schedule with correct version
    # ... rest of logic
```

**3. Add helper function:**
```python
async def get_schedules_for_week(
    session: AsyncSession,
    restaurant_id: UUID,
    week_start_date: date
) -> List[Schedule]:
    result = await session.execute(
        select(Schedule).where(
            Schedule.restaurant_id == restaurant_id,
            Schedule.week_start_date == week_start_date
        )
    )
    return result.scalars().all()
```

---

## Summary

**What Backend Needs to Do:**

1. ✅ Implement `DELETE /schedules/{id}` endpoint (only allow deleting drafts)
2. ✅ Update `/schedules/run` to check for existing schedules before creating
3. ✅ Auto-delete old draft schedules when regenerating
4. ✅ Increment version number when published schedule exists
5. ✅ Return proper error codes (409, 422) instead of 500
6. ✅ Add helpful error messages

**Priority:** HIGH - Blocking frontend scheduling features from working

**Current Workaround:** Frontend deletes draft first (requires DELETE endpoint to exist)

---

## Questions for Backend Team

1. Does `DELETE /schedules/{id}` endpoint exist? If not, please implement.
2. Should the scheduler auto-delete old drafts, or should we require frontend to delete first?
3. What should happen when trying to regenerate a published schedule?
4. Are there any other constraints we should know about?

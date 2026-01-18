# Backend Changes Needed for Scheduling Features

## CRITICAL FIX #1: GET /schedules Must Include Items Array

### Problem
`GET /api/v1/restaurants/{restaurant_id}/schedules?week_start=2026-01-12` returns schedule WITHOUT items array.

Console shows: `[useSchedule] Schedule has items? NO - MISSING!`

### Fix
In `app/api/scheduling.py`, find the `list_schedules` endpoint and add selectinload:

```python
@router.get("/restaurants/{restaurant_id}/schedules")
async def list_schedules(...):
    result = await session.execute(
        select(Schedule)
        .options(selectinload(Schedule.items))  # ← ADD THIS!
        .where(Schedule.restaurant_id == restaurant_id)
        .order_by(Schedule.week_start_date.desc())
    )
    return result.scalars().all()
```

**Without this, the schedule grid is completely empty even though shifts exist in DB!**

---

## Feature #2: AI Reasoning Endpoint

### What Frontend Needs
When user hovers/clicks on a shift, show WHY the AI scheduled that person:
- "Role server is a preferred role"
- "Shift type matches staff preference"
- "Assignment improves schedule fairness"

This data is in your `schedule_reasoning` table already!

### New Endpoint Required
```python
@router.get("/schedule-items/{item_id}/reasoning")
async def get_shift_reasoning(
    item_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """Get AI reasoning for why this shift was assigned"""
    result = await session.execute(
        select(ScheduleReasoning)
        .where(ScheduleReasoning.schedule_item_id == item_id)
    )
    reasoning = result.scalar_one_or_none()

    if not reasoning:
        raise HTTPException(404, "Reasoning not found")

    return {
        "reasons": reasoning.reasons,
        "constraint_violations": reasoning.constraint_violations,
        "confidence_score": reasoning.confidence_score
    }
```

**Frontend will call this when user clicks on a shift badge to see "Why was Emily scheduled here?"**

---

## Feature #3: Inline Editing Endpoints

### What Frontend Needs
User should be able to:
1. Click on a shift time badge → Edit start/end times
2. Drag a shift from one staff member to another
3. Delete a shift
4. Add a new shift manually

### Endpoints Needed

**1. Update Shift (PATCH /schedule-items/{id})**
```python
@router.patch("/schedule-items/{item_id}")
async def update_schedule_item(
    item_id: UUID,
    data: UpdateScheduleItemRequest,  # waiter_id, shift_start, shift_end, role
    session: AsyncSession
):
    """
    Update an existing shift
    - Change times: shift_start, shift_end
    - Reassign to different staff: waiter_id
    - Change role: role (server/bartender/host)
    """
    item = await session.get(ScheduleItem, item_id)
    if not item:
        raise HTTPException(404, "Schedule item not found")

    # Only allow editing draft schedules
    schedule = await session.get(Schedule, item.schedule_id)
    if schedule.status == 'published':
        raise HTTPException(409, "Cannot edit published schedule")

    # Update fields
    if data.waiter_id:
        item.waiter_id = data.waiter_id
    if data.shift_start:
        item.shift_start = data.shift_start
    if data.shift_end:
        item.shift_end = data.shift_end
    if data.role:
        item.role = data.role

    # Mark as manual edit
    item.source = 'manual'

    await session.commit()
    return item
```

**2. Delete Shift (DELETE /schedule-items/{id})**
Already documented - this endpoint is CRITICAL for regenerating schedules!

**3. Add Shift Manually (POST /schedules/{schedule_id}/items)**
```python
@router.post("/schedules/{schedule_id}/items")
async def create_schedule_item(
    schedule_id: UUID,
    data: CreateScheduleItemRequest,
    session: AsyncSession
):
    """Manually add a new shift to the schedule"""
    # Validate schedule exists and is draft
    schedule = await session.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    if schedule.status == 'published':
        raise HTTPException(409, "Cannot modify published schedule")

    # Create shift
    item = ScheduleItem(
        id=uuid4(),
        schedule_id=schedule_id,
        waiter_id=data.waiter_id,
        role=data.role,
        shift_date=data.shift_date,
        shift_start=data.shift_start,
        shift_end=data.shift_end,
        source='manual'
    )

    session.add(item)
    await session.commit()
    return item
```

---

## Feature #4: AI Suggestion/Preview Workflow

### Current Flow (BROKEN)
1. User clicks "AI Suggest"
2. Backend generates schedule immediately
3. Schedule appears in grid (no preview/approval)

### Desired Flow
1. User clicks "AI Suggest"
2. Backend generates schedule as DRAFT (status='suggestion'?)
3. Frontend shows preview modal: "Here's what AI suggests - Apply or Cancel"
4. User clicks Apply → Mark as draft, show in grid
5. User clicks Cancel → Delete the suggestion schedule

### Backend Changes Needed

**Option A: Add new status type**
- Change schedule status enum to include: `draft | published | suggestion | archived`
- Suggestion schedules are temporary until approved
- Frontend filters to only show `draft` and `published` in main grid

**Option B: Use a flag**
- Add `is_suggestion` boolean to Schedule model
- When `/schedules/run` is called, set `is_suggestion=true`
- Frontend can query for suggestion vs actual schedule
- When approved, set `is_suggestion=false`

**Recommended: Option A**

```python
# When running AI scheduler
schedule = Schedule(
    ...
    status='suggestion',  # ← Not 'draft' yet
    generated_by='engine'
)

# When user approves
@router.post("/schedules/{schedule_id}/approve")
async def approve_suggestion(schedule_id: UUID, session: AsyncSession):
    schedule = await session.get(Schedule, schedule_id)
    if schedule.status != 'suggestion':
        raise HTTPException(400, "Only suggestions can be approved")

    schedule.status = 'draft'  # ← Now it's a real draft
    await session.commit()
    return schedule
```

---

## Feature #5: Reasoning Display in Schedule Response

### What Frontend Needs
When displaying schedule, show AI reasoning inline without extra API calls.

### Option 1: Nest reasoning in schedule items response
```python
class ScheduleItemResponse(BaseModel):
    id: UUID
    waiter_id: UUID
    role: str
    shift_date: date
    shift_start: time
    shift_end: time
    source: str
    preference_match_score: Optional[float]
    fairness_impact_score: Optional[float]
    reasoning: Optional[ScheduleReasoningResponse]  # ← ADD THIS

class ScheduleReasoningResponse(BaseModel):
    reasons: List[str]
    constraint_violations: List[str]
    confidence_score: float
```

Then in endpoint:
```python
@router.get("/schedules/{schedule_id}")
async def get_schedule(...):
    result = await session.execute(
        select(Schedule)
        .options(
            selectinload(Schedule.items)
            .selectinload(ScheduleItem.reasoning)  # ← Load reasoning too!
        )
        .where(Schedule.id == schedule_id)
    )
```

### Option 2: Separate reasoning endpoint (less efficient)
Keep reasoning separate, frontend calls `/schedule-items/{id}/reasoning` when needed.

**Recommendation: Option 1** - Include reasoning in schedule response for better UX.

---

## Summary of Backend Tasks

### Must Fix NOW (Blocking)
1. ✅ **GET /restaurants/{id}/schedules** - Add `selectinload(Schedule.items)`
2. ✅ **DELETE /schedules/{id}** - Allow deleting draft/suggestion schedules

### Required for Full Feature Set
3. ✅ **PATCH /schedule-items/{id}** - Update shift (reassign staff, change times)
4. ✅ **POST /schedules/{id}/items** - Manually add shift
5. ✅ **GET /schedule-items/{id}/reasoning** - Get AI reasoning (or nest in schedule response)
6. ✅ **POST /schedules/{id}/approve** - Approve AI suggestion (if using suggestion status)

### Nice to Have
7. Add `status='suggestion'` to Schedule model enum
8. Nest reasoning in schedule items response (avoid extra API calls)
9. Validate edit constraints (can't edit published, check availability conflicts)

---

## Example: What Frontend Will Do

**1. Empty State**
```
User lands on /schedule page
→ GET /restaurants/{id}/schedules → returns []
→ Shows "No schedule yet - Generate with AI" button
```

**2. AI Generation + Preview**
```
User clicks "AI Suggest"
→ POST /restaurants/{id}/schedules/run
→ Backend creates schedule with status='suggestion', items=[26 shifts]
→ Frontend shows preview modal with AI reasoning
→ User sees: "Emily: 7am-11am server (Role matches preference, improves fairness)"
```

**3. User Approves**
```
User clicks "Apply" in preview
→ POST /schedules/{id}/approve (or just refetch if using draft status)
→ status changes to 'draft'
→ Grid displays schedule with all shifts
```

**4. Inline Editing**
```
User clicks shift "Emily 7am-11am"
→ Modal opens showing: Times, Staff dropdown, Role dropdown, AI reasoning
→ User changes to "Emily 7am-3pm"
→ PATCH /schedule-items/{id} { shift_end: "15:00" }
→ Grid updates
```

**5. Move Shift to Different Staff**
```
User drags "Emily 7am-11am" to "James" row
→ PATCH /schedule-items/{id} { waiter_id: "james-uuid" }
→ Grid updates, reasoning shows (manual) instead of AI
```

**6. Delete Shift**
```
User clicks X on shift
→ DELETE /schedule-items/{id}
→ Grid updates, coverage gap warning appears
```

---

## Questions for Backend

1. **Does selectinload work?** Can you add `.options(selectinload(Schedule.items))` to GET /schedules endpoint?

2. **Reasoning structure** - The `schedule_reasoning` table has `reasons` (array) and `constraint_violations` (array). Can you expose this via:
   - Nested in schedule items response? (preferred)
   - Or separate GET /schedule-items/{id}/reasoning endpoint?

3. **Suggestion status** - Do you want to add `status='suggestion'` to the enum, or should AI schedules start as `status='draft'` immediately?

4. **Edit endpoints** - Do PATCH/POST/DELETE for schedule items already exist and work?
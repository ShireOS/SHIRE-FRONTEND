# Make Mimosas Demo Data Production-Realistic

## Current State
- 5 staff members
- Simple brunch hours (7am-3pm)
- AI schedules mostly 7am-11am shifts
- Feels like a toy demo, not a real restaurant

## Needed: Production-Scale Demo Data

### Staff (20-25 people)
```
Servers: 12-15 people
- Mix of full-time (5-6 shifts/week) and part-time (2-3 shifts/week)
- Varied availability (some mornings only, some evenings, some weekends only)
- Different tenure levels (new hires, veterans)

Bartenders: 3-4 people
- Full bar service (not just brunch)
- Some overlap with server skills

Hosts: 2-3 people
- Coverage for all service hours

Bussers: 2-3 people
- Support staff

Runners: 1-2 people
- Peak hours only
```

### Service Hours (Full Restaurant, Not Just Brunch)
```
Monday-Thursday:
- Lunch: 11am-3pm
- Dinner: 5pm-10pm

Friday:
- Lunch: 11am-3pm
- Dinner: 5pm-11pm

Saturday:
- Brunch: 9am-3pm
- Dinner: 5pm-11pm

Sunday:
- Brunch: 9am-3pm
- Dinner: 5pm-9pm
```

### Realistic Scheduling Patterns

**Shift Types:**
- Opening shifts: 10am-4pm, 11am-5pm
- Mid shifts: 12pm-6pm, 3pm-9pm
- Closing shifts: 5pm-11pm, 6pm-12am
- Double shifts: 11am-11pm (rare, high performers only)
- Split shifts: 11am-3pm + 6pm-10pm

**Staffing Requirements:**
```python
# Example realistic requirements

# Monday Lunch (Slow)
11am-3pm: 3 servers, 1 bartender, 1 host

# Friday Dinner (Busy)
5pm-7pm: 5 servers, 2 bartenders, 1 host, 1 busser
7pm-10pm: 6 servers, 2 bartenders, 1 host, 2 bussers (prime time!)
10pm-11pm: 3 servers, 1 bartender, 1 host, 1 busser (closing)

# Saturday Brunch (Busy)
9am-11am: 4 servers, 1 bartender, 1 host
11am-2pm: 6 servers, 2 bartenders, 2 hosts, 1 busser (peak brunch)
2pm-3pm: 4 servers, 1 bartender, 1 host

# Saturday Dinner (Busiest)
5pm-7pm: 6 servers, 2 bartenders, 2 hosts, 1 busser
7pm-10pm: 8 servers, 3 bartenders, 2 hosts, 2 bussers (PEAK!)
10pm-11pm: 4 servers, 2 bartenders, 1 host, 1 busser
```

### Staff Availability (Varied)

**Full-time servers:**
- Available 5-6 days/week
- Prefer morning OR evening (not both)
- Some avoid weekends, some prefer weekends

**Part-time servers:**
- Available 2-3 specific days
- Students: weekends + evenings only
- Parents: weekdays mornings only

**Bartenders:**
- Mostly evening/night availability
- Weekend warriors (Friday-Sunday only)

**Realistic constraints:**
- 3-4 people avoid clopening
- Max 40 hours/week for most
- Min 20 hours/week for full-timers
- Preferred sections (some love bar area, some prefer dining room)

### Expected AI Behavior

With realistic data, AI should create:
- **Diverse shift times**: Morning, mid, evening, closing shifts
- **Staggered start times**: Not everyone at 7am!
- **Weekend coverage**: More staff Friday-Sunday
- **Split coverage**: Lunch team ≠ Dinner team
- **Fair distribution**: Everyone gets mix of good/bad shifts
- **Preference matching**: Morning people get mornings, etc.

### Example Week Schedule (What We Should See)

**Monday:**
- Maria: 11am-3pm (lunch server)
- James: 5pm-10pm (dinner server)
- Carlos: 5pm-10pm (bartender)
- Sophie: 11am-9pm (host, split shift)

**Friday:**
- Maria: 11am-7pm (lunch through happy hour)
- James: 5pm-11pm (dinner/closing)
- Emily: 5pm-11pm (dinner)
- David: 7pm-11pm (mid-peak support)
- Carlos: 4pm-11pm (bar setup through closing)
- Lisa: 5pm-11pm (bartender, peak)

**Saturday:**
- Different team for brunch (9am-3pm)
- Different team for dinner (5pm-11pm)
- Some overlap during transition (2pm-6pm)

## Implementation

Update `app/services/seed_service.py` in `ensure_mimosas_restaurant()`:

```python
async def ensure_mimosas_restaurant():
    # Create 20-25 staff with varied:
    # - roles (12 servers, 4 bartenders, 3 hosts, 2 bussers, 2 runners)
    # - availability patterns
    # - preferences
    # - tenure (mix of new and veteran)

    # Create realistic staffing requirements for:
    # - Lunch service (11am-3pm)
    # - Dinner service (5pm-11pm)
    # - Brunch service (9am-3pm weekends)
    # - Peak periods (Friday-Saturday nights)

    # Generate 60 days of realistic visit/order history:
    # - Higher volume on weekends
    # - Dinner busier than lunch
    # - Friday/Saturday peak times
```

## Why This Matters

**Current:** Schedule looks fake - everyone working 7am-11am
**Realistic:** See actual restaurant complexity - varied shifts, coverage strategies, real trade-offs

Frontend will automatically show:
- Multiple shift times across the grid (not uniform)
- Coverage gaps in realistic places (Saturday 7pm needs more servers)
- Fairness scores that matter (not everyone getting same hours)
- AI reasoning that's interesting ("Prioritized Emily for Saturday peak - high performer")

## ADD: AI-Generated Summary to Schedule Run Response

### What Frontend Needs
The preview modal should display an AI-generated explanation of the scheduling strategy (like waiter insights has `llm_summary`).

### Update ScheduleRun Response
Add a `schedule_summary` field to the ScheduleRun AND Schedule response:

```python
class ScheduleRunResponse(BaseModel):
    id: UUID
    run_status: str
    schedule_id: Optional[UUID]
    summary_metrics: Optional[dict]
    schedule_summary: Optional[str]  # ← NEW: AI-generated explanation

class ScheduleResponse(BaseModel):
    id: UUID
    restaurant_id: UUID
    week_start_date: date
    status: str
    generated_by: str
    version: int
    items: List[ScheduleItemResponse]
    schedule_summary: Optional[str]  # ← NEW: Store summary with schedule
    created_at: datetime
    updated_at: datetime
```

### Add Endpoint to Update Summary
Allow managers to edit the AI summary:

```python
@router.patch("/schedules/{schedule_id}/summary")
async def update_schedule_summary(
    schedule_id: UUID,
    data: dict,  # { "schedule_summary": "Updated text..." }
    session: AsyncSession
):
    schedule = await session.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    schedule.schedule_summary = data.get("schedule_summary")
    await session.commit()
    return schedule
```

### Generate Summary After Scheduling
After the scheduling engine completes, generate an LLM summary:

```python
# In scheduling_engine.py after creating all shifts

summary_prompt = f"""
You are an AI scheduling assistant explaining your scheduling decisions to a restaurant manager.

Schedule created for week of {week_start_date}:
- Created {items_created} shifts totaling {total_hours} hours
- Achieved {coverage_pct}% coverage of staffing requirements
- Fairness score (Gini coefficient): {fairness_gini} (lower is more fair)
- Preference matching: {preference_avg}% of shifts matched staff preferences
- {len(gaps)} coverage gaps remaining

Staff context:
- {len(staff)} total staff members
- {len(requirements)} different time slot requirements
- Mix of full-time and part-time availability

Write a natural, conversational 3-4 sentence explanation of your scheduling strategy. Explain:
- What you prioritized (fairness, coverage, preferences, peak periods)
- Key decisions you made (who got which shifts and why)
- Any trade-offs or compromises (why some gaps exist, which preferences couldn't be met)
- Actionable suggestions (hire more staff, adjust availability, etc.)

Write as if speaking directly to the manager. Be specific and insightful.
"""

schedule_summary = await llm.generate(summary_prompt)

# Save to both ScheduleRun and Schedule
run.schedule_summary = schedule_summary
schedule.schedule_summary = schedule_summary
```

### Example Summary (Narrative Style)
```
"I prioritized fairness across your team while ensuring strong coverage during peak periods. With a Gini coefficient of 0.03, hours are distributed very evenly - everyone gets their fair share. I matched 73% of shifts to staff preferences, giving morning people their preferred morning slots and avoiding clopening patterns for the 4 team members who requested it. The main trade-off was Saturday 7-9pm dinner service - you're short 2 servers and 1 bartender because most of your evening staff are already maxed out on hours. I'd recommend either recruiting additional weekend evening staff or asking a few current team members to expand their availability for Saturday nights. Overall, this schedule achieves 87% coverage while keeping everyone happy and fairly distributed."
```

The summary should read like a conversation with the AI - explaining reasoning, decisions, and suggestions naturally.

### Frontend Will Display
The preview modal will show this summary instead of hardcoded text, making each schedule explanation unique and accurate.

---

## Summary

Make Mimosas a **real restaurant demo** with:
- ✅ 20-25 staff members
- ✅ Full service hours (lunch + dinner, not just brunch)
- ✅ Varied shift patterns (open, mid, close, split)
- ✅ Realistic staffing requirements (more on weekends, peak periods)
- ✅ Diverse availability patterns
- ✅ Historical data matching volume patterns
- ✅ **AI-generated schedule summary** explaining strategy, decisions, trade-offs

This will showcase the AI scheduler's real capabilities!

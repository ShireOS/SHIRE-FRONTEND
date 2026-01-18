# Verify Mimosas Has 50 Staff Members

## Current Issue

Frontend is calling:
```
GET /api/v1/restaurants/9a513454-fedb-4827-8389-c7db819a423a/waiters
```

Backend is returning:
```
Array(5)  ← Only 5 staff!
```

Expected: **50 staff members** for Mimosas restaurant.

---

## Verify in Backend

Run this query to check how many staff Mimosas actually has:

```python
# In Python shell or test
from app.database import get_session_context

async with get_session_context() as session:
    # Get Mimosas restaurant
    result = await session.execute(
        select(Restaurant).where(Restaurant.name == "Mimosas")
    )
    mimosas = result.scalar_one()
    print(f"Mimosas ID: {mimosas.id}")

    # Count staff
    result = await session.execute(
        select(func.count(Waiter.id))
        .where(Waiter.restaurant_id == mimosas.id)
        .where(Waiter.is_active == True)
    )
    count = result.scalar()
    print(f"Active staff count: {count}")

    # List all staff
    result = await session.execute(
        select(Waiter)
        .where(Waiter.restaurant_id == mimosas.id)
        .where(Waiter.is_active == True)
        .order_by(Waiter.name)
    )
    staff = result.scalars().all()
    for s in staff:
        print(f"  - {s.name} ({s.role})")
```

**Expected output:**
```
Mimosas ID: 9a513454-fedb-4827-8389-c7db819a423a
Active staff count: 50
  - Aaron Martinez (server)
  - Alice Johnson (bartender)
  - ... (48 more)
```

**If you see `Active staff count: 5`**, then the seed hasn't been updated yet!

---

## Fix: Re-run Seed with 50 Staff

Update `app/services/seed_service.py` → `ensure_mimosas_restaurant()` to create 50 staff:

```python
# Servers (20-25)
# Bartenders (8-10)
# Hosts (5)
# Chefs (5-7)
# Bussers (5)
# Runners (2-3)
# ----------------
# Total: ~50 staff
```

Then run:
```bash
# Delete old Mimosas data
# Re-run seed
python -c "
from app.services.seed_service import SeedService
from app.database import get_session_context
import asyncio

async def reseed():
    async with get_session_context() as session:
        seed = SeedService(session)
        result = await seed.ensure_mimosas_restaurant()
        print(f'Created {result['staff_count']} staff members')

asyncio.run(reseed())
"
```

---

## What Frontend is Doing (ALL CORRECT)

✅ **Selecting Mimosas:** Auto-selects by name, gets correct ID
✅ **Calling with correct ID:** `GET /restaurants/9a513454.../waiters`
✅ **POSTing schedule generation:** `POST /restaurants/9a513454.../schedules/run`
✅ **Fetching generated schedule:** `GET /schedules/{id}`

**The frontend is perfect** - it's just waiting for backend to have 50 staff in the database!

---

## Quick Test

After re-seeding, refresh frontend and check console:
```
[API] Response from /restaurants/9a513454.../waiters: Array(50)  ← Should show 50!
```

Then the grid will have 50 staff rows and AI will schedule varied shifts across all of them.

# URGENT: CORS Blocking All POST/DELETE Requests

## Problem
Frontend can't use scheduling features - CORS is blocking POST/DELETE/PUT requests.

## Fix
In your backend `main.py` or wherever CORS is configured, change this:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],  # ← Make sure this says ["*"] not ["GET"]
    allow_headers=["*"],
)
```

That's it. Restart backend after changing.

## Test
Click "AI Suggest" button on /schedule page - should work after fix.

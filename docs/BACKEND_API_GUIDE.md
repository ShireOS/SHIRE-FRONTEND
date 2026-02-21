# SHIRE Backend API Guide

This document details all backend endpoints needed to support the restaurant onboarding system and integrations.

## Authentication

The frontend uses **Supabase Auth** directly. The backend should:

1. **Validate Supabase JWT** on all protected endpoints
2. **Extract `user_id`** from the JWT for authorization
3. **NO backend auth endpoints needed** - Supabase handles signup/login/reset

### JWT Validation Middleware (FastAPI)

```python
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from functools import lru_cache

security = HTTPBearer()

@lru_cache()
def get_supabase_jwt_secret():
    # Get from Supabase Dashboard > Settings > API > JWT Secret
    return os.getenv("SUPABASE_JWT_SECRET")

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            get_supabase_jwt_secret(),
            algorithms=["HS256"],
            audience="authenticated"
        )
        return {
            "user_id": payload["sub"],
            "email": payload.get("email"),
            "role": payload.get("role", "authenticated")
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

---

## Onboarding Endpoints

### Create Restaurant (Step 1)

Frontend handles this via Supabase directly. No backend endpoint needed.

### Save Operating Hours (Step 2)

Frontend handles this via Supabase directly. No backend endpoint needed.

### Save Capacity (Step 3)

Frontend handles this via Supabase directly. No backend endpoint needed.

---

## Menu Import Endpoints

### 1. Extract Menu from Image/PDF (AI Vision)

**Endpoint:** `POST /api/v1/menu/import/extract`

**Request:**
```
Content-Type: multipart/form-data

file: <PDF or image file>
restaurant_id: <uuid>
```

**Response:**
```json
{
  "job_id": "abc123",
  "status": "processing"
}
```

**Backend Implementation:**
```python
from fastapi import UploadFile, File, Form, BackgroundTasks
from openai import OpenAI
import base64

client = OpenAI()

@router.post("/menu/import/extract")
async def extract_menu(
    file: UploadFile = File(...),
    restaurant_id: str = Form(...),
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    # Verify ownership
    # ... check restaurant belongs to user

    # Read file
    contents = await file.read()

    # Create job record
    job_id = str(uuid.uuid4())
    # Save job to database with status "processing"

    # Process in background
    background_tasks.add_task(
        process_menu_extraction,
        job_id,
        contents,
        file.content_type,
        restaurant_id
    )

    return {"job_id": job_id, "status": "processing"}

async def process_menu_extraction(
    job_id: str,
    file_bytes: bytes,
    content_type: str,
    restaurant_id: str
):
    """Background task to extract menu items using GPT-4 Vision"""

    # Convert to base64
    base64_image = base64.b64encode(file_bytes).decode('utf-8')

    # Determine media type
    media_type = "image/jpeg"
    if "pdf" in content_type:
        media_type = "application/pdf"
    elif "png" in content_type:
        media_type = "image/png"

    # Call GPT-4 Vision
    response = client.chat.completions.create(
        model="gpt-4-vision-preview",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": """Extract all menu items from this image/document.

Return a JSON array with this structure:
[
  {
    "name": "Item Name",
    "description": "Optional description",
    "price": 12.99,
    "category": "Appetizers"
  }
]

Be thorough - extract ALL items. Include prices if visible.
Group items by their menu section/category."""
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        max_tokens=4096
    )

    # Parse response
    items = parse_menu_json(response.choices[0].message.content)

    # Update job with results
    # ... save items to database, update job status to "completed"
```

### 2. Get Menu Import Job Status

**Endpoint:** `GET /api/v1/menu/import/jobs/{job_id}`

**Response:**
```json
{
  "job_id": "abc123",
  "status": "completed",  // or "processing", "failed"
  "items": [
    {
      "name": "Caesar Salad",
      "description": "Romaine lettuce with parmesan",
      "price": 12.99,
      "category": "Salads"
    }
  ],
  "error": null
}
```

### 3. Confirm Menu Items

**Endpoint:** `POST /api/v1/menu/import/confirm`

**Request:**
```json
{
  "restaurant_id": "uuid",
  "items": [
    {
      "name": "Caesar Salad",
      "description": "Romaine lettuce with parmesan",
      "price": 12.99,
      "category": "Salads"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "items_created": 25
}
```

### 4. Get Menu Import Template

**Endpoint:** `GET /api/v1/menu/import/template`

**Response:** Returns CSV file

```csv
name,description,price,category,cost
"Caesar Salad","Romaine with parmesan",12.99,"Salads",4.50
"Margherita Pizza","Classic tomato and mozzarella",16.99,"Pizza",5.00
```

### 5. Import from Spreadsheet

**Endpoint:** `POST /api/v1/menu/import/spreadsheet`

**Request:**
```
Content-Type: multipart/form-data

file: <CSV or Excel file>
restaurant_id: <uuid>
```

**Response:**
```json
{
  "success": true,
  "items_created": 50,
  "errors": []
}
```

### 6. Scrape Menu from Website

**Endpoint:** `POST /api/v1/menu/import/scrape`

**Request:**
```json
{
  "restaurant_id": "uuid",
  "url": "https://myrestaurant.com/menu"
}
```

**Response:**
```json
{
  "job_id": "abc123",
  "status": "processing"
}
```

---

## Integration Endpoints

### 7shifts Integration

#### Get OAuth URL

**Endpoint:** `GET /api/v1/integrations/7shifts/auth-url`

**Query Params:**
```
restaurant_id=<uuid>
```

**Response:**
```json
{
  "url": "https://app.7shifts.com/oauth/authorize?client_id=xxx&redirect_uri=xxx&scope=read:employees,read:shifts&state=xxx"
}
```

**Backend Implementation:**
```python
@router.get("/integrations/7shifts/auth-url")
async def get_7shifts_auth_url(
    restaurant_id: str,
    user: dict = Depends(get_current_user)
):
    # Verify restaurant ownership

    # Generate state token (include restaurant_id, user_id)
    state = jwt.encode({
        "restaurant_id": restaurant_id,
        "user_id": user["user_id"],
        "exp": datetime.utcnow() + timedelta(minutes=10)
    }, SECRET_KEY)

    url = (
        "https://app.7shifts.com/oauth/authorize"
        f"?client_id={SEVENSHIFTS_CLIENT_ID}"
        f"&redirect_uri={SEVENSHIFTS_REDIRECT_URI}"
        f"&scope=read:employees,read:shifts,write:shifts"
        f"&state={state}"
    )

    return {"url": url}
```

#### OAuth Callback

**Endpoint:** `POST /api/v1/integrations/7shifts/callback`

**Request:**
```json
{
  "code": "authorization_code_from_7shifts",
  "state": "jwt_state_token"
}
```

**Response:**
```json
{
  "success": true,
  "employees_synced": 15
}
```

**Backend Implementation:**
```python
@router.post("/integrations/7shifts/callback")
async def handle_7shifts_callback(
    code: str,
    state: str
):
    # Verify state token
    state_data = jwt.decode(state, SECRET_KEY, algorithms=["HS256"])
    restaurant_id = state_data["restaurant_id"]

    # Exchange code for tokens
    response = requests.post(
        "https://api.7shifts.com/oauth2/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": SEVENSHIFTS_REDIRECT_URI,
            "client_id": SEVENSHIFTS_CLIENT_ID,
            "client_secret": SEVENSHIFTS_CLIENT_SECRET
        }
    )
    tokens = response.json()

    # Store tokens (encrypted)
    await store_integration(
        restaurant_id=restaurant_id,
        provider="sevenshifts",
        access_token=encrypt(tokens["access_token"]),
        refresh_token=encrypt(tokens["refresh_token"]),
        expires_at=datetime.utcnow() + timedelta(seconds=tokens["expires_in"])
    )

    # Sync employees
    employees = await sync_7shifts_employees(restaurant_id)

    return {"success": True, "employees_synced": len(employees)}
```

#### Sync Employees

**Endpoint:** `POST /api/v1/integrations/7shifts/sync`

**Request:**
```json
{
  "restaurant_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "synced": {
    "created": 5,
    "updated": 10,
    "total": 15
  }
}
```

**Backend Implementation:**
```python
async def sync_7shifts_employees(restaurant_id: str):
    # Get integration tokens
    integration = await get_integration(restaurant_id, "sevenshifts")

    # Refresh token if needed
    if integration.token_expires_at < datetime.utcnow():
        await refresh_7shifts_token(integration)

    # Fetch employees from 7shifts
    headers = {"Authorization": f"Bearer {decrypt(integration.access_token)}"}
    response = requests.get(
        f"https://api.7shifts.com/v2/company/{integration.external_id}/users",
        headers=headers
    )

    employees = response.json()["data"]

    # Upsert to waiters table
    for emp in employees:
        await upsert_waiter(
            restaurant_id=restaurant_id,
            external_id=emp["id"],
            name=f"{emp['first_name']} {emp['last_name']}",
            email=emp.get("email"),
            phone=emp.get("mobile_phone"),
            role=map_7shifts_role(emp.get("role")),
            is_active=emp.get("active", True)
        )

    return employees
```

#### Get Integration Status

**Endpoint:** `GET /api/v1/integrations/7shifts/status`

**Query Params:**
```
restaurant_id=<uuid>
```

**Response:**
```json
{
  "connected": true,
  "last_synced_at": "2024-01-15T10:30:00Z",
  "sync_error": null,
  "employees_count": 15
}
```

#### Disconnect Integration

**Endpoint:** `DELETE /api/v1/integrations/7shifts/disconnect`

**Query Params:**
```
restaurant_id=<uuid>
```

**Response:**
```json
{
  "success": true
}
```

---

### Toast POS Integration (Menu Import)

#### Initiate Toast OAuth

**Endpoint:** `POST /api/v1/menu/import/toast/connect`

**Request:**
```json
{
  "restaurant_id": "uuid"
}
```

**Response:**
```json
{
  "url": "https://ws-api.toasttab.com/authentication/v1/authentication/login?..."
}
```

#### Toast OAuth Callback

**Endpoint:** `GET /api/v1/menu/import/toast/callback`

Handles OAuth redirect, stores tokens.

#### Sync Menu from Toast

**Endpoint:** `POST /api/v1/menu/import/toast/sync`

**Request:**
```json
{
  "restaurant_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "items_synced": 85,
  "categories_synced": 12
}
```

**Backend Implementation:**
```python
async def sync_toast_menu(restaurant_id: str):
    integration = await get_integration(restaurant_id, "toast")

    headers = {"Authorization": f"Bearer {decrypt(integration.access_token)}"}

    # Get menus
    response = requests.get(
        f"https://ws-api.toasttab.com/menus/v2/menus",
        headers=headers
    )

    menus = response.json()

    # Process menu groups and items
    for menu in menus:
        for group in menu.get("menuGroups", []):
            for item in group.get("items", []):
                await upsert_menu_item(
                    restaurant_id=restaurant_id,
                    pos_item_id=item["guid"],
                    name=item["name"],
                    category=group["name"],
                    price=item.get("price"),
                    is_available=item.get("visibility") == "ALL"
                )

    return {"items_synced": count}
```

---

## Staff Management Endpoints

### Send Invitation

**Endpoint:** `POST /api/v1/staff/invite`

**Request:**
```json
{
  "restaurant_id": "uuid",
  "email": "newstaff@example.com",
  "role": "server"
}
```

**Response:**
```json
{
  "success": true,
  "invitation_id": "uuid"
}
```

**Backend Implementation:**
```python
@router.post("/staff/invite")
async def send_invitation(
    restaurant_id: str,
    email: str,
    role: str,
    user: dict = Depends(get_current_user)
):
    # Verify ownership/manager role

    # Generate invitation token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=7)

    # Save invitation
    invitation = await create_invitation(
        restaurant_id=restaurant_id,
        email=email,
        role=role,
        invited_by=user["user_id"],
        token=token,
        expires_at=expires_at
    )

    # Send email
    await send_invitation_email(
        to=email,
        restaurant_name=restaurant.name,
        invite_link=f"{FRONTEND_URL}/invite/{token}"
    )

    return {"success": True, "invitation_id": invitation.id}
```

### Accept Invitation

**Endpoint:** `POST /api/v1/staff/invites/{token}/accept`

**Request:**
```json
{
  "user_id": "uuid"  // From Supabase auth
}
```

**Response:**
```json
{
  "success": true,
  "restaurant_id": "uuid"
}
```

### List Pending Invitations

**Endpoint:** `GET /api/v1/staff/invites`

**Query Params:**
```
restaurant_id=<uuid>
```

**Response:**
```json
{
  "invitations": [
    {
      "id": "uuid",
      "email": "staff@example.com",
      "role": "server",
      "created_at": "2024-01-15T10:00:00Z",
      "expires_at": "2024-01-22T10:00:00Z"
    }
  ]
}
```

---

## Environment Variables Required

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # Service role key for backend
SUPABASE_JWT_SECRET=xxx

# OpenAI (for menu extraction)
OPENAI_API_KEY=sk-xxx

# 7shifts
SEVENSHIFTS_CLIENT_ID=xxx
SEVENSHIFTS_CLIENT_SECRET=xxx
SEVENSHIFTS_REDIRECT_URI=https://api.yourapp.com/api/v1/integrations/7shifts/callback

# Toast
TOAST_CLIENT_ID=xxx
TOAST_CLIENT_SECRET=xxx
TOAST_REDIRECT_URI=https://api.yourapp.com/api/v1/menu/import/toast/callback

# Encryption key for storing tokens
TOKEN_ENCRYPTION_KEY=xxx

# Frontend URL (for invitation links)
FRONTEND_URL=https://app.yourapp.com
```

---

## Rate Limiting Recommendations

| Endpoint | Limit |
|----------|-------|
| Menu extraction | 5 req/min per restaurant |
| 7shifts sync | 10 req/min per restaurant |
| Invitations | 20 req/hour per restaurant |
| General API | 100 req/min per user |

---

## Error Response Format

All errors should return:

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "The authentication token is invalid or expired",
    "details": {}
  }
}
```

Common error codes:
- `UNAUTHORIZED` - Missing or invalid auth
- `FORBIDDEN` - User doesn't have permission
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `INTEGRATION_ERROR` - Third-party API error
- `RATE_LIMITED` - Too many requests

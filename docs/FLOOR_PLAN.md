# Floor Plan Detection API

AI-powered floor plan analysis with draggable table editing.

## Backend Complete ✅

The backend implementation is complete and ready for frontend integration.

## Database Schema

Added to `restaurants` table:
- `floor_plan_image_url` - URL to floor plan image in Supabase Storage
- `floor_plan_data` - JSONB with table positions and metadata
- `floor_plan_updated_at` - Timestamp of last update

Run migration:
```sql
-- Already in supabase/migrations/0004_floor_plan.sql
-- Run in Supabase Dashboard > SQL Editor
```

## API Endpoints

Base URL: `/api/v1/restaurants/{restaurant_id}/floor-plan`

### 1. Upload Floor Plan Image

**POST** `/upload`

Upload a floor plan image (JPG or PNG).

```typescript
// Request
FormData with file: UploadFile

// Response
{
  "success": true,
  "image_url": "https://...supabase.co/storage/floor-plans/...",
  "message": "Floor plan uploaded successfully"
}
```

### 2. Analyze Floor Plan

**POST** `/analyze`

Run AI detection on uploaded image.

```typescript
// Request
{
  "image_url": "https://...supabase.co/storage/floor-plans/...",
  "expected_table_count": 9  // Optional hint for AI
}

// Response
{
  "dimensions": {"width": 1084, "height": 882},
  "tables": [
    {
      "id": "T1",
      "position": {
        "center_x": 25.0,  // % of image width (0-100)
        "center_y": 20.0,  // % of image height (0-100)
        "width": 10.0,     // % of image width
        "height": 10.0     // % of image height
      },
      "shape": "rectangular",  // or "round"
      "capacity": 4,
      "confidence": 0.95,
      "notes": "Four-top near entrance"
    }
  ],
  "total_tables": 4,
  "total_capacity": 16,
  "confidence_score": 0.95,
  "warnings": []
}
```

### 3. Save Floor Plan (After User Edits)

**POST** `/save`

Save final table positions after user drags/edits them.

```typescript
// Request
{
  "image_url": "https://...supabase.co/storage/floor-plans/...",
  "tables": [
    {
      "id": "T1",
      "position": {
        "center_x": 26.5,  // User may have adjusted position
        "center_y": 21.0,
        "width": 10.0,
        "height": 10.0
      },
      "shape": "rectangular",
      "capacity": 4,
      "confidence": 0.95,
      "notes": "Four-top near entrance"
    }
  ]
}

// Response
{
  "success": true,
  "restaurant_id": "uuid...",
  "total_tables": 4,
  "total_capacity": 16,
  "message": "Floor plan saved successfully"
}
```

### 4. Get Existing Floor Plan

**GET** `/`

Retrieve saved floor plan for a restaurant.

```typescript
// Response (if exists)
{
  "has_floor_plan": true,
  "image_url": "https://...supabase.co/storage/floor-plans/...",
  "tables": [...],  // Same format as analyze response
  "total_tables": 4,
  "total_capacity": 16,
  "updated_at": "2026-02-27T14:30:00Z"
}

// Response (if no floor plan)
{
  "has_floor_plan": false,
  "image_url": null,
  "tables": [],
  "total_tables": 0,
  "total_capacity": 0,
  "updated_at": null
}
```

## Frontend Integration Guide

### Step 1: Upload Flow

```typescript
// 1. User selects image file
const file = event.target.files[0];

// 2. Upload to backend
const formData = new FormData();
formData.append('file', file);

const uploadRes = await fetch(
  `${API_URL}/restaurants/${restaurantId}/floor-plan/upload`,
  {
    method: 'POST',
    body: formData
  }
);

const { image_url } = await uploadRes.json();
```

### Step 2: Analyze

```typescript
// 3. Trigger AI analysis
const analyzeRes = await fetch(
  `${API_URL}/restaurants/${restaurantId}/floor-plan/analyze`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url,
      expected_table_count: 9  // from user input
    })
  }
);

const analysis = await analyzeRes.json();
// analysis.tables contains detected positions
```

### Step 3: Display & Edit

```typescript
// 4. Display floor plan with draggable tables
<FloorPlanEditor
  backgroundImage={analysis.dimensions}
  tables={analysis.tables}
  onTableMove={(tableId, newPosition) => {
    // Update table position in state
    updateTablePosition(tableId, newPosition);
  }}
/>
```

### Step 4: Save

```typescript
// 5. User clicks "Save" - send edited positions
const saveRes = await fetch(
  `${API_URL}/restaurants/${restaurantId}/floor-plan/save`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url,
      tables: editedTables  // After user drags/edits
    })
  }
);
```

## Coordinate System

All positions use **percentage-based coordinates (0-100)**:

- `center_x`: Horizontal center of table (0 = left edge, 100 = right edge)
- `center_y`: Vertical center of table (0 = top edge, 100 = bottom edge)
- `width`: Table width as % of image
- `height`: Table height as % of image

This makes it resolution-independent - works on any canvas size!

### Converting to Pixels

```typescript
function positionToPixels(position, canvasWidth, canvasHeight) {
  return {
    x: (position.center_x / 100) * canvasWidth,
    y: (position.center_y / 100) * canvasHeight,
    width: (position.width / 100) * canvasWidth,
    height: (position.height / 100) * canvasHeight
  };
}
```

## UI Components Needed

1. **Upload Component**
   - Drag & drop or file select
   - Image preview
   - "Analyze" button

2. **Floor Plan Editor**
   - Canvas with background image
   - Draggable table overlays (rectangles/circles)
   - Table labels (T1, T2, etc.)
   - Capacity badges

3. **Table Editor Modal**
   - Click table → edit modal
   - Edit: table number, capacity, shape
   - Delete table option
   - "Add Table" button

4. **Save/Cancel Controls**
   - "Save {N} Tables" button
   - "Re-analyze" button
   - "Cancel" to discard changes

## Testing

Test with:
```bash
python test_floor_plan_detection.py app/services/ImgToFloorPlan/floorplan.png 4
```

Results saved to `floorplan_analysis.json` for inspection.

## Notes

- AI typically takes 10-30 seconds to analyze
- 95%+ confidence on clear floor plans
- Detects rectangular and round tables
- Auto-estimates capacity based on table size
- User can adjust all positions and properties
- Data persists on re-login
- Uploading new image replaces old one gracefully
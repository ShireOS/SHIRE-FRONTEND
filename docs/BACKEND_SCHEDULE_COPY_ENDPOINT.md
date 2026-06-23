# Backend Schedule Copy Endpoint

## Endpoint

`POST /api/v1/restaurants/{restaurant_id}/schedules/copy`

This endpoint powers mobile manual generation. It should copy a real prior schedule into the target week so managers can quickly edit and publish from mobile.

## Request

```json
{
  "source_schedule_id": "optional-uuid",
  "source_week_start": "optional YYYY-MM-DD",
  "target_week_start": "YYYY-MM-DD",
  "force_replace": false
}
```

Rules:
- `target_week_start` is required.
- If `source_schedule_id` is present, copy that schedule.
- Else if `source_week_start` is present, copy the best schedule for that week, preferring `published` over `draft`.
- Else copy the latest `published` schedule for the restaurant, falling back to the latest `draft`.
- If a draft already exists for `target_week_start`, return `409` unless `force_replace` is `true`.
- If no source schedule exists, return `404` with a stable message such as `No source schedule available to copy`.

## Response

Return `201` with the same shape as `GET /api/v1/schedules/{schedule_id}`:

```json
{
  "id": "new-schedule-uuid",
  "restaurant_id": "restaurant-uuid",
  "week_start_date": "YYYY-MM-DD",
  "status": "draft",
  "generated_by": "manual",
  "items": []
}
```

Each copied item should preserve staff, role, section, start/end time, notes, lock/manual flags where supported, and set `source` to `manual`. `shift_date` must be shifted by day offset from the source week into the target week.

## Tests

- Copy latest published schedule into an empty target week; item dates shift correctly.
- Copy latest draft when no published schedule exists.
- Return `409` when the target week already has a draft and `force_replace` is false.
- With `force_replace=true`, delete/replace the target draft and return the new populated draft.
- Return `404` when no source schedule exists.
- Do not allow published target schedules to be replaced.

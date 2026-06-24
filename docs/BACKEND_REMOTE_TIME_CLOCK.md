# Backend Remote Time Clock Contract

The mobile app now calls these endpoints for restaurant-gated remote clock-in.
The API server is the source of truth for policy enforcement, payable time, push
delivery, and audit history.

## Policy

- `GET /employee/time-clock/policy`
- `GET /restaurants/{restaurant_id}/employee-request-policy`
- `PUT /restaurants/{restaurant_id}/employee-request-policy`

Store the settings under `manager_settings.remote_time_clock`:

```json
{
  "enabled": false,
  "allow_manual_entries": false,
  "require_manager_mention": true
}
```

Default `enabled` to `false` for restaurants with no setting. If `enabled` is
false, reject employee clock-in and manual-entry writes even if the client shows
cached enabled state.

## Employee Time Clock

- `GET /employee/time-clock/status`
- `GET /employee/admins`
- `POST /employee/time-clock/clock-in`
- `POST /employee/time-clock/clock-out`
- `POST /employee/time-clock/manual-entry`

Remote clock-in creates an active `pos_time_clock_entries` row immediately with
pending review state and a linked review request. Clock-out closes the active
entry immediately. Manual entry creates a pending review entry with employee
provided date, start, end, reason, and mentioned manager.

## Manager Review

- `GET /restaurants/{restaurant_id}/time-clock/requests?status=pending|all`
- `PATCH /time-clock/requests/{id}` with `{ "status": "approved" | "denied" }`

Approval marks the time entry approved/payable. Denial keeps audit history,
marks the review request denied, voids the time entry, and excludes it from
payable hours.

## Push Tokens

- `POST /mobile/push-tokens`

Store Expo push tokens by user, restaurant, platform, and device. When an
employee mentions a manager on a remote time request, send a push to that
manager when a valid token exists. All admins should still see the in-app queue.

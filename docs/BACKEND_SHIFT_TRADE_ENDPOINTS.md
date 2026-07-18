# Backend Contract: Employee Shift Trades

This frontend expects the scheduling API to own shift-trade validation and the final atomic schedule mutation.

## Policy

Read and write the existing `employee_request_policies.manager_settings.shift_trades` object:

```json
{
  "enabled": true,
  "require_manager_approval": true,
  "allow_employee_to_employee_trades": true,
  "notify_managers_in_chat": false
}
```

Default behavior is manager final approval after both employees approve.

## Employee Endpoints

- `GET /api/v1/employee/shift-trades`
  - `scope=active|all`; return the signed-in employee's incoming, outgoing, or historical transfers.

- `POST /api/v1/employee/shift-trades`
  - Body: `{ "schedule_item_id": "uuid", "target_waiter_id": "uuid", "reason": "optional" }`
  - Validate the schedule item belongs to the signed-in employee, the target waiter is active in the same restaurant, and policy allows trades.
  - Create `shift_trade_requests` with `status = 'pending_target'` and `requester_approved_at = now()`.
  - The target employee sees the request in the Schedule request inbox.

- `PATCH /api/v1/employee/shift-trades/{trade_id}`
  - Body: `{ "status": "approved" | "denied" | "cancelled" }`
  - Target employee may approve/deny while `pending_target`.
  - Requesting employee may cancel before final approval.
  - On target approval, set `target_approved_at = now()` and move to `pending_manager`.
  - Manager approval is mandatory; policy data cannot bypass this transition.

## Manager Endpoints

- `GET /api/v1/restaurants/{restaurant_id}/shift-trade-requests?status=pending_manager|all|...`
  - Return enriched rows with requester/target names, role, shift date, and shift times.

- `PATCH /api/v1/shift-trade-requests/{trade_id}`
  - Body: `{ "status": "approved" | "denied" }`
  - On approval, update the matching `schedule_items.waiter_id` to `target_waiter_id`, set `is_manual_override = true`, and mark the trade `approved` in one transaction.
  - On denial, set `manager_denied_at = now()` and mark `denied`.
  - Every eligible owner/manager for the restaurant reads the same queue; one final decision closes it for all accounts.

## Safety Requirements

- Never mutate `schedule_items` unless the trade is still pending and the schedule item still belongs to `requesting_waiter_id`.
- Do not allow self-trades, cross-restaurant trades, inactive staff, cancelled/expired requests, or duplicate approvals.
- If the shift changed since the request was created, return `409` with a clear message.

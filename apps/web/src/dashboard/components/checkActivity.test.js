import assert from 'node:assert/strict'
import test from 'node:test'

import { activityLabel, activityTitle, activityWho, groupActivityIntoSessions } from './checkActivity.js'

const at = (minute) => `2026-08-07T18:${String(minute).padStart(2, '0')}:00Z`

test('labels: known types are friendly, unknown types humanize', () => {
  assert.equal(activityLabel('item_sent'), 'Sent to kitchen')
  assert.equal(activityLabel('add_gratuity'), 'Gratuity added or changed')
  assert.equal(activityLabel('remove_gratuity'), 'Gratuity removed')
  assert.equal(activityLabel('some_new_event'), 'Some new event')
})

test('gratuity manager actions include their amount', () => {
  assert.equal(activityTitle({ action: 'add_gratuity', amount: 12.5 }), 'Gratuity added or changed — $12.50')
  assert.equal(activityTitle({ action: 'remove_gratuity', amount: 0 }), 'Gratuity removed — $0.00')
})

test('title includes item snapshot with quantity', () => {
  assert.equal(
    activityTitle({ action: 'item_added', item_snapshot: { name: 'Burger', quantity: 2 } }),
    'Item added — 2× Burger',
  )
  assert.equal(activityTitle({ action: 'seat_moved' }), 'Seat moved')
})

test('who line shows actor, role, terminal, and approver', () => {
  assert.equal(
    activityWho({ actor_name: 'Maria', actor_role: 'server', terminal_name: 'Terminal 2', manager_approver_name: 'Sam' }),
    'Maria (server) · Terminal 2 · approved by Sam',
  )
  assert.equal(activityWho({ actor_name: 'Maria', origin_surface: 'fast_bar' }), 'Maria · fast bar')
})

test('single open-to-close run is one session', () => {
  const sessions = groupActivityIntoSessions([
    { action: 'item_added', created_at: at(1) },
    { action: 'item_sent', created_at: at(2) },
    { action: 'payment_recorded', created_at: at(3) },
    { action: 'paid_check_closed', created_at: at(4) },
  ])
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].label, 'Opened')
  assert.equal(sessions[0].entries.length, 4)
})

test('reopen starts a new session containing the reopen event', () => {
  const sessions = groupActivityIntoSessions([
    { action: 'item_added', created_at: at(1) },
    { action: 'paid_check_closed', created_at: at(2) },
    { action: 'reopen_order', created_at: at(3) },
    { action: 'item_voided', created_at: at(4) },
  ])
  assert.equal(sessions.length, 2)
  assert.equal(sessions[1].label, 'Reopened')
  assert.deepEqual(sessions[1].entries.map(e => e.action), ['reopen_order', 'item_voided'])
})

test('activity after a close without explicit reopen becomes its own session', () => {
  const sessions = groupActivityIntoSessions([
    { action: 'paid_check_closed', created_at: at(1) },
    { action: 'refund_payment', created_at: at(2) },
  ])
  assert.equal(sessions.length, 2)
  assert.equal(sessions[1].label, 'Resumed after close')
})

test('repeated close attempts stay in the session they close', () => {
  const sessions = groupActivityIntoSessions([
    { action: 'item_added', created_at: at(1) },
    { action: 'closed_with_unsent_items', created_at: at(2) },
    { action: 'closed_with_unsent_items', created_at: at(3) },
    { action: 'paid_check_closed', created_at: at(4) },
    { action: 'item_sent', created_at: at(5) },
  ])
  assert.equal(sessions.length, 2)
  assert.equal(sessions[0].entries.length, 4)
  assert.deepEqual(sessions[1].entries.map(e => e.action), ['item_sent'])
})

test('entries sort oldest-first even when given newest-first', () => {
  const sessions = groupActivityIntoSessions([
    { action: 'paid_check_closed', created_at: at(9) },
    { action: 'item_added', created_at: at(1) },
    { action: 'item_sent', action_occurred_at: at(5) },
  ])
  assert.equal(sessions.length, 1)
  assert.deepEqual(sessions[0].entries.map(e => e.action), ['item_added', 'item_sent', 'paid_check_closed'])
})

test('empty and missing-timestamp input is safe', () => {
  assert.deepEqual(groupActivityIntoSessions([]), [])
  assert.equal(groupActivityIntoSessions([{ action: 'item_added' }]).length, 1)
})

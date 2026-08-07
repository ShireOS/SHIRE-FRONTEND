// Pure helpers for the check activity log: friendly labels for POS event
// types, one-line summaries (who/role/station), and grouping the timeline
// into sessions — a new section every time the check is (re)opened.

const EVENT_LABELS = {
  created: 'Check opened',
  item_added: 'Item added',
  item_sent: 'Sent to kitchen',
  item_voided: 'Item voided',
  item_handled_locally: 'Handled at station',
  item_handled_locally_undone: 'Station handling undone',
  unsent_item_removed: 'Unsent item removed',
  unsent_fulfillment_decision: 'Unsent items decided',
  paid_unsent_written_off: 'Unsent items written off',
  quantity_changed: 'Quantity changed',
  modifier_changed: 'Modifiers changed',
  seat_moved: 'Seat moved',
  payment_recorded: 'Payment recorded',
  paid_and_kept_open: 'Paid — kept open',
  paid_check_closed: 'Check closed (paid)',
  closed_with_unsent_items: 'Closed with unsent items',
  quick_cash_undo: 'Quick cash undone',
  archived: 'Check archived',
  reopen_order: 'Check reopened',
  refund_payment: 'Refund',
  void_payment: 'Payment voided',
  fast_bar_walkup_attached: 'Walk-up tab attached',
  fast_bar_walkup_attachment_removed: 'Walk-up tab detached',
  fast_bar_walkup_attachment_undone: 'Walk-up attach undone',
  fast_bar_walkup_left_open: 'Walk-up tab left open',
  fast_bar_walkup_received: 'Walk-up tab received',
}

// Events that end a session…
const CLOSE_ACTIONS = new Set(['paid_check_closed', 'closed_with_unsent_items', 'archived'])
// …and events that explicitly start a new one.
const REOPEN_ACTIONS = new Set(['reopen_order', 'order_reopened', 'check_reopened'])

export function activityLabel(action) {
  if (!action) return 'Activity'
  if (EVENT_LABELS[action]) return EVENT_LABELS[action]
  const text = String(action).replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// "Item added — 2× Burger"
export function activityTitle(entry) {
  const base = activityLabel(entry.action || entry.source)
  const snapshot = entry.item_snapshot
  if (snapshot && typeof snapshot === 'object' && snapshot.name) {
    const qty = Number(snapshot.quantity) > 1 ? `${Number(snapshot.quantity)}× ` : ''
    return `${base} — ${qty}${snapshot.name}`
  }
  if (entry.amount != null && ['refund_payment', 'void_payment'].includes(entry.action)) {
    return `${base} — $${Number(entry.amount).toFixed(2)}`
  }
  return base
}

// "Maria (server) · Terminal 2 · approved by Sam"
export function activityWho(entry) {
  const parts = []
  if (entry.actor_name) {
    parts.push(entry.actor_role ? `${entry.actor_name} (${entry.actor_role})` : entry.actor_name)
  }
  const station = entry.terminal_name || entry.device_name
  if (station) parts.push(station)
  else if (entry.origin_surface) parts.push(String(entry.origin_surface).replace(/_/g, ' '))
  if (entry.manager_approver_name) parts.push(`approved by ${entry.manager_approver_name}`)
  return parts.join(' · ')
}

const entryTime = (entry) => {
  const stamp = entry.action_occurred_at || entry.created_at
  const time = stamp ? new Date(stamp).getTime() : NaN
  return Number.isFinite(time) ? time : 0
}

// Oldest-first sessions: a new section starts at the first event, after any
// close-type event, and at any explicit reopen event. First section is
// "Opened", reopen-started sections are "Reopened", anything else that
// follows a close is "Resumed after close".
export function groupActivityIntoSessions(activity) {
  const ordered = [...(activity || [])].sort((a, b) => entryTime(a) - entryTime(b))
  const sessions = []
  let current = null
  let previousWasClose = false
  for (const entry of ordered) {
    const action = entry.action || ''
    const isReopen = REOPEN_ACTIONS.has(action)
    const isClose = CLOSE_ACTIONS.has(action)
    // Repeated close attempts belong to the session they close — only real
    // post-close activity (or an explicit reopen) starts a new section.
    if (!current || isReopen || (previousWasClose && !isClose)) {
      current = {
        label: sessions.length === 0 ? 'Opened' : isReopen ? 'Reopened' : 'Resumed after close',
        startedAt: entry.action_occurred_at || entry.created_at || null,
        entries: [],
      }
      sessions.push(current)
    }
    current.entries.push(entry)
    previousWasClose = isClose
  }
  return sessions
}

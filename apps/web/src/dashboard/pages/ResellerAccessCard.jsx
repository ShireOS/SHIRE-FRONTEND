import { useEffect, useState } from 'react'
import { Check, Eye } from 'lucide-react'
import { useAuth } from '../../auth'
import {
  RESELLER_TOGGLEABLE_TABS,
  DEFAULT_RESELLER_PERMISSIONS,
  fetchResellerAssignments,
  updateResellerPermissions,
} from '../data/resellerAccess'

const TAB_LABELS = {
  devices: 'Devices & peripherals',
  setup: 'Setup',
  team: 'Team & pay',
  scheduling: 'Scheduling',
  messaging: 'Messaging',
  payments: 'Payments / Plan',
}

const resellerName = (assignment) => {
  const profile = assignment.reseller
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  return name || 'Reseller'
}

/**
 * Owner-only card on a store's Home: controls which operational surfaces the
 * store's resellers can view. Analytics + rates/payout stay mandatory.
 */
export default function ResellerAccessCard({ restaurant }) {
  const auth = useAuth()
  const [assignments, setAssignments] = useState([])
  const [busyKey, setBusyKey] = useState(null)
  const [error, setError] = useState(null)

  const isOwner = restaurant?.owner_id && restaurant.owner_id === auth.user?.id

  useEffect(() => {
    if (!restaurant?.id || !isOwner) return
    let cancelled = false
    fetchResellerAssignments(restaurant.id)
      .then((rows) => {
        if (!cancelled) setAssignments(rows)
      })
      .catch(() => {
        // Table missing (migration not run) or no access — hide quietly.
      })
    return () => {
      cancelled = true
    }
  }, [restaurant?.id, isOwner])

  if (!isOwner || assignments.length === 0) return null

  const toggle = async (assignment, tab) => {
    const permissions = {
      ...DEFAULT_RESELLER_PERMISSIONS,
      ...(assignment.permissions || {}),
    }
    permissions[tab] = !permissions[tab]

    const key = `${assignment.id}:${tab}`
    setBusyKey(key)
    setError(null)
    try {
      await updateResellerPermissions(assignment.id, permissions)
      setAssignments((prev) =>
        prev.map((item) => (item.id === assignment.id ? { ...item, permissions } : item))
      )
    } catch (updateError) {
      setError(updateError?.message || 'Could not update reseller access.')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Eye size={15} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
        <p className="label-mono">Reseller access</p>
      </div>
      <p className="mt-1 text-sm text-dash-secondary">
        Your reseller always sees this store's analytics, rates, and payout status.
        You control the rest.
      </p>
      <div className="mt-4 space-y-3">
        {assignments.map((assignment) => {
          const permissions = { ...DEFAULT_RESELLER_PERMISSIONS, ...(assignment.permissions || {}) }
          return (
            <div key={assignment.id} className="flex flex-wrap items-center gap-3">
              <span className="min-w-[120px] text-sm font-semibold text-dash-cream">
                {resellerName(assignment)}
              </span>
              <div className="flex flex-wrap gap-2">
                {RESELLER_TOGGLEABLE_TABS.map((tab) => {
                  const enabled = Boolean(permissions[tab])
                  const isBusy = busyKey === `${assignment.id}:${tab}`
                  return (
                    <button
                      key={tab}
                      type="button"
                      disabled={isBusy}
                      aria-pressed={enabled}
                      onClick={() => void toggle(assignment, tab)}
                      className={[
                        'flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-50',
                        enabled
                          ? 'border-shell-accent/60 bg-shell-accent/10 text-shell-accent'
                          : 'border-dash-border text-dash-tertiary hover:text-dash-secondary',
                      ].join(' ')}
                    >
                      {enabled && <Check size={11} strokeWidth={3} aria-hidden="true" />}
                      {TAB_LABELS[tab]}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {error && <p className="mt-3 text-xs text-dash-danger">{error}</p>}
    </section>
  )
}

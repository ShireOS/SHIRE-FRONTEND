import { useEffect, useState } from 'react'
import { Percent } from 'lucide-react'
import { useAuth } from '../../auth'
import {
  PRICING_MODES,
  formatRate,
  fetchPendingRateRequests,
  resolveRateChangeRequest,
} from '../data/ratePlans'

/**
 * Shown on a store's Home for its owner: pending reseller rate raises with
 * approve / decline actions. Renders nothing when there is nothing to decide.
 */
export default function RateApprovalBanner({ restaurant }) {
  const auth = useAuth()
  const [requests, setRequests] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const isOwner = restaurant?.owner_id && restaurant.owner_id === auth.user?.id

  useEffect(() => {
    if (!restaurant?.id || !isOwner) return
    let cancelled = false
    fetchPendingRateRequests([restaurant.id])
      .then((pending) => {
        if (!cancelled) setRequests(pending)
      })
      .catch(() => {
        // Table may not exist yet (migration not run); stay silent on Home.
      })
    return () => {
      cancelled = true
    }
  }, [restaurant?.id, isOwner])

  if (!isOwner || requests.length === 0) return null

  const resolve = async (request, status) => {
    setBusyId(request.id)
    setError(null)
    try {
      await resolveRateChangeRequest(request, status, auth.user.id)
      setRequests((prev) => prev.filter((item) => item.id !== request.id))
    } catch (resolveError) {
      setError(resolveError?.message || 'Could not update the request.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-lg border border-dash-warning/40 bg-dash-warning/10 p-4">
      {requests.map((request) => {
        const proposed = request.proposed_changes || {}
        const modeLabel = PRICING_MODES.find((mode) => mode.value === proposed.pricing_mode)?.label
        return (
          <div key={request.id} className="flex flex-wrap items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dash-warning/20 text-dash-warning">
              <Percent size={15} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-dash-cream">
                Your reseller proposed raising the card rate
                {' '}from <span className="font-mono tabular-nums">{formatRate(request.current_rate)}</span>
                {' '}to <span className="font-mono tabular-nums">{formatRate(request.proposed_rate)}</span>
              </p>
              <p className="mt-0.5 text-xs text-dash-secondary">
                {modeLabel ? `${modeLabel} · ` : ''}
                Nothing changes until you approve.
                {request.message ? ` — “${request.message}”` : ''}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busyId === request.id}
                onClick={() => void resolve(request, 'approved')}
                className="h-9 rounded-xl bg-shell-cta px-4 text-sm font-medium text-shell-cta-text transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busyId === request.id}
                onClick={() => void resolve(request, 'declined')}
                className="h-9 rounded-full border border-dash-border px-4 text-sm font-medium text-dash-secondary transition hover:border-dash-danger hover:text-dash-danger active:scale-[0.98] disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        )
      })}
      {error && <p className="mt-2 text-xs text-dash-danger">{error}</p>}
    </section>
  )
}

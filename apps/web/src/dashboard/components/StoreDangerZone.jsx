import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { backOfficeApi } from '../../shared/api/backOfficeApi'
import { queryClient, queryKeys } from '../../shared/query'

const READINESS_STALE_TIME_MS = 30_000
const DELETION_RECONCILE_ATTEMPTS = 20
const DELETION_RECONCILE_DELAY_MS = 750
const DELETION_BACKGROUND_RECONCILE_MS = 5_000
const DELETION_TRACKING_PREFIX = 'shire:pending-store-deletion:'

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function errorMessage(error, fallback) {
  if (!(error instanceof Error)) return fallback
  try {
    const detail = JSON.parse(error.message)
    return detail?.message || detail?.detail?.message || fallback
  } catch {
    return error.message || fallback
  }
}

function readPendingDeletion(key) {
  if (!key) return null
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) || 'null')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

function writePendingDeletion(key, value) {
  if (!key) return
  if (value) window.sessionStorage.setItem(key, JSON.stringify(value))
  else window.sessionStorage.removeItem(key)
}

export default function StoreDangerZone({ restaurant, restaurantId, auth }) {
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [resetStatus, setResetStatus] = useState('')
  const [pendingDeletion, setPendingDeletion] = useState(null)
  const [reconciling, setReconciling] = useState(false)
  const [reconciliationMessage, setReconciliationMessage] = useState('')
  const idempotencyKeyRef = useRef('')
  const pendingDeletionRef = useRef(null)
  const activeRestaurantRef = useRef(restaurantId)
  activeRestaurantRef.current = restaurantId

  const deletionTrackingKey = useMemo(
    () => auth?.user?.id && restaurantId
      ? `${DELETION_TRACKING_PREFIX}${auth.user.id}:${restaurantId}`
      : '',
    [auth?.user?.id, restaurantId],
  )

  useEffect(() => {
    const stored = readPendingDeletion(deletionTrackingKey)
    // A reload means an in-memory request can no longer still be running. Its
    // persisted key must therefore be reconciled as an ambiguous response.
    const tracked = stored ? { ...stored, phase: 'ambiguous' } : null
    pendingDeletionRef.current = tracked
    setPendingDeletion(tracked)
    writePendingDeletion(deletionTrackingKey, tracked)
    idempotencyKeyRef.current = tracked?.idempotency_key || ''
    setReconciliationMessage(tracked
      ? 'The deletion response is still being reconciled with the server.'
      : '')
  }, [deletionTrackingKey])

  const commitPendingDeletion = useCallback((next) => {
    pendingDeletionRef.current = next
    setPendingDeletion(next)
    writePendingDeletion(deletionTrackingKey, next)
  }, [deletionTrackingKey])

  const clearPendingDeletion = useCallback(() => {
    commitPendingDeletion(null)
    idempotencyKeyRef.current = ''
  }, [commitPendingDeletion])

  const isPrimaryOwner = Boolean(auth?.user?.id && restaurant?.owner_id === auth.user.id)
  const exactNameMatches = restaurantName === (restaurant?.name || '')
  const readinessQuery = useQuery({
    queryKey: queryKeys.deletionReadiness(restaurantId || ''),
    queryFn: () => backOfficeApi.deletionReadiness(restaurantId),
    enabled: Boolean(restaurantId && isPrimaryOwner),
    staleTime: READINESS_STALE_TIME_MS,
  })
  const readiness = readinessQuery.data ?? null
  const loading = readinessQuery.isPending
  const loadError = readinessQuery.error
    ? errorMessage(readinessQuery.error, 'Could not check whether this store is ready for deletion.')
    : ''

  const closeModal = () => {
    if (submitting) return
    setModalOpen(false)
    setRestaurantName('')
    setPassword('')
    setSubmitError('')
    if (!pendingDeletionRef.current) idempotencyKeyRef.current = ''
  }

  const sendPasswordSetup = async () => {
    if (!auth?.user?.email) return
    setResetStatus('sending')
    const result = await auth.resetPassword(auth.user.email)
    setResetStatus(result.success ? 'sent' : result.error || 'error')
  }

  const leaveStore = useCallback((notice) => {
    if (activeRestaurantRef.current !== restaurantId) return
    clearPendingDeletion()
    setPassword('')
    setModalOpen(false)
    queryClient.clear()
    navigate(auth.accountType === 'reseller' ? '/reseller/profile' : '/enterprise/settings', {
      replace: true,
      state: { lifecycleNotice: notice },
    })
    void auth.refreshRestaurants().catch(() => undefined)
  }, [auth, clearPendingDeletion, navigate, restaurantId])

  const reconcileDeletion = useCallback(async (attempts = DELETION_RECONCILE_ATTEMPTS) => {
    let current = null
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        current = await backOfficeApi.deletionReadiness(restaurantId)
      } catch {
        // A transport failure is not an authoritative lifecycle state. Keep
        // the persisted request alive and retry instead of treating it as a
        // failed deletion.
      }
      if (current && current.lifecycle_state !== 'suspending') return current
      if (attempt + 1 < attempts) await wait(DELETION_RECONCILE_DELAY_MS)
    }
    return current
  }, [restaurantId])

  const applyReconciledState = useCallback((current, fallbackMessage = '') => {
    if (activeRestaurantRef.current !== restaurantId) return false
    if (current?.lifecycle_state
        && !['active', 'suspending'].includes(current.lifecycle_state)) {
      leaveStore(`${restaurant.name} is being archived. It remains recoverable for 30 days.`)
      return true
    }
    if (current) {
      queryClient.setQueryData(queryKeys.deletionReadiness(restaurantId), current)
    }
    if (current?.lifecycle_state === 'active') {
      clearPendingDeletion()
      setReconciliationMessage('The server confirmed this store is still active. Review readiness before trying again.')
      setSubmitError(current.blockers?.length
        ? 'Store activity changed during the final safety check. Resolve the blockers, then try again.'
        : fallbackMessage)
      return false
    }
    setReconciliationMessage(current?.lifecycle_state === 'suspending'
      ? 'The final deletion safety check is still resolving. This page will leave the store only after the server confirms a non-active state.'
      : 'The server could not be reached to confirm the deletion state. Reconciliation will keep retrying safely.')
    setSubmitError(current?.lifecycle_state === 'suspending'
      ? 'The deletion safety check is still resolving. Select Check again shortly.'
      : fallbackMessage)
    return false
  }, [clearPendingDeletion, leaveStore, restaurant.name, restaurantId])

  useEffect(() => {
    if (!pendingDeletion
        || pendingDeletion.restaurant_id !== restaurantId
        || pendingDeletion.phase === 'requesting') return undefined
    let cancelled = false
    let timer = null
    const check = async () => {
      const current = await reconcileDeletion(1)
      if (cancelled || activeRestaurantRef.current !== restaurantId) return
      if (!applyReconciledState(current)) {
        timer = window.setTimeout(check, DELETION_BACKGROUND_RECONCILE_MS)
      }
    }
    void check()
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [applyReconciledState, pendingDeletion, reconcileDeletion, restaurantId])

  const checkAgain = async () => {
    if (reconciling) return
    setReconciling(true)
    try {
      const current = await reconcileDeletion(3)
      applyReconciledState(current, 'The store remains active. Review readiness before trying again.')
    } finally {
      if (activeRestaurantRef.current === restaurantId) setReconciling(false)
    }
  }

  const deleteStore = async (event) => {
    event.preventDefault()
    if (submitting || !exactNameMatches || !password || !readiness?.ready) return
    setSubmitting(true)
    setSubmitError('')
    setReconciliationMessage('')
    const requestKey = idempotencyKeyRef.current || (idempotencyKeyRef.current = crypto.randomUUID())
    commitPendingDeletion({
      restaurant_id: restaurantId,
      restaurant_name: restaurant.name,
      idempotency_key: requestKey,
      started_at: new Date().toISOString(),
      phase: 'requesting',
    })
    try {
      const result = await backOfficeApi.deleteRestaurant(
        restaurantId,
        { restaurant_name: restaurantName, password },
        requestKey,
      )
      if (result.state && !['active', 'suspending'].includes(result.state)) {
        leaveStore(`${restaurant.name} is ${result.state === 'recoverable' ? 'archived' : 'being archived'}. It remains recoverable for 30 days.`)
        return
      }
      commitPendingDeletion({
        ...pendingDeletionRef.current,
        phase: 'ambiguous',
      })
      const currentReadiness = await reconcileDeletion()
      applyReconciledState(
        currentReadiness,
        'The deletion response did not confirm a non-active state. Review readiness before trying again.',
      )
    } catch (error) {
      setPassword('')
      commitPendingDeletion({
        ...pendingDeletionRef.current,
        restaurant_id: restaurantId,
        restaurant_name: restaurant.name,
        idempotency_key: requestKey,
        phase: 'ambiguous',
      })
      // The mutation can finish on the server after a proxy/network response
      // fails. Reconcile authoritative lifecycle state before calling it a
      // readiness failure or leaving the user inside a non-operational store.
      const currentReadiness = await reconcileDeletion()
      applyReconciledState(
        currentReadiness,
        errorMessage(error, 'The store was not deleted. Check the password and readiness, then try again.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!isPrimaryOwner) return null

  return (
    <section className="rounded-2xl border border-red-400/35 bg-red-500/[0.06] p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-red-400/10 p-2 text-red-300">
          <AlertTriangle size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-mono !text-red-300">Danger Zone</p>
          <h2 className="mt-1 text-xl font-semibold text-dash-cream">Delete this store</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-dash-secondary">
            The store becomes unavailable immediately. You can recover it from Account Settings for exactly 30 days.
            Financial, tax, payroll, time-clock, payment, gift-card, and audit records may be retained after that window
            as restricted records. Restored POS devices must be paired again.
          </p>
          <p className="mt-2 text-sm text-amber-200">
            AI phone numbers and agents are retained during recovery, so Twilio or Vapi charges may continue.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-black/15 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-dash-cream">Deletion readiness</h3>
          <button type="button" onClick={() => void checkAgain()} disabled={readinessQuery.isFetching || reconciling} className="inline-flex items-center gap-1.5 text-xs font-semibold text-dash-secondary hover:text-dash-cream disabled:opacity-50">
            <RefreshCw size={13} className={readinessQuery.isFetching || reconciling ? 'animate-spin' : ''} aria-hidden="true" />
            Check again
          </button>
        </div>
        {reconciliationMessage && <p className="mt-2 text-sm text-amber-200" role="status">{reconciliationMessage}</p>}
        {loading && <p className="mt-2 text-sm text-dash-secondary">Checking POS, payment, staff, and device activity…</p>}
        {loadError && <p className="mt-2 text-sm text-red-200">{loadError}</p>}
        {!loading && readiness?.ready && <p className="mt-2 text-sm text-emerald-300">Ready. A final POS-owned check runs after the store is quiesced.</p>}
        {!loading && readiness?.blockers?.length > 0 && (
          <ul className="mt-3 space-y-2">
            {readiness.blockers.map((blocker) => (
              <li key={blocker.code} className="flex items-start justify-between gap-3 text-sm text-red-200">
                <span>{blocker.message}{Number.isFinite(blocker.count) ? ` (${blocker.count})` : ''}</span>
                {blocker.resolution_url && (
                  <Link to={blocker.resolution_url} className="inline-flex shrink-0 items-center gap-1 font-semibold text-dash-cream hover:underline">
                    Resolve <ExternalLink size={11} aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {readiness?.warnings?.map((warning) => <p key={warning} className="mt-2 text-xs text-amber-200">{warning}</p>)}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={Boolean(pendingDeletion)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-red-500 px-4 text-sm font-semibold text-white transition hover:bg-red-400"
        >
          <Trash2 size={15} aria-hidden="true" /> Delete store
        </button>
        <button type="button" onClick={() => void sendPasswordSetup()} disabled={resetStatus === 'sending'} className="text-xs font-semibold text-dash-secondary hover:text-dash-cream disabled:opacity-50">
          {resetStatus === 'sending' ? 'Sending…' : 'Set up or reset account password'}
        </button>
        {resetStatus === 'sent' && <span className="text-xs text-emerald-300">Password setup email sent.</span>}
        {resetStatus && !['sending', 'sent'].includes(resetStatus) && <span className="text-xs text-red-200">{resetStatus}</span>}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-store-title">
          <form onSubmit={deleteStore} className="w-full max-w-lg rounded-2xl border border-red-400/30 bg-dash-base p-6 shadow-2xl">
            <p className="label-mono !text-red-300">Permanent action after 30 days</p>
            <h2 id="delete-store-title" className="mt-1 text-2xl font-semibold text-dash-cream">Delete {restaurant.name}</h2>
            <p className="mt-2 text-sm leading-6 text-dash-secondary">
              Enter the exact, case-sensitive store name and your primary owner account password. The password is verified by Supabase Auth and is never stored.
            </p>
            {loading && <p className="mt-3 text-sm text-amber-200" role="status">Finishing the store safety check… You can fill this out while it runs.</p>}
            {!loading && loadError && <p className="mt-3 text-sm text-red-200">The safety check could not finish. Close this dialog and select Check again.</p>}
            {!loading && !loadError && !readiness?.ready && <p className="mt-3 text-sm text-red-200">Resolve the readiness blockers shown behind this dialog before deletion.</p>}
            <label className="mt-5 block text-xs font-semibold text-dash-secondary">
              Store name
              <input autoFocus value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} disabled={submitting} autoComplete="off" className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-dash-cream outline-none focus:border-red-300" />
            </label>
            {restaurantName && !exactNameMatches && <p className="mt-1 text-xs text-red-200">The name must match “{restaurant.name}” exactly.</p>}
            <label className="mt-4 block text-xs font-semibold text-dash-secondary">
              Account password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} autoComplete="current-password" className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-dash-cream outline-none focus:border-red-300" />
            </label>
            {submitError && <p className="mt-3 text-sm text-red-200" role="alert">{submitError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeModal} disabled={submitting} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-dash-secondary hover:text-dash-cream disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={submitting || !exactNameMatches || !password || !readiness?.ready} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40">
                {submitting ? 'Quiescing store…' : 'Delete store'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

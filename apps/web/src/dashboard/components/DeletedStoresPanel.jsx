import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArchiveRestore, ExternalLink, KeyRound, RefreshCw } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth'
import { backOfficeApi } from '../../shared/api/backOfficeApi'
import { queryClient } from '../../shared/query'

const countdownFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' })

function recoveryCountdown(deadline, now) {
  const milliseconds = new Date(deadline).getTime() - now
  if (milliseconds <= 0) return 'Recovery window ended'
  const minutes = Math.ceil(milliseconds / 60_000)
  if (minutes < 60) return countdownFormatter.format(minutes, 'minute')
  const hours = Math.ceil(milliseconds / 3_600_000)
  if (hours < 48) return countdownFormatter.format(hours, 'hour')
  return countdownFormatter.format(Math.ceil(milliseconds / 86_400_000), 'day')
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

export function AccountSecurityPanel() {
  const auth = useAuth()
  const [status, setStatus] = useState('')
  const providers = useMemo(() => new Set((auth.user?.identities || []).map((identity) => identity.provider)), [auth.user?.identities])
  const oauthOnly = providers.size > 0 && !providers.has('email')

  const sendPasswordSetup = async () => {
    if (!auth.user?.email) return
    setStatus('sending')
    const result = await auth.resetPassword(auth.user.email)
    setStatus(result.success ? 'sent' : result.error || 'Could not send the password email.')
  }

  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <KeyRound size={15} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
        <p className="label-mono">Account Security</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-dash-secondary">
        Store deletion and recovery require your Supabase account password. {oauthOnly ? 'This account currently signs in through an OAuth provider. Set a password before using either action.' : 'You can set a new password if you do not know the current one.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void sendPasswordSetup()} disabled={status === 'sending'} className="rounded-lg border border-dash-border px-3 py-2 text-xs font-semibold text-dash-secondary transition hover:text-dash-cream disabled:opacity-50">
          {status === 'sending' ? 'Sending…' : 'Email password setup link'}
        </button>
        {status === 'sent' && <span className="text-xs text-dash-success">Password setup email sent.</span>}
        {status && !['sending', 'sent'].includes(status) && <span className="text-xs text-dash-danger">{status}</span>}
      </div>
    </section>
  )
}

export default function DeletedStoresPanel() {
  const auth = useAuth()
  const location = useLocation()
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [password, setPassword] = useState('')
  const [supportReason, setSupportReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [restoreError, setRestoreError] = useState('')
  const [restoring, setRestoring] = useState({})
  const [restored, setRestored] = useState([])
  const restoringRef = useRef(restoring)
  const restoreIdempotencyKeyRef = useRef('')

  useEffect(() => {
    restoringRef.current = restoring
  }, [restoring])

  const refreshRestaurants = auth.refreshRestaurants
  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const rows = await backOfficeApi.deletedRestaurants()
      setStores(rows)
      const currentIds = new Set(rows.map((row) => row.deletion_id))
      const completed = Object.values(restoringRef.current).filter((row) => !currentIds.has(row.deletion_id))
      if (completed.length) {
        setRestored((current) => [...completed, ...current.filter((row) => !completed.some((item) => item.restaurant_id === row.restaurant_id))])
        setRestoring((current) => Object.fromEntries(Object.entries(current).filter(([id]) => currentIds.has(id))))
        queryClient.clear()
        await refreshRestaurants()
      }
    } catch (loadError) {
      setError(errorMessage(loadError, 'Could not load deleted stores.'))
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [refreshRestaurants])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const needsPolling = stores.some((store) => ['archiving', 'restoring'].includes(store.state)) || Object.keys(restoring).length > 0
  useEffect(() => {
    if (!needsPolling) return undefined
    const timer = window.setInterval(() => void load({ quiet: true }), 5_000)
    return () => window.clearInterval(timer)
  }, [load, needsPolling])

  const closeModal = () => {
    if (submitting) return
    setRestoreTarget(null)
    setPassword('')
    setSupportReason('')
    setRestoreError('')
    restoreIdempotencyKeyRef.current = ''
  }

  const restoreStore = async (event) => {
    event.preventDefault()
    if (!restoreTarget || submitting || !password || (auth.accountType === 'admin' && !supportReason.trim())) return
    setSubmitting(true)
    setRestoreError('')
    try {
      await backOfficeApi.restoreDeletedRestaurant(
        restoreTarget.deletion_id,
        { password, support_reason: supportReason.trim() || undefined },
        restoreIdempotencyKeyRef.current
          || (restoreIdempotencyKeyRef.current = crypto.randomUUID()),
      )
      restoreIdempotencyKeyRef.current = ''
      setRestoring((current) => ({ ...current, [restoreTarget.deletion_id]: restoreTarget }))
      setStores((current) => current.map((store) => store.deletion_id === restoreTarget.deletion_id ? { ...store, state: 'restoring' } : store))
      setRestoreTarget(null)
      setPassword('')
      setSupportReason('')
      setRestoreError('')
      void load({ quiet: true })
    } catch (restoreFailure) {
      setPassword('')
      setRestoreError(errorMessage(restoreFailure, 'The store was not restored. Check the password and recovery deadline.'))
    } finally {
      setSubmitting(false)
    }
  }

  const lifecycleNotice = typeof location.state?.lifecycleNotice === 'string' ? location.state.lifecycleNotice : ''

  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ArchiveRestore size={15} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
            <p className="label-mono">Deleted Stores</p>
          </div>
          <p className="mt-2 text-sm text-dash-secondary">Recover quarantined stores before their exact 30-day deadline.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg p-2 text-dash-secondary hover:text-dash-cream disabled:opacity-50" aria-label="Refresh deleted stores">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {lifecycleNotice && <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">{lifecycleNotice}</p>}
      {error && <p className="mt-4 text-sm text-dash-danger">{error}</p>}
      {loading && <p className="mt-4 text-sm text-dash-secondary">Loading deleted stores…</p>}

      {!loading && stores.length === 0 && restored.length === 0 && !error && (
        <p className="mt-4 rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-dash-tertiary">No recoverable stores.</p>
      )}

      <div className="mt-4 space-y-3">
        {restored.map((store) => (
          <div key={`restored-${store.restaurant_id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.06] p-4">
            <div>
              <p className="font-semibold text-dash-cream">{store.name}</p>
              <p className="mt-1 text-xs text-emerald-200">Restoration finished. Devices must be paired again.</p>
            </div>
            <Link to={`/restaurants/${store.restaurant_id}/analytics`} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/30 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/10">
              Open Store <ExternalLink size={12} />
            </Link>
          </div>
        ))}

        {stores.map((store) => {
          const recoverable = new Date(store.recoverable_until).getTime() > now
          return (
            <article key={store.deletion_id} className="rounded-xl border border-white/10 bg-black/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-dash-cream">{store.name}</h3>
                  {auth.accountType === 'admin' && <p className="mt-1 text-xs text-dash-tertiary">Original owner: {store.original_owner_email || store.original_owner_id}</p>}
                  <p className="mt-1 text-xs text-dash-tertiary">Deleted {new Date(store.deleted_at).toLocaleString()}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${store.state === 'recoverable' ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-300/10 text-amber-100'}`}>
                  {store.state === 'archiving' ? 'Archiving' : store.state === 'restoring' ? 'Restoring' : 'Recoverable'}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div><dt className="text-dash-tertiary">Recovery deadline</dt><dd className="mt-0.5 text-dash-cream">{new Date(store.recoverable_until).toLocaleString()}</dd></div>
                <div><dt className="text-dash-tertiary">Countdown</dt><dd className="mt-0.5 font-semibold text-amber-100">{recoveryCountdown(store.recoverable_until, now)}</dd></div>
                <div><dt className="text-dash-tertiary">Asset archive</dt><dd className="mt-0.5 text-dash-cream">{store.archive_status}</dd></div>
                <div><dt className="text-dash-tertiary">Providers</dt><dd className="mt-0.5 text-dash-cream">{Object.keys(store.provider_steps || {}).length ? 'Lifecycle steps recorded' : 'Pending'}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-amber-200">AI phone and other provider charges may continue during recovery.</p>
              <button type="button" onClick={() => { restoreIdempotencyKeyRef.current = ''; setRestoreTarget(store) }} disabled={!recoverable || store.state !== 'recoverable'} className="mt-3 rounded-lg bg-shell-accent px-3 py-2 text-xs font-semibold text-dash-base hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
                {store.state === 'restoring' ? 'Restoring…' : 'Restore'}
              </button>
            </article>
          )
        })}
      </div>

      {restoreTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="restore-store-title">
          <form onSubmit={restoreStore} className="w-full max-w-lg rounded-2xl border border-white/15 bg-dash-base p-6 shadow-2xl">
            <p className="label-mono">Recover store</p>
            <h2 id="restore-store-title" className="mt-1 text-2xl font-semibold text-dash-cream">Restore {restoreTarget.name}</h2>
            <p className="mt-2 text-sm leading-6 text-dash-secondary">Your password is verified by Supabase Auth and is never stored. Restored devices still require fresh pairing.</p>
            <label className="mt-5 block text-xs font-semibold text-dash-secondary">
              Account password
              <input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={submitting} className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-dash-cream outline-none focus:border-shell-accent" />
            </label>
            {auth.accountType === 'admin' && (
              <label className="mt-4 block text-xs font-semibold text-dash-secondary">
                Support reason (required for administrators)
                <textarea value={supportReason} onChange={(event) => setSupportReason(event.target.value)} disabled={submitting} rows={3} className="mt-1.5 w-full resize-none rounded-lg border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-dash-cream outline-none focus:border-shell-accent" />
              </label>
            )}
            {restoreError && <p className="mt-3 text-sm text-dash-danger" role="alert">{restoreError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeModal} disabled={submitting} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-dash-secondary hover:text-dash-cream disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={submitting || !password || (auth.accountType === 'admin' && !supportReason.trim())} className="rounded-lg bg-shell-accent px-4 py-2 text-sm font-semibold text-dash-base hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
                {submitting ? 'Starting restoration…' : 'Restore store'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

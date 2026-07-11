import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../auth'
import { backOfficeApi } from '../../shared/api/backOfficeApi'

// Back-office member invite landing page: /invite?token=...
// Supabase invite emails usually land the user here already signed in; the
// signed-out case survives the login/signup round-trip via localStorage (the
// same trick ClaimStorePage uses — reopening /invite without a ?token falls
// back to the stored one).
const PENDING_INVITE_STORAGE_KEY = 'shire_pending_bo_invite_token'

export default function AcceptInvitePage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlToken = searchParams.get('token')
  const [storedToken] = useState(() => {
    try {
      return localStorage.getItem(PENDING_INVITE_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const token = urlToken || storedToken

  const [phase, setPhase] = useState('idle') // idle | accepting | done | error
  const [result, setResult] = useState(null) // { member, restaurant }
  const [error, setError] = useState(null)
  const attempted = useRef(false)

  useEffect(() => {
    if (!urlToken) return
    try {
      localStorage.setItem(PENDING_INVITE_STORAGE_KEY, urlToken)
    } catch {
      /* private mode — the URL itself still carries the token */
    }
  }, [urlToken])

  useEffect(() => {
    if (!token || auth.isLoading || !auth.isAuthenticated || attempted.current) return
    attempted.current = true
    setPhase('accepting')
    backOfficeApi
      .acceptInvite(token)
      .then(async (response) => {
        try {
          localStorage.removeItem(PENDING_INVITE_STORAGE_KEY)
        } catch {
          /* ignore */
        }
        // Best effort: make the new restaurant show up without a hard reload.
        try {
          await auth.refreshRestaurants?.(response?.restaurant?.id)
        } catch {
          /* the dashboard route will load it on navigation */
        }
        setResult(response)
        setPhase('done')
      })
      .catch((acceptError) => {
        setError(acceptError?.message || 'This invite could not be accepted.')
        setPhase('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, auth.isLoading, auth.isAuthenticated])

  const nextParam = token ? encodeURIComponent(`/invite?token=${token}`) : ''
  const restaurantName = result?.restaurant?.name || 'this restaurant'

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-dash-base px-4 py-10 text-dash-cream">
      <div className="w-full max-w-lg">
        <p className="font-display text-2xl tracking-tight">SHIRE</p>

        <section className="glass-card mt-4 rounded-2xl p-6">
          {!token && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Invite link is incomplete</h1>
              <p className="mt-2 text-sm leading-6 text-dash-secondary">
                This link is missing its invite token. Open the link from your invitation email again,
                or ask the restaurant owner to send a fresh one.
              </p>
            </>
          )}

          {token && auth.isLoading && (
            <div className="flex justify-center py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-dash-border border-t-shell-accent" />
            </div>
          )}

          {token && !auth.isLoading && !auth.isAuthenticated && (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-shell-accent/10 text-shell-accent">
                <KeyRound size={20} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">You&rsquo;ve been invited</h1>
              <p className="mt-2 text-sm leading-6 text-dash-secondary">
                Sign in with the email this invite was sent to — then you&rsquo;ll come right back here to
                accept it.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <Link
                  to={`/auth/login?next=${nextParam}`}
                  className="w-full rounded-xl bg-shell-cta py-3 text-center text-sm font-semibold text-shell-cta-text transition hover:opacity-90"
                >
                  Sign in to accept
                </Link>
                <Link
                  to={`/auth/signup?next=${nextParam}`}
                  className="w-full rounded-xl border border-dash-border py-3 text-center text-sm font-semibold text-dash-secondary transition hover:text-dash-cream"
                >
                  Create an account
                </Link>
                <p className="text-center text-xs text-dash-tertiary">
                  If you aren&rsquo;t redirected after signing in, open your invite link again.
                </p>
              </div>
            </>
          )}

          {token && auth.isAuthenticated && (phase === 'idle' || phase === 'accepting') && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-dash-border border-t-shell-accent" />
              <p className="text-sm text-dash-secondary">Accepting your invite…</p>
            </div>
          )}

          {phase === 'done' && (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-shell-accent/10 text-shell-accent">
                <ShieldCheck size={20} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">
                You now have access to {restaurantName}
              </h1>
              <p className="mt-2 text-sm leading-6 text-dash-secondary">
                Your permissions were set by whoever invited you — the dashboard only shows what you can
                use.
              </p>
              <button
                type="button"
                onClick={() =>
                  result?.restaurant?.id
                    ? navigate(`/restaurants/${result.restaurant.id}/analytics`)
                    : navigate('/')
                }
                className="mt-5 w-full rounded-xl bg-shell-cta py-3 text-sm font-semibold text-shell-cta-text transition hover:opacity-90"
              >
                Open the dashboard
              </button>
            </>
          )}

          {phase === 'error' && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">This invite can&rsquo;t be accepted</h1>
              <p className="mt-2 text-sm leading-6 text-dash-secondary">{error}</p>
              <p className="mt-3 text-xs leading-5 text-dash-tertiary">
                Invites expire, can be revoked, and only work for the email address they were sent to.
                Ask the restaurant owner to send a fresh invite if you still need access.
              </p>
              <Link
                to="/"
                className="mt-5 block w-full rounded-xl border border-dash-border py-3 text-center text-sm font-semibold text-dash-secondary transition hover:text-dash-cream"
              >
                Go to my dashboard
              </Link>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../auth'
import { backOfficeApi } from '../../shared/api/backOfficeApi'
import { clearStoredInviteToken, inviteDestination } from './inviteDestination'
import { inviteAuthRoutes, PENDING_INVITE_STORAGE_KEY } from '../../auth/inviteFlow'

export { PENDING_INVITE_STORAGE_KEY } from '../../auth/inviteFlow'

const KIND_COPY = {
  restaurant_member: {
    title: 'Restaurant access',
    detail: (invite) => `Join ${invite.restaurant_name || 'this restaurant'} as ${invite.role === 'owner' ? 'an owner' : invite.role === 'manager' ? 'a manager' : 'staff'}.`,
  },
  reseller_connection: {
    title: 'Restaurant connection',
    detail: (invite) => `Connect your reseller account to ${invite.restaurant_name || 'this restaurant'}.`,
  },
  reseller_employee: {
    title: 'Reseller team access',
    detail: (invite) => `Join ${invite.reseller_name || 'this reseller organization'}.`,
  },
  platform_account: {
    title: 'SHIRE account access',
    detail: (invite) => `Join SHIRE as ${String(invite.account_type || 'a user').replace(/_/g, ' ')}.`,
  },
}

export default function AcceptInvitePage() {
  const auth = useAuth()
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
  const [invite, setInvite] = useState(undefined)
  const [phase, setPhase] = useState('preview')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [switchingAccount, setSwitchingAccount] = useState(false)
  const attempted = useRef(false)

  useEffect(() => {
    if (!urlToken) return
    try {
      localStorage.setItem(PENDING_INVITE_STORAGE_KEY, urlToken)
    } catch {
      // The URL remains the fallback in private browsing modes.
    }
  }, [urlToken])

  useEffect(() => {
    if (!token) {
      setInvite(null)
      return
    }
    backOfficeApi.previewInvite(token)
      .then((preview) => {
        if (preview?.status !== 'pending') {
          try {
            clearStoredInviteToken(localStorage, token)
          } catch {
            // The page can still explain the terminal invitation state.
          }
        }
        setInvite(preview)
      })
      .catch((previewError) => {
        try {
          if (localStorage.getItem(PENDING_INVITE_STORAGE_KEY) === token) {
            localStorage.removeItem(PENDING_INVITE_STORAGE_KEY)
          }
        } catch {
          // The URL remains available to explain the failed invitation.
        }
        setInvite(null)
        setError(previewError?.message || 'This invitation could not be loaded.')
      })
  }, [token])

  useEffect(() => {
    if (!token || !invite || invite.status !== 'pending' || auth.isLoading || !auth.isAuthenticated || attempted.current) return
    attempted.current = true
    setPhase('accepting')
    backOfficeApi.acceptInvite(token)
      .then(async (response) => {
        try {
          localStorage.removeItem(PENDING_INVITE_STORAGE_KEY)
        } catch {
          // Ignore unavailable storage after a successful server transaction.
        }
        try {
          await auth.refreshRestaurants?.(response?.restaurant?.id)
        } catch {
          // The hard navigation below refreshes account and restaurant context.
        }
        setResult(response)
        setPhase('done')
      })
      .catch((acceptError) => {
        setError(acceptError?.message || 'This invitation could not be accepted.')
        setPhase('error')
      })
  }, [token, invite, auth.isLoading, auth.isAuthenticated, auth])

  const authRoutes = token && invite?.email ? inviteAuthRoutes(token, invite.email) : null
  const inviteCopy = invite ? KIND_COPY[invite.kind] || KIND_COPY.platform_account : null
  const wrongAccount = phase === 'error'
    && String(error || '').toLowerCase().includes('different email address')

  const continueWithInvitedAccount = async (destination) => {
    if (!destination || switchingAccount) return
    setSwitchingAccount(true)
    try {
      await auth.signOut()
      window.location.assign(destination)
    } catch (signOutError) {
      setError(signOutError?.message || 'Could not switch accounts. Please try again.')
      setSwitchingAccount(false)
    }
  }

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-dash-base px-4 py-10 text-dash-cream">
      <div className="w-full max-w-lg">
        <p className="font-display text-2xl tracking-tight">SHIRE</p>
        <section className="glass-card mt-4 rounded-2xl p-6">
          {invite === undefined && (
            <div className="flex justify-center py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-dash-border border-t-shell-accent" />
            </div>
          )}

          {invite === null && (
            <>
              <h1 className="text-2xl font-semibold">Invitation unavailable</h1>
              <p className="mt-2 text-sm leading-6 text-dash-secondary">
                {error || 'This link is incomplete. Ask the sender for a fresh invitation.'}
              </p>
            </>
          )}

          {invite && invite.status !== 'pending' && (
            <>
              <h1 className="text-2xl font-semibold">Invitation no longer active</h1>
              <p className="mt-2 text-sm text-dash-secondary">
                This invitation is {invite.status}. Ask the sender for a fresh one if you still need access.
              </p>
              {invite.status === 'accepted' && auth.isAuthenticated && (
                <button
                  type="button"
                  onClick={() => window.location.assign(inviteDestination({
                    kind: invite.kind,
                    restaurant: invite.restaurant_id ? { id: invite.restaurant_id } : null,
                  }, auth.accountType))}
                  className="mt-5 w-full rounded-xl bg-shell-cta py-3 text-sm font-semibold text-shell-cta-text"
                >
                  Continue
                </button>
              )}
            </>
          )}

          {invite && invite.status === 'pending' && !auth.isLoading && !auth.isAuthenticated && (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-shell-accent/10 text-shell-accent">
                <KeyRound size={20} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <p className="label-mono mt-4">{inviteCopy.title}</p>
              <h1 className="mt-1 text-2xl font-semibold">You&rsquo;ve been invited</h1>
              <p className="mt-2 text-sm leading-6 text-dash-secondary">{inviteCopy.detail(invite)}</p>
              <p className="mt-2 text-xs text-dash-tertiary">Continue as {invite.email}.</p>
              <div className="mt-5 flex flex-col gap-2">
                <Link to={authRoutes.login} className="w-full rounded-xl bg-shell-cta py-3 text-center text-sm font-semibold text-shell-cta-text">
                  Sign in to accept
                </Link>
                <Link to={authRoutes.signup} className="w-full rounded-xl border border-dash-border py-3 text-center text-sm font-semibold text-dash-secondary">
                  Create an account
                </Link>
              </div>
            </>
          )}

          {invite && invite.status === 'pending' && auth.isLoading && (
            <div className="flex justify-center py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-dash-border border-t-shell-accent" />
            </div>
          )}

          {invite && invite.status === 'pending' && auth.isAuthenticated && phase !== 'done' && phase !== 'error' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-dash-border border-t-shell-accent" />
              <p className="text-sm text-dash-secondary">Accepting your invitation…</p>
            </div>
          )}

          {phase === 'done' && (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-shell-accent/10 text-shell-accent">
                <ShieldCheck size={20} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <h1 className="mt-4 text-2xl font-semibold">Access connected</h1>
              <p className="mt-2 text-sm leading-6 text-dash-secondary">Your account now has the access described in this invitation.</p>
              <button type="button" onClick={() => window.location.assign(inviteDestination(result, auth.accountType))} className="mt-5 w-full rounded-xl bg-shell-cta py-3 text-sm font-semibold text-shell-cta-text">
                Continue
              </button>
            </>
          )}

          {phase === 'error' && (
            <>
              <h1 className="text-2xl font-semibold">Invitation could not be accepted</h1>
              <p className="mt-2 text-sm leading-6 text-dash-secondary">{error}</p>
              <p className="mt-3 text-xs text-dash-tertiary">
                {wrongAccount
                  ? `This link belongs to ${invite?.email}. Choose whether that email already has a SHIRE account.`
                  : `Sign in with ${invite?.email}, or ask the sender for a fresh invitation.`}
              </p>
              {wrongAccount && authRoutes ? (
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={switchingAccount}
                    onClick={() => void continueWithInvitedAccount(authRoutes.login)}
                    className="w-full rounded-xl bg-shell-cta py-2.5 text-sm font-semibold text-shell-cta-text disabled:opacity-50"
                  >
                    Sign in as {invite.email}
                  </button>
                  <button
                    type="button"
                    disabled={switchingAccount}
                    onClick={() => void continueWithInvitedAccount(authRoutes.signup)}
                    className="w-full rounded-xl border border-dash-border py-2.5 text-sm font-semibold text-dash-secondary disabled:opacity-50"
                  >
                    Create account for {invite.email}
                  </button>
                </div>
              ) : (
                <button type="button" disabled={switchingAccount} onClick={() => void auth.signOut()} className="mt-4 w-full rounded-xl border border-dash-border py-2.5 text-sm font-semibold text-dash-secondary disabled:opacity-50">
                  Sign out and use the invited email
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}

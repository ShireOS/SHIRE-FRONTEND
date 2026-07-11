import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, Store } from 'lucide-react'
import { useAuth } from '../../auth'
import { fetchInviteByToken, claimStore, PENDING_CLAIM_STORAGE_KEY } from '../data/boarding'

/**
 * Public claim page. The hero is the restaurant and what happens next; the
 * commercial terms are present but collapsed — honest, not in your face.
 */
export default function ClaimStorePage() {
  const { token } = useParams()
  const auth = useAuth()
  const navigate = useNavigate()
  const [invite, setInvite] = useState(undefined) // undefined = loading, null = not found
  const [termsOpen, setTermsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) return
    // Survive the signup/login round-trip: OwnerGate redirects back here.
    localStorage.setItem(PENDING_CLAIM_STORAGE_KEY, token)
    fetchInviteByToken(token)
      .then(setInvite)
      .catch(() => setInvite(null))
  }, [token])

  const summary = invite?.summary || {}
  const usable = invite && invite.status === 'pending' && new Date(invite.expires_at) > new Date()

  const accept = async () => {
    setBusy(true)
    setError(null)
    try {
      const restaurantId = await claimStore(token)
      localStorage.removeItem(PENDING_CLAIM_STORAGE_KEY)
      await auth.refreshRestaurants(restaurantId)
      navigate('/onboarding')
    } catch (claimError) {
      setError(claimError?.message || 'Could not claim this store.')
    } finally {
      setBusy(false)
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
              <h1 className="text-2xl font-semibold tracking-tight">Invite not found</h1>
              <p className="mt-2 text-sm text-dash-secondary">
                This claim link is invalid. Ask your reseller to send a fresh one.
              </p>
            </>
          )}

          {invite && !usable && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Invite no longer active</h1>
              <p className="mt-2 text-sm text-dash-secondary">
                This link was {invite.status === 'accepted' ? 'already used' : invite.status === 'revoked' ? 'revoked' : 'expired'}.
                Ask your reseller for a new one.
              </p>
            </>
          )}

          {usable && (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-shell-accent/10 text-shell-accent">
                <Store size={20} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">
                {summary.restaurant_name || invite.restaurant_name || 'Your restaurant'} is ready
              </h1>
              <p className="mt-2 text-sm leading-6 text-dash-secondary">
                Your reseller set up this workspace for you.
                {invite.kind === 'draft'
                  ? ' Review what’s below, take ownership, and finish the remaining onboarding steps — nothing you see here needs re-entering.'
                  : ' Accept to create your store and continue with onboarding.'}
              </p>

              <dl className="mt-4 space-y-1.5 text-sm">
                {[
                  ['Restaurant', summary.restaurant_name || invite.restaurant_name],
                  ['Legal name', summary.legal_business_name],
                  ['Location', [summary.city, summary.state].filter(Boolean).join(', ')],
                ].filter(([, value]) => value).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-dash-tertiary">{label}</dt>
                    <dd className="font-medium text-dash-cream">{value}</dd>
                  </div>
                ))}
              </dl>

              <button
                type="button"
                onClick={() => setTermsOpen((open) => !open)}
                aria-expanded={termsOpen}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary"
              >
                <ChevronDown
                  size={13}
                  strokeWidth={1.75}
                  className={`transition-transform ${termsOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
                Pricing & payout terms
              </button>
              {termsOpen && (
                <dl className="mt-2 space-y-1.5 rounded-xl border border-dash-border bg-[var(--glass-bg)] p-3 text-sm">
                  {[
                    ['Card pricing', summary.rate_summary],
                    ['Payout schedule', summary.payout_schedule],
                    ['Applies to', summary.rate_plan?.applies_to?.join(', ')],
                  ].filter(([, value]) => value).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-dash-tertiary">{label}</dt>
                      <dd className="font-medium text-dash-cream">{value}</dd>
                    </div>
                  ))}
                  <p className="pt-1 text-xs leading-5 text-dash-tertiary">
                    You can review or change pricing any time in Setup → Payments. Rate increases
                    proposed by your reseller always require your approval.
                  </p>
                </dl>
              )}

              {error && <p className="mt-3 text-xs text-dash-danger">{error}</p>}

              <div className="mt-5">
                {auth.isAuthenticated ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void accept()}
                    className="w-full rounded-xl bg-shell-cta py-3 text-sm font-semibold text-shell-cta-text transition hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? 'Claiming…' : 'Accept & take ownership'}
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link
                      to="/auth/signup"
                      className="w-full rounded-xl bg-shell-cta py-3 text-center text-sm font-semibold text-shell-cta-text transition hover:opacity-90"
                    >
                      Create an account to claim
                    </Link>
                    <Link
                      to="/auth/login"
                      className="w-full rounded-xl border border-dash-border py-3 text-center text-sm font-semibold text-dash-secondary transition hover:text-dash-cream"
                    >
                      I already have an account
                    </Link>
                    <p className="text-center text-xs text-dash-tertiary">
                      You'll come right back here after signing in.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

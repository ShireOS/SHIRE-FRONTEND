import { useEffect, useMemo, useState } from 'react'
import { Check, UserCircle2, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '../../auth'
import { supabase } from '../../shared/lib/supabase'

// Surfaces a user may hide from their own view. Per user, not per role —
// hiding is cosmetic and never grants or removes access.
const SLIMMABLE_SURFACES = [
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'payments', label: 'Payments / Plan' },
  { id: 'team', label: 'Team' },
]

export function readDashboardPrefs(profile) {
  const prefs = profile?.dashboard_prefs
  return prefs && typeof prefs === 'object' ? prefs : {}
}

/**
 * Derived identity — computed from actual relationships, never from the raw
 * account_type column alone, so the label can't lie.
 */
export function deriveIdentity(auth) {
  const restaurants = auth.restaurant.restaurants || []
  const owned = restaurants.filter((r) => r.owner_id === auth.user?.id)
  if (auth.accountType === 'admin') return { label: 'Admin', detail: 'Platform administrator — full visibility.' }
  if (auth.accountType === 'reseller') {
    const resold = restaurants.length - owned.length
    return { label: 'Reseller', detail: `You manage rates and boarding for ${resold} store${resold === 1 ? '' : 's'}.` }
  }
  if (owned.length > 0) {
    return { label: 'Owner', detail: `You own ${owned.length} store${owned.length === 1 ? '' : 's'}.` }
  }
  return { label: 'Manager', detail: 'You manage stores you’ve been invited to.' }
}

export default function SettingsPage() {
  const auth = useAuth()
  const [prefs, setPrefs] = useState(() => readDashboardPrefs(auth.profile))
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setPrefs(readDashboardPrefs(auth.profile))
  }, [auth.profile])

  const identity = deriveIdentity(auth)
  const restaurants = auth.restaurant.restaurants || []
  const owned = restaurants.filter((r) => r.owner_id === auth.user?.id)
  const managed = restaurants.filter((r) => r.owner_id !== auth.user?.id && auth.accountType === 'owner')
  const resold = restaurants.filter((r) => r.owner_id !== auth.user?.id && auth.accountType === 'reseller')

  const breakdown = useMemo(
    () => [
      { label: 'Stores you own', items: owned },
      { label: 'Stores you manage', items: managed },
      { label: 'Stores you resell for', items: resold },
    ].filter((entry) => entry.items.length > 0),
    [owned, managed, resold]
  )

  const savePrefs = async (next) => {
    setPrefs(next)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ dashboard_prefs: next })
        .eq('id', auth.user.id)
      if (updateError) throw updateError
      setSavedAt(Date.now())
    } catch (saveError) {
      setError(saveError?.message || 'Could not save preferences.')
    }
  }

  const hidden = new Set(prefs.hidden_surfaces || [])
  const toggleSurface = (surfaceId) => {
    const next = new Set(hidden)
    if (next.has(surfaceId)) next.delete(surfaceId)
    else next.add(surfaceId)
    void savePrefs({ ...prefs, hidden_surfaces: [...next] })
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="label-mono">Preferences</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight text-dash-cream">Settings</h1>
      </header>

      <section className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <UserCircle2 size={15} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
          <p className="label-mono">Account</p>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="rounded-full bg-shell-accent/10 px-3 py-1 text-sm font-semibold text-shell-accent">
            {identity.label}
          </span>
          <p className="text-sm text-dash-secondary">{identity.detail}</p>
        </div>
        <dl className="mt-4 space-y-2">
          {breakdown.map((entry) => (
            <details key={entry.label} className="group">
              <summary className="flex cursor-pointer items-baseline justify-between text-sm text-dash-secondary transition hover:text-dash-cream">
                <span>{entry.label}</span>
                <span className="font-mono tabular-nums">{entry.items.length}</span>
              </summary>
              <ul className="mt-1 space-y-0.5 pl-3 text-xs text-dash-tertiary">
                {entry.items.map((restaurant) => (
                  <li key={restaurant.id}>{restaurant.name || 'Untitled'}</li>
                ))}
              </ul>
            </details>
          ))}
          {breakdown.length === 0 && (
            <p className="text-sm text-dash-tertiary">No stores linked to this account yet.</p>
          )}
        </dl>
      </section>

      <section className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
          <p className="label-mono">Customize view</p>
        </div>
        <p className="mt-1 text-sm text-dash-secondary">
          Hide surfaces you never use. This only slims your own navigation — it doesn't change anyone's access.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SLIMMABLE_SURFACES.map((surface) => {
            const isVisible = !hidden.has(surface.id)
            return (
              <button
                key={surface.id}
                type="button"
                aria-pressed={isVisible}
                onClick={() => toggleSurface(surface.id)}
                className={[
                  'flex min-h-[34px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition',
                  isVisible
                    ? 'border-shell-accent/60 bg-shell-accent/10 text-shell-accent'
                    : 'border-dash-border text-dash-tertiary line-through hover:text-dash-secondary',
                ].join(' ')}
              >
                {isVisible && <Check size={11} strokeWidth={3} aria-hidden="true" />}
                {surface.label}
              </button>
            )
          })}
        </div>

        <div className="mt-4">
          <p className="label-mono !text-[10px]">Default landing</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {[
              { id: 'overview', label: 'Enterprise overview' },
              { id: 'stores', label: 'Stores grid' },
            ].map((landing) => (
              <button
                key={landing.id}
                type="button"
                aria-pressed={(prefs.default_landing || 'stores') === landing.id}
                onClick={() => void savePrefs({ ...prefs, default_landing: landing.id })}
                className={[
                  'min-h-[34px] rounded-full border px-3 text-xs font-semibold transition',
                  (prefs.default_landing || 'stores') === landing.id
                    ? 'border-shell-accent/60 bg-shell-accent/10 text-shell-accent'
                    : 'border-dash-border text-dash-secondary hover:text-dash-cream',
                ].join(' ')}
              >
                {landing.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-dash-danger">{error}</p>}
        {savedAt && !error && <p className="mt-3 text-xs text-dash-success">Saved.</p>}
      </section>
    </div>
  )
}

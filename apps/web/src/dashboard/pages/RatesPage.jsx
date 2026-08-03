import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, Banknote, Check, ChevronDown, Clock } from 'lucide-react'
import { useAuth } from '../../auth'
import {
  PRICING_MODES,
  TENDER_OPTIONS,
  DEFAULT_RATE_PLAN,
  formatRate,
  fetchRatePlans,
  fetchPendingRateRequests,
  upsertRatePlan,
  createRateChangeRequest,
  cancelRateChangeRequest,
} from '../data/ratePlans'

const maskAccount = (value) => (value ? `···${String(value).slice(-4)}` : null)

function payoutSnapshot(restaurant) {
  const config = restaurant?.config && typeof restaurant.config === 'object' ? restaurant.config : {}
  const fields = [
    { label: 'Account holder', value: config.bank_account_holder || null },
    { label: 'Bank', value: config.bank_name || null },
    { label: 'Account', value: maskAccount(config.bank_account_number) },
    { label: 'Payout schedule', value: config.payout_schedule || null },
  ]
  const ready = Boolean(config.bank_account_holder && config.bank_routing_number && config.bank_account_number)
  return { fields, ready }
}

function planToForm(plan) {
  const source = plan || DEFAULT_RATE_PLAN
  return {
    ratePercent: (Number(source.card_rate) * 100).toFixed(2),
    pricing_mode: source.pricing_mode,
    dual_pricing_enabled: Boolean(source.dual_pricing_enabled),
    listed_price_basis: source.listed_price_basis || 'electronic',
    display_order: source.display_order || `${source.listed_price_basis || 'electronic'}_first`,
    applies_to: [...(source.applies_to || [])],
    basis: source.basis || 'subtotal_plus_tax',
    version: Number(source.version) || 0,
  }
}

function formToPlan(form) {
  return {
    card_rate: Math.max(0, Number(form.ratePercent) || 0) / 100,
    pricing_mode: form.pricing_mode,
    dual_pricing_enabled: form.dual_pricing_enabled,
    listed_price_basis: form.listed_price_basis,
    display_order: form.display_order,
    applies_to: form.applies_to,
    basis: form.basis,
    version: form.version,
  }
}

function TogglePill({ checked, onChange, label }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={[
        'flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors duration-100 active:scale-[0.98]',
        checked
          ? 'border-shell-accent/60 bg-shell-accent/10 text-shell-accent ring-2 ring-shell-accent/15'
          : 'border-dash-border bg-[var(--glass-bg)] text-dash-secondary hover:border-dash-tertiary',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-4 w-4 items-center justify-center rounded-sm border-2',
          checked ? 'border-shell-accent/60 bg-shell-accent text-shell-cta-text' : 'border-dash-border bg-dash-elevated',
        ].join(' ')}
      >
        {checked && <Check size={11} strokeWidth={3} aria-hidden="true" />}
      </span>
      {label}
    </button>
  )
}

function RatePlanCard({ restaurant, plan, pendingRequest, userId, onSaved, onRequestChange, restaurantBase }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState(() => planToForm(plan))
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    setForm(planToForm(plan))
  }, [plan])

  const currentRate = plan ? Number(plan.card_rate) : null
  const modeLabel = PRICING_MODES.find((mode) => mode.value === (plan?.pricing_mode || form.pricing_mode))?.label
  const payout = payoutSnapshot(restaurant)

  const toggleTender = (tender) => {
    setForm((prev) => ({
      ...prev,
      applies_to: prev.applies_to.includes(tender)
        ? prev.applies_to.filter((item) => item !== tender)
        : [...prev.applies_to, tender],
    }))
  }

  const save = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const proposed = formToPlan(form)
      const isRaise = currentRate !== null && proposed.card_rate > currentRate

      if (isRaise) {
        // Raising the effective rate requires owner sign-off; everything else
        // in the proposal rides along in the request snapshot.
        const request = await createRateChangeRequest({
          restaurantId: restaurant.id,
          currentRate,
          proposedPlan: proposed,
          userId,
        })
        onRequestChange(request)
        setFeedback({ tone: 'pending', text: 'Rate raise sent to the owner for approval.' })
      } else {
        const saved = await upsertRatePlan(restaurant.id, proposed, userId)
        onSaved(saved)
        setFeedback({ tone: 'success', text: 'Rate plan saved.' })
      }
    } catch (error) {
      setFeedback({ tone: 'error', text: error?.message || 'Could not save the rate plan.' })
    } finally {
      setSaving(false)
    }
  }

  const cancelPending = async () => {
    if (!pendingRequest) return
    setSaving(true)
    try {
      await cancelRateChangeRequest(pendingRequest.id)
      onRequestChange(null)
      setFeedback({ tone: 'success', text: 'Pending request cancelled.' })
    } catch (error) {
      setFeedback({ tone: 'error', text: error?.message || 'Could not cancel the request.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="glass-card rounded-2xl">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-dash-cream">{restaurant.name || 'Untitled restaurant'}</h2>
          <p className="mt-0.5 truncate label-mono !text-[10px] normal-nums">
            {plan ? `${formatRate(plan.card_rate)} · ${modeLabel}` : 'No rate plan yet'}
          </p>
        </div>
        {pendingRequest && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-dash-warning/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-eyebrow text-dash-warning">
            <Clock size={11} strokeWidth={2} aria-hidden="true" />
            {formatRate(pendingRequest.current_rate)} → {formatRate(pendingRequest.proposed_rate)} pending
          </span>
        )}
        {!payout.ready && (
          <span
            title="Payout details incomplete"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-dash-danger/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-eyebrow text-dash-danger"
          >
            <Banknote size={11} strokeWidth={2} aria-hidden="true" />
            Payout incomplete
          </span>
        )}
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={`shrink-0 text-dash-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="space-y-5 border-t border-dash-border p-4">
          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <label className="block">
                  <span className="label-mono !text-[10px] normal-nums">Card rate</span>
                  <span className="mt-1 flex h-9 w-28 items-center rounded-full border border-dash-border bg-[var(--glass-bg)] px-3 focus-within:border-shell-accent/60">
                    <input
                      type="number"
                      min="0"
                      max="15"
                      step="0.05"
                      value={form.ratePercent}
                      onChange={(event) => setForm((prev) => ({ ...prev, ratePercent: event.target.value }))}
                      className="w-full bg-transparent font-mono text-sm tabular-nums text-dash-cream outline-none"
                    />
                    <span className="text-sm text-dash-tertiary">%</span>
                  </span>
                </label>
                <label className="block">
                  <span className="label-mono !text-[10px] normal-nums">Adjustment basis</span>
                  <span className="relative mt-1 flex h-9 items-center rounded-full border border-dash-border bg-[var(--glass-bg)] pl-3 pr-8">
                    <select
                      value={form.basis}
                      onChange={(event) => setForm((prev) => ({ ...prev, basis: event.target.value }))}
                      className="appearance-none bg-transparent text-sm text-dash-cream outline-none"
                    >
                      <option value="subtotal_plus_tax">Subtotal + tax</option>
                      <option value="subtotal">Subtotal only</option>
                    </select>
                    <ChevronDown size={13} strokeWidth={1.75} className="pointer-events-none absolute right-3 text-dash-tertiary" aria-hidden="true" />
                  </span>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label-mono !text-[10px] normal-nums">Listed prices</span>
                  <span className="relative mt-1 flex h-9 items-center rounded-full border border-dash-border bg-[var(--glass-bg)] pl-3 pr-8">
                    <select
                      value={form.listed_price_basis}
                      disabled={form.pricing_mode !== 'dual_pricing_posted_electronic'}
                      onChange={(event) => setForm((prev) => ({
                        ...prev,
                        listed_price_basis: event.target.value,
                        display_order: `${event.target.value}_first`,
                      }))}
                      className="appearance-none bg-transparent text-sm text-dash-cream outline-none disabled:opacity-50"
                    >
                      <option value="cash">Cash</option>
                      <option value="electronic">Electronic</option>
                    </select>
                    <ChevronDown size={13} strokeWidth={1.75} className="pointer-events-none absolute right-3 text-dash-tertiary" aria-hidden="true" />
                  </span>
                </label>
                <label className="block">
                  <span className="label-mono !text-[10px] normal-nums">Show first</span>
                  <span className="relative mt-1 flex h-9 items-center rounded-full border border-dash-border bg-[var(--glass-bg)] pl-3 pr-8">
                    <select
                      value={form.display_order}
                      onChange={(event) => setForm((prev) => ({ ...prev, display_order: event.target.value }))}
                      className="appearance-none bg-transparent text-sm text-dash-cream outline-none"
                    >
                      <option value="cash_first">Cash</option>
                      <option value="electronic_first">Electronic</option>
                    </select>
                    <ChevronDown size={13} strokeWidth={1.75} className="pointer-events-none absolute right-3 text-dash-tertiary" aria-hidden="true" />
                  </span>
                </label>
              </div>
              <p className="text-xs leading-5 text-dash-tertiary">
                Listed prices determine the math. Show first changes only POS and receipt ordering.
              </p>

              <div>
                <p className="label-mono !text-[10px] normal-nums">Pricing mode</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRICING_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setForm((prev) => {
                        const listed = mode.value === 'dual_pricing_posted_electronic'
                          ? prev.listed_price_basis
                          : ['credit_surcharge', 'none'].includes(mode.value) ? 'cash' : 'electronic'
                        return {
                          ...prev,
                          pricing_mode: mode.value,
                          listed_price_basis: listed,
                          display_order: prev.display_order || `${listed}_first`,
                        }
                      })}
                      className={[
                        'h-9 rounded-full border px-3.5 text-sm font-medium transition-colors duration-100 active:scale-[0.98]',
                        form.pricing_mode === mode.value
                          ? 'border-shell-accent/60 bg-shell-accent/10 text-shell-accent ring-2 ring-shell-accent/15'
                          : 'border-dash-border bg-[var(--glass-bg)] text-dash-secondary hover:border-dash-tertiary',
                      ].join(' ')}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="label-mono !text-[10px] normal-nums">Applies to</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TENDER_OPTIONS.map((tender) => (
                    <TogglePill
                      key={tender.value}
                      label={tender.label}
                      checked={form.applies_to.includes(tender.value)}
                      onChange={() => toggleTender(tender.value)}
                    />
                  ))}
                </div>
              </div>

              <TogglePill
                label="Dual pricing enabled"
                checked={form.dual_pricing_enabled}
                onChange={(next) => setForm((prev) => ({ ...prev, dual_pricing_enabled: next }))}
              />
            </div>

            <aside className="h-fit glass-panel rounded-2xl border border-dash-border p-3">
              <p className="flex items-center gap-1.5 label-mono !text-[10px] normal-nums">
                <Banknote size={12} strokeWidth={1.75} aria-hidden="true" />
                Payout details
              </p>
              <dl className="mt-2 space-y-1.5">
                {payout.fields.map((field) => (
                  <div key={field.label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-dash-tertiary">{field.label}</dt>
                    <dd className={`truncate text-xs font-medium ${field.value ? 'text-dash-cream' : 'text-dash-danger'}`}>
                      {field.value || 'Missing'}
                    </dd>
                  </div>
                ))}
              </dl>
              {!payout.ready && (
                <button
                  type="button"
                  onClick={() => navigate(`${restaurantBase}/${restaurant.id}/setup`)}
                  className="mt-3 h-8 w-full rounded-full border border-dash-warning/40 bg-dash-warning/10 text-xs font-semibold text-dash-warning transition hover:bg-dash-warning/20"
                >
                  Complete payout setup
                </button>
              )}
            </aside>
          </div>

          {pendingRequest && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dash-warning/30 bg-dash-warning/10 px-3 py-2 text-sm text-dash-secondary">
              <Clock size={14} strokeWidth={1.75} className="text-dash-warning" aria-hidden="true" />
              <span>
                Raise to <strong className="font-mono tabular-nums">{formatRate(pendingRequest.proposed_rate)}</strong> is waiting on the owner.
              </span>
              <button
                type="button"
                onClick={() => void cancelPending()}
                disabled={saving}
                className="ml-auto text-xs font-semibold text-dash-danger hover:underline disabled:opacity-50"
              >
                Cancel request
              </button>
            </div>
          )}

          {feedback && (
            <p
              className={[
                'flex items-center gap-2 text-sm',
                feedback.tone === 'error' ? 'text-dash-danger' : '',
                feedback.tone === 'success' ? 'text-dash-success' : '',
                feedback.tone === 'pending' ? 'text-dash-warning' : '',
              ].join(' ')}
            >
              <AlertCircle size={14} strokeWidth={1.75} aria-hidden="true" />
              {feedback.text}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || Boolean(pendingRequest)}
              title={pendingRequest ? 'Resolve the pending request before making more changes' : undefined}
              className="h-9 rounded-xl bg-shell-cta px-5 text-sm font-medium text-shell-cta-text transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default function RatesPage({ restaurantBase = '/restaurants', fallbackPath = '/enterprise/stores' }) {
  const auth = useAuth()
  const restaurants = auth.restaurant.restaurants || []
  const [plans, setPlans] = useState({})
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const restaurantIds = useMemo(() => restaurants.map((r) => r.id), [restaurants])

  useEffect(() => {
    if (restaurantIds.length === 0) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([fetchRatePlans(restaurantIds), fetchPendingRateRequests(restaurantIds)])
      .then(([planMap, pendingRequests]) => {
        if (cancelled) return
        setPlans(planMap)
        setPending(pendingRequests)
        setLoadError(null)
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error?.message || 'Could not load rate plans.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantIds.join(',')])

  if (auth.accountType !== 'reseller' && auth.accountType !== 'admin') {
    return <Navigate to={fallbackPath} replace />
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="label-mono">Enterprise</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight text-dash-cream">Rates & Pricing</h1>
        <p className="mt-1 max-w-2xl text-sm text-dash-secondary">
          Set each store's effective card rate, the tenders it applies to, and its pricing mode.
          Raising a rate sends the owner an approval request; lowering applies immediately.
        </p>
      </header>

      {loadError && (
        <p className="rounded-lg border border-dash-danger/30 bg-dash-danger/10 px-3 py-2 text-sm text-dash-danger">
          {loadError} — run the reseller migration in Supabase if these tables don't exist yet.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-dash-border border-t-shell-accent" />
        </div>
      ) : restaurants.length === 0 ? (
        <section className="glass-card rounded-2xl p-8 text-center">
          <h2 className="text-lg font-semibold text-dash-cream">No stores in your portfolio</h2>
          <p className="mt-1 text-sm text-dash-secondary">
            An admin needs to assign restaurants to your reseller account.
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {restaurants.map((restaurant) => (
            <RatePlanCard
              key={restaurant.id}
              restaurant={restaurant}
              plan={plans[restaurant.id] || null}
              pendingRequest={pending.find((request) => request.restaurant_id === restaurant.id) || null}
              userId={auth.user?.id}
              onSaved={(saved) => setPlans((prev) => ({ ...prev, [restaurant.id]: saved }))}
              onRequestChange={(request) =>
                setPending((prev) => {
                  const withoutStore = prev.filter((item) => item.restaurant_id !== restaurant.id)
                  return request ? [request, ...withoutStore] : withoutStore
                })
              }
              restaurantBase={restaurantBase}
            />
          ))}
        </div>
      )}
    </div>
  )
}

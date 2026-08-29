import { useCallback, useEffect, useMemo, useState } from 'react'
import { Coins, Loader2 } from 'lucide-react'
import { fetchWithSupabaseAuth } from '../../shared/query'

/**
 * The plain-English half of the cash closeout settings.
 *
 * The full pill grid still lives in Setup -> Cash & Closeout. This card exists
 * because the one decision that changes the nightly drawer count -- whether the
 * drawer starts with a float -- was buried among twenty unlabeled toggles, and
 * nothing on screen connected it to what the manager actually sees at close.
 *
 * Saving PUTs the whole settings row back. The endpoint's payload model fills
 * every unspecified field from its own defaults, so the fetched row must be
 * spread into the body or this card would silently reset server-checkout and
 * end-of-day settings it never displayed.
 */

const money = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(Number(value || 0))

const sanitizeMoney = (value) => String(value ?? '')
  .replace(/[^\d.]/g, '')
  .replace(/(\..*)\./g, '$1')
  .slice(0, 10)

const FLOAT_MODES = {
  none: 'none',
  fixed: 'fixed',
  previousRetained: 'previous_retained',
}

function floatModeFrom(settings) {
  if (settings?.opening_bank_source === FLOAT_MODES.previousRetained || settings?.require_starting_bank) return FLOAT_MODES.previousRetained
  if (settings?.opening_bank_source === FLOAT_MODES.fixed) return FLOAT_MODES.fixed
  if (Number(settings?.opening_bank_default || 0) > 0) return FLOAT_MODES.fixed
  return FLOAT_MODES.none
}

function Choice({ selected, title, detail, badge, onSelect, children }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`block w-full border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shell-accent/70 ${
        selected
          ? 'border-shell-accent/70 bg-shell-accent/10'
          : 'border-dash-border hover:border-dash-border/80 hover:bg-white/[0.03]'
      }`}
    >
      <span className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${
            selected ? 'border-[5px] border-shell-accent' : 'border-dash-tertiary'
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-dash-cream">{title}</span>
            {badge && <span className="label-mono text-shell-accent">{badge}</span>}
          </span>
          <span className="mt-1 block text-xs leading-5 text-dash-tertiary">{detail}</span>
          {children}
        </span>
      </span>
    </button>
  )
}

function MoneyField({ label, value, onChange, hint }) {
  return (
    <label className="mt-3 block" onClick={(event) => event.stopPropagation()}>
      <span className="label-mono">{label}</span>
      <span className="mt-1.5 flex min-h-[42px] items-center border border-dash-border bg-[var(--glass-bg)] px-3 focus-within:border-shell-accent/70">
        <span className="mr-1 text-sm text-dash-tertiary">$</span>
        <input
          value={value}
          onChange={(event) => onChange(sanitizeMoney(event.target.value))}
          inputMode="decimal"
          placeholder="0.00"
          className="w-full bg-transparent text-sm text-dash-cream outline-none"
        />
      </span>
      {hint && <span className="mt-1 block text-xs text-dash-tertiary">{hint}</span>}
    </label>
  )
}

/** A static render of the iPad close screen the current answers produce. */
function ManagerPreview({ floatMode, floatAmount, blindClose, trackDeposit }) {
  const showFloat = floatMode !== FLOAT_MODES.none
  const expected = 360.5 + (showFloat ? Number(floatAmount || 0) : 0)
  const counted = expected - 2.5
  return (
    <div className="border border-dash-border bg-[var(--glass-bg)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label-mono">What the manager will see</p>
        <span className="label-mono flex items-center gap-1.5 text-emerald-300">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Preview
        </span>
      </div>
      <div className="mt-3 border border-dash-border bg-black/25 p-3">
        <p className="text-sm font-semibold text-dash-cream">Count the drawer</p>
        <div className={`mt-3 grid gap-2 ${showFloat ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {showFloat && (
            <div className="border border-dash-border bg-white/[0.04] px-2.5 py-2">
              <p className="label-mono">Starting float</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-dash-cream">{money(floatAmount)}</p>
              {floatMode === FLOAT_MODES.fixed && <p className="mt-0.5 text-[10px] text-dash-tertiary">Set in back office</p>}
              {floatMode === FLOAT_MODES.previousRetained && <p className="mt-0.5 text-[10px] text-dash-tertiary">Prior close; fallback shown</p>}
            </div>
          )}
          <div className="border border-dash-border bg-white/[0.04] px-2.5 py-2">
            <p className="label-mono">Expected cash</p>
            <p className={`mt-1 font-semibold tabular-nums ${blindClose ? 'text-xs text-dash-tertiary' : 'text-sm text-dash-cream'}`}>
              {blindClose ? 'Hidden by policy' : money(expected)}
            </p>
          </div>
          <div className="border border-dashed border-sky-400/70 px-2.5 py-2">
            <p className="label-mono">Current cash</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-dash-cream">{counted.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-3 flex justify-between border-t border-dash-border pt-2 text-xs text-dash-tertiary">
          <span>Over / short</span>
          <span className="font-semibold tabular-nums text-amber-300">−$2.50</span>
        </div>
        {trackDeposit && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="border border-dashed border-sky-400/70 px-2.5 py-1.5"><p className="label-mono">Deposit</p></div>
            <div className="border border-dashed border-sky-400/70 px-2.5 py-1.5"><p className="label-mono">Cash left in drawer</p></div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs leading-5 text-dash-tertiary">
        {showFloat
          ? 'Three fields. The float is context for the count, not a decision the manager re-makes each night.'
          : 'Two fields. One is calculated, one is counted.'}
      </p>
    </div>
  )
}

export default function CashCloseDaySettings({ restaurantId, initialSettings = null, onSaved }) {
  const [settings, setSettings] = useState(initialSettings)
  const [loading, setLoading] = useState(!initialSettings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  const [floatMode, setFloatMode] = useState(() => floatModeFrom(initialSettings))
  const [floatAmount, setFloatAmount] = useState(() => (
    initialSettings?.opening_bank_default == null ? '' : sanitizeMoney(initialSettings.opening_bank_default)
  ))
  const [blindClose, setBlindClose] = useState(initialSettings?.blind_drawer_close !== false)
  const [trackDeposit, setTrackDeposit] = useState(initialSettings?.track_deposit_at_close === true)
  const [showClockoutOptions, setShowClockoutOptions] = useState(initialSettings?.show_clockout_options_at_close === true)
  const [varianceThreshold, setVarianceThreshold] = useState(() => (
    initialSettings?.cash_variance_threshold == null ? '' : sanitizeMoney(initialSettings.cash_variance_threshold)
  ))

  const hydrate = useCallback((row) => {
    setSettings(row)
    setFloatMode(floatModeFrom(row))
    setFloatAmount(row?.opening_bank_default == null ? '' : sanitizeMoney(row.opening_bank_default))
    setBlindClose(row?.blind_drawer_close !== false)
    setTrackDeposit(row?.track_deposit_at_close === true)
    setShowClockoutOptions(row?.show_clockout_options_at_close === true)
    setVarianceThreshold(row?.cash_variance_threshold == null ? '' : sanitizeMoney(row.cash_variance_threshold))
  }, [])

  useEffect(() => {
    if (!restaurantId) return undefined
    if (initialSettings) {
      setLoading(false)
      return undefined
    }
    let active = true
    setLoading(true)
    setError('')
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/closeout-settings`, {
      timeoutMs: 15_000,
    })
      .then((row) => { if (active) hydrate(row) })
      .catch((nextError) => {
        if (active) setError(nextError instanceof Error ? nextError.message : 'Could not load cash settings.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [restaurantId, initialSettings, hydrate])

  const dirty = useMemo(() => {
    if (!settings) return false
    const amount = floatMode === FLOAT_MODES.none ? 0 : Number(floatAmount || 0)
    return floatMode !== floatModeFrom(settings)
      || amount !== Number(settings.opening_bank_default || 0)
      || blindClose !== (settings.blind_drawer_close !== false)
      || trackDeposit !== (settings.track_deposit_at_close === true)
      || showClockoutOptions !== (settings.show_clockout_options_at_close === true)
      || (varianceThreshold === '' ? null : Number(varianceThreshold)) !== (settings.cash_variance_threshold == null ? null : Number(settings.cash_variance_threshold))
  }, [settings, floatMode, floatAmount, blindClose, trackDeposit, showClockoutOptions, varianceThreshold])

  useEffect(() => {
    if (!initialSettings || saving || dirty) return
    hydrate(initialSettings)
    setLoading(false)
  }, [dirty, hydrate, initialSettings, saving])

  const save = async () => {
    if (!settings || saving) return
    setSaving(true)
    setError('')
    setSaved('')
    try {
      // The preview contains only the Close Day subset. Fetch the complete row
      // at save time so fields owned by Setup or Server Reports are preserved,
      // without putting this secondary request on the page-entry critical path.
      const latestSettings = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/closeout-settings`, {
        timeoutMs: 15_000,
      })
      const saveResult = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/closeout-settings`, {
        method: 'PUT',
        body: JSON.stringify({
          ...latestSettings,
          // Legacy clients still understand this field, but opening cash is no
          // longer a cashier-entered prerequisite in any policy mode.
          require_starting_bank: false,
          opening_bank_source: floatMode,
          opening_bank_default: floatMode === FLOAT_MODES.none ? 0 : Number(floatAmount || 0),
          track_deposit_at_close: trackDeposit,
          blind_drawer_close: blindClose,
          show_clockout_options_at_close: showClockoutOptions,
          cash_variance_threshold: varianceThreshold === '' ? null : Number(varianceThreshold),
        }),
      })
      hydrate(saveResult)
      onSaved?.(saveResult)
      setSaved('Saved. The change reaches the iPad the next time a manager opens Close Day.')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save cash settings.')
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    if (!settings || saving) return
    hydrate(settings)
    setError('')
    setSaved('Changes discarded.')
  }

  if (loading) {
    return (
      <section className="flex items-center gap-3 border border-dash-border bg-[var(--glass-bg)] p-5 text-sm text-dash-tertiary">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        Loading cash settings…
      </section>
    )
  }

  if (!settings) {
    return (
      <section className="border border-dash-border bg-[var(--glass-bg)] p-5">
        <p className="text-sm text-red-200">{error || 'Cash settings are unavailable for this restaurant.'}</p>
      </section>
    )
  }

  return (
    <section className="border border-dash-border bg-[var(--glass-bg)] p-5">
      <div className="flex items-center gap-2">
        <Coins size={17} className="text-dash-tertiary" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-dash-cream">Cash &amp; Close Day</h2>
      </div>
      <p className="mt-1 text-sm text-dash-secondary">
        How the drawer count works on the POS. Every other closeout toggle stays in Setup → Cash &amp; Closeout.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.85fr)]">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-dash-cream">Show employee clock-out choices at every close?</h3>
            <p className="mt-1 text-xs leading-5 text-dash-tertiary">Everyone remains selected by default. Turning this on lets the manager select employees or leave everyone clocked in.</p>
            <div className="mt-3 space-y-2">
              <Choice selected={!showClockoutOptions} onSelect={() => setShowClockoutOptions(false)} title="No — clock everyone out" badge="Default" detail="Matches the standard once-per-day restaurant close." />
              <Choice selected={showClockoutOptions} onSelect={() => setShowClockoutOptions(true)} title="Yes — show choices" detail="Managers can clock out everyone, selected employees, or nobody." />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-dash-cream">Does the drawer start the night with cash in it?</h3>
            <p className="mt-1 text-xs leading-5 text-dash-tertiary">A starting float is money that isn&apos;t from sales — it&apos;s there to make change.</p>
            <div className="mt-3 space-y-2">
              <Choice
                selected={floatMode === FLOAT_MODES.none}
                onSelect={() => setFloatMode(FLOAT_MODES.none)}
                title="No, the drawer starts empty"
                badge="Default"
                detail="The manager counts the drawer and compares it to the day's sales. Two numbers, nothing to remember."
              />
              <Choice
                selected={floatMode === FLOAT_MODES.fixed}
                onSelect={() => setFloatMode(FLOAT_MODES.fixed)}
                title="Yes, the same amount every night"
                detail="Set it once here. The manager sees it but never types it."
              >
                {floatMode === FLOAT_MODES.fixed && (
                  <MoneyField label="Starting float" value={floatAmount} onChange={setFloatAmount} />
                )}
              </Choice>
              <Choice
                selected={floatMode === FLOAT_MODES.previousRetained}
                onSelect={() => setFloatMode(FLOAT_MODES.previousRetained)}
                title="Use what was left at the prior close"
                detail="The POS automatically carries forward the prior finalized retained amount. No cashier confirmation is required."
              >
                {floatMode === FLOAT_MODES.previousRetained && (
                  <MoneyField
                    label="Fallback if no prior close exists"
                    value={floatAmount}
                    onChange={setFloatAmount}
                    hint="The manager is warned when this fallback is used, but cash sales are never blocked."
                  />
                )}
              </Choice>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-dash-cream">Should the manager see the expected total before counting?</h3>
            <p className="mt-1 text-xs leading-5 text-dash-tertiary">Hiding it stops someone counting backwards into the number the POS expects.</p>
            <div className="mt-3 space-y-2">
              <Choice
                selected={!blindClose}
                onSelect={() => setBlindClose(false)}
                title="Show the expected total"
                detail="Faster, and fine for an owner-operated store."
              />
              <Choice
                selected={blindClose}
                onSelect={() => setBlindClose(true)}
                title="Hide it until the count is entered"
                detail="A blind close. The expected total unlocks the moment a count is typed."
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-dash-cream">When should a miscount need an explanation?</h3>
            <p className="mt-1 text-xs leading-5 text-dash-tertiary">
              Below this the manager closes normally. At or above it, the POS refuses to close without a written reason.
            </p>
            <div className="max-w-[220px]">
              <MoneyField
                label="Flag over / short above"
                value={varianceThreshold}
                onChange={setVarianceThreshold}
                hint="Leave blank to require a reason for any difference."
              />
            </div>
            <button
              type="button"
              onClick={() => setTrackDeposit((current) => !current)}
              aria-pressed={trackDeposit}
              className={`mt-4 block w-full border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-shell-accent/70 ${
                trackDeposit ? 'border-shell-accent/70 bg-shell-accent/10' : 'border-dash-border hover:bg-white/[0.03]'
              }`}
            >
              <span className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 border ${trackDeposit ? 'border-shell-accent bg-shell-accent' : 'border-dash-tertiary'}`}
                />
                <span>
                  <span className="block text-sm font-semibold text-dash-cream">Also track the deposit and what&apos;s left in the drawer</span>
                  <span className="mt-1 block text-xs leading-5 text-dash-tertiary">Adds two optional fields at close. Off by default.</span>
                </span>
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <ManagerPreview
            floatMode={floatMode}
            floatAmount={floatMode === FLOAT_MODES.none ? '' : floatAmount}
            blindClose={blindClose}
            trackDeposit={trackDeposit}
          />
          <div className="flex flex-wrap items-center justify-end gap-3">
            {saved && <p className="text-xs text-emerald-300">{saved}</p>}
            {error && <p className="text-xs text-red-300">{error}</p>}
            <button type="button" onClick={discard} disabled={!dirty || saving} className="border border-dash-border px-5 py-2 text-sm font-semibold text-dash-secondary transition hover:text-dash-cream disabled:cursor-not-allowed disabled:opacity-40">Cancel</button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="border border-shell-accent/70 bg-shell-accent/15 px-5 py-2 text-sm font-semibold text-dash-cream transition hover:bg-shell-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

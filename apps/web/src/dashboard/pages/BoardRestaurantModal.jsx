import { useState } from 'react'
import { Check, Copy, Link2, Mail, X } from 'lucide-react'
import { useAuth } from '../../auth'
import { PRICING_MODES, TENDER_OPTIONS, DEFAULT_RATE_PLAN } from '../data/ratePlans'
import { createQuickInvite, createDraftInvite, claimUrl } from '../data/boarding'
import { backOfficeApi } from '../../shared/api/backOfficeApi'

const PAYOUT_SCHEDULES = ['daily', 'weekly', 'biweekly', 'monthly']

const initialRateForm = {
  ratePercent: (DEFAULT_RATE_PLAN.card_rate * 100).toFixed(2),
  pricing_mode: DEFAULT_RATE_PLAN.pricing_mode,
  dual_pricing_enabled: true,
  listed_price_basis: DEFAULT_RATE_PLAN.listed_price_basis,
  display_order: DEFAULT_RATE_PLAN.display_order,
  applies_to: [...DEFAULT_RATE_PLAN.applies_to],
  basis: DEFAULT_RATE_PLAN.basis,
}

const rateFormToPlan = (form) => ({
  card_rate: Math.max(0, Number(form.ratePercent) || 0) / 100,
  pricing_mode: form.pricing_mode,
  dual_pricing_enabled: form.dual_pricing_enabled,
  listed_price_basis: form.listed_price_basis,
  display_order: form.display_order,
  applies_to: form.applies_to,
  basis: form.basis,
})

function FieldLabel({ children }) {
  return <span className="label-mono !text-[10px]">{children}</span>
}

function PillButton({ isActive, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'min-h-[34px] rounded-full border px-3 text-xs font-semibold transition',
        isActive
          ? 'border-shell-accent/60 bg-shell-accent/10 text-shell-accent'
          : 'border-dash-border text-dash-secondary hover:text-dash-cream',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function TextField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-shell-accent/60"
      />
    </label>
  )
}

// The rate plan is mandatory for boarding — a store cannot exist in a
// reseller's book without its commercial terms set.
function RatePlanFields({ form, setForm }) {
  const toggleTender = (tender) => {
    setForm((prev) => ({
      ...prev,
      applies_to: prev.applies_to.includes(tender)
        ? prev.applies_to.filter((item) => item !== tender)
        : [...prev.applies_to, tender],
    }))
  }

  return (
    <div className="space-y-3 rounded-xl border border-dash-border bg-[var(--glass-bg)] p-3">
      <p className="label-mono !text-[10px]">Rate plan · required</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <FieldLabel>Card rate %</FieldLabel>
          <input
            type="number"
            min="0"
            max="15"
            step="0.05"
            value={form.ratePercent}
            onChange={(event) => setForm((prev) => ({ ...prev, ratePercent: event.target.value }))}
            className="mt-1 w-24 rounded-xl border border-dash-border bg-transparent px-3 py-2 font-mono text-sm tabular-nums text-dash-cream outline-none focus:border-shell-accent/60"
          />
        </label>
        <label className="block">
          <FieldLabel>Adjustment basis</FieldLabel>
          <select
            value={form.basis}
            onChange={(event) => setForm((prev) => ({ ...prev, basis: event.target.value }))}
            className="mt-1 rounded-xl border border-dash-border bg-transparent px-3 py-2 text-sm text-dash-cream outline-none"
          >
            <option value="subtotal_plus_tax">Subtotal + tax</option>
            <option value="subtotal">Subtotal only</option>
          </select>
        </label>
        <label className="block">
          <FieldLabel>Listed prices</FieldLabel>
          <select
            value={form.listed_price_basis}
            disabled={form.pricing_mode !== 'dual_pricing_posted_electronic'}
            onChange={(event) => setForm((prev) => ({
              ...prev,
              listed_price_basis: event.target.value,
              display_order: `${event.target.value}_first`,
            }))}
            className="mt-1 rounded-xl border border-dash-border bg-transparent px-3 py-2 text-sm text-dash-cream outline-none disabled:opacity-50"
          >
            <option value="cash">Cash</option>
            <option value="electronic">Electronic</option>
          </select>
        </label>
        <label className="block">
          <FieldLabel>Show first</FieldLabel>
          <select
            value={form.display_order}
            onChange={(event) => setForm((prev) => ({ ...prev, display_order: event.target.value }))}
            className="mt-1 rounded-xl border border-dash-border bg-transparent px-3 py-2 text-sm text-dash-cream outline-none"
          >
            <option value="cash_first">Cash</option>
            <option value="electronic_first">Electronic</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRICING_MODES.map((mode) => (
          <PillButton
            key={mode.value}
            isActive={form.pricing_mode === mode.value}
            onClick={() => setForm((prev) => {
              const listed = mode.value === 'dual_pricing_posted_electronic'
                ? prev.listed_price_basis
                : ['credit_surcharge', 'none'].includes(mode.value) ? 'cash' : 'electronic'
              const followsListedBasis = prev.display_order === `${prev.listed_price_basis}_first`
              return {
                ...prev,
                pricing_mode: mode.value,
                listed_price_basis: listed,
                display_order: followsListedBasis ? `${listed}_first` : prev.display_order,
              }
            })}
          >
            {mode.label}
          </PillButton>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {TENDER_OPTIONS.map((tender) => (
          <PillButton
            key={tender.value}
            isActive={form.applies_to.includes(tender.value)}
            onClick={() => toggleTender(tender.value)}
          >
            {form.applies_to.includes(tender.value) ? '✓ ' : ''}{tender.label}
          </PillButton>
        ))}
      </div>
      <PillButton
        isActive={form.dual_pricing_enabled}
        onClick={() => setForm((prev) => ({ ...prev, dual_pricing_enabled: !prev.dual_pricing_enabled }))}
      >
        Dual pricing {form.dual_pricing_enabled ? 'on' : 'off'}
      </PillButton>
    </div>
  )
}

function InviteResult({ invite, email, onDone }) {
  const [copied, setCopied] = useState(false)
  const url = claimUrl(invite.token)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Selection fallback: the input below is selectable.
    }
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm font-semibold text-dash-cream">{invite.email_sent ? 'Invite sent' : 'Invite ready'}</p>
      <p className="text-xs text-dash-secondary">
        {invite.email_sent
          ? `An email was sent to ${email}. The claim link expires in 30 days.`
          : `Send this claim link to ${email || 'the owner'} — it expires in 30 days.`}
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(event) => event.target.select()}
          className="w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 font-mono text-xs text-dash-cream outline-none"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dash-border text-dash-secondary transition hover:border-shell-accent/40 hover:text-shell-accent"
          aria-label="Copy claim link"
        >
          {copied ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.75} />}
        </button>
      </div>
      <div className="flex justify-center gap-2">
        {email && (
          <a
            href={`mailto:${email}?subject=${encodeURIComponent('Your SHIRE restaurant is ready to claim')}&body=${encodeURIComponent(`Claim your restaurant workspace here: ${url}`)}`}
            className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-dash-border px-3 text-xs font-semibold text-dash-secondary transition hover:border-shell-accent/40 hover:text-dash-cream"
          >
            <Mail size={13} strokeWidth={1.75} aria-hidden="true" />
            Open in email
          </a>
        )}
        <button
          type="button"
          onClick={onDone}
          className="min-h-[36px] rounded-xl bg-shell-cta px-4 text-xs font-semibold text-shell-cta-text transition hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export default function BoardRestaurantModal({ onClose, onBoarded }) {
  const auth = useAuth()
  const [path, setPath] = useState('draft') // 'draft' | 'quick'
  const [email, setEmail] = useState('')
  const [draft, setDraft] = useState({
    name: '',
    legal_business_name: '',
    city: '',
    state: '',
    type: '',
    payout_schedule: 'daily',
  })
  const [rateForm, setRateForm] = useState(initialRateForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const submit = async () => {
    setError(null)
    const plan = rateFormToPlan(rateForm)
    if (!(plan.card_rate > 0) && plan.pricing_mode !== 'none') {
      setError('Set the card rate — boarding requires the rate plan.')
      return
    }
    if (path === 'draft' && !draft.name.trim()) {
      setError('The restaurant needs a name.')
      return
    }
    setBusy(true)
    try {
      if (path === 'quick') {
        const invite = await createQuickInvite({
          userId: auth.user.id,
          email: email.trim(),
          restaurantName: draft.name.trim() || null,
          ratePlan: { ...plan, payout_schedule: draft.payout_schedule },
        })
        const delivery = email.trim()
          ? await backOfficeApi.sendStoreInvite(invite.id).catch(() => ({ email_sent: false }))
          : { email_sent: false }
        setResult({ ...invite, ...delivery })
      } else {
        const { invite } = await createDraftInvite({
          userId: auth.user.id,
          email: email.trim(),
          draft: {
            ...draft,
            name: draft.name.trim(),
            legal_business_name: draft.legal_business_name.trim(),
          },
          ratePlan: plan,
        })
        const delivery = email.trim()
          ? await backOfficeApi.sendStoreInvite(invite.id).catch(() => ({ email_sent: false }))
          : { email_sent: false }
        setResult({ ...invite, ...delivery })
        onBoarded?.()
      }
    } catch (submitError) {
      setError(submitError?.message || 'Could not create the invite.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="glass-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-dash-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-mono">Reseller boarding</p>
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-dash-cream">Board a restaurant</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-dash-tertiary transition hover:bg-[var(--glass-bg-hover)] hover:text-dash-cream"
          >
            <X size={17} strokeWidth={1.75} />
          </button>
        </div>

        {result ? (
          <div className="mt-5">
            <InviteResult invite={result} email={email.trim()} onDone={onClose} />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <PillButton isActive={path === 'draft'} onClick={() => setPath('draft')}>
                <Link2 size={12} strokeWidth={1.75} className="mr-1 inline" aria-hidden="true" />
                Draft & claim
              </PillButton>
              <PillButton isActive={path === 'quick'} onClick={() => setPath('quick')}>
                <Mail size={12} strokeWidth={1.75} className="mr-1 inline" aria-hidden="true" />
                Quick invite
              </PillButton>
            </div>
            <p className="text-xs leading-5 text-dash-secondary">
              {path === 'draft'
                ? 'Pre-fill the store so the owner claims it with nothing to re-enter. It shows in your grid as "Awaiting claim" until they accept.'
                : 'Send a lightweight link. The owner sets everything up themselves; the store binds to your book with this rate plan when they accept.'}
            </p>

            <TextField label="Owner email" value={email} onChange={setEmail} placeholder="owner@restaurant.com" type="email" />
            <TextField label={path === 'draft' ? 'Restaurant name · required' : 'Restaurant name (optional)'} value={draft.name} onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))} placeholder="Harbor Cafe" />

            {path === 'draft' && (
              <>
                <TextField label="Legal business name" value={draft.legal_business_name} onChange={(value) => setDraft((prev) => ({ ...prev, legal_business_name: value }))} placeholder="Harbor Cafe LLC" />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="City" value={draft.city} onChange={(value) => setDraft((prev) => ({ ...prev, city: value }))} placeholder="Charleston" />
                  <TextField label="State" value={draft.state} onChange={(value) => setDraft((prev) => ({ ...prev, state: value }))} placeholder="SC" />
                </div>
              </>
            )}

            <label className="block">
              <FieldLabel>Payout schedule</FieldLabel>
              <div className="mt-1 flex flex-wrap gap-2">
                {PAYOUT_SCHEDULES.map((schedule) => (
                  <PillButton
                    key={schedule}
                    isActive={draft.payout_schedule === schedule}
                    onClick={() => setDraft((prev) => ({ ...prev, payout_schedule: schedule }))}
                  >
                    {schedule}
                  </PillButton>
                ))}
              </div>
            </label>

            <RatePlanFields form={rateForm} setForm={setRateForm} />

            {error && <p className="text-xs text-dash-danger">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[38px] rounded-xl border border-dash-border px-4 text-sm font-semibold text-dash-secondary transition hover:text-dash-cream"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="min-h-[38px] rounded-xl bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Creating…' : path === 'draft' ? 'Create draft & link' : 'Create invite link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

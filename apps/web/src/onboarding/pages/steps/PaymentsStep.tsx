import type { UseOnboardingReturn } from '../../hooks/useOnboarding'
import { SmartTimeInput } from '../../../shared/components/SmartTimeInput'

interface PaymentsStepProps {
  onboarding: UseOnboardingReturn
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="label-mono text-[rgb(var(--gold))]">{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]'

const PRICING_TENDER_OPTIONS = [
  ['card', 'Card'],
  ['credit', 'Credit'],
  ['debit', 'Debit'],
  ['terminal', 'Terminal'],
  ['gift_card', 'Gift card'],
  ['standalone', 'Standalone tender'],
  ['external', 'External card terminal'],
] as const

export function PaymentsStep({ onboarding }: PaymentsStepProps) {
  const { data, updateData, savePayments, nextStep, isLoading, error } = onboarding
  const updatePricingPolicy = (patch: Partial<typeof data.pricing_policy>) => updateData({
    pricing_policy: { ...data.pricing_policy, ...patch },
  })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await savePayments()
      nextStep()
    } catch {
      // Error is surfaced by the hook.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <div>
          <p className="label-mono text-[rgb(var(--gold))]">Bank Account</p>
          <p className="mt-2 text-sm text-[rgb(var(--text-secondary))]">
            Used for payout readiness. Processor verification can still happen later.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account Holder">
            <input value={data.bank_account_holder} onChange={(event) => updateData({ bank_account_holder: event.target.value })} className={inputClass} placeholder="The Golden Fork LLC" />
          </Field>
          <Field label="Bank Name">
            <input value={data.bank_name} onChange={(event) => updateData({ bank_name: event.target.value })} className={inputClass} placeholder="Bank name" />
          </Field>
          <Field label="Routing Number">
            <input inputMode="numeric" value={data.bank_routing_number} onChange={(event) => updateData({ bank_routing_number: event.target.value.replace(/\D/g, '').slice(0, 9) })} className={inputClass} placeholder="9 digits" />
          </Field>
          <Field label="Account Number">
            <input inputMode="numeric" value={data.bank_account_number} onChange={(event) => updateData({ bank_account_number: event.target.value.replace(/\D/g, '').slice(0, 17) })} className={inputClass} placeholder="Account number" />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="label-mono text-[rgb(var(--gold))]">Processing Settings</p>
          <p className="mt-2 text-sm text-[rgb(var(--text-secondary))]">
            These defaults drive refunds, batch close, payouts, and credit card tip handling.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payout Schedule">
            <select value={data.payout_schedule} onChange={(event) => updateData({ payout_schedule: event.target.value as typeof data.payout_schedule })} className={inputClass}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="manual">Manual</option>
            </select>
          </Field>
          <Field label="Refund Funding">
            <select value={data.refund_funding_source} onChange={(event) => updateData({ refund_funding_source: event.target.value as typeof data.refund_funding_source })} className={inputClass}>
              <option value="processor_balance">Processor balance first</option>
              <option value="bank_account">Linked bank account</option>
            </select>
          </Field>
          <Field label="Batch Close">
            <select value={data.batch_close_mode} onChange={(event) => updateData({ batch_close_mode: event.target.value as typeof data.batch_close_mode })} className={inputClass}>
              <option value="automatic">Automatic</option>
              <option value="manual">Manual manager close</option>
            </select>
          </Field>
          <Field label="Batch Close Time">
            <SmartTimeInput ariaLabel="Automatic batch close time" minuteStep={5} value={data.batch_close_time} onChange={(value) => updateData({ batch_close_time: value })} inputClassName="!rounded-lg" />
          </Field>
          <Field label="Credit Card Tips Paid">
            <select value={data.credit_card_tip_payout} onChange={(event) => updateData({ credit_card_tip_payout: event.target.value as typeof data.credit_card_tip_payout })} className={inputClass}>
              <option value="nightly">Nightly</option>
              <option value="payroll">Through payroll</option>
            </select>
          </Field>
          <Field label="Refund Approval Threshold">
            <input inputMode="decimal" value={data.refund_approval_threshold} onChange={(event) => updateData({ refund_approval_threshold: event.target.value.replace(/[^\d.]/g, '').slice(0, 8) })} className={inputClass} placeholder="Manager approval over $..." />
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t border-[rgba(255,255,255,0.1)] pt-6">
        <div>
          <p className="label-mono text-[rgb(var(--gold))]">Pricing Policy</p>
          <p className="mt-2 text-sm text-[rgb(var(--text-secondary))]">Controls how listed cash and electronic prices are calculated and displayed in the POS.</p>
        </div>
        <label className="flex items-center gap-3 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgb(var(--text-primary))]">
          <input type="checkbox" checked={data.pricing_policy.enabled} onChange={(event) => updatePricingPolicy({ enabled: event.target.checked })} />
          Enable pricing adjustment
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pricing Mode">
            <select value={data.pricing_policy.mode} onChange={(event) => updatePricingPolicy({ mode: event.target.value as typeof data.pricing_policy.mode })} className={inputClass}>
              <option value="dual_pricing_posted_electronic">Posted electronic price</option>
              <option value="cash_discount">Cash discount</option>
              <option value="credit_surcharge">Credit surcharge</option>
              <option value="service_fee_all">Service fee</option>
              <option value="none">No adjustment</option>
            </select>
          </Field>
          <Field label="Commercial Rate">
            <div className="min-h-[50px] rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgb(var(--text-secondary))]">
              <span className="font-mono text-[rgb(var(--text-primary))]">{(data.pricing_policy.rate * 100).toFixed(2).replace(/\.?0+$/, '')}%</span>
              <p className="mt-1 text-xs text-[rgb(var(--text-tertiary))]">Set by Shire or reseller terms.</p>
            </div>
          </Field>
          <Field label="Adjustment Basis">
            <select value={data.pricing_policy.basis} onChange={(event) => updatePricingPolicy({ basis: event.target.value as typeof data.pricing_policy.basis })} className={inputClass}>
              <option value="subtotal_plus_tax">Subtotal + tax</option>
              <option value="subtotal">Subtotal before tax</option>
            </select>
          </Field>
          <Field label="Listed Prices">
            <select value={data.pricing_policy.listed_price_basis} onChange={(event) => updatePricingPolicy({ listed_price_basis: event.target.value as typeof data.pricing_policy.listed_price_basis })} className={inputClass}>
              <option value="cash">Cash</option>
              <option value="electronic">Electronic</option>
            </select>
          </Field>
          <Field label="Show First">
            <select value={data.pricing_policy.display_order} onChange={(event) => updatePricingPolicy({ display_order: event.target.value as typeof data.pricing_policy.display_order })} className={inputClass}>
              <option value="cash_first">Cash</option>
              <option value="electronic_first">Electronic</option>
            </select>
          </Field>
          <Field label="State">
            <input value={data.pricing_policy.jurisdiction_state} onChange={(event) => updatePricingPolicy({ jurisdiction_state: event.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2) })} className={inputClass} placeholder="SC" />
          </Field>
          <Field label="Receipt Label">
            <input value={data.pricing_policy.label} onChange={(event) => updatePricingPolicy({ label: event.target.value.slice(0, 120) })} className={inputClass} placeholder="Dual pricing" />
          </Field>
        </div>
        <div className="space-y-3">
          <span className="label-mono text-[rgb(var(--gold))]">Applies To</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRICING_TENDER_OPTIONS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-3 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgb(var(--text-primary))]">
                <input
                  type="checkbox"
                  checked={data.pricing_policy.applies_to.includes(value)}
                  onChange={() => updatePricingPolicy({
                    applies_to: data.pricing_policy.applies_to.includes(value)
                      ? data.pricing_policy.applies_to.filter(item => item !== value)
                      : [...data.pricing_policy.applies_to, value],
                  })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <Field label="Disclosure">
          <textarea value={data.pricing_policy.disclosure} onChange={(event) => updatePricingPolicy({ disclosure: event.target.value.slice(0, 1000) })} className={`${inputClass} min-h-24 resize-y`} />
        </Field>
      </section>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 px-6 bg-white text-black hover:bg-gray-100 disabled:opacity-50 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? 'Saving...' : 'Continue'}
      </button>
    </form>
  )
}

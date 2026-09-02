import { CHARGE_APPLIES_TO_OPTIONS, defaultServiceCharge, sanitizeCountInput, sanitizeMoneyInput, sanitizePercentInput } from '@shire/settings'
import type { ServiceChargeData, UseOnboardingReturn } from '../../hooks/useOnboarding'
import { TaxJurisdictionPanel } from '../../../dashboard/components/TaxJurisdictionPanel'

interface TaxesChargesStepProps {
  onboarding: UseOnboardingReturn
}

const CHARGE_APPLIES_TO: Array<{ value: ServiceChargeData['applies_to']; label: string }> = [
  ...CHARGE_APPLIES_TO_OPTIONS,
]

const inputClass = 'w-full min-w-0 px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]'
const compactInputClass = `${inputClass} text-sm`

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg border px-3 py-2 text-xs font-semibold transition',
        active
          ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.1)] text-[rgb(var(--text-primary))]'
          : 'border-[rgba(255,255,255,0.1)] text-[rgb(var(--text-tertiary))] hover:border-[rgba(255,255,255,0.2)] hover:text-[rgb(var(--text-primary))]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function TaxesChargesStep({ onboarding }: TaxesChargesStepProps) {
  const { data, restaurantId, updateData, saveTaxesCharges, nextStep, isLoading, error } = onboarding
  const serviceCharges = data.service_charges

  const updateCharge = (index: number, patch: Partial<ServiceChargeData>) => {
    updateData({
      service_charges: serviceCharges.map((row, currentIndex) => currentIndex === index ? { ...row, ...patch } : row),
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await saveTaxesCharges()
      nextStep()
    } catch {
      // Hook owns the visible error.
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
          <p className="label-mono text-[rgb(var(--gold))]">Tax Rates</p>
          <p className="mt-2 text-sm leading-6 text-[rgb(var(--text-secondary))]">
            SHIRE matches the restaurant address to official geography and resolves product-specific jurisdictions. Choose what the store sells; restaurant users never type or override a percentage.
          </p>
        </div>

        <TaxJurisdictionPanel
          restaurantId={restaurantId}
          locationDisplay={[data.address, [data.city, data.state].filter(Boolean).join(', '), data.postal_code].filter(Boolean).join(' · ')}
          onResolved={payload => updateData({
            tax_rates: payload.tax_rates as typeof data.tax_rates,
            enabled_tax_classes: payload.tax_profile?.enabled_tax_classes || data.enabled_tax_classes,
          })}
        />
      </section>

      <section className="space-y-4">
        <div>
          <p className="label-mono text-[rgb(var(--gold))]">Service Charges</p>
          <p className="mt-2 text-sm leading-6 text-[rgb(var(--text-secondary))]">
            Configure automatic gratuity, delivery, catering, large-party, or house service fees. Employee-owned charges become gratuity earnings; restaurant-owned charges remain service-charge revenue.
          </p>
        </div>

        {serviceCharges.length === 0 && (
          <div className="rounded-lg border border-dashed border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.02)] p-4 text-sm text-[rgb(var(--text-secondary))]">
            No service charges yet. Add one only if this restaurant uses a fee or auto-gratuity.
          </div>
        )}

        <div className="space-y-3">
          {serviceCharges.map((charge, index) => (
            <div key={charge.id || `charge:${index}`} className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr_0.7fr_1fr]">
                <label className="space-y-1.5">
                  <span className="block text-xs font-medium text-[rgb(var(--text-secondary))]">Charge name</span>
                  <input value={charge.name} onChange={(event) => updateCharge(index, { name: event.target.value })} className={compactInputClass} placeholder="e.g. Large-party gratuity" />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs font-medium text-[rgb(var(--text-secondary))]">Calculated as</span>
                  <select value={charge.charge_type} onChange={(event) => updateCharge(index, { charge_type: event.target.value as ServiceChargeData['charge_type'] })} className={compactInputClass}>
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs font-medium text-[rgb(var(--text-secondary))]">{charge.charge_type === 'fixed' ? 'Amount ($)' : 'Rate (%)'}</span>
                  <input inputMode="decimal" value={charge.amount} onChange={(event) => updateCharge(index, { amount: charge.charge_type === 'percentage' ? sanitizePercentInput(event.target.value) : sanitizeMoneyInput(event.target.value) })} className={compactInputClass} placeholder={charge.charge_type === 'fixed' ? 'e.g. 5.00' : 'e.g. 18'} />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs font-medium text-[rgb(var(--text-secondary))]">Applies to</span>
                  <select value={charge.applies_to} onChange={(event) => updateCharge(index, { applies_to: event.target.value as ServiceChargeData['applies_to'] })} className={compactInputClass}>
                    {CHARGE_APPLIES_TO.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
              <p className="mt-2 text-xs leading-5 text-[rgb(var(--text-tertiary))]">The charge name appears to staff and on receipts. New charges start taxable, manually applied, and retained by the restaurant.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ToggleButton active={charge.taxable} onClick={() => updateCharge(index, { taxable: !charge.taxable })}>Taxable</ToggleButton>
                <ToggleButton active={charge.auto_apply} onClick={() => updateCharge(index, { auto_apply: !charge.auto_apply })}>Auto apply</ToggleButton>
                <ToggleButton active={charge.is_tip} onClick={() => updateCharge(index, { is_tip: !charge.is_tip })}>{charge.is_tip ? 'Employee receives charge' : 'Restaurant keeps charge'}</ToggleButton>
                <button
                  type="button"
                  onClick={() => updateData({ service_charges: serviceCharges.filter((_, currentIndex) => currentIndex !== index) })}
                  className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 transition hover:border-red-400/50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => updateData({ service_charges: [...serviceCharges, defaultServiceCharge()] })}
          className="rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-2 text-sm text-[rgb(var(--text-secondary))] transition-colors hover:border-[rgba(201,169,98,0.45)] hover:text-[rgb(var(--text-primary))]"
        >
          + Add service charge
        </button>
      </section>

      <section className="space-y-4 border-t border-[rgba(255,255,255,0.1)] pt-6">
        <div>
          <p className="label-mono text-[rgb(var(--gold))]">Large-Party Auto Gratuity</p>
          <p className="mt-2 text-sm leading-6 text-[rgb(var(--text-secondary))]">This restaurant-wide rule applies when a section does not define its own service-charge behavior.</p>
        </div>
        <label className="flex items-center gap-3 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[rgb(var(--text-primary))]">
          <input type="checkbox" checked={data.auto_gratuity.enabled} onChange={(event) => updateData({ auto_gratuity: { ...data.auto_gratuity, enabled: event.target.checked } })} />
          Automatically apply gratuity to large parties
        </label>
        {data.auto_gratuity.enabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2"><span className="label-mono text-[rgb(var(--gold))]">Minimum Party Size</span><input inputMode="numeric" value={data.auto_gratuity.party_threshold} onChange={(event) => updateData({ auto_gratuity: { ...data.auto_gratuity, party_threshold: sanitizeCountInput(event.target.value, 2) } })} className={inputClass} placeholder="6" /></label>
            <label className="block space-y-2"><span className="label-mono text-[rgb(var(--gold))]">Gratuity Rate %</span><input inputMode="decimal" value={data.auto_gratuity.percent} onChange={(event) => updateData({ auto_gratuity: { ...data.auto_gratuity, percent: sanitizePercentInput(event.target.value) } })} className={inputClass} placeholder="18" /></label>
            <label className="block space-y-2"><span className="label-mono text-[rgb(var(--gold))]">Receipt Label</span><input value={data.auto_gratuity.label} onChange={(event) => updateData({ auto_gratuity: { ...data.auto_gratuity, label: event.target.value.slice(0, 40) } })} className={inputClass} placeholder="Gratuity" /></label>
            <label className="block space-y-2"><span className="label-mono text-[rgb(var(--gold))]">Who Receives It</span><select value={data.auto_gratuity.assigned_to_employee ? 'employee' : 'restaurant'} onChange={(event) => updateData({ auto_gratuity: { ...data.auto_gratuity, assigned_to_employee: event.target.value === 'employee' } })} className={inputClass}><option value="employee">Employee tip earnings</option><option value="restaurant">Restaurant service-charge revenue</option></select></label>
          </div>
        )}
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

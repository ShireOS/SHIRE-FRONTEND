import type { ServiceChargeData, TaxRateData, UseOnboardingReturn } from '../../hooks/useOnboarding'

interface TaxesChargesStepProps {
  onboarding: UseOnboardingReturn
}

const TAX_APPLIES_TO: Array<{ value: TaxRateData['applies_to']; label: string }> = [
  { value: 'all', label: 'All sales' },
  { value: 'food', label: 'Food' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'non_alcohol', label: 'Non-alcohol' },
  { value: 'merchandise', label: 'Merchandise' },
]

const CHARGE_APPLIES_TO: Array<{ value: ServiceChargeData['applies_to']; label: string }> = [
  { value: 'all', label: 'All orders' },
  { value: 'dine_in', label: 'Dine-in' },
  { value: 'bar', label: 'Bar' },
  { value: 'takeout', label: 'Takeout' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'catering', label: 'Catering' },
  { value: 'large_party', label: 'Large party' },
]

const inputClass = 'w-full min-w-0 px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]'
const compactInputClass = `${inputClass} text-sm`

const sanitizeNumber = (value: string) => value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 10)

const defaultTaxRate = (): TaxRateData => ({
  name: 'Sales Tax',
  rate: '',
  applies_to: 'all',
  is_default: true,
  is_inclusive: false,
  is_active: true,
})

const defaultServiceCharge = (index: number): ServiceChargeData => ({
  name: index === 0 ? 'Service Charge' : `Service Charge ${index + 1}`,
  charge_type: 'percentage',
  amount: '',
  applies_to: 'all',
  taxable: true,
  auto_apply: false,
  is_tip: false,
  is_active: true,
})

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
  const { data, updateData, saveTaxesCharges, nextStep, isLoading, error } = onboarding
  const taxRates = data.tax_rates.length > 0 ? data.tax_rates : [defaultTaxRate()]
  const serviceCharges = data.service_charges

  const updateTax = (index: number, patch: Partial<TaxRateData>) => {
    const next = taxRates.map((row, currentIndex) => {
      const updated = currentIndex === index ? { ...row, ...patch } : row
      if (patch.is_default && currentIndex !== index) return { ...updated, is_default: false }
      return updated
    })
    updateData({ tax_rates: next })
  }

  const removeTax = (index: number) => {
    const next = taxRates.filter((_, currentIndex) => currentIndex !== index)
    if (next.length === 0) {
      updateData({ tax_rates: [defaultTaxRate()] })
      return
    }
    if (!next.some(row => row.is_default)) {
      next[0] = { ...next[0], is_default: true }
    }
    updateData({ tax_rates: next })
  }

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
            Define the tax categories the POS will use for order totals, refunds, closeout, and reports.
          </p>
        </div>

        <div className="space-y-3">
          {taxRates.map((tax, index) => (
            <div key={tax.id || `tax:${index}`} className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="grid gap-3 sm:grid-cols-[1.2fr_0.7fr_1fr]">
                <input
                  value={tax.name}
                  onChange={(event) => updateTax(index, { name: event.target.value })}
                  className={compactInputClass}
                  placeholder="Sales Tax"
                />
                <input
                  inputMode="decimal"
                  value={tax.rate}
                  onChange={(event) => updateTax(index, { rate: sanitizeNumber(event.target.value) })}
                  className={compactInputClass}
                  placeholder="Rate %"
                />
                <select
                  value={tax.applies_to}
                  onChange={(event) => updateTax(index, { applies_to: event.target.value as TaxRateData['applies_to'] })}
                  className={compactInputClass}
                >
                  {TAX_APPLIES_TO.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <ToggleButton active={tax.is_default} onClick={() => updateTax(index, { is_default: true })}>Default tax</ToggleButton>
                <ToggleButton active={tax.is_inclusive} onClick={() => updateTax(index, { is_inclusive: !tax.is_inclusive })}>Tax included in price</ToggleButton>
                <button
                  type="button"
                  onClick={() => removeTax(index)}
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
          onClick={() => updateData({ tax_rates: [...taxRates, { ...defaultTaxRate(), name: 'Additional Tax', is_default: false }] })}
          className="rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-2 text-sm text-[rgb(var(--text-secondary))] transition-colors hover:border-[rgba(201,169,98,0.45)] hover:text-[rgb(var(--text-primary))]"
        >
          + Add tax rate
        </button>
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
                <input
                  value={charge.name}
                  onChange={(event) => updateCharge(index, { name: event.target.value })}
                  className={compactInputClass}
                  placeholder="Service Charge"
                />
                <select
                  value={charge.charge_type}
                  onChange={(event) => updateCharge(index, { charge_type: event.target.value as ServiceChargeData['charge_type'] })}
                  className={compactInputClass}
                >
                  <option value="percentage">Percent</option>
                  <option value="fixed">Fixed $</option>
                </select>
                <input
                  inputMode="decimal"
                  value={charge.amount}
                  onChange={(event) => updateCharge(index, { amount: sanitizeNumber(event.target.value) })}
                  className={compactInputClass}
                  placeholder={charge.charge_type === 'fixed' ? 'Amount' : 'Rate %'}
                />
                <select
                  value={charge.applies_to}
                  onChange={(event) => updateCharge(index, { applies_to: event.target.value as ServiceChargeData['applies_to'] })}
                  className={compactInputClass}
                >
                  {CHARGE_APPLIES_TO.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
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
          onClick={() => updateData({ service_charges: [...serviceCharges, defaultServiceCharge(serviceCharges.length)] })}
          className="rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-2 text-sm text-[rgb(var(--text-secondary))] transition-colors hover:border-[rgba(201,169,98,0.45)] hover:text-[rgb(var(--text-primary))]"
        >
          + Add service charge
        </button>
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

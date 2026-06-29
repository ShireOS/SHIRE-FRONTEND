import type { TipPayrollSettingsData, TipRoleRuleData, UseOnboardingReturn } from '../../hooks/useOnboarding'

interface TipPayrollStepProps {
  onboarding: UseOnboardingReturn
}

const inputClass = 'w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]'
const labelClass = 'mb-1.5 block text-xs font-medium text-[rgb(var(--text-secondary))]'

const DISTRIBUTION_MODES: Array<{ value: TipPayrollSettingsData['tip_distribution_mode']; label: string }> = [
  { value: 'individual', label: 'Individual tips' },
  { value: 'pooled', label: 'Pooled tips' },
  { value: 'role_based', label: 'Role-based pool' },
  { value: 'sales_based', label: 'Sales-based split' },
  { value: 'hours_based', label: 'Hours-based split' },
  { value: 'points_based', label: 'Point-based split' },
]

const CASH_TIP_MODES: Array<{ value: TipPayrollSettingsData['cash_tip_declaration_mode']; label: string }> = [
  { value: 'not_tracked', label: 'Do not track cash tips' },
  { value: 'declared_by_employee', label: 'Employee declares' },
  { value: 'declared_by_manager', label: 'Manager declares' },
  { value: 'required_checkout', label: 'Required at checkout' },
]

const PAYROLL_FREQUENCIES: Array<{ value: TipPayrollSettingsData['payroll_export_frequency']; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'semimonthly', label: 'Semimonthly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'manual', label: 'Manual export' },
]

const TIPOUT_BASES: Array<{ value: TipPayrollSettingsData['tipout_basis']; label: string }> = [
  { value: 'none', label: 'No tipout' },
  { value: 'sales', label: 'Sales' },
  { value: 'tips', label: 'Tips' },
  { value: 'hours', label: 'Hours' },
  { value: 'points', label: 'Points' },
  { value: 'custom', label: 'Custom' },
]

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg border px-3 py-2 text-sm transition',
        active
          ? 'border-[rgba(212,168,84,0.45)] bg-[rgba(212,168,84,0.14)] text-[rgb(var(--gold))]'
          : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[rgb(var(--text-secondary))]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function TipPayrollStep({ onboarding }: TipPayrollStepProps) {
  const { data, updateData, saveTipPayrollSettings, nextStep, isLoading, error } = onboarding
  const settings = data.tip_payroll_settings
  const jobCodes = data.job_codes

  const update = (patch: Partial<TipPayrollSettingsData>) => {
    updateData({ tip_payroll_settings: { ...settings, ...patch } })
  }

  const updateRule = (index: number, patch: Partial<TipRoleRuleData>) => {
    const role_tip_rules = settings.role_tip_rules.map((rule, currentIndex) =>
      currentIndex === index ? { ...rule, ...patch } : rule
    )
    update({ role_tip_rules })
  }

  const handleContinue = async () => {
    await saveTipPayrollSettings()
    nextStep()
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="text-sm text-[rgb(var(--text-secondary))]">
          Configure who keeps tips, whether tips are pooled, how cash tips are declared, and whether credit card tips are paid nightly or through payroll.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass}>Tip distribution</label>
          <select value={settings.tip_distribution_mode} onChange={(event) => update({ tip_distribution_mode: event.target.value as TipPayrollSettingsData['tip_distribution_mode'] })} className={inputClass}>
            {DISTRIBUTION_MODES.map(option => <option key={option.value} value={option.value} className="bg-[#1a1a1a]">{option.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Cash tips</label>
          <select value={settings.cash_tip_declaration_mode} onChange={(event) => update({ cash_tip_declaration_mode: event.target.value as TipPayrollSettingsData['cash_tip_declaration_mode'] })} className={inputClass}>
            {CASH_TIP_MODES.map(option => <option key={option.value} value={option.value} className="bg-[#1a1a1a]">{option.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Credit card tips paid</label>
          <select value={settings.credit_tip_payout_timing} onChange={(event) => update({ credit_tip_payout_timing: event.target.value as TipPayrollSettingsData['credit_tip_payout_timing'] })} className={inputClass}>
            <option value="nightly" className="bg-[#1a1a1a]">Nightly</option>
            <option value="payroll" className="bg-[#1a1a1a]">Through payroll</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Payroll export</label>
          <select value={settings.payroll_export_frequency} onChange={(event) => update({ payroll_export_frequency: event.target.value as TipPayrollSettingsData['payroll_export_frequency'] })} className={inputClass}>
            {PAYROLL_FREQUENCIES.map(option => <option key={option.value} value={option.value} className="bg-[#1a1a1a]">{option.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Payroll provider</label>
          <input value={settings.payroll_provider} onChange={(event) => update({ payroll_provider: event.target.value })} placeholder="ADP, Gusto, manual..." className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Credit card fee %</label>
          <input inputMode="decimal" value={settings.credit_card_fee_percent} onChange={(event) => update({ credit_card_fee_percent: event.target.value.replace(/[^\d.]/g, '').slice(0, 6) })} placeholder="Optional" className={inputClass} />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[rgb(var(--gold))]">Pool & Tipout Rules</p>
        <div className="flex flex-wrap gap-2">
          <Toggle active={settings.tip_pooling_enabled} onClick={() => update({ tip_pooling_enabled: !settings.tip_pooling_enabled })}>Tip pooling enabled</Toggle>
          <Toggle active={settings.require_tipout_at_checkout} onClick={() => update({ require_tipout_at_checkout: !settings.require_tipout_at_checkout })}>Tipout at checkout</Toggle>
          <Toggle active={settings.allow_manager_tip_adjustments} onClick={() => update({ allow_manager_tip_adjustments: !settings.allow_manager_tip_adjustments })}>Manager tip edits</Toggle>
          <Toggle active={settings.tipout_sales_includes_tax} onClick={() => update({ tipout_sales_includes_tax: !settings.tipout_sales_includes_tax })}>Sales include tax</Toggle>
          <Toggle active={settings.tipout_include_managers} onClick={() => update({ tipout_include_managers: !settings.tipout_include_managers })}>Managers included</Toggle>
          <Toggle active={settings.auto_withhold_credit_card_fees} onClick={() => update({ auto_withhold_credit_card_fees: !settings.auto_withhold_credit_card_fees })}>Withhold card fees</Toggle>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Pool reset</label>
            <select value={settings.tip_pool_reset} onChange={(event) => update({ tip_pool_reset: event.target.value as TipPayrollSettingsData['tip_pool_reset'] })} className={inputClass}>
              <option value="shift" className="bg-[#1a1a1a]">Each shift</option>
              <option value="day" className="bg-[#1a1a1a]">Each day</option>
              <option value="pay_period" className="bg-[#1a1a1a]">Pay period</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Tipout basis</label>
            <select value={settings.tipout_basis} onChange={(event) => update({ tipout_basis: event.target.value as TipPayrollSettingsData['tipout_basis'] })} className={inputClass}>
              {TIPOUT_BASES.map(option => <option key={option.value} value={option.value} className="bg-[#1a1a1a]">{option.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[rgb(var(--gold))]">Role Tip Rules</p>
        {settings.role_tip_rules.map((rule, index) => {
          const role = jobCodes.find(code => code.code === rule.role_key)
          return (
            <div key={rule.role_key} className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">{role?.label || rule.role_key}</p>
                  <p className="text-xs text-[rgb(var(--text-tertiary))]">{rule.role_key}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Toggle active={rule.tip_eligible} onClick={() => updateRule(index, { tip_eligible: !rule.tip_eligible })}>Tip eligible</Toggle>
                  <Toggle active={rule.contributes_to_pool} onClick={() => updateRule(index, { contributes_to_pool: !rule.contributes_to_pool })}>Contributes</Toggle>
                  <Toggle active={rule.receives_from_pool} onClick={() => updateRule(index, { receives_from_pool: !rule.receives_from_pool })}>Receives</Toggle>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <input inputMode="decimal" value={rule.pool_points} onChange={(event) => updateRule(index, { pool_points: event.target.value.replace(/[^\d.]/g, '').slice(0, 6) })} placeholder="Pool points" className={inputClass} />
                <input inputMode="decimal" value={rule.tipout_percent} onChange={(event) => updateRule(index, { tipout_percent: event.target.value.replace(/[^\d.]/g, '').slice(0, 6) })} placeholder="Tipout %" className={inputClass} />
                <select value={rule.tipout_target_role} onChange={(event) => updateRule(index, { tipout_target_role: event.target.value })} className={inputClass}>
                  <option value="" className="bg-[#1a1a1a]">No target role</option>
                  {jobCodes.map(code => <option key={code.code} value={code.code} className="bg-[#1a1a1a]">{code.label}</option>)}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      <textarea value={settings.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="Any payroll or tipout notes..." className={`${inputClass} min-h-24`} />

      <button
        onClick={() => void handleContinue()}
        disabled={isLoading}
        className="w-full rounded-lg bg-white px-6 py-4 font-medium text-black transition-colors hover:bg-gray-100 disabled:opacity-50"
      >
        {isLoading ? 'Saving...' : 'Continue'}
      </button>
    </div>
  )
}

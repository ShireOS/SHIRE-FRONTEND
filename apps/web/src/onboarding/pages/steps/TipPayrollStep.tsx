import type { TipPayrollSettingsData, TipRoleRuleData, UseOnboardingReturn } from '../../hooks/useOnboarding'

interface TipPayrollStepProps {
  onboarding: UseOnboardingReturn
}

const inputClass = 'w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]'
const labelClass = 'mb-1.5 block text-xs font-medium text-[rgb(var(--text-secondary))]'

const POOL_METHODS: Array<{
  key: 'individual' | 'pooled' | 'hours_based' | 'points_based' | 'sales_based' | 'role_shares'
  mode: TipPayrollSettingsData['tip_distribution_mode']
  pooled: boolean
  title: string
  description: string
}> = [
  { key: 'individual', mode: 'individual', pooled: false, title: 'Keep own', description: 'Each employee keeps the tips on their own checks. No shared pool.' },
  { key: 'pooled', mode: 'pooled', pooled: true, title: 'Pool equally', description: 'Pool eligible tips, then split the pool evenly across receivers.' },
  { key: 'hours_based', mode: 'hours_based', pooled: true, title: 'Pool by hours', description: 'Split the pool based on hours worked. Optional weights can make one role earn more per hour.' },
  { key: 'points_based', mode: 'points_based', pooled: true, title: 'Pool by points', description: 'Split the pool by role weights, such as Server 10 points and Host 5 points.' },
  { key: 'sales_based', mode: 'sales_based', pooled: true, title: 'Pool by sales', description: 'Split the pool based on each employee or role sales.' },
  { key: 'role_shares', mode: 'role_shares', pooled: true, title: 'Pool by role %', description: 'Give each receiving role a configured percentage of the pool.' },
]

const CASH_TIP_MODES: Array<{ value: TipPayrollSettingsData['cash_tip_declaration_mode']; label: string }> = [
  { value: 'not_tracked', label: 'Not tracked — no declaration' },
  { value: 'declared_by_employee', label: 'Optional — employee may declare' },
  { value: 'declared_by_manager', label: 'Manager declares' },
  { value: 'required_checkout', label: 'Required before checkout' },
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

function ChoicePills({ value, options, onChange }: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className="inline-flex rounded-full border border-[rgba(255,255,255,0.1)] bg-black/20 p-1">
      {options.map(option => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={[
              'rounded-full px-3 py-1.5 text-xs font-semibold transition',
              selected
                ? 'bg-[rgb(var(--gold))] text-black shadow-sm'
                : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function activePoolMethod(settings: TipPayrollSettingsData): (typeof POOL_METHODS)[number]['key'] {
  if (!settings.tip_pooling_enabled || settings.tip_distribution_mode === 'individual') return 'individual'
  if (settings.tip_distribution_mode === 'role_based') return 'points_based'
  return POOL_METHODS.some(method => method.key === settings.tip_distribution_mode)
    ? settings.tip_distribution_mode as (typeof POOL_METHODS)[number]['key']
    : 'pooled'
}

export function TipPayrollStep({ onboarding }: TipPayrollStepProps) {
  const { data, updateData, saveTipPayrollSettings, nextStep, isLoading, error } = onboarding
  const settings = data.tip_payroll_settings
  const jobCodes = data.job_codes
  const methodKey = activePoolMethod(settings)
  const isPooled = methodKey !== 'individual'
  const isPointsMode = methodKey === 'points_based'
  const isHoursMode = methodKey === 'hours_based'
  const usesPoolWeight = isPointsMode || isHoursMode

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
          Configure whether tips are kept individually or pooled, how any pool is split, what tipouts are reserved from a role's tips, and how tips flow into payroll.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-[rgba(212,168,84,0.25)] bg-[rgba(212,168,84,0.06)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Apply employee payouts to expected drawer cash</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[rgb(var(--text-secondary))]">When on, Close Day subtracts only money employees receive now or nightly. Payroll amounts stay in the drawer.</p>
          </div>
          <ChoicePills
            value={settings.expected_drawer_payouts_enabled ? 'on' : 'off'}
            options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
            onChange={(value) => update({ expected_drawer_payouts_enabled: value === 'on' })}
          />
        </div>
        {settings.expected_drawer_payouts_enabled ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { label: 'Cash voluntary tips', value: settings.cash_tip_payout_timing, options: [{ value: 'immediate', label: 'Keep now' }, { value: 'payroll', label: 'Payroll' }], change: (value: string) => update({ cash_tip_payout_timing: value as TipPayrollSettingsData['cash_tip_payout_timing'] }) },
              { label: 'Cash employee gratuity', value: settings.cash_employee_gratuity_payout_timing, options: [{ value: 'immediate', label: 'Keep now' }, { value: 'payroll', label: 'Payroll' }], change: (value: string) => update({ cash_employee_gratuity_payout_timing: value as TipPayrollSettingsData['cash_employee_gratuity_payout_timing'] }) },
              { label: 'Card voluntary tips', value: settings.credit_tip_payout_timing, options: [{ value: 'nightly', label: 'Nightly cash' }, { value: 'payroll', label: 'Payroll' }], change: (value: string) => update({ credit_tip_payout_timing: value as TipPayrollSettingsData['credit_tip_payout_timing'] }) },
              { label: 'Card employee gratuity', value: settings.card_employee_gratuity_payout_timing, options: [{ value: 'nightly', label: 'Nightly cash' }, { value: 'payroll', label: 'Payroll' }], change: (value: string) => update({ card_employee_gratuity_payout_timing: value as TipPayrollSettingsData['card_employee_gratuity_payout_timing'] }) },
              { label: 'Tip-outs', value: settings.tipout_payout_timing, options: [{ value: 'nightly', label: 'Nightly drawer' }, { value: 'payroll', label: 'Payroll' }], change: (value: string) => update({ tipout_payout_timing: value as TipPayrollSettingsData['tipout_payout_timing'] }) },
            ].map(item => (
              <div key={item.label} className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-black/15 p-3">
                <p className="mb-2 text-xs font-medium text-[rgb(var(--text-secondary))]">{item.label}</p>
                <ChoicePills value={item.value} options={item.options} onChange={item.change} />
              </div>
            ))}
          </div>
        ) : null}
        <p className="text-xs leading-5 text-[rgb(var(--text-tertiary))]">Nightly tip-outs are withheld from contributors and paid to recipients through the drawer. Allocated tip-outs net to $0 additional drawer impact; unresolved amounts remain reserved.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass}>Cash tips</label>
          <select value={settings.cash_tip_declaration_mode} onChange={(event) => update({ cash_tip_declaration_mode: event.target.value as TipPayrollSettingsData['cash_tip_declaration_mode'] })} className={inputClass}>
            {CASH_TIP_MODES.map(option => <option key={option.value} value={option.value} className="bg-[#1a1a1a]">{option.label}</option>)}
          </select>
          <p className="mt-2 text-xs leading-5 text-[rgb(var(--text-tertiary))]">Optional means an employee can enter a real amount or Skip. Skip records no declaration; it is never treated as $0. Only required mode blocks Server Checkout.</p>
        </div>
        <div>
          <label className={labelClass}>Payroll export</label>
          <select value={settings.payroll_export_frequency} onChange={(event) => update({ payroll_export_frequency: event.target.value as TipPayrollSettingsData['payroll_export_frequency'] })} className={inputClass}>
            {PAYROLL_FREQUENCIES.map(option => <option key={option.value} value={option.value} className="bg-[#1a1a1a]">{option.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Pay period starts</label>
          <select value={settings.payroll_period_start_weekday} onChange={(event) => update({ payroll_period_start_weekday: Number(event.target.value) })} disabled={!['weekly', 'biweekly'].includes(settings.payroll_export_frequency)} className={inputClass}>
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((label, index) => <option key={label} value={index} className="bg-[#1a1a1a]">{label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Biweekly anchor date</label>
          <input type="date" value={settings.payroll_period_anchor_date} onChange={(event) => update({ payroll_period_anchor_date: event.target.value })} disabled={settings.payroll_export_frequency !== 'biweekly'} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Reports open to</label>
          <select value={settings.payroll_report_default_period} onChange={(event) => update({ payroll_report_default_period: event.target.value as TipPayrollSettingsData['payroll_report_default_period'] })} disabled={settings.payroll_export_frequency === 'manual'} className={inputClass}>
            <option value="last_completed" className="bg-[#1a1a1a]">Last completed period</option>
            <option value="current_open" className="bg-[#1a1a1a]">Current open period</option>
          </select>
        </div>
        {settings.payroll_export_frequency === 'semimonthly' ? (
          <div>
            <label className={labelClass}>First period ends on</label>
            <input type="number" min={1} max={27} value={settings.payroll_semimonthly_cutoff_day} onChange={(event) => update({ payroll_semimonthly_cutoff_day: Math.max(1, Math.min(27, Number(event.target.value) || 15)) })} className={inputClass} />
          </div>
        ) : null}
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
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[rgb(var(--gold))]">Pool & Tipout Rules</p>
          <p className="mt-1 text-xs text-[rgb(var(--text-secondary))]">
            Pick one pool method. Points and percentages are not the same: points weight who receives a point-based pool, while percentages say how much of a role's tips gets reserved for a pool or tipout.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {POOL_METHODS.map(method => {
            const selected = methodKey === method.key
            return (
              <button
                key={method.key}
                type="button"
                onClick={() => update({ tip_distribution_mode: method.mode, tip_pooling_enabled: method.pooled })}
                className={[
                  'rounded-lg border p-3 text-left transition',
                  selected
                    ? 'border-[rgba(212,168,84,0.55)] bg-[rgba(212,168,84,0.12)]'
                    : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] hover:border-[rgba(212,168,84,0.35)]',
                ].join(' ')}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--text-primary))]">
                  <span className={[
                    'h-3.5 w-3.5 flex-none rounded-full border',
                    selected ? 'border-[rgb(var(--gold))] bg-[rgb(var(--gold))] shadow-[inset_0_0_0_3px_rgba(0,0,0,0.65)]' : 'border-[rgb(var(--text-tertiary))]',
                  ].join(' ')} />
                  {method.title}
                </span>
                <span className="mt-1.5 block text-xs leading-relaxed text-[rgb(var(--text-secondary))]">{method.description}</span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle active={settings.require_tipout_at_checkout} onClick={() => update({ require_tipout_at_checkout: !settings.require_tipout_at_checkout })}>Tipout at checkout</Toggle>
          <Toggle active={settings.allow_manager_tip_adjustments} onClick={() => update({ allow_manager_tip_adjustments: !settings.allow_manager_tip_adjustments })}>Manager tip edits</Toggle>
          <Toggle active={settings.tipout_sales_includes_tax} onClick={() => update({ tipout_sales_includes_tax: !settings.tipout_sales_includes_tax })}>Sales include tax</Toggle>
          <Toggle active={settings.tipout_include_managers} onClick={() => update({ tipout_include_managers: !settings.tipout_include_managers })}>Managers included</Toggle>
          <Toggle active={settings.auto_withhold_credit_card_fees} onClick={() => update({ auto_withhold_credit_card_fees: !settings.auto_withhold_credit_card_fees })}>Withhold card fees</Toggle>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Pool reset</label>
            <select value={settings.tip_pool_reset} disabled={!isPooled} onChange={(event) => update({ tip_pool_reset: event.target.value as TipPayrollSettingsData['tip_pool_reset'] })} className={`${inputClass} ${isPooled ? '' : 'opacity-40'}`}>
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
                {isPooled && rule.contributes_to_pool ? (
                  <div>
                    <label className={labelClass}>% of tips into pool</label>
                    <input inputMode="decimal" value={rule.pool_contribution_percent} onChange={(event) => updateRule(index, { pool_contribution_percent: event.target.value.replace(/[^\d.]/g, '').slice(0, 6) })} placeholder="100" className={inputClass} />
                  </div>
                ) : null}
                {usesPoolWeight ? (
                  <div>
                    <label className={labelClass}>{isHoursMode ? 'Hourly pool weight' : 'Pool share points'}</label>
                    <input
                      inputMode="decimal"
                      value={rule.pool_points}
                      onChange={(event) => updateRule(index, { pool_points: event.target.value.replace(/[^\d.]/g, '').slice(0, 6) })}
                      placeholder={isHoursMode ? '1.0' : 'e.g. 10'}
                      className={inputClass}
                    />
                  </div>
                ) : null}
                <div>
                  <label className={labelClass}>Tipout amount</label>
                  <input inputMode="decimal" value={rule.tipout_percent} onChange={(event) => updateRule(index, { tipout_percent: event.target.value.replace(/[^\d.]/g, '').slice(0, 6) })} placeholder="Optional" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Tipout goes to</label>
                  <select value={rule.tipout_target_role} onChange={(event) => updateRule(index, { tipout_target_role: event.target.value })} className={inputClass}>
                    <option value="" className="bg-[#1a1a1a]">No target role</option>
                    {jobCodes.map(code => <option key={code.code} value={code.code} className="bg-[#1a1a1a]">{code.label}</option>)}
                  </select>
                </div>
              </div>
              {usesPoolWeight ? (
                <p className="mt-2 text-xs text-[rgb(var(--text-tertiary))]">
                  {isPointsMode
                    ? 'Points are relative weights for receiving the pool. A 10 point role receives twice the share of a 5 point role.'
                    : 'Weight per hour multiplies hours for that role. Leave roles at 1 for a straight hours-based split.'}
                </p>
              ) : null}
              {!isPooled ? (
                <p className="mt-2 text-xs text-[rgb(var(--text-tertiary))]">
                  Keep own means there is no shared pool. Only use the tipout fields if this role gives a set percent of its own tips to another role.
                </p>
              ) : null}
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

import type { DiscountRuleData, UseOnboardingReturn } from '../../hooks/useOnboarding'

interface DiscountRulesStepProps {
  onboarding: UseOnboardingReturn
}

const DISCOUNT_TYPES: Array<{ value: DiscountRuleData['discount_type']; label: string }> = [
  { value: 'discount', label: 'Discount' },
  { value: 'comp', label: 'Comp' },
  { value: 'promo', label: 'Promo' },
  { value: 'employee_meal', label: 'Employee meal' },
  { value: 'service_recovery', label: 'Service recovery' },
]

const APPLIES_TO: Array<{ value: DiscountRuleData['applies_to']; label: string }> = [
  { value: 'item', label: 'Item' },
  { value: 'check', label: 'Check' },
  { value: 'both', label: 'Both' },
]

const VALUE_TYPES: Array<{ value: DiscountRuleData['value_type']; label: string }> = [
  { value: 'percent', label: 'Percent %' },
  { value: 'fixed', label: 'Fixed $' },
  // The custom-amount key. The POS shows a keypad instead of a preset tile and
  // staff type the figure, bounded by min/max.
  { value: 'open', label: 'Custom — staff enters amount' },
]

/** An open rule is unbounded without a ceiling, so the API requires a maximum. */
const needsBounds = (rule: DiscountRuleData) => rule.value_type === 'open' || rule.editable_by_employee

/** Mirrors the server-side validation so the operator sees it before saving. */
const ruleWarning = (rule: DiscountRuleData): string => {
  if (rule.value_type === 'open' && !rule.max_value.trim()) {
    return 'Staff enter this amount, so it needs a maximum.'
  }
  if (rule.value_type !== 'open' && !rule.default_value.trim()) {
    return 'Set a default value, or switch it to a custom amount.'
  }
  if (rule.min_value.trim() && rule.max_value.trim() && Number(rule.min_value) > Number(rule.max_value)) {
    return 'Minimum cannot exceed maximum.'
  }
  if (rule.value_type === 'percent' && Number(rule.default_value || 0) > 100) {
    return 'A percent discount cannot exceed 100%.'
  }
  return ''
}

const TAX_BEHAVIORS: Array<{ value: DiscountRuleData['tax_behavior']; label: string }> = [
  { value: 'reduce_taxable_amount', label: 'Reduce taxable amount' },
  { value: 'apply_after_tax', label: 'Apply after tax' },
  { value: 'no_tax_impact', label: 'No tax impact' },
]

const ROLE_OPTIONS = ['owner', 'manager', 'server', 'bartender', 'cashier', 'host', 'runner', 'busser']
const SERVICE_MODES = [
  { value: 'dine_in', label: 'Dine-in' },
  { value: 'bar', label: 'Bar' },
  { value: 'counter_service', label: 'Counter' },
  { value: 'takeout', label: 'Takeout' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'catering', label: 'Catering' },
]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const inputClass = 'w-full min-w-0 px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]'
const sanitizeNumber = (value: string) => value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 10)

const newRule = (index: number, template?: Partial<DiscountRuleData>): DiscountRuleData => ({
  name: template?.name || (index === 0 ? 'Manager Comp' : `Discount ${index + 1}`),
  discount_type: template?.discount_type || 'discount',
  applies_to: template?.applies_to || 'check',
  value_type: template?.value_type || 'percent',
  // Prefilled so a freshly added rule is savable; an empty default is rejected.
  default_value: template?.default_value ?? '10',
  editable_by_employee: template?.editable_by_employee || false,
  min_value: template?.min_value || '',
  max_value: template?.max_value || '',
  allowed_roles: template?.allowed_roles || ['owner', 'manager'],
  requires_manager_approval: template?.requires_manager_approval || false,
  tax_behavior: template?.tax_behavior || 'reduce_taxable_amount',
  reason_required: template?.reason_required || false,
  service_modes: template?.service_modes || [],
  days_of_week: template?.days_of_week || [],
  is_active: true,
})

function Pill({
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

export function DiscountRulesStep({ onboarding }: DiscountRulesStepProps) {
  const { data, updateData, saveDiscountRules, nextStep, isLoading, error } = onboarding
  const rules = data.discount_rules

  const updateRule = (index: number, patch: Partial<DiscountRuleData>) => {
    updateData({
      discount_rules: rules.map((rule, currentIndex) => currentIndex === index ? { ...rule, ...patch } : rule),
    })
  }

  const toggleArrayValue = <T extends string | number,>(values: T[], value: T) =>
    values.includes(value) ? values.filter(item => item !== value) : [...values, value]

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await saveDiscountRules()
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

      <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="text-sm leading-6 text-[rgb(var(--text-secondary))]">
          Add POS discount rules for comps, promos, employee meals, or service recovery. These become the buttons staff see on the discount screen.
        </p>
        <p className="mt-2 text-sm leading-6 text-[rgb(var(--text-tertiary))]">
          A <strong className="text-[rgb(var(--text-secondary))]">preset</strong> carries a fixed value — &ldquo;Employee Meal, 50%&rdquo; — and applies in one tap.
          A <strong className="text-[rgb(var(--text-secondary))]">custom</strong> rule (value type &ldquo;Custom&rdquo;) has no set value: the POS shows a keypad and
          staff type the amount, capped by the maximum you set. Use <em>Applies to</em> to decide whether a rule can be
          used on the whole check, on individual items, or both.
        </p>
      </div>

      {rules.length === 0 && (
        <div className="rounded-lg border border-dashed border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.02)] p-5 text-sm text-[rgb(var(--text-secondary))]">
          No discount rules configured.
        </div>
      )}

      <div className="space-y-4">
        {rules.map((rule, index) => (
          <div key={rule.id || `discount:${index}`} className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
              <input
                value={rule.name}
                onChange={(event) => updateRule(index, { name: event.target.value })}
                className={inputClass}
                placeholder="Manager Comp"
              />
              <select
                value={rule.discount_type}
                onChange={(event) => updateRule(index, { discount_type: event.target.value as DiscountRuleData['discount_type'] })}
                className={inputClass}
              >
                {DISCOUNT_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select
                value={rule.applies_to}
                onChange={(event) => updateRule(index, { applies_to: event.target.value as DiscountRuleData['applies_to'] })}
                className={inputClass}
              >
                {APPLIES_TO.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_0.8fr_1.2fr]">
              <select
                value={rule.value_type}
                onChange={(event) => updateRule(index, { value_type: event.target.value as DiscountRuleData['value_type'] })}
                className={inputClass}
              >
                {VALUE_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <input
                inputMode="decimal"
                value={rule.default_value}
                disabled={rule.value_type === 'open'}
                onChange={(event) => updateRule(index, { default_value: sanitizeNumber(event.target.value) })}
                className={inputClass}
                placeholder={rule.value_type === 'open' ? 'Staff enters the amount' : rule.value_type === 'fixed' ? 'Default $' : 'Default %'}
              />
              <select
                value={rule.tax_behavior}
                onChange={(event) => updateRule(index, { tax_behavior: event.target.value as DiscountRuleData['tax_behavior'] })}
                className={inputClass}
              >
                {TAX_BEHAVIORS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Pill active={rule.editable_by_employee} onClick={() => updateRule(index, { editable_by_employee: !rule.editable_by_employee })}>Editable by employee</Pill>
              <Pill active={rule.requires_manager_approval} onClick={() => updateRule(index, { requires_manager_approval: !rule.requires_manager_approval })}>Manager approval</Pill>
              <Pill active={rule.reason_required} onClick={() => updateRule(index, { reason_required: !rule.reason_required })}>Reason required</Pill>
              <button
                type="button"
                onClick={() => updateData({ discount_rules: rules.filter((_, currentIndex) => currentIndex !== index) })}
                className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 transition hover:border-red-400/50"
              >
                Remove
              </button>
            </div>

            {needsBounds(rule) && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  inputMode="decimal"
                  value={rule.min_value}
                  onChange={(event) => updateRule(index, { min_value: sanitizeNumber(event.target.value) })}
                  className={inputClass}
                  placeholder={rule.value_type === 'fixed' ? 'Minimum $' : 'Minimum %'}
                />
                <input
                  inputMode="decimal"
                  value={rule.max_value}
                  onChange={(event) => updateRule(index, { max_value: sanitizeNumber(event.target.value) })}
                  className={inputClass}
                  placeholder={`${rule.value_type === 'fixed' ? 'Maximum $' : 'Maximum %'}${rule.value_type === 'open' ? ' (required)' : ''}`}
                />
              </div>
            )}

            {ruleWarning(rule) && (
              <p className="mt-3 text-xs font-semibold text-amber-300">{ruleWarning(rule)}</p>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <p className="label-mono mb-2 text-[rgb(var(--gold))]">Allowed Roles</p>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map(role => (
                    <Pill key={role} active={rule.allowed_roles.includes(role)} onClick={() => updateRule(index, { allowed_roles: toggleArrayValue(rule.allowed_roles, role) })}>
                      {role}
                    </Pill>
                  ))}
                </div>
              </div>

              <div>
                <p className="label-mono mb-2 text-[rgb(var(--gold))]">Availability</p>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_MODES.map(mode => (
                    <Pill key={mode.value} active={rule.service_modes.includes(mode.value)} onClick={() => updateRule(index, { service_modes: toggleArrayValue(rule.service_modes, mode.value) })}>
                      {mode.label}
                    </Pill>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAYS.map((day, dayIndex) => (
                    <Pill key={day} active={rule.days_of_week.includes(dayIndex)} onClick={() => updateRule(index, { days_of_week: toggleArrayValue(rule.days_of_week, dayIndex).sort((a, b) => a - b) })}>
                      {day}
                    </Pill>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateData({ discount_rules: [...rules, newRule(rules.length)] })}
          className="rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-2 text-sm text-[rgb(var(--text-secondary))] transition-colors hover:border-[rgba(201,169,98,0.45)] hover:text-[rgb(var(--text-primary))]"
        >
          + Add discount
        </button>
        {[
          newRule(rules.length, { name: 'Manager Comp', discount_type: 'comp', applies_to: 'both', value_type: 'open', editable_by_employee: true, max_value: '100', reason_required: true }),
          newRule(rules.length, { name: 'Employee Meal', discount_type: 'employee_meal', applies_to: 'item', value_type: 'percent', default_value: '50' }),
          newRule(rules.length, { name: 'Service Recovery', discount_type: 'service_recovery', applies_to: 'check', value_type: 'fixed', default_value: '20', reason_required: true }),
          newRule(rules.length, { name: 'Custom Amount', discount_type: 'discount', applies_to: 'both', value_type: 'open', default_value: '', editable_by_employee: true, max_value: '50', requires_manager_approval: true, reason_required: true }),
          newRule(rules.length, { name: 'Item Comp', discount_type: 'comp', applies_to: 'item', value_type: 'percent', default_value: '100', requires_manager_approval: true, reason_required: true }),
        ].filter(template => !rules.some(rule => rule.name.toLowerCase() === template.name.toLowerCase())).map(template => (
          <button
            key={template.name}
            type="button"
            onClick={() => updateData({ discount_rules: [...rules, template] })}
            className="rounded-lg bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-[rgb(var(--text-tertiary))] transition-colors hover:bg-[rgba(255,255,255,0.09)] hover:text-[rgb(var(--text-primary))]"
          >
            {template.name}
          </button>
        ))}
      </div>

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

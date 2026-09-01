import type { CheckWorkflowSettingsData, UseOnboardingReturn } from '../../hooks/useOnboarding'
import { sanitizeMoneyInput } from '@shire/settings'

interface CheckWorkflowStepProps {
  onboarding: UseOnboardingReturn
}

const inputClass = 'w-full min-w-0 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-4 py-3 text-sm text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]'
const labelClass = 'mb-1.5 block text-xs font-medium text-[rgb(var(--text-secondary))]'

const FIRE_MODES: Array<{ value: CheckWorkflowSettingsData['default_order_fire_mode']; label: string }> = [
  { value: 'manual', label: 'Manual fire' },
  { value: 'immediate', label: 'Send immediately' },
  { value: 'by_course', label: 'Course-based' },
]

function Toggle({
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
          : 'border-[rgba(255,255,255,0.1)] text-[rgb(var(--text-tertiary))] hover:border-[rgba(255,255,255,0.22)] hover:text-[rgb(var(--text-primary))]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  )
}

export function CheckWorkflowStep({ onboarding }: CheckWorkflowStepProps) {
  const { data, updateData, saveCheckWorkflowSettings, nextStep, isLoading, error } = onboarding
  const settings = data.check_workflow_settings

  const update = (patch: Partial<CheckWorkflowSettingsData>) => {
    updateData({ check_workflow_settings: { ...settings, ...patch } })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await saveCheckWorkflowSettings()
      nextStep()
    } catch {
      // Hook owns visible error.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <h3 className="mb-2 text-sm font-semibold text-[rgb(var(--text-primary))]">Seats & Firing</h3>
        <p className="mb-4 text-sm text-[rgb(var(--text-secondary))]">
          Controls how servers enter seats, hold courses, and send items to prep stations.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Default fire mode">
            <select value={settings.default_order_fire_mode} onChange={(event) => update({ default_order_fire_mode: event.target.value as CheckWorkflowSettingsData['default_order_fire_mode'] })} className={inputClass}>
              {FIRE_MODES.map(option => <option key={option.value} value={option.value} className="bg-[#1a1a1a]">{option.label}</option>)}
            </select>
          </Field>
          <Field label="Sent-item correction window (minutes)">
            <input
              value={settings.sent_item_correction_window_minutes}
              onChange={(event) => update({ sent_item_correction_window_minutes: String(Math.max(0, Math.min(15, Number(event.target.value.replace(/[^\d]/g, '') || 0)))) })}
              className={inputClass}
              inputMode="numeric"
              placeholder="4"
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Toggle active={settings.seat_numbers_enabled} onClick={() => update({ seat_numbers_enabled: !settings.seat_numbers_enabled })}>Seat numbers</Toggle>
          <Toggle active={settings.seat_number_required} onClick={() => update({ seat_number_required: !settings.seat_number_required })}>Seats required</Toggle>
          <Toggle active={settings.course_required} onClick={() => update({ course_required: !settings.course_required })}>Course required</Toggle>
          <Toggle active={settings.allow_hold_and_fire} onClick={() => update({ allow_hold_and_fire: !settings.allow_hold_and_fire })}>Hold & fire</Toggle>
          <Toggle active={settings.split_by_seat_enabled} onClick={() => update({ split_by_seat_enabled: !settings.split_by_seat_enabled })}>Split by seat</Toggle>
          <Toggle active={settings.split_by_item_enabled} onClick={() => update({ split_by_item_enabled: !settings.split_by_item_enabled })}>Split by item</Toggle>
        </div>
      </section>

      <section className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <h3 className="mb-2 text-sm font-semibold text-[rgb(var(--text-primary))]">Tabs & Preauthorization</h3>
        <p className="mb-4 text-sm text-[rgb(var(--text-secondary))]">
          Sets bar-tab behavior, whether cards are preauthorized, and how paid tabs close.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Default preauth amount">
            <input value={settings.default_preauth_amount} onChange={(event) => update({ default_preauth_amount: sanitizeMoneyInput(event.target.value) })} className={inputClass} inputMode="decimal" placeholder="Optional" />
          </Field>
          <Field label="Tab name">
            <select value={settings.tab_name_required ? 'required' : 'optional'} onChange={(event) => update({ tab_name_required: event.target.value === 'required' })} className={inputClass}>
              <option value="required" className="bg-[#1a1a1a]">Required</option>
              <option value="optional" className="bg-[#1a1a1a]">Optional</option>
            </select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Toggle active={settings.allow_bar_tabs} onClick={() => update({ allow_bar_tabs: !settings.allow_bar_tabs })}>Bar tabs</Toggle>
          <Toggle active={settings.card_preauth_required} onClick={() => update({ card_preauth_required: !settings.card_preauth_required })}>Card preauth</Toggle>
          <Toggle active={settings.require_manager_for_reopen} onClick={() => update({ require_manager_for_reopen: !settings.require_manager_for_reopen })}>Manager reopen approval</Toggle>
        </div>
      </section>

      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center rounded-lg bg-white px-6 py-4 font-medium text-black transition-colors hover:bg-gray-100 disabled:opacity-50"
      >
        {isLoading ? 'Saving...' : 'Continue'}
      </button>
    </form>
  )
}

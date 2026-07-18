import type { CloseoutSettingsData, UseOnboardingReturn } from '../../hooks/useOnboarding'

interface CloseoutSettingsStepProps {
  onboarding: UseOnboardingReturn
}

const CASH_MODES: Array<{ value: CloseoutSettingsData['cash_tracking_mode']; label: string }> = [
  { value: 'shared_drawer', label: 'Shared drawer' },
  { value: 'per_terminal', label: 'Drawer per terminal' },
  { value: 'per_employee', label: 'Server bank / employee drawer' },
  { value: 'no_cash', label: 'No cash accepted' },
]

const REPORT_DELIVERY: Array<{ value: CloseoutSettingsData['server_checkout_report_delivery']; label: string }> = [
  { value: 'none', label: 'No report' },
  { value: 'print', label: 'Print' },
  { value: 'email', label: 'Email' },
  { value: 'print_and_email', label: 'Print + email' },
]

const BATCH_MODES: Array<{ value: CloseoutSettingsData['eod_batch_close_mode']; label: string }> = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'manual', label: 'Manual' },
  { value: 'prompt_manager', label: 'Prompt manager' },
]

const REPORTS = [
  ['sales_summary', 'Sales'],
  ['labor_summary', 'Labor'],
  ['cash_drawer_summary', 'Cash drawer'],
  ['tip_summary', 'Tips'],
  ['discounts_voids_refunds', 'Discounts/voids/refunds'],
  ['tax_summary', 'Taxes'],
] as const

const inputClass = 'w-full min-w-0 px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]'
const sanitizeNumber = (value: string) => value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 10)

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

export function CloseoutSettingsStep({ onboarding }: CloseoutSettingsStepProps) {
  const { data, updateData, saveCloseoutSettings, nextStep, isLoading, error } = onboarding
  const settings = data.closeout_settings

  const update = (patch: Partial<CloseoutSettingsData>) => {
    updateData({ closeout_settings: { ...settings, ...patch } })
  }

  const toggleReport = (report: string) => {
    const reports = settings.eod_reports.includes(report)
      ? settings.eod_reports.filter(item => item !== report)
      : [...settings.eod_reports, report]
    update({ eod_reports: reports })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await saveCloseoutSettings()
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
        <h3 className="mb-3 text-sm font-semibold text-[rgb(var(--text-primary))]">Cash Management</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={settings.cash_tracking_mode} onChange={(event) => update({ cash_tracking_mode: event.target.value as CloseoutSettingsData['cash_tracking_mode'] })} className={inputClass}>
            {CASH_MODES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input value={settings.cash_drop_threshold} onChange={(event) => update({ cash_drop_threshold: sanitizeNumber(event.target.value) })} className={inputClass} inputMode="decimal" placeholder="Cash drop threshold" />
          <input value={settings.cash_variance_threshold} onChange={(event) => update({ cash_variance_threshold: sanitizeNumber(event.target.value) })} className={inputClass} inputMode="decimal" placeholder="Variance approval threshold" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Toggle active={settings.require_starting_bank} onClick={() => update({ require_starting_bank: !settings.require_starting_bank })}>Starting bank required</Toggle>
          <Toggle active={settings.blind_drawer_close} onClick={() => update({ blind_drawer_close: !settings.blind_drawer_close })}>Blind close</Toggle>
          <Toggle active={settings.allow_paid_in_out} onClick={() => update({ allow_paid_in_out: !settings.allow_paid_in_out })}>Paid in/out</Toggle>
          <Toggle active={settings.require_manager_for_drawer_open} onClick={() => update({ require_manager_for_drawer_open: !settings.require_manager_for_drawer_open })}>Manager drawer open</Toggle>
        </div>
      </section>

      <section className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[rgb(var(--text-primary))]">Server Checkout</h3>
        <select value={settings.server_checkout_report_delivery} onChange={(event) => update({ server_checkout_report_delivery: event.target.value as CloseoutSettingsData['server_checkout_report_delivery'] })} className={inputClass}>
          {REPORT_DELIVERY.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <div className="mt-3 flex flex-wrap gap-2">
          <Toggle active={settings.server_require_all_checks_closed} onClick={() => update({ server_require_all_checks_closed: !settings.server_require_all_checks_closed })}>Checks closed</Toggle>
          <Toggle active={settings.server_require_tabs_closed} onClick={() => update({ server_require_tabs_closed: !settings.server_require_tabs_closed })}>Tabs closed</Toggle>
          <Toggle active={settings.server_require_credit_tips_reviewed} onClick={() => update({ server_require_credit_tips_reviewed: !settings.server_require_credit_tips_reviewed })}>Credit tips reviewed</Toggle>
          <Toggle active={settings.server_require_tipout_entry} onClick={() => update({ server_require_tipout_entry: !settings.server_require_tipout_entry })}>Tipout entry</Toggle>
          <Toggle active={settings.server_require_manager_approval} onClick={() => update({ server_require_manager_approval: !settings.server_require_manager_approval })}>Manager approval</Toggle>
          <Toggle active={settings.allow_clockout_before_checkout} onClick={() => update({ allow_clockout_before_checkout: !settings.allow_clockout_before_checkout })}>Clock out before checkout</Toggle>
        </div>
      </section>

      <section className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[rgb(var(--text-primary))]">End of Day</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={settings.eod_batch_close_mode} onChange={(event) => update({ eod_batch_close_mode: event.target.value as CloseoutSettingsData['eod_batch_close_mode'] })} className={inputClass}>
            {BATCH_MODES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input
            value={settings.eod_report_recipients.join(', ')}
            onChange={(event) => update({ eod_report_recipients: event.target.value.split(',').map(email => email.trim()).filter(Boolean) })}
            className={inputClass}
            placeholder="Report emails, comma-separated"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Toggle active={settings.eod_email_on_close} onClick={() => update({ eod_email_on_close: !settings.eod_email_on_close })}>Email final report on close</Toggle>
          <Toggle active={settings.eod_email_formats.includes('pdf')} onClick={() => update({ eod_email_formats: settings.eod_email_formats.includes('pdf') ? settings.eod_email_formats.filter(format => format !== 'pdf') : [...settings.eod_email_formats, 'pdf'] })}>PDF</Toggle>
          <Toggle active={settings.eod_email_formats.includes('xlsx')} onClick={() => update({ eod_email_formats: settings.eod_email_formats.includes('xlsx') ? settings.eod_email_formats.filter(format => format !== 'xlsx') : [...settings.eod_email_formats, 'xlsx'] })}>Excel</Toggle>
          <Toggle active={settings.eod_require_drawers_closed} onClick={() => update({ eod_require_drawers_closed: !settings.eod_require_drawers_closed })}>Drawers closed</Toggle>
          <Toggle active={settings.eod_require_servers_checked_out} onClick={() => update({ eod_require_servers_checked_out: !settings.eod_require_servers_checked_out })}>Servers checked out</Toggle>
          <Toggle active={settings.eod_require_open_checks_resolved} onClick={() => update({ eod_require_open_checks_resolved: !settings.eod_require_open_checks_resolved })}>Open checks resolved</Toggle>
          <Toggle active={settings.eod_require_paid_outs_reviewed} onClick={() => update({ eod_require_paid_outs_reviewed: !settings.eod_require_paid_outs_reviewed })}>Paid outs reviewed</Toggle>
          <Toggle active={settings.eod_require_tip_adjustments_reviewed} onClick={() => update({ eod_require_tip_adjustments_reviewed: !settings.eod_require_tip_adjustments_reviewed })}>Tip edits reviewed</Toggle>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {REPORTS.map(([value, label]) => (
            <Toggle key={value} active={settings.eod_reports.includes(value)} onClick={() => toggleReport(value)}>
              {label}
            </Toggle>
          ))}
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

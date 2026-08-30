import { useEffect, useState } from 'react'
import type { CloseoutSettingsData, UseOnboardingReturn } from '../../hooks/useOnboarding'

interface CloseoutSettingsStepProps {
  onboarding: UseOnboardingReturn
}

const CASH_MODES: Array<{ value: CloseoutSettingsData['cash_tracking_mode']; label: string }> = [
  { value: 'shared_drawer', label: 'One shared drawer' },
  { value: 'per_terminal', label: 'Separate drawer per terminal' },
  { value: 'per_employee', label: 'Server banks / employee drawers' },
  { value: 'no_cash', label: 'No cash accepted' },
]

const REPORT_DELIVERY: Array<{ value: CloseoutSettingsData['server_checkout_report_delivery']; label: string }> = [
  { value: 'none', label: 'Do not send checkout report' },
  { value: 'print', label: 'Print checkout report' },
  { value: 'email', label: 'Email checkout report' },
  { value: 'print_and_email', label: 'Print and email checkout report' },
]

const BATCH_MODES: Array<{ value: CloseoutSettingsData['eod_batch_close_mode']; label: string }> = [
  { value: 'automatic', label: 'Auto-close eligible batches' },
  { value: 'manual', label: 'Manager closes batches manually' },
  { value: 'prompt_manager', label: 'Prompt manager before closing' },
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
  help,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  help?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg border px-3 py-2 text-left text-xs font-semibold transition',
        active
          ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.1)] text-[rgb(var(--text-primary))]'
          : 'border-[rgba(255,255,255,0.1)] text-[rgb(var(--text-tertiary))] hover:border-[rgba(255,255,255,0.22)] hover:text-[rgb(var(--text-primary))]',
      ].join(' ')}
    >
      <span className="block">{children}</span>
      {help && <span className="mt-1 block text-[11px] font-normal leading-4 opacity-75">{help}</span>}
    </button>
  )
}

function SectionIntro({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-[rgb(var(--text-primary))]">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-[rgb(var(--text-tertiary))]">{description}</p>
    </div>
  )
}

function MoneyField({
  label,
  help,
  value,
  onChange,
}: {
  label: string
  help: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-1">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--text-tertiary))]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(sanitizeNumber(event.target.value))}
        className={inputClass}
        inputMode="decimal"
        placeholder="Blank for none"
      />
      <span className="block text-[11px] leading-4 text-[rgb(var(--text-tertiary))]">{help}</span>
    </label>
  )
}

export function CloseoutSettingsStep({ onboarding }: CloseoutSettingsStepProps) {
  const { data, updateData, saveCloseoutSettings, nextStep, isLoading, error } = onboarding
  const settings = data.closeout_settings
  const [reportRecipientsText, setReportRecipientsText] = useState(settings.eod_report_recipients.join(', '))

  useEffect(() => {
    setReportRecipientsText(settings.eod_report_recipients.join(', '))
  }, [settings.eod_report_recipients])

  const update = (patch: Partial<CloseoutSettingsData>) => {
    updateData({ closeout_settings: { ...settings, ...patch } })
  }

  const commitReportRecipients = (value = reportRecipientsText) => {
    update({ eod_report_recipients: value.split(',').map(email => email.trim()).filter(Boolean) })
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

      <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="text-sm leading-6 text-[rgb(var(--text-secondary))]">
          Decide what must be reconciled before employees clock out and before managers close the business day.
        </p>
      </div>

      <section className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <SectionIntro
          title="Cash Management"
          description="Controls how physical cash is tracked during service and when a manager needs to review drawer activity."
        />
        <select value={settings.cash_tracking_mode} onChange={(event) => update({ cash_tracking_mode: event.target.value as CloseoutSettingsData['cash_tracking_mode'] })} className={inputClass}>
          {CASH_MODES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={settings.opening_bank_source} onChange={(event) => update({ opening_bank_source: event.target.value as CloseoutSettingsData['opening_bank_source'], require_starting_bank: false })} className={`${inputClass} mt-3`}>
          <option value="none">Opening bank: $0 automatically</option>
          <option value="fixed">Opening bank: fixed amount</option>
          <option value="previous_retained">Starting cash: use cash left at last Close Day (recommended)</option>
        </select>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {settings.opening_bank_source !== 'none' && (
            <MoneyField
              label={settings.opening_bank_source === 'fixed' ? 'Fixed opening bank' : 'Opening bank fallback'}
              value={settings.opening_bank_default}
              onChange={(value) => update({ opening_bank_default: value })}
              help={settings.opening_bank_source === 'fixed' ? 'Applied automatically; staff never confirms it.' : 'Used only when no prior finalized retained amount exists.'}
            />
          )}
          <MoneyField
            label="Cash drop threshold"
            value={settings.cash_drop_threshold}
            onChange={(value) => update({ cash_drop_threshold: value })}
            help="When a drawer holds more than this cash amount, prompt a cash drop."
          />
          <MoneyField
            label="Over/short review amount"
            value={settings.cash_variance_threshold}
            onChange={(value) => update({ cash_variance_threshold: value })}
            help="If counted cash is off by more than this amount, require manager review."
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Toggle active={settings.track_deposit_at_close} help="Cash left in drawer is always recorded. Also require deposit plus cash left to equal the current count." onClick={() => update({ track_deposit_at_close: !settings.track_deposit_at_close })}>Require deposit amount at close</Toggle>
          <Toggle active={settings.blind_drawer_close} help="Cashiers enter counts without seeing expected cash first." onClick={() => update({ blind_drawer_close: !settings.blind_drawer_close })}>Use blind drawer close</Toggle>
          <Toggle active={settings.allow_paid_in_out} help="Allow cash to be added or removed for non-sale reasons." onClick={() => update({ allow_paid_in_out: !settings.allow_paid_in_out })}>Allow paid in/out</Toggle>
          <Toggle active={!settings.require_manager_for_drawer_open} help="Authorized staff may use No Sale without a manager only on a terminal with its own assigned drawer. Paid Out and Cash Drop safeguards stay separate." onClick={() => update({ require_manager_for_drawer_open: !settings.require_manager_for_drawer_open })}>Allow authorized staff to open their assigned drawer</Toggle>
        </div>
      </section>

      <section className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <SectionIntro
          title="Server Checkout"
          description="Sets what servers must resolve before clocking out, including open checks, tabs, tips, and manager signoff."
        />
        <select value={settings.server_checkout_report_delivery} onChange={(event) => update({ server_checkout_report_delivery: event.target.value as CloseoutSettingsData['server_checkout_report_delivery'] })} className={inputClass}>
          {REPORT_DELIVERY.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Toggle active={settings.server_require_all_checks_closed} help="Block checkout while the server still owns open checks." onClick={() => update({ server_require_all_checks_closed: !settings.server_require_all_checks_closed })}>Require all checks closed</Toggle>
          <Toggle active={settings.server_require_tabs_closed} help="Block checkout until bar tabs are closed or transferred." onClick={() => update({ server_require_tabs_closed: !settings.server_require_tabs_closed })}>Require tabs closed</Toggle>
          <Toggle active={settings.server_require_credit_tips_reviewed} help="Show credit-card tips for review before checkout." onClick={() => update({ server_require_credit_tips_reviewed: !settings.server_require_credit_tips_reviewed })}>Require credit tip review</Toggle>
          <Toggle active={settings.deduct_credit_card_tips_from_cash_due} help="Reduce the cash a server turns in by card tips owed to that server." onClick={() => update({ deduct_credit_card_tips_from_cash_due: !settings.deduct_credit_card_tips_from_cash_due })}>Deduct card tips from cash due</Toggle>
          <Toggle active={settings.server_require_tipout_entry} help="Require the server to enter owed tipouts before leaving." onClick={() => update({ server_require_tipout_entry: !settings.server_require_tipout_entry })}>Require tipout entry</Toggle>
          <Toggle active={settings.server_require_manager_approval} help="Require a manager to approve the server checkout." onClick={() => update({ server_require_manager_approval: !settings.server_require_manager_approval })}>Require manager approval</Toggle>
          <Toggle active={settings.allow_clockout_before_checkout} help="Let employees clock out before their checkout is complete." onClick={() => update({ allow_clockout_before_checkout: !settings.allow_clockout_before_checkout })}>Allow clockout before checkout</Toggle>
        </div>
      </section>

      <section className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <SectionIntro
          title="End of Day"
          description="Defines what managers must review before final closeout and which reports should be generated."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={settings.eod_batch_close_mode} onChange={(event) => update({ eod_batch_close_mode: event.target.value as CloseoutSettingsData['eod_batch_close_mode'] })} className={inputClass}>
            {BATCH_MODES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input
            value={reportRecipientsText}
            onChange={(event) => setReportRecipientsText(event.target.value)}
            onBlur={(event) => commitReportRecipients(event.target.value)}
            className={inputClass}
            placeholder="Report emails, comma-separated"
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Toggle active={settings.eod_email_on_close} help="Automatically send the final end-of-day report when the business day closes." onClick={() => update({ eod_email_on_close: !settings.eod_email_on_close })}>Email final report on close</Toggle>
          <Toggle active={settings.eod_email_formats.includes('pdf')} help="Attach a print-ready PDF to the end-of-day email." onClick={() => update({ eod_email_formats: settings.eod_email_formats.includes('pdf') ? settings.eod_email_formats.filter(format => format !== 'pdf') : [...settings.eod_email_formats, 'pdf'] })}>Include PDF</Toggle>
          <Toggle active={settings.eod_email_formats.includes('xlsx')} help="Attach an Excel workbook for reconciliation and analysis." onClick={() => update({ eod_email_formats: settings.eod_email_formats.includes('xlsx') ? settings.eod_email_formats.filter(format => format !== 'xlsx') : [...settings.eod_email_formats, 'xlsx'] })}>Include Excel</Toggle>
          <Toggle active={settings.eod_require_drawers_closed} help="Require every cash drawer to be closed before day close." onClick={() => update({ eod_require_drawers_closed: !settings.eod_require_drawers_closed })}>Require drawers closed</Toggle>
          <Toggle active={settings.eod_require_servers_checked_out} help="Require all server checkouts to be completed first." onClick={() => update({ eod_require_servers_checked_out: !settings.eod_require_servers_checked_out })}>Require servers checked out</Toggle>
          <Toggle active={settings.eod_require_open_checks_resolved} help="Require open checks to be paid, voided, or transferred." onClick={() => update({ eod_require_open_checks_resolved: !settings.eod_require_open_checks_resolved })}>Require open checks resolved</Toggle>
          <Toggle active={settings.eod_require_paid_outs_reviewed} help="Require manager review of paid-in and paid-out activity." onClick={() => update({ eod_require_paid_outs_reviewed: !settings.eod_require_paid_outs_reviewed })}>Require paid outs reviewed</Toggle>
          <Toggle active={settings.eod_require_tip_adjustments_reviewed} help="Require tip edits and adjustments to be reviewed." onClick={() => update({ eod_require_tip_adjustments_reviewed: !settings.eod_require_tip_adjustments_reviewed })}>Require tip edits reviewed</Toggle>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(var(--text-tertiary))]">End-of-day reports</p>
        <div className="mt-2 flex flex-wrap gap-2">
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

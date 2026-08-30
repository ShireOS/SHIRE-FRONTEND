import {
  CASH_TRACKING_OPTIONS,
  CHECKOUT_REPORT_OPTIONS,
  EOD_BATCH_OPTIONS,
  EOD_REPORT_OPTIONS,
  isOptionValue,
} from './options'
import { sanitizeNumber } from './helpers'
import type { CloseoutSettingsData } from './types'

export function defaultCloseoutSettings(): CloseoutSettingsData {
  return {
    cash_tracking_mode: 'shared_drawer',
    // New restaurants carry forward the cash explicitly left at Close Day.
    // Back Office can still choose a fixed bank or an empty drawer.
    require_starting_bank: false,
    opening_bank_source: 'previous_retained',
    opening_bank_default: '',
    track_deposit_at_close: false,
    blind_drawer_close: true,
    allow_paid_in_out: true,
    require_manager_for_drawer_open: false,
    cash_drop_threshold: '',
    cash_variance_threshold: '',
    server_require_all_checks_closed: true,
    server_require_tabs_closed: true,
    server_require_cash_tips_declared: false,
    server_require_credit_tips_reviewed: true,
    deduct_credit_card_tips_from_cash_due: true,
    server_require_tipout_entry: false,
    server_require_manager_approval: true,
    server_checkout_report_delivery: 'print',
    allow_clockout_before_checkout: false,
    eod_batch_close_mode: 'prompt_manager',
    eod_require_drawers_closed: true,
    eod_require_servers_checked_out: true,
    eod_require_open_checks_resolved: true,
    eod_require_paid_outs_reviewed: true,
    eod_require_tip_adjustments_reviewed: true,
    eod_report_recipients: [],
    eod_reports: ['sales_summary', 'cash_drawer_summary', 'tip_summary', 'discounts_voids_refunds', 'tax_summary'],
    eod_email_on_close: false,
    eod_email_formats: ['pdf'],
  }
}

export function normalizeCloseoutSettings(row: unknown): CloseoutSettingsData {
  const fallback = defaultCloseoutSettings()
  const source: any = row && typeof row === 'object' ? row : {}
  return {
    ...fallback,
    ...source,
    cash_tracking_mode: isOptionValue(CASH_TRACKING_OPTIONS, source.cash_tracking_mode) ? source.cash_tracking_mode : fallback.cash_tracking_mode,
    cash_drop_threshold: source.cash_drop_threshold == null ? '' : sanitizeNumber(source.cash_drop_threshold),
    cash_variance_threshold: source.cash_variance_threshold == null ? '' : sanitizeNumber(source.cash_variance_threshold),
    opening_bank_default: source.opening_bank_default == null ? '' : sanitizeNumber(source.opening_bank_default),
    // require_starting_bank is retired: the nightly typed-in float became
    // opening_bank_source. Legacy rows migrate — a saved true means the bank
    // carried over ('previous_retained'); otherwise a configured amount means
    // 'fixed'.
    require_starting_bank: false,
    opening_bank_source: ['none', 'fixed', 'previous_retained'].includes(source.opening_bank_source)
      ? source.opening_bank_source
      : source.require_starting_bank === true
        ? 'previous_retained'
        : Number(source.opening_bank_default || 0) > 0 ? 'fixed' : 'none',
    track_deposit_at_close: source.track_deposit_at_close === true,
    server_checkout_report_delivery: isOptionValue(CHECKOUT_REPORT_OPTIONS, source.server_checkout_report_delivery) ? source.server_checkout_report_delivery : fallback.server_checkout_report_delivery,
    eod_batch_close_mode: isOptionValue(EOD_BATCH_OPTIONS, source.eod_batch_close_mode) ? source.eod_batch_close_mode : fallback.eod_batch_close_mode,
    // Cash-tip declaration lives in tips & payroll now; never resurrect the
    // old checkout blocker from stale rows.
    server_require_cash_tips_declared: false,
    eod_report_recipients: Array.isArray(source.eod_report_recipients) ? source.eod_report_recipients.map(String).filter(Boolean) : [],
    eod_email_on_close: source.eod_email_on_close === true,
    eod_email_formats: Array.isArray(source.eod_email_formats) && source.eod_email_formats.length ? source.eod_email_formats.filter((format: unknown) => format === 'pdf' || format === 'xlsx') : ['pdf'],
    eod_reports: Array.isArray(source.eod_reports) && source.eod_reports.length > 0
      ? source.eod_reports.map(String).filter((report: string) => isOptionValue(EOD_REPORT_OPTIONS, report))
      : fallback.eod_reports,
  }
}

/** PUT /restaurants/:id/closeout-settings body. */
export function closeoutSettingsPayload(closeoutSettings: unknown) {
  const settings = normalizeCloseoutSettings(closeoutSettings)
  return {
    ...settings,
    require_starting_bank: false,
    cash_drop_threshold: settings.cash_drop_threshold === '' ? null : Number(settings.cash_drop_threshold),
    cash_variance_threshold: settings.cash_variance_threshold === '' ? null : Number(settings.cash_variance_threshold),
    opening_bank_default: settings.opening_bank_source === 'none' || settings.opening_bank_default === '' ? 0 : Number(settings.opening_bank_default),
  }
}

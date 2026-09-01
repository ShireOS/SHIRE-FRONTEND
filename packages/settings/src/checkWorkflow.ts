import { ORDER_FIRE_MODE_OPTIONS, isOptionValue } from './options'
import { sanitizeNumber } from './helpers'
import { numberRangeError } from './entry'
import type { CheckWorkflowSettingsData } from './types'

// Only fields the POS actually enforces. The old form also collected split
// limits, merge/transfer toggles, tab auto-close, reopen allowance, guest-check
// printing, and notes — none of which any POS code path reads; they were
// removed rather than shown as working controls.
export function defaultCheckWorkflowSettings(): CheckWorkflowSettingsData {
  return {
    seat_numbers_enabled: true,
    seat_number_required: false,
    course_required: false,
    split_by_seat_enabled: true,
    split_by_item_enabled: true,
    allow_bar_tabs: true,
    tab_name_required: true,
    card_preauth_required: false,
    default_preauth_amount: '',
    require_manager_for_reopen: true,
    allow_hold_and_fire: true,
    default_order_fire_mode: 'immediate',
    default_hold_minutes: '10',
    hold_preset_minutes: [5, 10, 15],
    allow_manual_hold: true,
    allow_item_seat_move: true,
    allow_multi_item_seat_move: true,
    require_manager_for_item_move_after_send: false,
    sent_item_correction_window_minutes: '4',
    to_go_enabled: false,
  }
}

export function normalizeCheckWorkflowSettings(row: unknown): CheckWorkflowSettingsData {
  const fallback = defaultCheckWorkflowSettings()
  const source: any = row && typeof row === 'object' ? row : {}
  const holdPresetMinutes = Array.isArray(source.hold_preset_minutes)
    ? Array.from(new Set(source.hold_preset_minutes.map(Number).filter((minutes: number) => Number.isFinite(minutes) && minutes > 0))).slice(0, 8) as number[]
    : fallback.hold_preset_minutes
  // Iterating the fallback's keys drops the dead legacy columns still present
  // on old rows instead of carrying them back into state.
  const normalized: any = {}
  for (const key of Object.keys(fallback)) normalized[key] = source[key] ?? (fallback as any)[key]
  return {
    ...normalized,
    default_preauth_amount: source.default_preauth_amount == null ? '' : sanitizeNumber(source.default_preauth_amount),
    default_order_fire_mode: isOptionValue(ORDER_FIRE_MODE_OPTIONS, source.default_order_fire_mode) ? source.default_order_fire_mode : fallback.default_order_fire_mode,
    default_hold_minutes: source.default_hold_minutes == null ? fallback.default_hold_minutes : String(source.default_hold_minutes).replace(/[^\d]/g, '').slice(0, 3) || fallback.default_hold_minutes,
    hold_preset_minutes: holdPresetMinutes.length > 0 ? holdPresetMinutes : fallback.hold_preset_minutes,
    sent_item_correction_window_minutes: String(Math.max(0, Math.min(15, Number(source.sent_item_correction_window_minutes ?? fallback.sent_item_correction_window_minutes) || 0))),
  }
}

/** PUT /restaurants/:id/check-workflow-settings body (proxied to the POS). */
export function checkWorkflowSettingsPayload(checkWorkflowSettings: unknown) {
  const validationError = checkWorkflowSettingsEntryError(checkWorkflowSettings)
  if (validationError) throw new Error(validationError)
  const settings = normalizeCheckWorkflowSettings(checkWorkflowSettings)
  const holdPresetMinutes = Array.from(new Set(settings.hold_preset_minutes.map(Number).filter(minutes => Number.isFinite(minutes) && minutes > 0))).slice(0, 8)
  return {
    ...settings,
    default_preauth_amount: settings.default_preauth_amount === '' ? null : Number(settings.default_preauth_amount),
    default_hold_minutes: Math.max(1, Math.min(360, Number(settings.default_hold_minutes || 10))),
    sent_item_correction_window_minutes: Math.max(0, Math.min(15, Number(settings.sent_item_correction_window_minutes || 0))),
    hold_preset_minutes: holdPresetMinutes.length > 0 ? holdPresetMinutes : defaultCheckWorkflowSettings().hold_preset_minutes,
  }
}

export function checkWorkflowSettingsEntryError(checkWorkflowSettings: unknown): string {
  const source: any = checkWorkflowSettings && typeof checkWorkflowSettings === 'object' ? checkWorkflowSettings : {}
  const preauthError = numberRangeError(source.default_preauth_amount, 'Default preauthorization amount', { min: 0 })
  const holdError = numberRangeError(source.default_hold_minutes ?? 10, 'Default hold minutes', { required: true, min: 1, max: 360, integer: true })
  const correctionError = numberRangeError(source.sent_item_correction_window_minutes ?? 0, 'Sent-item correction window', { required: true, min: 0, max: 15, integer: true })
  if (preauthError || holdError || correctionError) return preauthError || holdError || correctionError
  for (const value of Array.isArray(source.hold_preset_minutes) ? source.hold_preset_minutes : []) {
    const presetError = numberRangeError(value, 'Hold preset', { required: true, min: 1, max: 360, integer: true })
    if (presetError) return presetError
  }
  return ''
}

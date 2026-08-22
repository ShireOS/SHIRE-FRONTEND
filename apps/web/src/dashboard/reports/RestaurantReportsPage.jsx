import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  Mail,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { fetchCached, fetchWithSupabaseAuth, queryClient, queryKeys, STALE_TIMES } from '../../shared/query'
import { fetchPosApi } from '../../shared/api/posClient'
import ServerReceiptTemplateModal from './ServerReceiptTemplateModal'
import { viewVisible } from '../../shared/backOfficeView'

// Presentation fallback for the canonical POS receipt contract. The snapshot
// replaces this metadata when available, but settings remain usable while a
// report request is loading or recovering from a transport failure.
const ACTIVITY_GROUP_CATALOG = [
  { id: 'activity_discount_void', label: 'Discounts, comps & voids', description: 'Discounts, comps, item voids, and check voids with staff and reason attribution.' },
  { id: 'activity_refund_reversal', label: 'Refunds & reversals', description: 'Refunds, payment voids, tender voids, and reversed cash movements.' },
  { id: 'activity_transaction_sequence', label: 'High-risk transaction sequences', description: 'Linked action sequences on one check that warrant manager review.' },
  { id: 'activity_kitchen_loss', label: 'Kitchen loss & sent-item changes', description: 'Voids, edits, and unsends involving items already sent to production.' },
  { id: 'activity_cash', label: 'Cash drawer & variance', description: 'No Sale, paid in/out, drops, reversals, and recorded cash variance.' },
  { id: 'activity_tip_change', label: 'Tip changes', description: 'Tip and payout adjustments with actor and approval context.' },
  { id: 'activity_manual_item', label: 'Manual & open items', description: 'Open-price or manually entered item activity.' },
  { id: 'activity_tax_gratuity', label: 'Tax & gratuity exceptions', description: 'Tax-exempt checks and gratuity additions or removals.' },
  { id: 'activity_check_exception', label: 'Check exceptions', description: 'Reopens, unusual closes, and business-day reopen activity.' },
  { id: 'activity_payment_risk', label: 'Payment risk', description: 'Failed, duplicated, keyed, unresolved, or reconciliation-required payments.' },
  { id: 'activity_gift_card', label: 'Gift-card activity', description: 'Gift-card issuance, redemption, cancellation, refund, and balance activity.' },
  { id: 'activity_control_weakness', label: 'Control weaknesses', description: 'Missing actors or reasons, self-approval, and other control gaps.' },
  { id: 'activity_timing_pattern', label: 'Timing patterns', description: 'Exceptions after hours, near close, or around reopened business days.' },
  { id: 'activity_employee_pattern', label: 'Employee patterns', description: 'Explainable peer and prior-baseline changes that need review.' },
]
const ACTIVITY_GROUP_IDS = ACTIVITY_GROUP_CATALOG.map((group) => group.id)

const RECEIPT_GROUP_CATALOG = [
  { id: 'revenue', label: 'Revenue', description: 'Gross and net sales, discounts, tax, gratuity, service charges, pricing adjustments, and total collected.' },
  { id: 'service_mode_sales', label: 'Sales by service type', description: 'Dine-in, to-go, delivery, drive-thru, and unclassified check performance.' },
  { id: 'tender_mix', label: 'Media / tender mix', description: 'Cash and card transaction counts, applied amounts, surcharges, tips, and tender percentages.' },
  { id: 'media_tip_detail', label: 'Detailed media & tips', description: 'Tender totals by recorded card brand plus captured, declared, and tip-out amounts.' },
  { id: 'cash_reconciliation', label: 'Cash reconciliation', description: 'Collected media, processor fees, expected cash, counted cash, and variance.', employee_scope: 'unsupported' },
  { id: 'daily_sales', label: 'Daily sales', description: 'Net sales, checks, guests, discounts, and collected totals for each accounting business date.' },
  { id: 'key_metrics', label: 'Key metrics', description: 'Checks, guests, average checks, net sales per guest, sales per labor hour, and discount rate.' },
  { id: 'category_sales', label: 'Top categories', description: 'Category units, net sales, sales share, cost, and margin.' },
  { id: 'department_detail', label: 'All departments', description: 'Every recorded menu department with sales value and share.' },
  { id: 'item_sales', label: 'Top & bottom items', description: 'Menu-item units, net sales, discounts, margin, and voided quantities.' },
  { id: 'discounts_voids', label: 'Discounts, voids & refunds', description: 'Discount totals and types, refunds, voided items, and voided checks.' },
  { id: 'employee_performance', label: 'Employee performance', description: 'Employee sales, checks, average check, table-turn time, and tip percentage.' },
  { id: 'labor_payroll', label: 'Labor & payroll', description: 'Paid and overtime hours, recorded wages, missing pay rates, and labor percentage.' },
  { id: 'punch_log', label: 'Punch log', description: 'Clock entries, missed clock-outs, manager edits, voids, and edit reasons.' },
  { id: 'tax', label: 'Tax', description: 'Taxable and non-taxable sales, tax liability, service-charge tax, and rate details.' },
  { id: 'cash_closeout', label: 'Cash & closeout', description: 'Paid in/out, cash drops, expected and counted cash, variance, and daily closes.', employee_scope: 'unsupported' },
  { id: 'transaction_log', label: 'Transaction log', description: 'Completed cash, card, gift-card, and other tenders with timestamps and POS metadata.' },
  { id: 'server_summary', label: 'Server summary', description: 'Worked-server sales, checks, voluntary tips, gratuity, and cash due.' },
  { id: 'tip_settlement', label: 'Tips & tip-outs', description: 'Employee tips collected, tip-outs paid and received, and final payouts.' },
  ...ACTIVITY_GROUP_CATALOG,
]

const DEFAULT_PROFILES = [
  { id: 'long', name: 'Long', built_in: true, group_ids: ['revenue', 'tender_mix', 'daily_sales', 'key_metrics', 'category_sales', 'item_sales', 'discounts_voids', 'employee_performance', 'labor_payroll', 'punch_log', 'tax', 'cash_closeout', 'server_summary', 'tip_settlement'] },
  { id: 'short', name: 'Short', built_in: true, group_ids: ['revenue', 'tender_mix', 'daily_sales', 'key_metrics', 'category_sales', 'item_sales', 'discounts_voids', 'tax'] },
  { id: 'compact', name: 'Compact', built_in: true, group_ids: ['revenue', 'tender_mix', 'key_metrics'] },
  { id: 'activity', name: 'Activity', built_in: true, group_ids: ACTIVITY_GROUP_IDS },
]

function withRequiredBuiltInProfiles(savedProfiles, defaults = DEFAULT_PROFILES) {
  const saved = (Array.isArray(savedProfiles) ? savedProfiles : [])
    .map((profile) => ({ ...profile, group_ids: (Array.isArray(profile.group_ids) ? profile.group_ids : []).flatMap((groupId) => groupId === 'activity' ? ACTIVITY_GROUP_IDS : [groupId]) }))
    .filter((profile) => profile.group_ids.length > 0)
  const known = new Set(saved.map((profile) => profile.id))
  return [...saved, ...defaults.filter((profile) => profile.built_in && !known.has(profile.id))]
}

const PERIOD_OPTIONS = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom' },
]
const REPORT_SNAPSHOT_TIMEOUT_MS = 15_000

function reportLoadErrorMessage(error) {
  const message = error instanceof Error ? error.message : 'Could not load the POS report.'
  const status = Number(error?.status || 0)
  if ([404, 502, 503].includes(status) && ['not found', '404 not found'].includes(message.trim().toLowerCase())) {
    return 'POS Reports is unavailable because the reporting services are running incompatible versions. Deploy matching POS and Restaurant reporting backend versions, then retry.'
  }
  return message
}

// Existing scheduler rows keep their legacy attachment contract while the
// interactive POS report uses the new receipt-group contract.
const SCHEDULE_SECTIONS = [
  ['sales_revenue', 'Sales & revenue'],
  ['top_bottom_sellers', 'Top & bottom sellers'],
  ['average_check', 'Average check'],
  ['employee_reports', 'Employee reports'],
  ['payroll_support', 'Payroll support'],
  ['punch_log', 'Punch log'],
  ['z_report', 'End-of-day closeout'],
  ['tax_summary', 'Tax'],
  ['daily_summary', 'Daily summary'],
]
const SCHEDULE_LABELS = Object.fromEntries(SCHEDULE_SECTIONS)
const EMPTY_SCHEDULE = {
  name: '', email: '', frequency: 'daily', sections: ['sales_revenue', 'daily_summary'],
  send_time: '07:00', timezone: 'America/Chicago', weekday: 1, month_day: 1,
  is_active: true, include_server_summary: true, attachment_formats: ['pdf'],
}

function dateKey(value) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function periodRange(preset, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(end)
  if (preset === 'month') start.setDate(1)
  else if (preset === 'quarter') start.setMonth(Math.floor(end.getMonth() / 3) * 3, 1)
  else if (preset === 'year') start.setMonth(0, 1)
  else start.setDate(end.getDate() - ((end.getDay() + 6) % 7))
  return { start: dateKey(start), end: dateKey(end) }
}

function minuteTime(value, fallback) {
  return typeof value === 'string' && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : fallback
}

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const numberFormatters = new Map()
const dateFormatters = new Map()

function numberFormatter(digits) {
  if (!numberFormatters.has(digits)) {
    numberFormatters.set(digits, new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }))
  }
  return numberFormatters.get(digits)
}

function dateFormatter(kind, timezone) {
  const key = `${kind}:${timezone || 'local'}`
  if (!dateFormatters.has(key)) {
    dateFormatters.set(key, new Intl.DateTimeFormat(undefined, kind === 'datetime'
      ? { dateStyle: 'short', timeStyle: 'short', timeZone: timezone }
      : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }))
  }
  return dateFormatters.get(key)
}

function money(value) {
  const amount = Number(value || 0)
  const absolute = currencyFormatter.format(Math.abs(amount))
  return amount < 0 ? `-${absolute}` : absolute
}

function number(value, digits = 0) {
  return numberFormatter(digits).format(Number(value || 0))
}

function displayValue(value, format, digits = 0, timezone = undefined) {
  if (value == null || value === '') return '—'
  if (format === 'money') return money(value)
  if (format === 'percent') return `${number(value, 2)}%`
  if (format === 'number') return number(value, digits)
  if (format === 'minutes') return `${number(value, 1)} min`
  if (format === 'datetime') return dateFormatter('datetime', timezone).format(new Date(value))
  if (format === 'date') return dateFormatter('date').format(new Date(`${value}T12:00:00`))
  if (format === 'json' && typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value).replaceAll('_', ' ')
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function fileFromBase64(file) {
  const bytes = Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0))
  return new Blob([bytes], { type: file.mime_type })
}

function downloadSnapshotCsv(snapshot, groupIds, profileName) {
  const selected = new Set(groupIds)
  const rows = []
  for (const group of snapshot?.groups || []) {
    if (!selected.has(group.id)) continue
    for (const line of group.lines || []) {
      rows.push({ section: group.label, record_type: 'summary', label: line.label, value: line.value, format: line.format, note: line.note || '' })
    }
    for (const row of group.rows || []) rows.push({ section: group.label, record_type: 'detail', ...row })
  }
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const escape = (value) => {
    const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }
  const csv = [columns.map(escape).join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\n')
  const restaurant = String(snapshot?.restaurant?.name || 'restaurant').toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')
  const profile = profileName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${restaurant}-${profile}-${snapshot.window.start_date}-to-${snapshot.window.end_date}.csv`)
}

function IconButton({ label, icon: Icon, onClick, onIntent, disabled = false, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onIntent}
      onFocus={onIntent}
      disabled={disabled}
      title={label}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${primary ? 'bg-dash-gold text-black' : 'border border-white/10 bg-white/[0.04] text-dash-secondary hover:bg-white/[0.08] hover:text-dash-cream'}`}
    >
      <Icon className={`h-4 w-4 ${label === 'Refresh' && disabled ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function Field({ label, children }) {
  return (
    <label className="block text-sm text-dash-secondary">
      <span className="mb-1.5 block text-xs font-semibold uppercase text-dash-tertiary">{label}</span>
      <span className="[&>input]:h-10 [&>input]:w-full [&>input]:rounded-md [&>input]:border [&>input]:border-white/10 [&>input]:bg-white/[0.04] [&>input]:px-3 [&>select]:h-10 [&>select]:w-full [&>select]:rounded-md [&>select]:border [&>select]:border-white/10 [&>select]:bg-dash-surface [&>select]:px-3">{children}</span>
    </label>
  )
}

function Modal({ title, onClose, children, maxWidth = 'max-w-3xl' }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 sm:p-6">
      <div className={`max-h-[92vh] w-full ${maxWidth} overflow-y-auto rounded-md border border-white/10 bg-dash-surface p-5 shadow-2xl`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} title="Close" className="rounded p-2 text-dash-secondary hover:bg-white/10 hover:text-dash-cream"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ScopeModal({ value, dimensions, loading = false, error = '', onClose, onApply }) {
  const [draft, setDraft] = useState(() => ({ ...value, scope_mode: 'cumulative', scope_ids: [...value.scope_ids] }))
  const options = draft.scope_dimension === 'revenue_center'
    ? dimensions.sections || []
    : draft.scope_dimension === 'device'
      ? dimensions.devices || []
      : draft.scope_dimension === 'employee'
        ? dimensions.employees || []
        : []
  const toggle = (id) => setDraft((current) => ({ ...current, scope_ids: current.scope_ids.includes(id) ? current.scope_ids.filter((item) => item !== id) : [...current.scope_ids, id] }))
  const canApply = draft.scope_dimension === 'none' || draft.scope_ids.length > 0
  return (
    <Modal title="Report scope" onClose={onClose}>
      {loading && <p className="mb-4 text-sm text-dash-tertiary">Loading sections, devices, and employees...</p>}
      {error && <p className="mb-4 rounded-md border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {[['none', 'Whole restaurant'], ['revenue_center', 'Sections'], ['device', 'Devices'], ['employee', 'Employees']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setDraft({ ...draft, scope_dimension: id, scope_ids: [], scope_mode: 'cumulative' })} className={`h-10 rounded-md border px-3 text-sm font-semibold ${draft.scope_dimension === id ? 'border-dash-gold bg-dash-gold/10 text-dash-cream' : 'border-white/10 text-dash-secondary'}`}>{label}</button>
        ))}
      </div>
      {draft.scope_dimension !== 'none' && (
        <>
          <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {options.map((option) => (
              <label key={option.id} className="flex min-h-11 items-center gap-3 rounded-md border border-white/10 px-3 text-sm">
                <input type="checkbox" checked={draft.scope_ids.includes(option.id)} onChange={() => toggle(option.id)} />
                <span className="min-w-0">
                  <span className="block break-words">{option.name}{draft.scope_dimension === 'device' && option.section_name ? <span className="ml-1 text-xs text-dash-tertiary">({option.section_name})</span> : null}</span>
                  {draft.scope_dimension === 'employee' && <span className="block text-xs text-dash-tertiary">{option.role || 'Staff'}{option.is_active === false ? ' · inactive with report history' : ''}</span>}
                </span>
              </label>
            ))}
          </div>
          {draft.scope_dimension === 'employee' && <p className="mt-3 text-xs leading-5 text-dash-tertiary">Sales and menu activity follow checks assigned to each employee. Drawer reconciliation and day-close totals are excluded because those records are not employee-owned.</p>}
          {!options.length && <p className="mt-4 text-sm text-dash-tertiary">No reportable values are available for this scope.</p>}
        </>
      )}
      <div className="mt-5 flex justify-end gap-2"><IconButton label="Cancel" icon={X} onClick={onClose} /><IconButton label="Apply scope" icon={Layers} primary disabled={!canApply} onClick={() => onApply(draft)} /></div>
    </Modal>
  )
}

function ProfileSettingsModal({ profiles, activeId, catalog, defaults, scopeDimension, canConfigureReceipt, canManageSchedules, onConfigureReceipt, onManageSchedules, onClose, onSave }) {
  const [drafts, setDrafts] = useState(() => profiles.map((profile) => ({ ...profile, group_ids: [...profile.group_ids] })))
  const [selectedId, setSelectedId] = useState(activeId)
  const [saving, setSaving] = useState(false)
  const selected = drafts.find((profile) => profile.id === selectedId) || drafts[0]
  const selectedHasActivity = selected.group_ids.some((groupId) => groupId.startsWith('activity_'))
  const selectedHasOperations = selected.group_ids.some((groupId) => !groupId.startsWith('activity_'))
  const visibleCatalog = selected.id === 'activity' || (selectedHasActivity && !selectedHasOperations)
    ? catalog.filter((group) => group.id.startsWith('activity_'))
    : selected.built_in
      ? catalog.filter((group) => !group.id.startsWith('activity_'))
      : catalog
  const replaceSelected = (changes) => setDrafts((current) => current.map((profile) => profile.id === selected.id ? { ...profile, ...changes } : profile))
  const toggle = (groupId) => replaceSelected({ group_ids: selected.group_ids.includes(groupId) ? selected.group_ids.filter((id) => id !== groupId) : visibleCatalog.map((item) => item.id).filter((id) => id === groupId || selected.group_ids.includes(id)) })
  const selectAll = () => replaceSelected({ group_ids: visibleCatalog.map((group) => group.id) })
  const clearAll = () => replaceSelected({ group_ids: [] })
  const addProfile = () => {
    const id = `custom-${Date.now()}`
    const next = { id, name: 'Custom report', built_in: false, group_ids: [...selected.group_ids] }
    setDrafts((current) => [...current, next])
    setSelectedId(id)
  }
  const removeProfile = () => {
    if (selected.built_in) return
    const remaining = drafts.filter((profile) => profile.id !== selected.id)
    setDrafts(remaining)
    setSelectedId(remaining.find((profile) => profile.id === 'long')?.id || remaining[0].id)
  }
  const resetProfile = () => {
    const original = defaults.find((profile) => profile.id === selected.id)
    if (original) replaceSelected({ group_ids: [...original.group_ids] })
  }
  const save = async () => {
    setSaving(true)
    try {
      await onSave(drafts, selectedId)
      onClose()
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal title="POS report settings" onClose={onClose} maxWidth="max-w-4xl">
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[220px_1fr]">
        <div>
          <div className="space-y-1">
            {drafts.map((profile) => (
              <button key={profile.id} type="button" onClick={() => setSelectedId(profile.id)} className={`flex min-h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm font-semibold ${selected.id === profile.id ? 'bg-dash-gold text-black' : 'text-dash-secondary hover:bg-white/[0.05] hover:text-dash-cream'}`}>
                <span className="truncate">{profile.name}</span><span className="text-xs opacity-65">{profile.group_ids.length}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={addProfile} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/10 text-sm font-semibold text-dash-secondary hover:bg-white/[0.05]"><Plus className="h-4 w-4" />Add profile</button>
          {canConfigureReceipt && <button type="button" onClick={onConfigureReceipt} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/10 text-sm font-semibold text-dash-secondary hover:bg-white/[0.05]"><Printer className="h-4 w-4" />Server receipt</button>}
          {canManageSchedules && <button type="button" onClick={onManageSchedules} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/10 text-sm font-semibold text-dash-secondary hover:bg-white/[0.05]"><Mail className="h-4 w-4" />Scheduled delivery</button>}
        </div>
        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Field label="Profile name"><input disabled={selected.built_in} value={selected.name} onChange={(event) => replaceSelected({ name: event.target.value })} /></Field>
            <div className="flex gap-2">
              <button type="button" onClick={selectAll} className="h-10 rounded-md border border-white/10 px-3 text-sm font-semibold">Select all</button>
              <button type="button" onClick={clearAll} className="h-10 rounded-md border border-white/10 px-3 text-sm font-semibold">Clear</button>
              {selected.built_in ? <button type="button" onClick={resetProfile} className="h-10 rounded-md border border-white/10 px-3 text-sm font-semibold">Reset</button> : <button type="button" onClick={removeProfile} title="Delete profile" className="inline-flex h-10 items-center justify-center rounded-md border border-red-400/20 px-3 text-red-300"><Trash2 className="h-4 w-4" /></button>}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleCatalog.map((group) => (
              <label key={group.id} className="flex min-h-16 cursor-pointer items-start gap-3 rounded-md border border-white/10 px-3 py-3">
                <input className="mt-1" type="checkbox" checked={selected.group_ids.includes(group.id)} onChange={() => toggle(group.id)} />
                <span className="min-w-0"><span className="block text-sm font-semibold">{group.label}</span><span className="mt-0.5 block text-xs leading-5 text-dash-tertiary">{group.description}</span>{scopeDimension === 'employee' && group.employee_scope === 'unsupported' && <span className="mt-1 block text-xs font-semibold text-amber-200">Excluded from employee-scoped reports</span>}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2"><IconButton label="Cancel" icon={X} onClick={onClose} disabled={saving} /><IconButton label={saving ? 'Saving' : 'Save profiles'} icon={Save} primary disabled={saving || !selected.group_ids.length || drafts.some((profile) => !profile.name.trim() || !profile.group_ids.length)} onClick={save} /></div>
    </Modal>
  )
}

function ScheduledReportsModal({ recipients, loading = false, canManage, deliveryEnabled, disabledReason, defaultTimezone, onClose, onSave, onDelete, onTest }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(EMPTY_SCHEDULE)
  const [working, setWorking] = useState('')
  const [message, setMessage] = useState('')
  const edit = (recipient = null) => {
    setEditingId(recipient?.id || 'new')
    setDraft(recipient ? {
      name: recipient.name || '', email: recipient.email, frequency: recipient.frequency,
      sections: recipient.sections || [], send_time: String(recipient.send_time || '07:00').slice(0, 5),
      timezone: recipient.timezone, weekday: recipient.weekday, month_day: recipient.month_day,
      is_active: recipient.is_active, include_server_summary: recipient.include_server_summary !== false,
      attachment_formats: recipient.attachment_formats || ['pdf'],
    } : { ...EMPTY_SCHEDULE, timezone: defaultTimezone || EMPTY_SCHEDULE.timezone })
  }
  const toggle = (field, value) => setDraft((current) => ({ ...current, [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value] }))
  const save = async () => {
    setWorking('save'); setMessage('')
    try { await onSave(editingId === 'new' ? null : editingId, draft); setEditingId(null) } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save the recipient.') } finally { setWorking('') }
  }
  const test = async (recipient) => {
    setWorking(recipient.id); setMessage('')
    try { const result = await onTest(recipient.id); setMessage(result.message || `Test report accepted for ${recipient.email}.`) } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not send the test report.') } finally { setWorking('') }
  }
  const remove = async (recipient) => {
    setWorking(recipient.id); setMessage('')
    try { await onDelete(recipient.id) } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not delete the recipient.') } finally { setWorking('') }
  }
  return (
    <Modal title="Scheduled report delivery" onClose={onClose} maxWidth="max-w-3xl">
      {!deliveryEnabled && <p className="mb-4 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{disabledReason || 'Email delivery is not configured.'}</p>}
      {message && <p className="mb-4 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-secondary">{message}</p>}
      {!editingId ? <>
        <div className="divide-y divide-white/10 border-y border-white/10">
          {recipients.map((recipient) => <div key={recipient.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="truncate font-semibold">{recipient.name || recipient.email}</p><p className="mt-1 break-words text-sm text-dash-secondary">{recipient.email} · {recipient.frequency} at {String(recipient.send_time || '07:00').slice(0, 5)} · {recipient.timezone}</p><p className="mt-1 text-xs text-dash-tertiary">{(recipient.sections || []).map((id) => SCHEDULE_LABELS[id] || id.replaceAll('_', ' ')).join(', ')}</p></div>
            {canManage && <div className="flex shrink-0 gap-2"><button type="button" disabled={!deliveryEnabled || Boolean(working)} onClick={() => test(recipient)} className="h-10 rounded-md border border-white/10 px-3 text-sm disabled:opacity-40">{working === recipient.id ? 'Working' : 'Test'}</button><button type="button" disabled={Boolean(working)} onClick={() => edit(recipient)} className="h-10 rounded-md border border-white/10 px-3 text-sm disabled:opacity-40">Edit</button><button type="button" disabled={Boolean(working)} title="Delete schedule" onClick={() => remove(recipient)} className="inline-flex h-10 items-center justify-center rounded-md border border-red-400/20 px-3 text-red-300 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></div>}
          </div>)}
          {loading && <p className="py-8 text-center text-sm text-dash-tertiary">Loading scheduled reports...</p>}
          {!loading && !recipients.length && <p className="py-8 text-center text-sm text-dash-tertiary">No scheduled report recipients.</p>}
        </div>
        {canManage && !loading && <button type="button" onClick={() => edit()} className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-dash-gold px-4 text-sm font-semibold text-black"><Plus className="h-4 w-4" />Add recipient</button>}
      </> : <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Recipient name"><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
          <Field label="Email"><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field>
          <Field label="Frequency"><select value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></Field>
          <Field label="Send time"><input type="time" step="900" value={draft.send_time} onChange={(event) => setDraft({ ...draft, send_time: event.target.value })} /></Field>
          <Field label="Timezone"><input value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} /></Field>
          {draft.frequency === 'weekly' && <Field label="Weekday"><select value={draft.weekday ?? 1} onChange={(event) => setDraft({ ...draft, weekday: Number(event.target.value) })}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => <option key={label} value={index}>{label}</option>)}</select></Field>}
          {draft.frequency === 'monthly' && <Field label="Day of month"><input type="number" min="1" max="28" value={draft.month_day ?? 1} onChange={(event) => setDraft({ ...draft, month_day: Number(event.target.value) })} /></Field>}
        </div>
        <div><p className="mb-2 text-xs font-semibold uppercase text-dash-tertiary">Sections</p><div className="grid gap-2 sm:grid-cols-2">{SCHEDULE_SECTIONS.map(([id, label]) => <label key={id} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={draft.sections.includes(id)} onChange={() => toggle('sections', id)} />{label}</label>)}</div></div>
        <div><p className="mb-2 text-xs font-semibold uppercase text-dash-tertiary">Attachments</p><div className="flex flex-wrap gap-4">{[['pdf', 'PDF'], ['xlsx', 'Excel workbook']].map(([id, label]) => <label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.attachment_formats.includes(id)} onChange={() => toggle('attachment_formats', id)} />{label}</label>)}</div></div>
        {draft.frequency === 'daily' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.include_server_summary} onChange={(event) => setDraft({ ...draft, include_server_summary: event.target.checked })} />Include the worked-server roster</label>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })} />Active schedule</label>
        <div className="flex justify-end gap-2"><IconButton label="Cancel" icon={X} onClick={() => setEditingId(null)} disabled={Boolean(working)} /><IconButton label={working === 'save' ? 'Saving' : 'Save recipient'} icon={Save} primary onClick={save} disabled={Boolean(working) || !draft.email || !draft.sections.length || !draft.attachment_formats.length} /></div>
      </div>}
    </Modal>
  )
}

function EmailModal({ profileName, onClose, onSend }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [formats, setFormats] = useState(['pdf'])
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')
  const toggleFormat = (format) => setFormats((current) => current.includes(format) ? current.filter((item) => item !== format) : [...current, format])
  const send = async () => {
    setSending(true); setStatus('')
    try {
      const result = await onSend({ recipients: email.split(',').map((value) => value.trim()).filter(Boolean), message, formats })
      setStatus(`${result.accepted || 0} report email${result.accepted === 1 ? '' : 's'} accepted.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not email the report.')
    } finally {
      setSending(false)
    }
  }
  return (
    <Modal title={`Email ${profileName} report`} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Recipients"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@example.com" /></Field>
        <Field label="Message"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Optional note" /></Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        {[['pdf', 'PDF'], ['xlsx', 'Excel workbook']].map(([id, label]) => <label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formats.includes(id)} onChange={() => toggleFormat(id)} />{label}</label>)}
      </div>
      {status && <p className="mt-4 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-secondary">{status}</p>}
      <div className="mt-5 flex justify-end gap-2"><IconButton label="Cancel" icon={X} onClick={onClose} /><IconButton label={sending ? 'Sending' : 'Send email'} icon={Mail} primary onClick={send} disabled={sending || !email.trim() || !formats.length} /></div>
    </Modal>
  )
}

function ReceiptPrintModal({ restaurantId, profileName, requestPayload, initialPreview, onClose, onPrinted }) {
  const [preview, setPreview] = useState(initialPreview || null)
  const [loading, setLoading] = useState(!initialPreview)
  const [printing, setPrinting] = useState(false)
  const [confirmedLong, setConfirmedLong] = useState(false)
  const [message, setMessage] = useState('')
  const printLock = useRef(false)
  const requestKey = JSON.stringify({ ...requestPayload, profile_name: profileName })

  useEffect(() => {
    if (initialPreview) {
      setPreview(initialPreview)
      setLoading(false)
      setMessage('')
      return undefined
    }
    let cancelled = false
    const controller = new AbortController()
    setLoading(true)
    setMessage('')
    fetchCached(
      queryKeys.reportReceiptPreview(restaurantId, requestKey),
      () => fetchPosApi(restaurantId, '/manager/report-hub/receipt-preview', {
        method: 'POST',
        body: requestKey,
        signal: controller.signal,
      }),
      STALE_TIMES.receiptPreview,
    ).then((result) => {
      if (!cancelled) setPreview(result)
    }).catch((error) => {
      if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not build the receipt preview.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true; controller.abort() }
  }, [restaurantId, profileName, requestKey, initialPreview])

  const print = async () => {
    if (printLock.current) return
    printLock.current = true
    setPrinting(true)
    setMessage('Queueing report…')
    try {
      const job = await fetchPosApi(restaurantId, '/manager/report-hub/receipt', {
        method: 'POST',
        body: JSON.stringify({
          ...requestPayload,
          profile_name: profileName,
          client_print_id: crypto.randomUUID(),
          confirm_long_receipt: confirmedLong,
          printer_context_id: preview?.printer_context_id || null,
          render_token: preview?.render_token || null,
        }),
      })
      let latest = job
      const deadline = Date.now() + 30_000
      let pollDelay = 500
      while (latest.progress !== 'printed' && latest.progress !== 'failed' && Date.now() < deadline) {
        setMessage(latest.progress === 'writing' ? `Sending to ${latest.target_name || 'receipt printer'}…` : latest.progress === 'claimed' ? 'The POS device is delivering the report…' : `Queued to ${latest.target_name || 'receipt printer'}…`)
        await new Promise((resolve) => window.setTimeout(resolve, pollDelay))
        latest = await fetchPosApi(restaurantId, `/manager/report-hub/receipt-jobs/${job.job_id}`)
        pollDelay = Math.min(Math.round(pollDelay * 1.5), 2000)
      }
      if (latest.progress === 'printed') {
        onPrinted(`Printed ${profileName} report to ${latest.target_name || 'the receipt printer'}.`)
        onClose()
      } else if (latest.progress === 'failed') {
        setMessage(latest.error || 'The receipt printer could not confirm delivery. Check the POS print queue before retrying.')
      } else {
        setMessage(`The report remains queued to ${latest.target_name || 'the receipt printer'}. Keep a restaurant POS device online to finish delivery.`)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not print the POS report.')
    } finally {
      printLock.current = false
      setPrinting(false)
    }
  }

  const capabilities = preview?.printer_capabilities
  return (
    <Modal title={`Print ${profileName} report`} onClose={onClose} maxWidth="max-w-2xl">
      {loading && <div className="flex min-h-64 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-dash-gold" /></div>}
      {!loading && preview && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="rounded-md border border-white/10 bg-white/[0.04] p-2"><Printer className="h-4 w-4 text-dash-gold" /></span>
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{preview.target?.name || 'Receipt printer'}</p><p className="text-xs text-dash-tertiary">{capabilities?.profile || 'Configured printer'} · {capabilities?.paper_width_mm || 80} mm · {preview.layout_columns || capabilities?.normal_columns || 48} columns</p></div>
            </div>
            <span className="text-xs text-dash-tertiary">About {preview.estimated_lines} lines</span>
          </div>
          <div className="mx-auto max-h-[52vh] max-w-[34rem] overflow-auto bg-white p-5 text-black shadow-inner">
            <pre className="whitespace-pre font-mono text-[11px] leading-[1.35]">{preview.preview}</pre>
          </div>
          {preview.long_receipt && (
            <label className="mt-4 flex items-start gap-3 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              <input className="mt-0.5" type="checkbox" checked={confirmedLong} onChange={(event) => setConfirmedLong(event.target.checked)} />
              <span><span className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Confirm long receipt</span><span className="mt-1 block text-xs text-amber-100/75">This selection will use substantially more receipt paper. No report rows will be silently removed.</span></span>
            </label>
          )}
        </>
      )}
      {message && <p className="mt-4 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-secondary">{message}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <IconButton label="Cancel" icon={X} onClick={onClose} disabled={printing} />
        <IconButton label={printing ? 'Printing' : 'Print receipt'} icon={printing ? RefreshCw : Printer} primary onClick={print} disabled={loading || printing || !preview || (preview.long_receipt && !confirmedLong)} />
      </div>
    </Modal>
  )
}

function ReceiptGroup({ group, timezone }) {
  return (
    <section className="border-t border-black/20 py-5 first:border-t-0 first:pt-0">
      <h2 className="mb-3 font-mono text-sm font-bold uppercase text-stone-950">{group.label}</h2>
      {(group.lines || []).length > 0 && (
        <div className="space-y-1.5">
          {group.lines.map((line, index) => (
            <div key={`${line.label}-${index}`}>
              <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 font-mono text-sm ${line.emphasis ? 'border-t border-black/30 pt-2 font-bold text-black' : 'text-stone-800'}`}>
                <span className="min-w-0 break-words">{line.label}</span><span className="whitespace-nowrap text-right">{displayValue(line.value, line.format, line.digits, timezone)}</span>
              </div>
              {line.note && <p className="mt-1 max-w-3xl font-mono text-xs leading-5 text-stone-500">{line.note}</p>}
            </div>
          ))}
        </div>
      )}
      {(group.rows || []).length > 0 && (group.columns || []).length > 0 && (
        <div className="mt-3 overflow-x-auto border-y border-black/15">
          <table className="min-w-full font-mono text-xs text-stone-800">
            <thead className="border-b border-black/20 text-left text-[11px] uppercase text-stone-600"><tr>{group.columns.map((column) => <th key={column.key} className="whitespace-nowrap px-2 py-2 font-bold">{column.label}</th>)}</tr></thead>
            <tbody className="divide-y divide-black/10">{group.rows.map((row, index) => <tr key={row.id || row.staff_id || row.breakdown || row.period || index} className={row.emphasis ? row.severity_rank >= 2 ? 'bg-red-100 font-bold text-red-950' : 'bg-amber-100 font-semibold text-amber-950' : ''}>{group.columns.map((column) => <td key={column.key} className={`max-w-72 px-2 py-2 align-top ${column.key === 'why_flagged' ? 'min-w-72 whitespace-normal' : 'whitespace-nowrap'}`}>{displayValue(row[column.key], column.format, column.digits || 0, timezone)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {(group.notes || []).filter(Boolean).map((note) => <p key={note} className="mt-2 font-mono text-xs leading-5 text-stone-500">{note}</p>)}
      {!(group.lines || []).length && !(group.rows || []).length && <p className="font-mono text-xs text-stone-500">No recorded data for this period.</p>}
    </section>
  )
}

function DigitalReceipt({ snapshot, profile }) {
  const selected = new Set(profile.group_ids)
  const groups = (snapshot.groups || []).filter((group) => selected.has(group.id))
  const period = `${snapshot.window.start_date} ${snapshot.window.start_time || '00:00'} through ${snapshot.window.end_date} ${snapshot.window.end_time || '23:59'}`
  return (
    <article className="mx-auto w-full max-w-5xl bg-stone-50 px-4 py-7 text-stone-950 shadow-[0_16px_60px_rgba(0,0,0,0.3)] sm:px-8 sm:py-10">
      <header className="mb-6 border-b-2 border-black pb-5 text-center font-mono">
        <h1 className="break-words text-xl font-bold uppercase sm:text-2xl">{snapshot.restaurant.name}</h1>
        <p className="mt-1 text-sm font-bold uppercase">{profile.name} POS report</p>
        <p className="mt-2 text-xs text-stone-600">{period}</p>
        <p className="mt-1 text-xs text-stone-600">Restaurant local time · {snapshot.restaurant.timezone}</p>
        {snapshot.scope?.dimension !== 'none' && <p className="mt-1 break-words text-xs text-stone-600">{snapshot.scope.dimension === 'employee' ? `Employees · ${(snapshot.scope.values || []).map((value) => value.name).filter(Boolean).join(', ') || 'Selected employees'}` : `Scoped by ${snapshot.scope.dimension.replaceAll('_', ' ')} · ${snapshot.scope.mode}`}</p>}
        {(snapshot.warnings || []).map((warning) => <p key={warning} className="mx-auto mt-2 max-w-3xl text-xs leading-5 text-stone-500">{warning}</p>)}
      </header>
      {groups.map((group) => <ReceiptGroup key={group.id} group={group} timezone={snapshot.restaurant.timezone} />)}
      <footer className="mt-5 border-t-2 border-black pt-4 text-center font-mono text-[11px] text-stone-500">POS report contract {snapshot.contract_version}</footer>
    </article>
  )
}

function receiptSnapshotContextKey(payload) {
  const { receipt_group_ids: _groupIds, ...context } = payload
  return JSON.stringify(context)
}

function snapshotCoversReceiptRequest(snapshot, payload) {
  if (!snapshot?.print_snapshot_id || snapshot._request_context_key !== receiptSnapshotContextKey(payload)) return false
  const available = new Set((snapshot.groups || []).map((group) => group.id))
  return (payload.receipt_group_ids || []).every((groupId) => available.has(groupId))
}

export default function RestaurantReportsPage({ restaurantId, canConfigureServerReceipt = false, viewPolicy = null }) {
  const [dates, setDates] = useState(() => periodRange('week'))
  const [times, setTimes] = useState({ start: '00:00', end: '23:59' })
  const [periodPreset, setPeriodPreset] = useState('week')
  const [scope, setScope] = useState({ scope_dimension: 'none', scope_mode: 'cumulative', scope_ids: [] })
  const [dimensions, setDimensions] = useState({ sections: [], devices: [], employees: [] })
  const [dimensionsLoading, setDimensionsLoading] = useState(false)
  const [dimensionsLoaded, setDimensionsLoaded] = useState(false)
  const [dimensionsError, setDimensionsError] = useState('')
  const [profiles, setProfiles] = useState(DEFAULT_PROFILES)
  const [activeProfileId, setActiveProfileId] = useState('long')
  const [snapshot, setSnapshot] = useState(null)
  const [preloadedReceiptPreviews, setPreloadedReceiptPreviews] = useState({})
  const [receiptPrintOpen, setReceiptPrintOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState('')
  const [modal, setModal] = useState(null)
  const [serverReceiptOpen, setServerReceiptOpen] = useState(false)
  const [recipients, setRecipients] = useState([])
  const [recipientsLoading, setRecipientsLoading] = useState(false)
  const [recipientsLoaded, setRecipientsLoaded] = useState(false)
  const [canManageRecipients, setCanManageRecipients] = useState(false)
  const [emailDelivery, setEmailDelivery] = useState({ enabled: false, reason: '' })
  const loadRequestRef = useRef(0)
  const loadAbortRef = useRef(null)
  const initialSnapshotStartedRef = useRef(false)
  const preferenceAutosaveReadyRef = useRef(false)
  const visibleProfiles = viewVisible(viewPolicy, 'reports.activity')
    ? profiles
    : profiles.filter((profile) => profile.id !== 'activity')
  const activeProfile = visibleProfiles.find((profile) => profile.id === activeProfileId) || visibleProfiles[0] || profiles[0]

  useEffect(() => {
    if (activeProfile?.id && activeProfile.id !== activeProfileId) setActiveProfileId(activeProfile.id)
  }, [activeProfile?.id, activeProfileId])
  const backendScope = useMemo(() => ({
    scope_dimension: scope.scope_dimension,
    scope_mode: scope.scope_mode,
    scope_ids: scope.scope_ids,
  }), [scope.scope_dimension, scope.scope_ids, scope.scope_mode])
  const scopeIdsKey = scope.scope_ids.join(',')
  const catalog = snapshot?.catalog?.length ? snapshot.catalog : RECEIPT_GROUP_CATALOG
  const defaults = snapshot?.default_profiles || DEFAULT_PROFILES
  const employeeUnsupportedGroupIds = useMemo(
    () => new Set(catalog.filter((group) => group.employee_scope === 'unsupported').map((group) => group.id)),
    [catalog],
  )
  const scopedGroupIds = useMemo(
    () => activeProfile.group_ids.filter((groupId) => scope.scope_dimension !== 'employee' || !employeeUnsupportedGroupIds.has(groupId)),
    [activeProfile, employeeUnsupportedGroupIds, scope.scope_dimension],
  )
  const groupIdsKey = scopedGroupIds.join(',')

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    setHydrated(false)
    setLoading(true)
    setSnapshot(null)
    setPreloadedReceiptPreviews({})
    setDimensions({ sections: [], devices: [], employees: [] })
    setDimensionsLoaded(false)
    setDimensionsLoading(false)
    setDimensionsError('')
    setRecipients([])
    setRecipientsLoaded(false)
    setRecipientsLoading(false)
    setCanManageRecipients(false)
    setEmailDelivery({ enabled: false, reason: '' })
    initialSnapshotStartedRef.current = false
    preferenceAutosaveReadyRef.current = false
    setError('')
    fetchCached(
      queryKeys.reportPreferences(restaurantId),
      () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/view-preferences`),
      STALE_TIMES.setup,
    ).then((preferences) => {
      if (cancelled) return
      const saved = preferences.settings?.reports || {}
      const preset = saved.period_preset || 'week'
      const range = preset === 'custom' && saved.custom_start_date && saved.custom_end_date ? { start: saved.custom_start_date, end: saved.custom_end_date } : periodRange(preset)
      setPeriodPreset(preset); setDates(range)
      setTimes({ start: minuteTime(saved.start_time, '00:00'), end: minuteTime(saved.end_time, '23:59') })
      const nextProfiles = withRequiredBuiltInProfiles(saved.pos_report_profiles, DEFAULT_PROFILES)
      const requestedActiveId = saved.report_scope === 'activity' ? 'activity' : saved.active_profile_id
      setScope({ scope_dimension: saved.scope_dimension || 'none', scope_mode: 'cumulative', scope_ids: saved.scope_ids || [] })
      setProfiles(nextProfiles)
      setActiveProfileId(nextProfiles.some((profile) => profile.id === requestedActiveId) ? requestedActiveId : 'long')
    }).catch((nextError) => {
      if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Could not load POS report settings.')
    }).finally(() => { if (!cancelled) setHydrated(true) })
    return () => { cancelled = true }
  }, [restaurantId])

  const loadDimensions = async (force = false) => {
    if (!restaurantId || (dimensionsLoaded && !force)) return dimensions
    setDimensionsLoading(true)
    setDimensionsError('')
    try {
      const next = await fetchCached(
        queryKeys.reportDimensions(restaurantId),
        () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/dimensions`),
        force ? 0 : STALE_TIMES.setup,
      )
      setDimensions(next)
      setDimensionsLoaded(true)
      return next
    } catch (nextError) {
      setDimensionsError(nextError instanceof Error ? nextError.message : 'Could not load report scope options.')
      return null
    } finally {
      setDimensionsLoading(false)
    }
  }

  const applyRecipientData = (data) => {
    setRecipients(data?.recipients || [])
    setCanManageRecipients(Boolean(data?.can_manage))
    setEmailDelivery({ enabled: Boolean(data?.delivery_enabled), reason: data?.delivery_disabled_reason || '' })
  }

  const loadRecipients = async (force = false) => {
    if (!restaurantId || (recipientsLoaded && !force)) return
    setRecipientsLoading(true)
    try {
      const data = await fetchCached(
        queryKeys.reportRecipients(restaurantId),
        () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/recipients`),
        force ? 0 : STALE_TIMES.reports,
      )
      applyRecipientData(data)
      setRecipientsLoaded(true)
    } catch {
      // The modal remains usable for retry on the next open; existing report
      // content should not fail because schedules are unavailable.
    } finally {
      setRecipientsLoading(false)
    }
  }

  const openScopeModal = () => {
    setModal('scope')
    void loadDimensions()
  }

  const openSchedulesModal = () => {
    setModal('schedules')
    void loadRecipients()
  }

  const load = async (forceRefresh = false) => {
    if (!restaurantId || !hydrated) return
    const requestPayload = { start_date: dates.start, end_date: dates.end, start_time: times.start, end_time: times.end, top_n: 10, receipt_group_ids: scopedGroupIds, ...backendScope }
    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId
    loadAbortRef.current?.abort()
    loadAbortRef.current = null
    if (!forceRefresh && snapshotCoversReceiptRequest(snapshot, requestPayload)) {
      setLoading(false)
      setError('')
      return
    }
    const controller = new AbortController()
    loadAbortRef.current = controller
    setLoading(true); setError(''); setPreloadedReceiptPreviews({})
    try {
      const requestKey = JSON.stringify(requestPayload)
      const next = await fetchCached(
        queryKeys.reportSnapshot(restaurantId, requestKey),
        () => fetchPosApi(restaurantId, '/manager/report-hub/snapshot', {
          method: 'POST',
          body: requestKey,
          signal: controller.signal,
          timeoutMs: REPORT_SNAPSHOT_TIMEOUT_MS,
        }),
        forceRefresh ? 0 : STALE_TIMES.reports,
      )
      if (loadRequestRef.current !== requestId) return
      setSnapshot({ ...next, _request_context_key: receiptSnapshotContextKey(requestPayload) })
      if (!profiles.length) setProfiles(withRequiredBuiltInProfiles([], next.default_profiles || DEFAULT_PROFILES))
    } catch (nextError) {
      if (loadRequestRef.current === requestId && !controller.signal.aborted) {
        setError(reportLoadErrorMessage(nextError))
      }
    } finally {
      if (loadRequestRef.current === requestId) {
        setLoading(false)
        if (loadAbortRef.current === controller) loadAbortRef.current = null
      }
    }
  }

  useEffect(() => {
    if (!restaurantId || !hydrated) return undefined
    const delay = initialSnapshotStartedRef.current ? 180 : 0
    initialSnapshotStartedRef.current = true
    const timeout = window.setTimeout(() => { void load() }, delay)
    return () => window.clearTimeout(timeout)
  }, [restaurantId, hydrated, dates.start, dates.end, times.start, times.end, scope.scope_dimension, scope.scope_mode, scopeIdsKey, groupIdsKey])

  useEffect(() => () => loadAbortRef.current?.abort(), [])

  const preferencePayload = (nextProfiles = profiles, nextActiveId = activeProfileId) => ({
    period_preset: periodPreset,
    custom_start_date: periodPreset === 'custom' ? dates.start : null,
    custom_end_date: periodPreset === 'custom' ? dates.end : null,
    start_time: times.start,
    end_time: times.end,
    comparison_enabled: false,
    comparison_mode: 'previous_period',
    comparison_start_date: null,
    comparison_end_date: null,
    category: '', daypart: '', day_of_week: null, hour: null, top_n: 10, rank_basis: 'revenue', sales_view: 'items',
    ...scope,
    active_profile_id: nextActiveId,
    pos_report_profiles: nextProfiles,
  })

  const cachePreferenceSettings = (patch) => {
    queryClient.setQueryData(queryKeys.reportPreferences(restaurantId), current => ({
      ...(current && typeof current === 'object' ? current : {}),
      settings: {
        ...(current?.settings && typeof current.settings === 'object' ? current.settings : {}),
        ...patch,
      },
    }))
  }

  const savePreferences = async (nextProfiles, nextActiveId) => {
    const settings = preferencePayload(nextProfiles, nextActiveId)
    await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/view-preferences/reports`, { method: 'PUT', body: JSON.stringify({ settings }) })
    cachePreferenceSettings(settings)
    setProfiles(nextProfiles); setActiveProfileId(nextActiveId); setStatus('Report profiles saved.')
  }

  const selectProfile = (id) => {
    setActiveProfileId(id)
    cachePreferenceSettings({ active_profile_id: id, pos_report_profiles: profiles })
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/view-preferences/reports`, {
      method: 'PUT',
      body: JSON.stringify({ settings: { active_profile_id: id, pos_report_profiles: profiles } }),
    }).catch(() => undefined)
  }

  const selectPeriod = (preset) => {
    setPeriodPreset(preset)
    if (preset !== 'custom') setDates(periodRange(preset))
  }

  const setCustomDateTime = (field, value) => {
    if (!value.includes('T')) return
    const [dateValue, timeValue] = value.split('T')
    setPeriodPreset('custom')
    const nextDates = { ...dates, [field]: dateValue }
    const nextTimes = { ...times, [field]: timeValue }
    const other = field === 'start' ? 'end' : 'start'
    const nextValue = `${nextDates[field]}T${nextTimes[field]}`
    const otherValue = `${nextDates[other]}T${nextTimes[other]}`
    if ((field === 'start' && nextValue > otherValue) || (field === 'end' && nextValue < otherValue)) {
      nextDates[other] = dateValue
      nextTimes[other] = timeValue
    }
    setDates(nextDates)
    setTimes(nextTimes)
  }

  useEffect(() => {
    if (!restaurantId || !hydrated) return undefined
    if (!preferenceAutosaveReadyRef.current) {
      preferenceAutosaveReadyRef.current = true
      return undefined
    }
    const timeout = window.setTimeout(() => {
      const settings = {
        period_preset: periodPreset,
        custom_start_date: periodPreset === 'custom' ? dates.start : null,
        custom_end_date: periodPreset === 'custom' ? dates.end : null,
        start_time: times.start,
        end_time: times.end,
        ...scope,
      }
      cachePreferenceSettings(settings)
      fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/view-preferences/reports`, {
        method: 'PUT',
        body: JSON.stringify({ settings }),
      }).catch(() => undefined)
    }, 450)
    return () => window.clearTimeout(timeout)
  }, [restaurantId, hydrated, periodPreset, dates.start, dates.end, times.start, times.end, scope.scope_dimension, scope.scope_mode, scopeIdsKey])

  const artifactPayload = (format) => ({
    start_date: dates.start,
    end_date: dates.end,
    start_time: times.start,
    end_time: times.end,
    format,
    packet_name: `${activeProfile.name} POS report`,
    receipt_group_ids: scopedGroupIds,
    top_n: 10,
    ...backendScope,
  })

  const receiptPrintPayload = {
    start_date: dates.start,
    end_date: dates.end,
    start_time: times.start,
    end_time: times.end,
    receipt_group_ids: scopedGroupIds,
    top_n: 10,
    snapshot_id: snapshot?.print_snapshot_id || null,
    ...backendScope,
  }
  const receiptPreviewRequestKey = JSON.stringify({ ...receiptPrintPayload, profile_name: activeProfile.name })

  const preloadReceiptPreview = async () => {
    if (!restaurantId || !snapshotCoversReceiptRequest(snapshot, receiptPrintPayload)) return null
    const cached = preloadedReceiptPreviews[receiptPreviewRequestKey]
    if (cached && Date.now() - cached.loadedAt < STALE_TIMES.receiptPreview) return cached.preview
    try {
      const preview = await fetchCached(
        queryKeys.reportReceiptPreview(restaurantId, receiptPreviewRequestKey),
        () => fetchPosApi(restaurantId, '/manager/report-hub/receipt-preview', {
          method: 'POST',
          body: receiptPreviewRequestKey,
        }),
        STALE_TIMES.receiptPreview,
      )
      setPreloadedReceiptPreviews((current) => ({
        ...current,
        [receiptPreviewRequestKey]: { preview, loadedAt: Date.now() },
      }))
      return preview
    } catch {
      return null
    }
  }

  const downloadArtifact = async (format) => {
    setWorking(format); setStatus('')
    try {
      const file = await fetchPosApi(restaurantId, '/manager/report-hub/artifact', { method: 'POST', body: JSON.stringify(artifactPayload(format)) })
      saveBlob(fileFromBase64(file), file.file_name)
      setStatus(`${file.file_name} is ready.`)
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : `Could not generate ${format.toUpperCase()}.`)
    } finally {
      setWorking('')
    }
  }

  const emailReport = (values) => fetchPosApi(restaurantId, '/manager/report-hub/email-now', {
    method: 'POST',
    body: JSON.stringify({ ...artifactPayload('pdf'), formats: values.formats, recipients: values.recipients, message: values.message }),
  })

  const saveRecipient = async (id, draft) => {
    const endpoint = id ? `/restaurants/${restaurantId}/reports/recipients/${id}` : `/restaurants/${restaurantId}/reports/recipients`
    await fetchWithSupabaseAuth(endpoint, { method: id ? 'PUT' : 'POST', body: JSON.stringify(draft) })
    await loadRecipients(true)
  }

  const deleteRecipient = async (id) => {
    await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/recipients/${id}`, { method: 'DELETE' })
    await loadRecipients(true)
  }

  const testRecipient = async (id) => {
    const result = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/recipients/${id}/test`, { method: 'POST' })
    await loadRecipients(true)
    return result
  }

  const selectedGroupCount = useMemo(() => (snapshot?.groups || []).filter((group) => scopedGroupIds.includes(group.id)).length, [snapshot, scopedGroupIds])
  const preloadedReceiptPreview = (() => {
    const cached = preloadedReceiptPreviews[receiptPreviewRequestKey]
    return cached && Date.now() - cached.loadedAt < STALE_TIMES.receiptPreview ? cached.preview : null
  })()

  return (
    <div aria-busy={loading} className="mx-auto w-full max-w-7xl overflow-x-hidden pb-12">
      <header className="sticky top-0 z-30 -mx-3 border-b border-white/10 bg-dash-base/95 px-3 py-4 backdrop-blur-xl sm:-mx-5 sm:px-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0"><h1 className="text-2xl font-semibold">POS reports</h1><p className="mt-1 text-xs text-dash-tertiary">Restaurant local time {dates.start} {times.start} through {dates.end} {times.end}</p></div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {viewVisible(viewPolicy, 'reports.scope') && <IconButton label={scope.scope_dimension === 'none' ? 'Scope' : scope.scope_dimension === 'device' ? 'Devices' : scope.scope_dimension === 'employee' ? 'Employees' : 'Sections'} icon={Layers} onClick={openScopeModal} />}
              {viewVisible(viewPolicy, 'reports.profiles') && <IconButton label="Settings" icon={Settings2} onClick={() => setModal('settings')} />}
              {viewVisible(viewPolicy, 'reports.schedules') && <IconButton label="Schedules" icon={Mail} onClick={openSchedulesModal} />}
              {canConfigureServerReceipt && viewVisible(viewPolicy, 'reports.receipt_template') && <IconButton label="Server receipt" icon={Printer} onClick={() => setServerReceiptOpen(true)} />}
              <IconButton label="Refresh" icon={RefreshCw} onClick={() => { void load(true) }} disabled={loading} />
            </div>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-white/10 bg-white/[0.025] p-1">{visibleProfiles.map((profile) => <button key={profile.id} type="button" onClick={() => selectProfile(profile.id)} className={`shrink-0 rounded px-4 py-2 text-sm font-semibold ${activeProfile.id === profile.id ? 'bg-dash-cream text-dash-base' : 'text-dash-secondary hover:text-dash-cream'}`}>{profile.name}</button>)}</div>
            <div className="flex max-w-full flex-wrap items-end gap-2">
              <Field label="Period"><select value={periodPreset} onChange={(event) => selectPeriod(event.target.value)}>{PERIOD_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>
              <Field label="From"><input type="datetime-local" value={`${dates.start}T${times.start}`} onChange={(event) => setCustomDateTime('start', event.target.value)} /></Field>
              <Field label="Through"><input type="datetime-local" value={`${dates.end}T${times.end}`} onChange={(event) => setCustomDateTime('end', event.target.value)} /></Field>
            </div>
          </div>
          {viewVisible(viewPolicy, 'reports.exports') && <div className="flex flex-wrap items-center gap-2">
            <IconButton label="PDF" icon={FileText} onClick={() => downloadArtifact('pdf')} disabled={!snapshot || Boolean(working)} />
            <IconButton label="CSV" icon={Download} onClick={() => downloadSnapshotCsv(snapshot, scopedGroupIds, activeProfile.name)} disabled={!snapshot || Boolean(working)} />
            <IconButton label="Excel" icon={FileSpreadsheet} onClick={() => downloadArtifact('xlsx')} disabled={!snapshot || Boolean(working)} />
            <IconButton label="Email" icon={Mail} onClick={() => setModal('email')} disabled={!snapshot || Boolean(working)} />
            <IconButton label="Print receipt" icon={Printer} onIntent={() => { void preloadReceiptPreview() }} onClick={() => { void preloadReceiptPreview(); setReceiptPrintOpen(true) }} disabled={!snapshot || loading || Boolean(working)} />
            <span className="ml-auto text-xs text-dash-tertiary">{selectedGroupCount} section{selectedGroupCount === 1 ? '' : 's'}</span>
          </div>}
        </div>
      </header>

      {loading && snapshot && <div role="status" aria-live="polite" className="my-4 flex items-center gap-2 rounded-md border border-dash-gold/20 bg-dash-gold/10 px-3 py-2 text-sm text-dash-cream"><RefreshCw className="h-4 w-4 animate-spin text-dash-gold" /><span>Updating POS report…</span></div>}
      {error && <div className="my-5 rounded-md border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
      {status && <div className="my-4 flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-secondary"><span>{status}</span><button type="button" title="Dismiss" onClick={() => setStatus('')} className="rounded p-1 hover:bg-white/10"><X className="h-4 w-4" /></button></div>}
      {loading && !snapshot && <div role="status" aria-live="polite" className="flex min-h-72 flex-col items-center justify-center gap-3 text-sm text-dash-secondary"><RefreshCw className="h-6 w-6 animate-spin text-dash-gold" /><span>Loading POS report…</span></div>}
      {snapshot && <div className="py-6 sm:py-8"><DigitalReceipt snapshot={snapshot} profile={activeProfile} /></div>}

      {modal === 'scope' && <ScopeModal value={scope} dimensions={dimensions} loading={dimensionsLoading} error={dimensionsError} onClose={() => setModal(null)} onApply={(next) => { setScope(next); setModal(null) }} />}
      {modal === 'settings' && <ProfileSettingsModal profiles={profiles} activeId={activeProfileId} catalog={catalog} defaults={defaults} scopeDimension={scope.scope_dimension} canConfigureReceipt={canConfigureServerReceipt && viewVisible(viewPolicy, 'reports.receipt_template')} canManageSchedules={viewVisible(viewPolicy, 'reports.schedules')} onConfigureReceipt={() => { setModal(null); setServerReceiptOpen(true) }} onManageSchedules={openSchedulesModal} onClose={() => setModal(null)} onSave={savePreferences} />}
      {modal === 'email' && <EmailModal profileName={activeProfile.name} onClose={() => setModal(null)} onSend={emailReport} />}
      {modal === 'schedules' && <ScheduledReportsModal recipients={recipients} loading={recipientsLoading} canManage={canManageRecipients} deliveryEnabled={emailDelivery.enabled} disabledReason={emailDelivery.reason} defaultTimezone={snapshot?.restaurant?.timezone} onClose={() => setModal(null)} onSave={saveRecipient} onDelete={deleteRecipient} onTest={testRecipient} />}
      {serverReceiptOpen && <ServerReceiptTemplateModal restaurantId={restaurantId} onClose={() => setServerReceiptOpen(false)} onSaved={() => setStatus('Server receipt layout saved restaurant-wide.')} />}
      {receiptPrintOpen && <ReceiptPrintModal restaurantId={restaurantId} profileName={activeProfile.name} requestPayload={receiptPrintPayload} initialPreview={preloadedReceiptPreview} onClose={() => setReceiptPrintOpen(false)} onPrinted={setStatus} />}
    </div>
  )
}

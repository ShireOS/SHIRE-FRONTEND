import { useEffect, useMemo, useState } from 'react'
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  Layers,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { fetchWithSupabaseAuth } from '../../shared/query'
import { fetchPosApi } from '../../shared/api/posClient'
import ServerReceiptTemplateModal from './ServerReceiptTemplateModal'
import { ReconciliationBanner, fetchReconciliation } from '../../shared/components/ReconciliationBanner'
import { effectivePreference } from './reportPreferences'

const SECTION_META = [
  ['sales_revenue', 'Sales & revenue'],
  ['top_bottom_sellers', 'Top & bottom sellers'],
  ['average_check', 'Average check'],
  ['employee_reports', 'Employee reports'],
  ['payroll_support', 'Payroll support'],
  ['punch_log', 'Punch log'],
  ['z_report', 'End-of-day Z report'],
  ['tax_summary', 'Tax'],
  ['daily_summary', 'Daily summary'],
]
const SECTION_LABELS = Object.fromEntries(SECTION_META)
const ALL_SECTION_IDS = SECTION_META.map(([id]) => id)
const resolvePreference = (preference) => effectivePreference(preference, ALL_SECTION_IDS)
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PERIOD_OPTIONS = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom' },
]

function dateKey(value) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDateKey(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function shiftDate(value, amount) {
  const date = typeof value === 'string' ? parseDateKey(value) : new Date(value)
  date.setDate(date.getDate() + amount)
  return date
}

function periodRange(preset, now = new Date()) {
  const end = new Date()
  end.setFullYear(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(end)
  if (preset === 'month') start.setDate(1)
  else if (preset === 'quarter') start.setMonth(Math.floor(end.getMonth() / 3) * 3, 1)
  else if (preset === 'year') start.setMonth(0, 1)
  else {
    const mondayOffset = (end.getDay() + 6) % 7
    start.setDate(end.getDate() - mondayOffset)
  }
  return { start: dateKey(start), end: dateKey(end) }
}

function comparisonRange(startKey, endKey, mode) {
  const start = parseDateKey(startKey)
  const end = parseDateKey(endKey)
  if (mode === 'previous_year') {
    start.setFullYear(start.getFullYear() - 1)
    end.setFullYear(end.getFullYear() - 1)
    return { comparisonStart: dateKey(start), comparisonEnd: dateKey(end) }
  }
  const dayCount = Math.round((end - start) / 86400000) + 1
  const comparisonEnd = shiftDate(start, -1)
  const comparisonStart = shiftDate(comparisonEnd, -(dayCount - 1))
  return { comparisonStart: dateKey(comparisonStart), comparisonEnd: dateKey(comparisonEnd) }
}

function initialDates() {
  const range = periodRange('week')
  return {
    ...range,
    ...comparisonRange(range.start, range.end, 'previous_period'),
  }
}

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0))
}

function number(value, digits = 0) {
  const precision = typeof digits === 'number' ? digits : 0
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: precision }).format(Number(value || 0))
}

function percent(value) {
  return value == null ? '—' : `${number(value, 1)}%`
}

function duration(value) {
  return value == null ? '—' : `${number(value, 1)} min`
}

function downloadCsv(filename, rows) {
  if (!rows.length) return
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const escape = (value) => {
    const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }
  const csv = [columns.map(escape).join(','), ...rows.map((row) => columns.map((key) => escape(row[key])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function IconButton({ label, icon: Icon, onClick, disabled = false, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`inline-flex h-10 self-start items-center gap-2 rounded-md px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${primary ? 'bg-dash-gold text-black' : 'border border-white/10 bg-white/[0.04] text-dash-secondary hover:bg-white/[0.08] hover:text-dash-cream'}`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function ComparisonToggle({ enabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-dash-secondary hover:bg-white/[0.08] hover:text-dash-cream"
    >
      <span className={`relative h-5 w-9 rounded-full transition ${enabled ? 'bg-dash-gold' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      <span>{enabled ? 'On' : 'Off'}</span>
    </button>
  )
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-md border border-white/10 bg-white/[0.025] p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`shrink-0 rounded px-3 py-2 text-xs font-semibold ${value === option.id ? 'bg-dash-cream text-dash-base' : 'text-dash-secondary hover:text-dash-cream'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Delta({ value, format = number, invert = false }) {
  if (!value || value.delta == null) return null
  const delta = Number(value.delta || 0)
  const positive = delta >= 0
  const favorable = invert ? delta <= 0 : positive
  const absoluteDelta = format(Math.abs(delta))
  return (
    <span className={`text-xs font-semibold ${favorable ? 'text-emerald-400' : 'text-red-300'}`}>
      {positive ? '+' : '-'}{absoluteDelta} from comparison
      {value.percent_change != null && <span className="ml-1 font-normal opacity-80">({positive ? '+' : ''}{percent(value.percent_change)})</span>}
    </span>
  )
}

function Stat({ label, value, comparison, comparisonFormat, invertDelta = false }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] p-4">
      <p className="label-mono">{label}</p>
      <p className="mt-2 truncate text-xl font-semibold sm:text-2xl">{value}</p>
      <div className="mt-1 min-h-4"><Delta value={comparison} format={comparisonFormat} invert={invertDelta} /></div>
    </div>
  )
}

function Disclosure({ title, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-white/10 pt-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-sm font-semibold text-dash-secondary hover:bg-white/[0.04] hover:text-dash-cream"
      >
        <span>{title} <span className="font-normal text-dash-tertiary">({number(count)})</span></span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}

function Table({ columns, rows, empty = 'No records in this period.' }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-white/10 text-xs uppercase text-dash-tertiary">
          <tr>{columns.map((column) => <th key={column.key} className="whitespace-nowrap px-3 py-3 font-semibold">{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row, index) => (
            <tr key={row.id || row.staff_id || row.menu_item_id || row.payment_id || `${row.name || row.label || 'row'}-${index}`}>
              {columns.map((column) => (
                <td key={column.key} className="whitespace-nowrap px-3 py-3 text-dash-secondary">
                  {column.render ? column.render(row[column.key], row) : row[column.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-dash-tertiary">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function Section({ id, title, subtitle, exportRows, children }) {
  return (
    <section id={`report-${id}`} className="scroll-mt-32 border-t border-white/10 py-7 last:border-b">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-dash-secondary">{subtitle}</p>}
        </div>
        {exportRows && (
          <IconButton label="Export CSV" icon={Download} onClick={() => downloadCsv(`${id}.csv`, exportRows)} disabled={!exportRows.length} />
        )}
      </div>
      {children}
    </section>
  )
}

function Modal({ title, onClose, children, maxWidth = 'max-w-2xl' }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <div className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-md border border-white/10 bg-dash-surface p-5 shadow-2xl`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} title="Close" className="rounded p-2 text-dash-secondary hover:bg-white/10 hover:text-dash-cream"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ConfigModal({ preference, onClose, onSave }) {
  const resolved = resolvePreference(preference)
  const [visible, setVisible] = useState(resolved.visible)
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      await onSave({ ...preference, visible_sections: visible, section_order: resolved.order })
      onClose()
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal title="Visible report sections" onClose={onClose}>
      <div className="grid gap-2 sm:grid-cols-2">
        {SECTION_META.map(([id, label]) => (
          <label key={id} className="flex cursor-pointer items-center gap-3 rounded-md border border-white/10 px-3 py-3 text-sm">
            <input type="checkbox" checked={visible.includes(id)} onChange={() => setVisible((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <IconButton label={saving ? 'Saving' : 'Save layout'} icon={Save} onClick={save} disabled={saving || visible.length === 0} primary />
      </div>
    </Modal>
  )
}

const EMPTY_RECIPIENT = {
  name: '', email: '', frequency: 'daily', sections: ['sales_revenue', 'daily_summary'],
  send_time: '07:00', timezone: 'America/Chicago', weekday: 1, month_day: 1, is_active: true,
  include_server_summary: true, attachment_formats: ['pdf'],
}

function EmailModal({ recipients, canManage, deliveryEnabled, disabledReason, defaultTimezone, onClose, onSave, onDelete, onTest }) {
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(EMPTY_RECIPIENT)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState(null)
  const [message, setMessage] = useState('')
  const edit = (recipient = null) => {
    setEditing(recipient?.id || 'new')
    setDraft(recipient ? {
      name: recipient.name || '', email: recipient.email, frequency: recipient.frequency,
      sections: recipient.sections, send_time: String(recipient.send_time || '07:00').slice(0, 5),
      timezone: recipient.timezone, weekday: recipient.weekday, month_day: recipient.month_day,
      is_active: recipient.is_active, include_server_summary: recipient.include_server_summary !== false,
      attachment_formats: recipient.attachment_formats || ['pdf'],
    } : { ...EMPTY_RECIPIENT, timezone: defaultTimezone || EMPTY_RECIPIENT.timezone })
  }
  const save = async () => {
    setSaving(true)
    try {
      await onSave(editing === 'new' ? null : editing, draft)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }
  const test = async (recipient) => {
    setTestingId(recipient.id)
    setMessage('')
    try {
      const result = await onTest(recipient.id)
      setMessage(result.message || `Test report accepted for ${recipient.email}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not send the test report.')
    } finally {
      setTestingId(null)
    }
  }
  return (
    <Modal title="Scheduled report recipients" onClose={onClose} maxWidth="max-w-3xl">
      {!deliveryEnabled && <div className="mb-4 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{disabledReason || 'Email delivery is not configured.'}</div>}
      {message && <div className="mb-4 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-dash-secondary">{message}</div>}
      {!editing ? (
        <>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {recipients.map((recipient) => (
              <div key={recipient.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{recipient.name || recipient.email}</p>
                  <p className="text-sm text-dash-secondary">{recipient.email} · {recipient.frequency} · {String(recipient.send_time).slice(0, 5)} · {recipient.timezone}</p>
                  <p className="mt-1 text-xs text-dash-tertiary">{recipient.sections.map((section) => SECTION_LABELS[section]).join(', ')}</p>
                  <p className="mt-1 text-xs text-dash-tertiary">{recipient.last_delivery_status ? `Last delivery: ${recipient.last_delivery_status}${recipient.last_delivery_at ? ` · ${new Date(recipient.last_delivery_at).toLocaleString()}` : ''}` : 'No deliveries yet'}</p>
                </div>
                {canManage && <div className="flex gap-2"><button type="button" disabled={!deliveryEnabled || testingId === recipient.id} onClick={() => test(recipient)} className="rounded-md border border-white/10 px-3 py-2 text-sm disabled:opacity-40">{testingId === recipient.id ? 'Sending...' : 'Send test'}</button><button type="button" onClick={() => edit(recipient)} className="rounded-md border border-white/10 px-3 py-2 text-sm">Edit</button><button type="button" title="Delete recipient" onClick={() => onDelete(recipient.id)} className="rounded-md border border-red-400/20 p-2 text-red-300"><Trash2 className="h-4 w-4" /></button></div>}
              </div>
            ))}
            {!recipients.length && <p className="py-8 text-center text-sm text-dash-tertiary">No scheduled recipients.</p>}
          </div>
          {canManage && <div className="mt-5"><button type="button" onClick={() => edit()} className="rounded-md bg-dash-gold px-4 py-2 text-sm font-semibold text-black">Add recipient</button></div>}
        </>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Recipient name"><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
            <Field label="Email"><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field>
            <Field label="Frequency"><select value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></Field>
            <Field label="Send time"><input type="time" value={draft.send_time} onChange={(event) => setDraft({ ...draft, send_time: event.target.value })} /></Field>
            <Field label="Timezone"><input value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} placeholder="America/Chicago" /></Field>
            {draft.frequency === 'weekly' && <Field label="Day"><select value={draft.weekday ?? 1} onChange={(event) => setDraft({ ...draft, weekday: Number(event.target.value) })}>{DAY_LABELS.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></Field>}
            {draft.frequency === 'monthly' && <Field label="Day of month"><input type="number" min="1" max="28" value={draft.month_day ?? 1} onChange={(event) => setDraft({ ...draft, month_day: Number(event.target.value) })} /></Field>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-dash-tertiary">Sections</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SECTION_META.map(([id, label]) => <label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.sections.includes(id)} onChange={() => setDraft({ ...draft, sections: draft.sections.includes(id) ? draft.sections.filter((section) => section !== id) : [...draft.sections, id] })} />{label}</label>)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-dash-tertiary">Attachments</p>
            <div className="flex flex-wrap gap-4">{[['pdf', 'PDF'], ['xlsx', 'Excel workbook']].map(([id, label]) => <label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.attachment_formats.includes(id)} onChange={() => setDraft({ ...draft, attachment_formats: draft.attachment_formats.includes(id) ? draft.attachment_formats.filter((format) => format !== id) : [...draft.attachment_formats, id] })} />{label}</label>)}</div>
          </div>
          {draft.frequency === 'daily' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.include_server_summary} onChange={(event) => setDraft({ ...draft, include_server_summary: event.target.checked })} />Include the worked-server roster for the completed business day</label>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })} />Active schedule</label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-md border border-white/10 px-4 py-2 text-sm">Cancel</button><button type="button" onClick={save} disabled={saving || !draft.email || !draft.sections.length || !draft.attachment_formats.length} className="rounded-md bg-dash-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">{saving ? 'Saving...' : 'Save recipient'}</button></div>
        </div>
      )}
    </Modal>
  )
}

function Field({ label, children }) {
  return <label className="block text-sm text-dash-secondary"><span className="mb-2 block text-xs font-semibold uppercase text-dash-tertiary">{label}</span><span className="[&>input]:h-10 [&>input]:w-full [&>input]:rounded-md [&>input]:border [&>input]:border-white/10 [&>input]:bg-white/[0.04] [&>input]:px-3 [&>select]:h-10 [&>select]:w-full [&>select]:rounded-md [&>select]:border [&>select]:border-white/10 [&>select]:bg-dash-surface [&>select]:px-3">{children}</span></label>
}

function fileFromBase64(file) {
  const bytes = Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0))
  return new Blob([bytes], { type: file.mime_type })
}

function saveArtifact(file) {
  const url = URL.createObjectURL(fileFromBase64(file))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.file_name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function printPdfArtifact(file) {
  const url = URL.createObjectURL(fileFromBase64(file))
  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.width = '1px'
  frame.style.height = '1px'
  frame.style.opacity = '0'
  frame.src = url
  frame.onload = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url) }, 60_000)
  }
  document.body.appendChild(frame)
}

function ServerReportsPanel({ roster, detail, selectedServerId, onSelect, loading, onPrintReceipt, canConfigureReceipt, onConfigureReceipt }) {
  const [search, setSearch] = useState('')
  const checks = (detail?.checks || []).filter((check) => {
    const needle = search.trim().toLowerCase()
    return !needle || [check.order_number, check.table_number, check.payment_method, check.payment_status].some((value) => String(value || '').toLowerCase().includes(needle))
  })
  const voluntaryTips = Number(detail?.voluntary_tips ?? detail?.tips ?? 0)
  const employeeGratuity = Number(detail?.employee_gratuity ?? 0)
  const restaurantServiceCharges = Number(detail?.restaurant_service_charges ?? 0)
  const unclassifiedServiceCharges = Number(detail?.unclassified_service_charges ?? detail?.unclassified_gratuity ?? 0)
  const totalTipEarnings = Number(detail?.total_tip_earnings ?? voluntaryTips + employeeGratuity)
  const voluntaryTakeHome = Number(detail?.voluntary_take_home ?? detail?.take_home ?? 0)
  const totalTakeHomeEarnings = Number(detail?.total_take_home_earnings ?? voluntaryTakeHome + employeeGratuity)
  const cashDueToRestaurant = detail?.cash_due_to_restaurant ?? detail?.cash_due
  const warningLabel = (warning) => typeof warning === 'string'
    ? warning
    : warning?.message || warning?.detail || warning?.code || 'This report is incomplete.'
  return (
    <section className="mt-6 overflow-hidden rounded-md border border-white/10 bg-white/[0.025]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
        <div><h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5 text-dash-gold" />Server reports</h2><p className="mt-1 text-xs text-dash-tertiary">Accounting business date {roster?.business_date || detail?.business_date || '—'} · people who worked that day, with full selected-server detail and searchable checks.</p></div>
        <div className="flex items-center gap-2">{canConfigureReceipt && <button type="button" onClick={onConfigureReceipt} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-3 text-sm font-semibold text-dash-secondary hover:bg-white/[0.07] hover:text-dash-cream"><Settings2 className="h-4 w-4" />Configure receipt</button>}<span className="rounded-full border border-white/10 px-3 py-1 text-xs text-dash-secondary">{number(roster?.count)} worked</span></div>
      </div>
      <div className="grid min-h-72 lg:grid-cols-[300px_1fr]">
        <div className="border-b border-white/10 p-2 lg:border-b-0 lg:border-r">
          {(roster?.servers || []).map((server) => <button key={server.staff_id} type="button" onClick={() => onSelect(server.staff_id)} className={`mb-1 w-full rounded-md px-3 py-3 text-left ${selectedServerId === server.staff_id ? 'bg-dash-gold text-black' : 'hover:bg-white/[0.05]'}`}><p className="font-semibold">{server.staff_name}</p><p className={`mt-1 text-xs ${selectedServerId === server.staff_id ? 'text-black/65' : 'text-dash-tertiary'}`}>{money(server.sales)} sales · {number(server.check_count)} checks · top {server.top_item?.name || '—'}</p></button>)}
          {!loading && !(roster?.servers || []).length && <p className="p-4 text-sm text-dash-tertiary">No worked servers were recorded for this day.</p>}
        </div>
        <div className="p-4">
          {loading && <div className="flex min-h-52 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-dash-gold" /></div>}
          {!loading && detail && <>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-semibold">{detail.staff_name}</h3><p className="mt-1 text-sm capitalize text-dash-secondary">{detail.role} · {detail.business_date}</p></div><button type="button" onClick={onPrintReceipt} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm font-semibold"><Printer className="h-4 w-4" />Receipt print</button></div>
            {(detail.warnings || []).map((warning, index) => <p key={`${warning?.code || 'warning'}-${index}`} className="mt-3 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{warningLabel(warning)}</p>)}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Stat label="Sales" value={money(detail.sales)} /><Stat label="Voluntary tips" value={money(voluntaryTips)} /><Stat label="Employee gratuity" value={money(employeeGratuity)} />{restaurantServiceCharges !== 0 && <Stat label="Restaurant service charges" value={money(restaurantServiceCharges)} />}{unclassifiedServiceCharges !== 0 && <Stat label="Unclassified legacy charges" value={money(unclassifiedServiceCharges)} />}<Stat label="Total tip earnings" value={money(totalTipEarnings)} /><Stat label="Voluntary tips after tip-out" value={money(voluntaryTakeHome)} /><Stat label="Total earnings after tip-out" value={money(totalTakeHomeEarnings)} />{cashDueToRestaurant != null && <Stat label="Server owes restaurant" value={money(cashDueToRestaurant)} />}<Stat label="Top sold item" value={detail.top_item?.name || '—'} /></div>
            <div className="mt-5 flex items-end justify-between gap-3"><div><h4 className="font-semibold">Checks</h4><p className="text-xs text-dash-tertiary">{number(detail.check_count)} checks · {number(detail.open_check_count)} open</p></div><input aria-label="Search server checks" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search check or table" className="h-10 w-64 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm" /></div>
            <div className="mt-2"><Table rows={checks} columns={[{ key: 'order_number', label: 'Check' }, { key: 'table_number', label: 'Table' }, { key: 'payment_status', label: 'Status' }, { key: 'payment_method', label: 'Tender' }, { key: 'total', label: 'Total', render: money }, { key: 'voluntary_tips', label: 'Voluntary tips', render: (value, row) => money(value ?? row.tip_amount) }, { key: 'employee_gratuity', label: 'Employee gratuity', render: money }, { key: 'restaurant_service_charges', label: 'Restaurant charges', render: money }, { key: 'unclassified_service_charges', label: 'Unclassified charges', render: (value, row) => money(value ?? row.unclassified_gratuity) }, { key: 'total_tip_earnings', label: 'Total tip earnings', render: (value, row) => money(value ?? Number(row.voluntary_tips ?? row.tip_amount ?? 0) + Number(row.employee_gratuity ?? 0)) }]} /></div>
          </>}
          {!loading && !detail && <div className="flex min-h-52 items-center justify-center text-sm text-dash-tertiary">Choose a server to see the full day report.</div>}
        </div>
      </div>
    </section>
  )
}

function PacketPanel({ restaurantId, dates, businessDate, selectedServerId, emailEnabled }) {
  const [sections, setSections] = useState(SECTION_META.map(([id]) => id))
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState('')
  const [status, setStatus] = useState('')
  const payload = {
    start_date: dates.start,
    end_date: dates.end,
    business_date: businessDate,
    sections,
    server_ids: selectedServerId ? [selectedServerId] : [],
    packet_name: 'Manager report packet',
  }
  const artifact = async (format, print = false) => {
    setWorking(print ? 'print' : format); setStatus('')
    try {
      const file = await fetchPosApi(restaurantId, '/manager/report-hub/artifact', { method: 'POST', body: JSON.stringify({ ...payload, format }) })
      if (print) printPdfArtifact(file)
      else saveArtifact(file)
      setStatus(print ? 'System print dialog opened.' : `${file.file_name} is ready.`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not generate the report packet.') }
    finally { setWorking('') }
  }
  const send = async () => {
    setWorking('email'); setStatus('')
    try {
      const result = await fetchPosApi(restaurantId, '/manager/report-hub/email-now', { method: 'POST', body: JSON.stringify({ ...payload, recipients: email.split(',').map((value) => value.trim()).filter(Boolean), formats: ['pdf'], message }) })
      setStatus(`${result.accepted || 0} report email${result.accepted === 1 ? '' : 's'} accepted.`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not email the report packet.') }
    finally { setWorking('') }
  }
  return <div className="space-y-5 py-6"><section className="rounded-md border border-white/10 bg-white/[0.025] p-5"><h2 className="text-xl font-semibold">Build a packet</h2><p className="mt-1 text-sm text-dash-secondary">The complete packet includes the worked-server summary. The currently selected server is the only detailed server/check report included.</p><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{SECTION_META.map(([id, label]) => <label key={id} className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-3 text-sm"><input type="checkbox" checked={sections.includes(id)} onChange={() => setSections((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />{label}</label>)}</div></section><section className="rounded-md border border-white/10 bg-white/[0.025] p-5"><h3 className="font-semibold">Output</h3><div className="mt-4 flex flex-wrap gap-2"><IconButton label="Full-page print" icon={Printer} disabled={Boolean(working) || !sections.length} onClick={() => artifact('pdf', true)} /><IconButton label="PDF" icon={FileText} disabled={Boolean(working) || !sections.length} onClick={() => artifact('pdf')} /><IconButton label="Excel" icon={FileSpreadsheet} disabled={Boolean(working) || !sections.length} onClick={() => artifact('xlsx')} /></div><div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto]"><Field label="Email now"><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@example.com, partner@example.com" /></Field><Field label="Message"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Optional note" /></Field><button type="button" onClick={send} disabled={!emailEnabled || !email.trim() || Boolean(working)} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-dash-gold px-4 text-sm font-semibold text-black disabled:opacity-40"><Send className="h-4 w-4" />Email now</button></div>{!emailEnabled && <p className="mt-3 text-xs text-amber-200">Email delivery is not enabled on the reporting service yet. PDF, Excel, and printing remain available.</p>}{status && <p className="mt-4 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-dash-secondary">{status}</p>}</section></div>
}

function AutomationPanel({ recipients, canManage, emailDelivery, onConfigure }) {
  return <div className="py-6"><section className="rounded-md border border-white/10 bg-white/[0.025] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Report automation</h2><p className="mt-1 text-sm text-dash-secondary">Back-office-only schedules send generated attachments. Daily schedules may include the worked-server roster, never every server’s check detail.</p></div>{canManage && <IconButton label="Manage schedules" icon={Settings2} onClick={onConfigure} primary />}</div>{!emailDelivery.enabled && <p className="mt-4 rounded-md border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">{emailDelivery.reason || 'Email delivery is not configured.'}</p>}<div className="mt-5 divide-y divide-white/10 border-y border-white/10">{recipients.map((recipient) => <div key={recipient.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{recipient.name || recipient.email}</p><p className="mt-1 text-sm text-dash-secondary">{recipient.email} · {recipient.frequency} at {String(recipient.send_time).slice(0, 5)}</p><p className="mt-1 text-xs text-dash-tertiary">Attachments: {(recipient.attachment_formats || ['pdf']).join(', ').toUpperCase()}{recipient.frequency === 'daily' && recipient.include_server_summary !== false ? ' · server roster included' : ''}</p></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs capitalize text-dash-secondary">{recipient.last_delivery_status || 'not sent'}</span></div>)}{!recipients.length && <p className="py-8 text-center text-sm text-dash-tertiary">No automated report schedules yet.</p>}</div></section></div>
}

export default function RestaurantReportsPage({ restaurantId, canConfigureServerReceipt = false }) {
  const [hubTab, setHubTab] = useState('reports')
  const [dates, setDates] = useState(initialDates)
  const [periodPreset, setPeriodPreset] = useState('week')
  const [comparisonEnabled, setComparisonEnabled] = useState(false)
  const [comparisonMode, setComparisonMode] = useState('previous_period')
  const [compareDraft, setCompareDraft] = useState(() => ({ ...initialDates(), mode: 'previous_period', enabled: false }))
  const [filters, setFilters] = useState({ category: '', daypart: '', dayOfWeek: '', hour: '', topN: 10, basis: 'revenue' })
  const [salesView, setSalesView] = useState('items')
  const [reportingScope, setReportingScope] = useState({ scope_dimension: 'none', scope_mode: 'cumulative', scope_ids: [] })
  const [dimensions, setDimensions] = useState({ sections: [], devices: [], coverage: {} })
  const [report, setReport] = useState(null)
  const [recon, setRecon] = useState(null)
  const [reconError, setReconError] = useState('')
  const [preference, setPreference] = useState({ visible_sections: SECTION_META.map(([id]) => id), section_order: SECTION_META.map(([id]) => id), section_settings: {} })
  const [recipients, setRecipients] = useState([])
  const [canManageRecipients, setCanManageRecipients] = useState(false)
  const [emailDelivery, setEmailDelivery] = useState({ enabled: false, reason: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [insights, setInsights] = useState({})
  const [serverRoster, setServerRoster] = useState(null)
  const [serverDetail, setServerDetail] = useState(null)
  const [selectedServerId, setSelectedServerId] = useState('')
  const [serverLoading, setServerLoading] = useState(false)
  const [serverMessage, setServerMessage] = useState('')
  const [serverReceiptConfigOpen, setServerReceiptConfigOpen] = useState(false)
  const [viewHydrated, setViewHydrated] = useState(false)
  const [viewPersistenceReady, setViewPersistenceReady] = useState(false)

  const setPrimaryRange = (range, preset = 'custom') => {
    const comparison = comparisonMode === 'custom'
      ? { comparisonStart: dates.comparisonStart, comparisonEnd: dates.comparisonEnd }
      : comparisonRange(range.start, range.end, comparisonMode)
    setPeriodPreset(preset)
    setDates({ ...range, ...comparison })
  }

  const selectPeriod = (preset) => {
    if (preset === 'custom') {
      setPeriodPreset('custom')
      return
    }
    setPrimaryRange(periodRange(preset), preset)
  }

  const setCustomDate = (field, value) => {
    const range = { start: dates.start, end: dates.end, [field]: value }
    if (field === 'start' && value > range.end) range.end = value
    if (field === 'end' && value < range.start) range.start = value
    setPrimaryRange(range)
  }

  const updateComparisonDraftMode = (mode) => {
    const comparison = mode === 'custom'
      ? { comparisonStart: compareDraft.comparisonStart, comparisonEnd: compareDraft.comparisonEnd }
      : comparisonRange(dates.start, dates.end, mode)
    setCompareDraft({ ...compareDraft, ...comparison, mode })
  }

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    setViewHydrated(false)
    setViewPersistenceReady(false)
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/view-preferences`)
      .then((payload) => {
        if (cancelled) return
        const saved = payload.settings?.reports
        if (saved) {
          const preset = saved.period_preset || 'week'
          const primary = preset === 'custom' && saved.custom_start_date && saved.custom_end_date
            ? { start: saved.custom_start_date, end: saved.custom_end_date }
            : periodRange(preset)
          const mode = saved.comparison_mode || 'previous_period'
          const comparison = mode === 'custom' && saved.comparison_start_date && saved.comparison_end_date
            ? { comparisonStart: saved.comparison_start_date, comparisonEnd: saved.comparison_end_date }
            : comparisonRange(primary.start, primary.end, mode)
          setPeriodPreset(preset)
          setComparisonMode(mode)
          setComparisonEnabled(Boolean(saved.comparison_enabled))
          setDates({ ...primary, ...comparison })
          setFilters({
            category: saved.category || '', daypart: saved.daypart || '',
            dayOfWeek: saved.day_of_week ?? '', hour: saved.hour ?? '',
            topN: saved.top_n || 10, basis: saved.rank_basis || 'revenue',
          })
          setSalesView(saved.sales_view || 'items')
          setReportingScope({
            scope_dimension: saved.scope_dimension || 'none',
            scope_mode: saved.scope_mode || 'cumulative',
            scope_ids: saved.scope_ids || [],
          })
        }
        setViewPersistenceReady(true)
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setViewHydrated(true) })
    return () => { cancelled = true }
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId || !viewHydrated || !viewPersistenceReady) return
    const timeout = window.setTimeout(() => {
      fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/view-preferences/reports`, {
        method: 'PUT',
        body: JSON.stringify({
          settings: {
            period_preset: periodPreset,
            custom_start_date: periodPreset === 'custom' ? dates.start : null,
            custom_end_date: periodPreset === 'custom' ? dates.end : null,
            comparison_enabled: comparisonEnabled,
            comparison_mode: comparisonMode,
            comparison_start_date: comparisonMode === 'custom' ? dates.comparisonStart : null,
            comparison_end_date: comparisonMode === 'custom' ? dates.comparisonEnd : null,
            category: filters.category,
            daypart: filters.daypart,
            day_of_week: filters.dayOfWeek === '' ? null : Number(filters.dayOfWeek),
            hour: filters.hour === '' ? null : Number(filters.hour),
            top_n: filters.topN,
            rank_basis: filters.basis,
            sales_view: salesView,
            ...reportingScope,
          },
        }),
      }).catch(() => undefined)
    }, 450)
    return () => window.clearTimeout(timeout)
  }, [restaurantId, viewHydrated, viewPersistenceReady, periodPreset, dates, comparisonEnabled, comparisonMode, filters, salesView, reportingScope])

  const load = async () => {
    if (!restaurantId) return
    setLoading(true)
    setError('')
    setReconError('')
    const query = new URLSearchParams({
      start_date: dates.start, end_date: dates.end,
      include_comparison: String(comparisonEnabled),
      top_n: String(filters.topN), rank_basis: filters.basis,
    })
    if (comparisonEnabled) {
      query.set('comparison_start_date', dates.comparisonStart)
      query.set('comparison_end_date', dates.comparisonEnd)
    }
    if (filters.category) query.set('category', filters.category)
    if (filters.daypart) query.set('daypart', filters.daypart)
    if (filters.dayOfWeek !== '') query.set('day_of_week', filters.dayOfWeek)
    if (filters.hour !== '') query.set('hour', filters.hour)
    query.set('scope_dimension', reportingScope.scope_dimension)
    query.set('scope_mode', reportingScope.scope_mode)
    if (reportingScope.scope_ids.length) query.set('scope_ids', reportingScope.scope_ids.join(','))
    try {
      const [nextReport, nextPreference, emailConfig, nextDimensions, nextRecon] = await Promise.all([
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports?${query}`),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/preferences`),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/recipients`),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/dimensions`),
        // Verification is advisory — a failure here never blocks the report,
        // but it must remain visible rather than looking like a verified result.
        fetchReconciliation(restaurantId, dates.start, dates.end)
          .then((data) => ({ data, error: '' }))
          .catch((reconciliationError) => ({ data: null, error: reconciliationError instanceof Error ? reconciliationError.message : 'Independent verification is unavailable.' })),
      ])
      setReport(nextReport)
      setRecon(nextRecon.data)
      setReconError(nextRecon.error)
      setPreference(nextPreference)
      setRecipients(emailConfig.recipients || [])
      setCanManageRecipients(Boolean(emailConfig.can_manage))
      setEmailDelivery({ enabled: Boolean(emailConfig.delivery_enabled), reason: emailConfig.delivery_disabled_reason || '' })
      setDimensions(nextDimensions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (viewHydrated) void load() }, [restaurantId, viewHydrated, dates, comparisonEnabled, filters.category, filters.daypart, filters.dayOfWeek, filters.hour, filters.topN, filters.basis, reportingScope])

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    setServerLoading(true)
    fetchPosApi(restaurantId, `/manager/report-hub/servers?business_date=${dates.end}`)
      .then((data) => {
        if (cancelled) return
        setServerRoster(data)
        const first = data.servers?.[0]?.staff_id || ''
        setSelectedServerId((current) => data.servers?.some((server) => server.staff_id === current) ? current : first)
      })
      .catch((err) => { if (!cancelled) setServerMessage(err instanceof Error ? err.message : 'Could not load server reports.') })
      .finally(() => { if (!cancelled) setServerLoading(false) })
    return () => { cancelled = true }
  }, [restaurantId, dates.end])

  useEffect(() => {
    if (!restaurantId || !selectedServerId) { setServerDetail(null); return }
    let cancelled = false
    setServerLoading(true)
    fetchPosApi(restaurantId, `/manager/report-hub/servers/${selectedServerId}?business_date=${dates.end}`)
      .then((data) => { if (!cancelled) setServerDetail(data) })
      .catch((err) => { if (!cancelled) setServerMessage(err instanceof Error ? err.message : 'Could not load the server report.') })
      .finally(() => { if (!cancelled) setServerLoading(false) })
    return () => { cancelled = true }
  }, [restaurantId, selectedServerId, dates.end])

  const printServerReceipt = async () => {
    if (!selectedServerId) return
    setServerMessage('')
    try {
      const result = await fetchPosApi(restaurantId, `/manager/report-hub/servers/${selectedServerId}/receipt?business_date=${dates.end}`, { method: 'POST', body: '{}' })
      setServerMessage(result.queued ? 'Server receipt report queued.' : 'Server receipt report could not be queued.')
    } catch (err) { setServerMessage(err instanceof Error ? err.message : 'Could not print the server receipt report.') }
  }

  const sections = report?.sections || {}
  const reconciliationCoversCurrentView = !filters.category
    && !filters.daypart
    && filters.dayOfWeek === ''
    && filters.hour === ''
    && reportingScope.scope_dimension === 'none'
  const orderedSections = resolvePreference(preference).visible
  const categories = sections.sales_revenue?.categories?.map((row) => row.label).filter(Boolean) || []
  const comparisonLabel = `${dates.comparisonStart} through ${dates.comparisonEnd}`

  const savePreference = async (next) => {
    const saved = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/preferences`, { method: 'PUT', body: JSON.stringify({ visible_sections: next.visible_sections, section_order: next.section_order, section_settings: next.section_settings || {} }) })
    setPreference(saved)
  }
  const saveRecipient = async (id, draft) => {
    const endpoint = id ? `/restaurants/${restaurantId}/reports/recipients/${id}` : `/restaurants/${restaurantId}/reports/recipients`
    await fetchWithSupabaseAuth(endpoint, { method: id ? 'PUT' : 'POST', body: JSON.stringify(draft) })
    const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/recipients`)
    setRecipients(data.recipients || [])
    setEmailDelivery({ enabled: Boolean(data.delivery_enabled), reason: data.delivery_disabled_reason || '' })
  }
  const deleteRecipient = async (id) => {
    await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/recipients/${id}`, { method: 'DELETE' })
    setRecipients((current) => current.filter((recipient) => recipient.id !== id))
  }
  const testRecipient = async (id) => {
    const result = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/recipients/${id}/test`, { method: 'POST' })
    const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/recipients`)
    setRecipients(data.recipients || [])
    return result
  }
  const generateInsight = async (staffId) => {
    setInsights((current) => ({ ...current, [staffId]: { loading: true } }))
    try {
      const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/staff/${staffId}/pos-insight?start_date=${dates.start}&end_date=${dates.end}`, { method: 'POST' })
      setInsights((current) => ({ ...current, [staffId]: { loading: false, data } }))
    } catch (err) {
      setInsights((current) => ({ ...current, [staffId]: { loading: false, error: err instanceof Error ? err.message : 'Could not generate insight.' } }))
    }
  }

  const sectionRenderers = {
    sales_revenue: () => <SalesRevenue section={sections.sales_revenue} filters={filters} setFilters={setFilters} categories={categories} comparisonEnabled={comparisonEnabled} view={salesView} setView={setSalesView} />,
    top_bottom_sellers: () => <TopBottom section={sections.top_bottom_sellers} filters={filters} setFilters={setFilters} />,
    average_check: () => <AverageCheck section={sections.average_check} comparisonEnabled={comparisonEnabled} />,
    employee_reports: () => <EmployeeReports section={sections.employee_reports} insights={insights} onInsight={generateInsight} />,
    payroll_support: () => <Payroll section={sections.payroll_support} comparisonEnabled={comparisonEnabled} />,
    punch_log: () => <PunchLog section={sections.punch_log} />,
    z_report: () => <ZReport section={sections.z_report} />,
    tax_summary: () => <TaxSummary section={sections.tax_summary} comparisonEnabled={comparisonEnabled} />,
    daily_summary: () => <DailySummary section={sections.daily_summary} comparisonEnabled={comparisonEnabled} />,
  }

  return (
    <div className="mx-auto w-full max-w-7xl overflow-x-hidden">
      <header className="sticky top-0 z-30 -mx-3 border-b border-white/10 bg-dash-base/95 px-3 py-4 backdrop-blur-xl sm:-mx-5 sm:px-5">
        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="mt-1 truncate text-2xl font-semibold">Restaurant reports</h1>
              <p className="mt-1 text-xs text-dash-tertiary">Accounting business dates {dates.start} through {dates.end}</p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2 sm:ml-auto">
              <IconButton label="Set comparison" icon={CalendarRange} onClick={() => { setCompareDraft({ ...dates, mode: comparisonMode, enabled: comparisonEnabled }); setModal('compare') }} />
              <IconButton label={reportingScope.scope_dimension === 'none' ? 'Scope' : reportingScope.scope_dimension === 'device' ? 'Devices' : 'Sections'} icon={Layers} onClick={() => setModal('scope')} />
              <IconButton label="Configure" icon={Settings2} onClick={() => setModal('config')} />
              <IconButton label="Email" icon={Mail} onClick={() => setModal('email')} />
              <IconButton label="Reset filters" icon={RotateCcw} onClick={() => {
                const primary = periodRange('week')
                setPeriodPreset('week'); setComparisonMode('previous_period'); setComparisonEnabled(false)
                setDates({ ...primary, ...comparisonRange(primary.start, primary.end, 'previous_period') })
                setFilters({ category: '', daypart: '', dayOfWeek: '', hour: '', topN: 10, basis: 'revenue' })
                setSalesView('items')
                setReportingScope({ scope_dimension: 'none', scope_mode: 'cumulative', scope_ids: [] })
              }} />
              <IconButton label="Refresh" icon={RefreshCw} onClick={load} disabled={loading} />
            </div>
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-white/10 bg-white/[0.025] p-1">
            {[['reports', 'Reports'], ['packets', 'Packets'], ['automation', 'Automation']].map(([id, label]) => <button key={id} type="button" onClick={() => setHubTab(id)} className={`rounded px-4 py-2 text-sm font-semibold ${hubTab === id ? 'bg-dash-cream text-dash-base' : 'text-dash-secondary hover:text-dash-cream'}`}>{label}</button>)}
          </div>
          <div className="flex justify-end">
            <div className="flex max-w-full flex-wrap items-end gap-2 rounded-md border border-white/10 bg-white/[0.025] p-2">
              <Field label="Period"><select aria-label="Reporting period" value={periodPreset} onChange={(event) => selectPeriod(event.target.value)}>{PERIOD_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>
              <Field label="From"><input type="date" value={dates.start} onChange={(event) => setCustomDate('start', event.target.value)} /></Field>
              <Field label="Through"><input type="date" value={dates.end} onChange={(event) => setCustomDate('end', event.target.value)} /></Field>
            </div>
          </div>
        </div>
        {comparisonEnabled && <div className="mt-3 flex items-center gap-2 rounded-md border border-dash-gold/20 bg-dash-gold/5 px-3 py-2 text-xs text-dash-secondary">
          <CalendarRange className="h-4 w-4 shrink-0 text-dash-gold" />
          <span><strong className="text-dash-cream">Comparison active:</strong> {comparisonLabel}</span>
        </div>}
        {reportingScope.scope_dimension !== 'none' && <div className="mt-3 flex items-start gap-2 rounded-md border border-sky-400/20 bg-sky-400/5 px-3 py-2 text-xs text-dash-secondary">
          <Layers className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
          <span><strong className="text-dash-cream">Scoped reporting:</strong> sales-derived sections use the selected {reportingScope.scope_dimension === 'device' ? 'devices' : 'sections'}. Employee, payroll, and punch data remain restaurant-wide because those records do not yet have reliable section or device attribution.</span>
        </div>}
      </header>

      {error && <div className="my-5 rounded-md border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
      {serverMessage && <div className="my-4 rounded-md border border-white/10 bg-white/[0.035] p-3 text-sm text-dash-secondary">{serverMessage}</div>}
      {hubTab === 'reports' && <>
        {loading && !report && <div className="flex min-h-64 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-dash-gold" /></div>}
        {report && <div className="my-4">{reconciliationCoversCurrentView ? <ReconciliationBanner recon={recon} filename={`verification-${dates.start}-${dates.end}.csv`} /> : <p className="rounded-md border border-sky-400/20 bg-sky-400/5 px-3 py-2 text-sm text-sky-100">Independent verification covers the whole restaurant and selected accounting dates. It is hidden for this filtered or scoped view so a whole-restaurant green result cannot be mistaken as verification of the visible subset.</p>}{reconError && reconciliationCoversCurrentView && <p className="rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">Independent transaction verification is unavailable: {reconError}</p>}</div>}
        {report && orderedSections.map((id) => <div key={id}>{sectionRenderers[id]?.()}</div>)}
        <ServerReportsPanel roster={serverRoster} detail={serverDetail} selectedServerId={selectedServerId} onSelect={setSelectedServerId} loading={serverLoading} onPrintReceipt={printServerReceipt} canConfigureReceipt={canConfigureServerReceipt} onConfigureReceipt={() => setServerReceiptConfigOpen(true)} />
      </>}
      {hubTab === 'packets' && <PacketPanel restaurantId={restaurantId} dates={dates} businessDate={dates.end} selectedServerId={selectedServerId} emailEnabled={emailDelivery.enabled} />}
      {hubTab === 'automation' && <AutomationPanel recipients={recipients} canManage={canManageRecipients} emailDelivery={emailDelivery} onConfigure={() => setModal('email')} />}

      {modal === 'compare' && <Modal title="Comparison period" onClose={() => setModal(null)}><div className="space-y-4"><div className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.025] p-3"><div><p className="text-sm font-semibold">Comparison</p><p className="mt-1 text-xs text-dash-tertiary">Show changes against another period.</p></div><ComparisonToggle enabled={compareDraft.enabled} onChange={(enabled) => setCompareDraft({ ...compareDraft, enabled })} /></div><div className={compareDraft.enabled ? '' : 'pointer-events-none opacity-40'}><div className="space-y-4"><Field label="Compare against"><select value={compareDraft.mode} onChange={(event) => updateComparisonDraftMode(event.target.value)}><option value="previous_period">Previous equal period</option><option value="previous_year">Same period last year</option><option value="custom">Custom period</option></select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Comparison from"><input type="date" value={compareDraft.comparisonStart} onChange={(event) => setCompareDraft({ ...compareDraft, mode: 'custom', comparisonStart: event.target.value })} /></Field><Field label="Comparison through"><input type="date" value={compareDraft.comparisonEnd} onChange={(event) => setCompareDraft({ ...compareDraft, mode: 'custom', comparisonEnd: event.target.value })} /></Field></div></div></div></div><div className="mt-5 flex justify-end"><IconButton label="Save comparison" icon={CalendarRange} primary disabled={compareDraft.enabled && (!compareDraft.comparisonStart || !compareDraft.comparisonEnd || compareDraft.comparisonStart > compareDraft.comparisonEnd)} onClick={() => { setComparisonMode(compareDraft.mode); setComparisonEnabled(compareDraft.enabled); setDates((current) => ({ ...current, comparisonStart: compareDraft.comparisonStart, comparisonEnd: compareDraft.comparisonEnd })); setModal(null) }} /></div></Modal>}
      {modal === 'scope' && <ReportScopeModal value={reportingScope} dimensions={dimensions} onClose={() => setModal(null)} onApply={(next) => { setReportingScope(next); setModal(null) }} />}
      {modal === 'config' && <ConfigModal preference={preference} onClose={() => setModal(null)} onSave={savePreference} />}
      {modal === 'email' && <EmailModal recipients={recipients} canManage={canManageRecipients} deliveryEnabled={emailDelivery.enabled} disabledReason={emailDelivery.reason} defaultTimezone={report?.restaurant?.timezone} onClose={() => setModal(null)} onSave={saveRecipient} onDelete={deleteRecipient} onTest={testRecipient} />}
      {serverReceiptConfigOpen && <ServerReceiptTemplateModal restaurantId={restaurantId} onClose={() => setServerReceiptConfigOpen(false)} onSaved={() => setServerMessage('Server receipt layout saved restaurant-wide.')} />}
    </div>
  )
}

function ReportScopeModal({ value, dimensions, onClose, onApply }) {
  const [draft, setDraft] = useState(() => ({ ...value, scope_ids: [...value.scope_ids] }))
  const options = draft.scope_dimension === 'revenue_center' ? dimensions.sections || [] : draft.scope_dimension === 'device' ? dimensions.devices || [] : []
  const toggle = (id) => setDraft((current) => ({ ...current, scope_ids: current.scope_ids.includes(id) ? current.scope_ids.filter((item) => item !== id) : [...current.scope_ids, id] }))
  return <Modal title="Report scope" onClose={onClose}>
    <div className="space-y-5">
      <p className="text-sm leading-6 text-dash-secondary">Sections are used as revenue centers in reporting. Device reports use the terminal that opened each order.</p>
      <div className="flex flex-wrap gap-2">{[['none', 'Whole restaurant'], ['revenue_center', 'Sections'], ['device', 'Devices']].map(([id, label]) => <button key={id} type="button" onClick={() => setDraft({ ...draft, scope_dimension: id, scope_ids: [], scope_mode: id === 'none' ? 'cumulative' : draft.scope_mode })} className={`h-10 rounded-md border px-3 text-sm font-semibold ${draft.scope_dimension === id ? 'border-dash-gold bg-dash-gold/10 text-dash-cream' : 'border-white/10 text-dash-secondary'}`}>{label}</button>)}</div>
      {draft.scope_dimension !== 'none' && <>
        <div className="flex gap-2">{[['cumulative', 'Cumulative total'], ['breakdown', 'Break down results']].map(([id, label]) => <button key={id} type="button" onClick={() => setDraft({ ...draft, scope_mode: id })} className={`h-10 rounded-md border px-3 text-sm font-semibold ${draft.scope_mode === id ? 'border-dash-gold bg-dash-gold/10 text-dash-cream' : 'border-white/10 text-dash-secondary'}`}>{label}</button>)}</div>
        <p className="text-xs text-dash-tertiary">No selection includes every {draft.scope_dimension === 'device' ? 'device' : 'section'}.</p>
        <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">{options.map((option) => <label key={option.id} className="flex min-h-11 items-center gap-3 rounded-md border border-white/10 px-3 text-sm"><input type="checkbox" checked={draft.scope_ids.includes(option.id)} onChange={() => toggle(option.id)} /><span>{option.name}{draft.scope_dimension === 'device' && option.section_name ? <span className="ml-1 text-xs text-dash-tertiary">({option.section_name})</span> : null}</span></label>)}</div>
      </>}
    </div>
    <div className="mt-5 flex justify-end gap-2"><IconButton label="Cancel" icon={X} onClick={onClose} /><IconButton label="Apply scope" icon={Layers} primary onClick={() => onApply(draft)} /></div>
  </Modal>
}

function SalesRevenue({ section = {}, filters, setFilters, categories, comparisonEnabled, view, setView }) {
  const summary = section.summary || {}
  const comparison = comparisonEnabled ? section.comparison || {} : {}
  const rows = view === 'items' ? section.items || [] : section[view] || []
  const columns = view === 'items'
    ? [{ key: 'name', label: 'Item' }, { key: 'category', label: 'Category' }, { key: 'units', label: 'Units', render: number }, { key: 'revenue', label: 'Revenue', render: money }, { key: 'revenue_share_pct', label: '% revenue', render: percent }, { key: 'cost', label: 'Cost', render: money }, { key: 'margin', label: 'Margin', render: money }]
    : [{ key: 'label', label: view === 'days_of_week' ? 'Day' : view.slice(0, -1) }, { key: 'units', label: 'Units', render: number }, { key: 'revenue', label: 'Revenue', render: money }, { key: 'cost', label: 'Cost', render: money }, { key: 'margin', label: 'Margin', render: money }]
  const displayRows = rows.map((row) => view === 'days_of_week' ? { ...row, label: DAY_LABELS[Number(row.label)] || row.label } : view === 'hours' ? { ...row, label: `${String(row.label).padStart(2, '0')}:00` } : row)
  const chargeRows = section.service_charges?.by_charge || []
  const chargeSections = section.service_charges?.by_section || []
  const allServiceCharges = Number(summary.service_charges || 0)
  const voluntaryTips = Number(summary.voluntary_tips ?? summary.tips ?? 0)
  const unattributedVoluntaryTips = Number(summary.unattributed_voluntary_tips || 0)
  const employeeGratuity = Number(summary.employee_gratuity || 0)
  const unattributedEmployeeGratuity = Number(summary.unattributed_employee_gratuity || 0)
  const totalTipEarnings = Number(summary.total_tip_earnings ?? voluntaryTips + employeeGratuity)
  const unclassifiedServiceCharges = Number(summary.unclassified_service_charges ?? 0)
  const restaurantServiceCharges = Number(summary.restaurant_service_charges ?? allServiceCharges - employeeGratuity - unclassifiedServiceCharges)
  const revenueWithRestaurantCharges = Number(summary.net_revenue_with_restaurant_service_charges ?? Number(summary.net_revenue || 0) + restaurantServiceCharges)
  const hasEmployeeGratuity = employeeGratuity !== 0 || chargeRows.some((row) => Boolean(row.assigned_to_employee ?? row.is_tip))
  const hasRestaurantCharges = restaurantServiceCharges !== 0 || chargeRows.some((row) => (row.assigned_to_employee ?? row.is_tip) === false)
  const hasUnclassifiedCharges = unclassifiedServiceCharges !== 0 || chargeRows.some((row) => row.ownership_classification === 'unclassified' || (row.assigned_to_employee == null && row.is_tip == null))
  const hasServiceCharges = allServiceCharges !== 0 || hasEmployeeGratuity || hasRestaurantCharges || hasUnclassifiedCharges
  return (
    <Section id="sales-revenue" title="Sales & revenue" subtitle={summary.labor_cost == null ? 'Sales are scoped. Labor remains restaurant-wide, so scoped profit is intentionally omitted.' : 'Labor-adjusted profit is net revenue minus recorded wages; other operating costs are not included yet.'} exportRows={displayRows}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Net revenue" value={money(summary.net_revenue)} comparison={comparison.net_revenue} comparisonFormat={money} />
        <Stat label="Employee cost" value={summary.labor_cost == null ? '—' : money(summary.labor_cost)} comparison={comparison.labor_cost} comparisonFormat={money} invertDelta />
        <Stat label="Profit after labor" value={summary.labor_adjusted_profit == null ? '—' : money(summary.labor_adjusted_profit)} comparison={comparison.labor_adjusted_profit} comparisonFormat={money} />
        <Stat label="Gross revenue" value={money(summary.gross_revenue)} comparison={comparison.gross_revenue} comparisonFormat={money} />
        <Stat label="Units sold" value={number(summary.units_sold)} comparison={comparison.units_sold} />
        <Stat label="Item margin" value={money(summary.item_margin)} comparison={comparison.item_margin} comparisonFormat={money} />
        <Stat label="Tickets" value={number(summary.ticket_count)} comparison={comparison.ticket_count} />
        <Stat label="Voluntary tips" value={money(voluntaryTips)} comparison={comparison.voluntary_tips || comparison.tips} comparisonFormat={money} />
        {unattributedVoluntaryTips !== 0 && <Stat label="Voluntary tips needing attribution" value={money(unattributedVoluntaryTips)} comparison={comparison.unattributed_voluntary_tips} comparisonFormat={money} />}
        <Stat label="Employee gratuity" value={money(employeeGratuity)} comparison={comparison.employee_gratuity} comparisonFormat={money} />
        {unattributedEmployeeGratuity !== 0 && <Stat label="Employee gratuity needing attribution" value={money(unattributedEmployeeGratuity)} comparison={comparison.unattributed_employee_gratuity} comparisonFormat={money} />}
        <Stat label="Total tip earnings" value={money(totalTipEarnings)} comparison={comparison.total_tip_earnings} comparisonFormat={money} />
        {hasRestaurantCharges && <Stat label="Restaurant service charges" value={money(restaurantServiceCharges)} comparison={comparison.restaurant_service_charges} comparisonFormat={money} />}
        {hasRestaurantCharges && <Stat label="Net revenue + restaurant charges" value={money(revenueWithRestaurantCharges)} comparison={comparison.net_revenue_with_restaurant_service_charges} comparisonFormat={money} />}
        {hasUnclassifiedCharges && <Stat label="Unclassified legacy charges" value={money(unclassifiedServiceCharges)} comparison={comparison.unclassified_service_charges} comparisonFormat={money} />}
      </div>
      {section.scope_breakdown?.length > 0 && <div className="mt-5"><h3 className="mb-2 text-sm font-semibold">Section / device performance</h3><Table columns={[{ key: 'name', label: 'Area or device' }, { key: 'ticket_count', label: 'Tickets', render: number }, { key: 'net_revenue', label: 'Net revenue', render: money }, { key: 'voluntary_tips', label: 'Voluntary tips', render: (value, row) => money(value ?? row.tips) }, { key: 'employee_gratuity', label: 'Employee gratuity', render: money }, { key: 'restaurant_service_charges', label: 'Restaurant charges', render: money }, { key: 'unclassified_service_charges', label: 'Unclassified charges', render: money }, { key: 'total_tip_earnings', label: 'Total tip earnings', render: (value, row) => money(value ?? Number(row.voluntary_tips ?? row.tips ?? 0) + Number(row.employee_gratuity ?? 0)) }, { key: 'discounts', label: 'Discounts', render: money }, { key: 'average_check', label: 'Average check', render: money }]} rows={section.scope_breakdown} /></div>}
      {hasServiceCharges && <div className="mt-5"><h3 className="mb-2 text-sm font-semibold">Charges &amp; gratuity</h3><p className="mb-2 text-sm text-dash-secondary">Employee-owned gratuity is tip earnings and is not restaurant revenue. Restaurant-owned service charges remain revenue. Both are billed on top of the check and stay separate from voluntary tips. Tax on taxable charges ({money(summary.service_charge_tax)}) is already included in the tax summary.</p>{unattributedEmployeeGratuity !== 0 && <p className="mb-3 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{money(unattributedEmployeeGratuity)} is employee-owned gratuity on checks without an employee. It remains unpaid until a manager attributes it.</p>}{hasUnclassifiedCharges && <p className="mb-3 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{money(unclassifiedServiceCharges)} belongs to legacy checks that did not save charge ownership. It remains unclassified instead of being guessed from current settings.</p>}<Table columns={[{ key: 'name', label: 'Charge' }, { key: 'source', label: 'Applied by' }, { key: 'assigned_to_employee', label: 'Ownership', render: (value, row) => row.ownership_classification === 'unclassified' || (value == null && row.is_tip == null) ? 'Unclassified legacy charge' : Boolean(value ?? row.is_tip) ? 'Employee gratuity' : 'Restaurant revenue' }, { key: 'charge_type', label: 'Type' }, { key: 'taxable', label: 'Tax', render: (value) => value ? 'Taxable' : 'Not taxable' }, { key: 'ticket_count', label: 'Checks', render: number }, { key: 'charge_basis', label: 'Charged on', render: money }, { key: 'effective_rate_percent', label: 'Effective rate', render: percent }, { key: 'service_charges', label: 'Amount', render: money }, { key: 'service_charge_tax', label: 'Tax on charge', render: money }]} rows={chargeRows} empty="No service charges or gratuity in this period." />{chargeSections.length > 1 && <div className="mt-4"><h4 className="mb-2 text-sm font-semibold text-dash-secondary">All charges by section</h4><Table columns={[{ key: 'name', label: 'Section' }, { key: 'ticket_count', label: 'Checks', render: number }, { key: 'charge_basis', label: 'Charged on', render: money }, { key: 'employee_gratuity', label: 'Employee gratuity', render: money }, { key: 'restaurant_service_charges', label: 'Restaurant charges', render: money }, { key: 'unclassified_service_charges', label: 'Unclassified charges', render: money }, { key: 'service_charges', label: 'All charges', render: money }]} rows={chargeSections} /></div>}</div>}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><Segmented value={view} onChange={setView} options={[{ id: 'items', label: 'Items' }, { id: 'categories', label: 'Category' }, { id: 'dayparts', label: 'Daypart' }, { id: 'days_of_week', label: 'Day' }, { id: 'hours', label: 'Hour' }]} /><div className="grid grid-cols-2 gap-2 sm:flex"><select aria-label="Category filter" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })} className="h-10 rounded-md border border-white/10 bg-dash-surface px-3 text-sm"><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select><select aria-label="Daypart filter" value={filters.daypart} onChange={(event) => setFilters({ ...filters, daypart: event.target.value })} className="h-10 rounded-md border border-white/10 bg-dash-surface px-3 text-sm"><option value="">All dayparts</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="late_night">Late night</option></select></div></div>
      <div className="mt-4"><Table columns={columns} rows={displayRows} /></div>
    </Section>
  )
}

function TopBottom({ section = {}, filters, setFilters }) {
  const columns = [{ key: 'name', label: 'Item' }, { key: 'units', label: 'Units', render: number }, { key: 'revenue', label: 'Revenue', render: money }, { key: 'margin', label: 'Margin', render: money }]
  const rows = [...(section.top || []), ...(section.bottom || [])]
  return <Section id="top-bottom-sellers" title="Top & bottom sellers" exportRows={rows}><div className="mb-4 flex flex-wrap items-center gap-3"><Segmented value={filters.basis} onChange={(basis) => setFilters({ ...filters, basis })} options={[{ id: 'units', label: 'Units' }, { id: 'revenue', label: 'Revenue' }, { id: 'margin', label: 'Margin' }]} /><label className="text-sm text-dash-secondary">Show <select value={filters.topN} onChange={(event) => setFilters({ ...filters, topN: Number(event.target.value) })} className="ml-2 h-9 rounded-md border border-white/10 bg-dash-surface px-2">{[5, 10, 15, 20].map((count) => <option key={count}>{count}</option>)}</select></label></div><div className="grid gap-6 xl:grid-cols-2"><div><h3 className="mb-2 text-sm font-semibold">Top</h3><Table columns={columns} rows={section.top || []} /></div><div><h3 className="mb-2 text-sm font-semibold">Bottom</h3><Table columns={columns} rows={section.bottom || []} /></div></div></Section>
}

function AverageCheck({ section = {}, comparisonEnabled }) {
  const summary = section.summary || {}
  const comparison = comparisonEnabled ? section.comparison || {} : {}
  return <Section id="average-check" title="Average check" exportRows={section.trend || []}><div className="grid gap-3 sm:grid-cols-3"><Stat label="Average check" value={money(summary.average_check)} comparison={comparison.average_check} comparisonFormat={money} /><Stat label="Items / ticket" value={number(summary.average_items_per_ticket, 2)} comparison={comparison.average_items_per_ticket} comparisonFormat={(value) => number(value, 2)} /><Stat label="Tickets" value={number(summary.ticket_count)} comparison={comparison.ticket_count} /></div><div className="mt-5 grid gap-6 xl:grid-cols-2"><div><h3 className="mb-2 text-sm font-semibold">By server</h3><Table columns={[{ key: 'server_name', label: 'Server' }, { key: 'tickets', label: 'Tickets', render: number }, { key: 'average_check', label: 'Avg check', render: money }, { key: 'average_items_per_ticket', label: 'Items', render: (v) => number(v, 2) }]} rows={section.by_server || []} /></div><div><h3 className="mb-2 text-sm font-semibold">By daypart</h3><Table columns={[{ key: 'daypart', label: 'Daypart' }, { key: 'tickets', label: 'Tickets', render: number }, { key: 'average_check', label: 'Avg check', render: money }, { key: 'average_items_per_ticket', label: 'Items', render: (v) => number(v, 2) }]} rows={section.by_daypart || []} /></div></div></Section>
}

function insightList(title, values = []) {
  if (!values.length) return null
  return <div><p className="label-mono">{title}</p><ul className="mt-2 space-y-1 text-sm text-dash-secondary">{values.map((value) => <li key={value}>• {value}</li>)}</ul></div>
}

function StaffInsight({ employee, insight }) {
  if (insight?.loading) return <div className="mt-3 rounded-md border border-white/10 p-4 text-sm text-dash-secondary">Generating contextual analysis...</div>
  if (insight?.error) return <div className="mt-3 rounded-md border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{insight.error}</div>
  if (!insight?.data) return null
  const analysis = insight.data.analysis || insight.data.recommendations || {}
  const peer = analysis.peer_context || insight.data.metrics_snapshot?.peer_context || {}
  const history = analysis.history_context || insight.data.metrics_snapshot?.history_context || {}
  const workload = analysis.workload_context || insight.data.metrics_snapshot?.workload_context || {}
  const standing = String(peer.overall_standing || 'not ranked').replaceAll('_', ' ')
  return (
    <article className="mt-3 rounded-md border border-dash-gold/20 bg-dash-gold/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold">{employee?.staff_name || 'Employee analysis'}</p>
          <p className="mt-1 text-sm text-dash-secondary">{analysis.summary || insight.data.insight_text}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 text-xs font-semibold">
          {peer.overall_rank && <span className="rounded border border-white/10 bg-white/[0.05] px-2 py-1">Rank {peer.overall_rank} of {peer.cohort_size}</span>}
          <span className="rounded border border-white/10 bg-white/[0.05] px-2 py-1 capitalize">{standing}</span>
          {history.available && <span className="rounded border border-white/10 bg-white/[0.05] px-2 py-1 capitalize">{history.trend}</span>}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div><p className="label-mono">Peer context</p><p className="mt-1 text-sm text-dash-secondary">{analysis.peer_assessment || `${peer.overall_percentile || 0}th percentile among ${peer.cohort_label || 'staff'}.`}</p></div>
        <div><p className="label-mono">Personal history</p><p className="mt-1 text-sm text-dash-secondary">{analysis.history_assessment || 'No prior-period comparison is available.'}</p></div>
        <div><p className="label-mono">Workload estimate</p><p className="mt-1 text-sm text-dash-secondary">{number(workload.tables_or_checks_handled)} tables/checks across {number(workload.hours_worked, 1)} hours · {workload.workload_estimated_turn_minutes == null ? '—' : `${number(workload.workload_estimated_turn_minutes, 1)} min`} rough interval</p></div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {insightList('Strengths', analysis.strengths)}
        {insightList('Areas to watch', analysis.areas_to_watch)}
        {insightList('Next actions', analysis.recommendations)}
      </div>
      {analysis.caveats?.length > 0 && <p className="mt-4 border-t border-white/10 pt-3 text-xs text-dash-tertiary">{analysis.caveats.join(' ')}</p>}
    </article>
  )
}

function EmployeeReports({ section = {}, insights, onInsight }) {
  const [sort, setSort] = useState('revenue')
  const rows = useMemo(() => [...(section.staff || [])].sort((a, b) => Number(b[sort] || 0) - Number(a[sort] || 0)), [section.staff, sort])
  return <Section id="employee-reports" title="Employee reports" subtitle={section.quality?.upsell_metric} exportRows={rows}><div className="mb-4"><label className="text-sm text-dash-secondary">Sort by <select value={sort} onChange={(event) => setSort(event.target.value)} className="ml-2 h-9 rounded-md border border-white/10 bg-dash-surface px-2"><option value="revenue">Revenue</option><option value="ticket_count">Tickets</option><option value="average_check">Average check</option><option value="average_tip_percentage">Tip %</option><option value="quick_index">Quick index</option></select></label></div><Table columns={[{ key: 'staff_name', label: 'Employee' }, { key: 'role', label: 'Role' }, { key: 'revenue', label: 'Revenue', render: money }, { key: 'ticket_count', label: 'Tickets', render: number }, { key: 'average_check', label: 'Avg check', render: money }, { key: 'average_turn_minutes', label: 'Turn', render: duration }, { key: 'upsell_attachment_rate', label: 'Add-on %', render: percent }, { key: 'average_tip_percentage', label: 'Tip %', render: percent }, { key: 'quick_index', label: 'Quick index', render: (v) => number(v, 1) }, { key: 'staff_id', label: 'AI summary', render: (id) => <button type="button" onClick={() => onInsight(id)} disabled={insights[id]?.loading} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs font-semibold"><Sparkles className="h-3 w-3" />{insights[id]?.loading ? 'Working' : 'Generate'}</button> }]} rows={rows} />{Object.entries(insights).map(([id, insight]) => <StaffInsight key={id} employee={rows.find((row) => String(row.staff_id) === String(id))} insight={insight} />)}</Section>
}

function Payroll({ section = {}, comparisonEnabled }) {
  const totals = section.totals || {}
  const comparison = comparisonEnabled ? section.comparison || {} : {}
  const voluntaryTips = Number(totals.voluntary_tips ?? 0)
  const unattributedVoluntaryTips = totals.unattributed_voluntary_tips == null ? null : Number(totals.unattributed_voluntary_tips)
  const employeeGratuity = totals.employee_gratuity == null ? null : Number(totals.employee_gratuity)
  const unattributedEmployeeGratuity = totals.unattributed_employee_gratuity == null ? null : Number(totals.unattributed_employee_gratuity)
  const totalTipEarnings = totals.total_tip_earnings == null
    ? (employeeGratuity == null ? null : voluntaryTips + employeeGratuity)
    : Number(totals.total_tip_earnings)
  const gratuityPayrollOwed = totals.gratuity_payroll_owed == null ? null : Number(totals.gratuity_payroll_owed)
  const unclassifiedServiceCharges = Number(totals.unclassified_service_charges ?? 0)
  return (
    <Section id="payroll-support" title="Payroll support" subtitle={section.overtime_rule} exportRows={section.employees || []}>
      <p className="mb-3 text-sm text-dash-secondary">Final allocated tips are reportable earnings and may include declared cash the employee already kept. They are not automatically a new payroll disbursement. “Gratuity owed through payroll” is the explicit unpaid gratuity liability.</p>
      {(section.warnings || []).map((warning, index) => <p key={`${warning?.code || 'warning'}-${index}`} className="mb-3 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{typeof warning === 'string' ? warning : warning.message || warning.code}</p>)}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Regular hours" value={number(totals.regular_hours, 1)} comparison={comparison.regular_hours} comparisonFormat={(value) => number(value, 1)} invertDelta />
        <Stat label="Overtime" value={number(totals.overtime_hours, 1)} comparison={comparison.overtime_hours} comparisonFormat={(value) => number(value, 1)} invertDelta />
        <Stat label="Wages owed" value={money(totals.wages_owed)} comparison={comparison.wages_owed} comparisonFormat={money} invertDelta />
        <Stat label="Voluntary tips" value={money(voluntaryTips)} comparison={comparison.voluntary_tips} comparisonFormat={money} />
        {unattributedVoluntaryTips !== null && unattributedVoluntaryTips !== 0 && <Stat label="Voluntary tips needing attribution" value={money(unattributedVoluntaryTips)} comparison={comparison.unattributed_voluntary_tips} comparisonFormat={money} />}
        <Stat label="Employee gratuity" value={employeeGratuity == null ? 'Unavailable' : money(employeeGratuity)} comparison={comparison.employee_gratuity} comparisonFormat={money} />
        {unattributedEmployeeGratuity !== null && unattributedEmployeeGratuity !== 0 && <Stat label="Employee gratuity needing attribution" value={money(unattributedEmployeeGratuity)} comparison={comparison.unattributed_employee_gratuity} comparisonFormat={money} />}
        <Stat label="Total tip earnings" value={totalTipEarnings == null ? 'Unavailable' : money(totalTipEarnings)} comparison={comparison.total_tip_earnings} comparisonFormat={money} />
        <Stat label="Gratuity owed through payroll" value={gratuityPayrollOwed == null ? 'Unavailable' : money(gratuityPayrollOwed)} comparison={comparison.gratuity_payroll_owed} comparisonFormat={money} />
        {unclassifiedServiceCharges !== 0 && <Stat label="Unclassified legacy charges" value={money(unclassifiedServiceCharges)} comparison={comparison.unclassified_service_charges} comparisonFormat={money} />}
      </div>
      <div className="mt-4">
        <Table columns={[
          { key: 'staff_name', label: 'Employee' },
          { key: 'role', label: 'Role' },
          { key: 'regular_hours', label: 'Regular', render: (value) => number(value, 1) },
          { key: 'overtime_hours', label: 'OT', render: (value) => number(value, 1) },
          { key: 'wages_owed', label: 'Wages', render: money },
          { key: 'voluntary_tips', label: 'Voluntary tips', render: money },
          { key: 'employee_gratuity', label: 'Employee gratuity', render: (value) => value == null ? 'Unavailable' : money(value) },
          { key: 'total_tip_earnings', label: 'Total tip earnings', render: (value) => value == null ? 'Unavailable' : money(value) },
          { key: 'gratuity_payroll_owed', label: 'Gratuity owed in payroll', render: (value) => value == null ? 'Unavailable' : money(value) },
          { key: 'tips_earned', label: 'Final allocated tips', render: (value, row) => `${money(value)}${row.finalized === false || row.payout_source === 'live_estimate' ? ' estimate' : ''}` },
          { key: 'tips_declared', label: 'Declared cash tips', render: (value) => value == null ? 'Not recorded' : money(value) },
        ]} rows={section.employees || []} />
      </div>
    </Section>
  )
}

function PunchLog({ section = {} }) {
  const summary = section.summary || {}
  const entries = section.entries || []
  return <Section id="punch-log" title="Punch log" exportRows={entries}><div className="grid gap-3 sm:grid-cols-4"><Stat label="Punches" value={number(summary.punches)} /><Stat label="Missed" value={number(summary.missed_punches)} /><Stat label="Manual edits" value={number(summary.manual_edits)} /><Stat label="Voided" value={number(summary.voided_entries)} /></div><div className="mt-4"><Disclosure title="Punch entries" count={entries.length}><Table columns={[{ key: 'staff_name', label: 'Employee' }, { key: 'clock_in_at', label: 'Clock in', render: (v) => new Date(v).toLocaleString() }, { key: 'clock_out_at', label: 'Clock out', render: (v) => v ? new Date(v).toLocaleString() : 'Missing' }, { key: 'hours', label: 'Hours', render: (v) => number(v, 2) }, { key: 'source', label: 'Source' }, { key: 'edited_by_manager_name', label: 'Editor' }, { key: 'edit_reason', label: 'Edit reason' }]} rows={entries} /></Disclosure></div></Section>
}

function ZReport({ section = {} }) {
  const transactions = section.transactions || []
  const cash = section.cash_accountability || {}
  const tips = section.tip_summary || {}
  const movements = [
    ...(section.cash_movements || []),
    ...(section.cash_drawer_events || []).filter((event) => event.event_type === 'no_sale').map((event) => ({ ...event, movement_type: 'no_sale', performed_by_name: event.staff_name, reason_preset_label: event.reason })),
  ]
  const dateBasis = section.date_basis === 'captured_at'
    ? 'Captured during the selected calendar period by payment completion time.'
    : 'Accounting business date from the locked check; payment completion time is shown separately.'
  return (
    <Section id="z-report" title="End-of-day Z report" subtitle={dateBasis} exportRows={movements.length ? movements : transactions}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Paid in" value={money(cash.paid_in)} /><Stat label="Paid out" value={money(cash.paid_out)} /><Stat label="Cash drops" value={money(cash.cash_drop)} /><Stat label="Cash variance" value={cash.variance_available ? money(cash.variance) : 'Not closed'} /><Stat label="Voluntary tips" value={tips.voluntary_tips == null ? 'Unavailable' : money(tips.voluntary_tips)} />{Number(tips.unattributed_voluntary_tips || 0) !== 0 && <Stat label="Voluntary tips needing attribution" value={money(tips.unattributed_voluntary_tips)} />}<Stat label="Employee gratuity" value={tips.employee_gratuity == null ? 'Unavailable' : money(tips.employee_gratuity)} />{Number(tips.unattributed_employee_gratuity || 0) !== 0 && <Stat label="Employee gratuity needing attribution" value={money(tips.unattributed_employee_gratuity)} />}<Stat label="Total tip earnings" value={tips.total_tip_earnings == null ? 'Unavailable' : money(tips.total_tip_earnings)} /></div>
      {Number(cash.pending_count || 0) > 0 && <p className="mt-4 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{cash.pending_count} cash movement exception(s) require reconciliation.</p>}
      {Number(cash.unreviewed_paid_out_count || 0) > 0 && <p className="mt-2 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{cash.unreviewed_paid_out_count} paid-out movement(s) remain unreviewed.</p>}
      <div className="mt-6"><Disclosure title="Cash accountability" count={movements.length} defaultOpen><Table columns={[{ key: 'business_date', label: 'Business date' }, { key: 'movement_type', label: 'Movement' }, { key: 'amount', label: 'Amount', render: money }, { key: 'performed_by_name', label: 'Performed by' }, { key: 'approved_by_name', label: 'Approved by' }, { key: 'reviewed_by_name', label: 'Reviewed by' }, { key: 'reason_preset_label', label: 'Reason' }, { key: 'status', label: 'Status' }]} rows={movements} /></Disclosure></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div><h3 className="mb-2 text-sm font-semibold">Daily closes</h3><Table columns={[{ key: 'business_date', label: 'Business date' }, { key: 'closed_by_name', label: 'Closed by' }, { key: 'closed_at', label: 'Closed at', render: (value) => new Date(value).toLocaleString() }, { key: 'totals', label: 'Collected', render: (value) => money(value?.total_collected) }]} rows={section.daily_closes || []} /></div>
        <div><h3 className="mb-2 text-sm font-semibold">Payment mix</h3><Table columns={[{ key: 'business_date', label: 'Business date' }, { key: 'payment_method', label: 'Method' }, { key: 'payments', label: 'Count', render: number }, { key: 'amount', label: 'Amount', render: money }, { key: 'voluntary_tips', label: 'Voluntary tips', render: (value, row) => money(value ?? row.tips) }, { key: 'employee_gratuity', label: 'Employee gratuity', render: money }, { key: 'restaurant_service_charges', label: 'Restaurant charges', render: money }, { key: 'unclassified_service_charges', label: 'Unclassified charges', render: money }, { key: 'total_tip_earnings', label: 'Total tip earnings', render: (value, row) => money(value ?? Number(row.voluntary_tips ?? row.tips ?? 0) + Number(row.employee_gratuity ?? 0)) }, { key: 'expected_deposit', label: 'Deposit', render: money }]} rows={section.payment_mix || []} /></div>
      </div>
      <div className="mt-6"><Disclosure title="Transactions" count={transactions.length}><Table columns={[{ key: 'order_number', label: 'Check' }, { key: 'business_date', label: 'Business date' }, { key: 'completed_at', label: 'Payment completed', render: (value) => new Date(value).toLocaleString() }, { key: 'waiter_name', label: 'Server' }, { key: 'payment_method', label: 'Method' }, { key: 'amount', label: 'Amount', render: money }, { key: 'voluntary_tips', label: 'Voluntary tips', render: (value, row) => money(value ?? row.tip_amount) }, { key: 'employee_gratuity', label: 'Employee gratuity', render: money }, { key: 'restaurant_service_charges', label: 'Restaurant charges', render: money }, { key: 'unclassified_service_charges', label: 'Unclassified charges', render: money }, { key: 'total_tip_earnings', label: 'Total tip earnings', render: (value, row) => money(value ?? Number(row.voluntary_tips ?? row.tip_amount ?? 0) + Number(row.employee_gratuity ?? 0)) }, { key: 'refunded_at', label: 'Refund', render: (value) => value ? new Date(value).toLocaleDateString() : '—' }, { key: 'deposit_status', label: 'Deposit' }]} rows={transactions} /></Disclosure></div>
    </Section>
  )
}

function TaxSummary({ section = {}, comparisonEnabled }) {
  const totals = section.totals || {}
  const comparison = comparisonEnabled ? section.comparison || {} : {}
  const recon = section.reconciliation || {}
  const inclusive = Number(totals.inclusive_tax || 0)
  const unattributed = Number(recon.unattributed_tax_added || 0) + Number(recon.unattributed_tax_included || 0)
  const rateColumns = [{ key: 'name', label: 'Tax rate' }, { key: 'rate_percent', label: 'Rate', render: (v) => v == null ? '—' : `${number(v, 4)}%` }, { key: 'is_inclusive', label: 'Pricing', render: (v, row) => row.rate_source === 'unattributed' ? '—' : v ? 'Included in price' : 'Added at checkout' }, { key: 'taxable_sales', label: 'Taxable sales', render: (v) => v == null ? '—' : money(v) }, { key: 'tax_added', label: 'Tax added', render: money }, { key: 'tax_included', label: 'Tax in prices', render: money }, { key: 'tax_collected', label: 'Total tax', render: money }, { key: 'ticket_count', label: 'Checks', render: (v) => v == null ? '—' : number(v) }]
  return <Section id="tax-summary" title="Tax" subtitle="Tax added at checkout and tax already inside menu prices are tracked separately and never overlap, so the liability is their sum. Per-rate and per-category attribution is re-derived from today's category and rate setup; anything it cannot reproduce is shown as unattributed rather than reassigned." exportRows={section.by_rate || []}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Taxable sales" value={money(totals.taxable_sales)} comparison={comparison.taxable_sales} comparisonFormat={money} /><Stat label="Non-taxable sales" value={money(totals.non_taxable_sales)} comparison={comparison.non_taxable_sales} comparisonFormat={money} /><Stat label="Tax collected" value={money(totals.tax_collected)} comparison={comparison.tax_collected} comparisonFormat={money} />{inclusive !== 0 && <Stat label="Tax included in prices" value={money(totals.inclusive_tax)} comparison={comparison.inclusive_tax} comparisonFormat={money} />}{inclusive !== 0 && <Stat label="Total tax liability" value={money(totals.total_tax_liability)} comparison={comparison.total_tax_liability} comparisonFormat={money} />}<Stat label="Service charge tax" value={money(totals.service_charge_tax)} /><Stat label="Checks" value={number(totals.ticket_count)} /><Stat label="Tax-exempt checks" value={number(totals.tax_exempt_tickets)} /></div>{Math.abs(unattributed) >= 0.01 && <p className="mt-4 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{money(unattributed)} of tax could not be attributed to a current rate — usually a rate, category assignment, or category name that changed after these checks closed. It is listed as its own row so the breakdown still reconciles to {money(totals.tax_collected)} collected.</p>}<div className="mt-6"><h3 className="mb-2 text-sm font-semibold">By tax rate</h3><Table columns={rateColumns} rows={section.by_rate || []} empty="No taxed sales in this period." /></div><div className="mt-6 grid gap-6 xl:grid-cols-2"><div><h3 className="mb-2 text-sm font-semibold">By category</h3><Table columns={[{ key: 'name', label: 'Category' }, { key: 'tax_rate_name', label: 'Rate' }, { key: 'rate_percent', label: '%', render: (v) => v == null ? '—' : `${number(v, 4)}%` }, { key: 'taxable_sales', label: 'Taxable', render: money }, { key: 'non_taxable_sales', label: 'Non-taxable', render: money }, { key: 'tax_collected', label: 'Tax', render: money }]} rows={section.by_category || []} /></div><div><h3 className="mb-2 text-sm font-semibold">By business date</h3><Table columns={[{ key: 'business_date', label: 'Date' }, { key: 'taxable_sales', label: 'Taxable', render: money }, { key: 'non_taxable_sales', label: 'Non-taxable', render: money }, { key: 'tax_collected', label: 'Tax added', render: money }, { key: 'inclusive_tax', label: 'In prices', render: money }, { key: 'total_tax_liability', label: 'Liability', render: money }]} rows={section.by_date || []} /></div></div></Section>
}

function DailySummary({ section = {}, comparisonEnabled }) {
  const summary = section.summary || {}
  const comparison = comparisonEnabled ? section.comparison || {} : {}
  const cash = section.cash_accountability || {}
  return (
    <Section id="daily-summary" title={`Daily summary · ${section.business_date || ''}`} subtitle="Accounting business date from the locked check. Profit after labor excludes food and other operating costs." exportRows={section.cash_movements?.length ? section.cash_movements : section.top_items || []}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Net sales" value={money(summary.net_revenue)} comparison={comparison.net_revenue} comparisonFormat={money} /><Stat label="Employee cost" value={money(summary.labor_cost)} comparison={comparison.labor_cost} comparisonFormat={money} invertDelta /><Stat label="Profit after labor" value={money(summary.labor_adjusted_profit)} comparison={comparison.labor_adjusted_profit} comparisonFormat={money} /><Stat label="Tickets" value={number(summary.ticket_count)} comparison={comparison.ticket_count} /><Stat label="Voluntary tips" value={summary.voluntary_tips == null ? 'Unavailable' : money(summary.voluntary_tips)} comparison={comparison.voluntary_tips} comparisonFormat={money} />{Number(summary.unattributed_voluntary_tips || 0) !== 0 && <Stat label="Voluntary tips needing attribution" value={money(summary.unattributed_voluntary_tips)} comparison={comparison.unattributed_voluntary_tips} comparisonFormat={money} />}<Stat label="Employee gratuity" value={summary.employee_gratuity == null ? 'Unavailable' : money(summary.employee_gratuity)} comparison={comparison.employee_gratuity} comparisonFormat={money} />{Number(summary.unattributed_employee_gratuity || 0) !== 0 && <Stat label="Employee gratuity needing attribution" value={money(summary.unattributed_employee_gratuity)} comparison={comparison.unattributed_employee_gratuity} comparisonFormat={money} />}<Stat label="Total tip earnings" value={summary.total_tip_earnings == null ? 'Unavailable' : money(summary.total_tip_earnings)} comparison={comparison.total_tip_earnings} comparisonFormat={money} /><Stat label="Expected cash" value={cash.variance_available ? money(cash.expected_cash) : 'Not closed'} /><Stat label="Counted cash" value={cash.variance_available ? money(cash.counted_cash) : 'Not closed'} /><Stat label="Cash variance" value={cash.variance_available ? money(cash.variance) : 'Not closed'} /></div>
      {section.flags?.length > 0 && <div className="mt-4 grid gap-2">{section.flags.map((flag, index) => <div key={`${flag.message}-${index}`} className="rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{flag.message}</div>)}</div>}
      <div className="mt-6"><Disclosure title="Cash movements" count={(section.cash_movements || []).length}><Table columns={[{ key: 'movement_type', label: 'Movement' }, { key: 'amount', label: 'Amount', render: money }, { key: 'performed_by_name', label: 'Performed by' }, { key: 'approved_by_name', label: 'Approved by' }, { key: 'status', label: 'Status' }]} rows={section.cash_movements || []} /></Disclosure></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div><h3 className="mb-2 text-sm font-semibold">Payment mix</h3><Table columns={[{ key: 'payment_method', label: 'Method' }, { key: 'payments', label: 'Count', render: number }, { key: 'amount', label: 'Amount', render: money }, { key: 'voluntary_tips', label: 'Voluntary tips', render: (value, row) => money(value ?? row.tips) }, { key: 'employee_gratuity', label: 'Employee gratuity', render: money }, { key: 'restaurant_service_charges', label: 'Restaurant charges', render: money }, { key: 'unclassified_service_charges', label: 'Unclassified charges', render: money }, { key: 'total_tip_earnings', label: 'Total tip earnings', render: (value, row) => money(value ?? Number(row.voluntary_tips ?? row.tips ?? 0) + Number(row.employee_gratuity ?? 0)) }]} rows={section.payment_mix || []} /></div>
        <div><h3 className="mb-2 text-sm font-semibold">Top five items</h3><Table columns={[{ key: 'name', label: 'Item' }, { key: 'units', label: 'Units', render: number }, { key: 'revenue', label: 'Revenue', render: money }, { key: 'margin', label: 'Margin', render: money }]} rows={section.top_items || []} /></div>
      </div>
    </Section>
  )
}

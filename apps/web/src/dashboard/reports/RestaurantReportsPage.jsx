import { useEffect, useMemo, useState } from 'react'
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Download,
  Mail,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { fetchWithSupabaseAuth } from '../../shared/query'

const SECTION_META = [
  ['sales_revenue', 'Sales & revenue'],
  ['top_bottom_sellers', 'Top & bottom sellers'],
  ['average_check', 'Average check'],
  ['employee_reports', 'Employee reports'],
  ['payroll_support', 'Payroll support'],
  ['punch_log', 'Punch log'],
  ['z_report', 'End-of-day Z report'],
  ['daily_summary', 'Daily summary'],
]
const SECTION_LABELS = Object.fromEntries(SECTION_META)
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
  const [visible, setVisible] = useState(preference.visible_sections || [])
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      await onSave({ ...preference, visible_sections: visible })
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
}

function EmailModal({ recipients, canManage, onClose, onSave, onDelete }) {
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(EMPTY_RECIPIENT)
  const [saving, setSaving] = useState(false)
  const edit = (recipient = null) => {
    setEditing(recipient?.id || 'new')
    setDraft(recipient ? { ...recipient, send_time: String(recipient.send_time || '07:00').slice(0, 5) } : EMPTY_RECIPIENT)
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
  return (
    <Modal title="Scheduled report recipients" onClose={onClose} maxWidth="max-w-3xl">
      {!editing ? (
        <>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {recipients.map((recipient) => (
              <div key={recipient.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{recipient.name || recipient.email}</p>
                  <p className="text-sm text-dash-secondary">{recipient.email} · {recipient.frequency} · {String(recipient.send_time).slice(0, 5)}</p>
                  <p className="mt-1 text-xs text-dash-tertiary">{recipient.sections.map((section) => SECTION_LABELS[section]).join(', ')}</p>
                </div>
                {canManage && <div className="flex gap-2"><button type="button" onClick={() => edit(recipient)} className="rounded-md border border-white/10 px-3 py-2 text-sm">Edit</button><button type="button" title="Delete recipient" onClick={() => onDelete(recipient.id)} className="rounded-md border border-red-400/20 p-2 text-red-300"><Trash2 className="h-4 w-4" /></button></div>}
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
            {draft.frequency === 'weekly' && <Field label="Day"><select value={draft.weekday ?? 1} onChange={(event) => setDraft({ ...draft, weekday: Number(event.target.value) })}>{DAY_LABELS.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></Field>}
            {draft.frequency === 'monthly' && <Field label="Day of month"><input type="number" min="1" max="28" value={draft.month_day ?? 1} onChange={(event) => setDraft({ ...draft, month_day: Number(event.target.value) })} /></Field>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-dash-tertiary">Sections</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SECTION_META.map(([id, label]) => <label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.sections.includes(id)} onChange={() => setDraft({ ...draft, sections: draft.sections.includes(id) ? draft.sections.filter((section) => section !== id) : [...draft.sections, id] })} />{label}</label>)}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })} />Active schedule</label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-md border border-white/10 px-4 py-2 text-sm">Cancel</button><button type="button" onClick={save} disabled={saving || !draft.email || !draft.sections.length} className="rounded-md bg-dash-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">{saving ? 'Saving...' : 'Save recipient'}</button></div>
        </div>
      )}
    </Modal>
  )
}

function Field({ label, children }) {
  return <label className="block text-sm text-dash-secondary"><span className="mb-2 block text-xs font-semibold uppercase text-dash-tertiary">{label}</span><span className="[&>input]:h-10 [&>input]:w-full [&>input]:rounded-md [&>input]:border [&>input]:border-white/10 [&>input]:bg-white/[0.04] [&>input]:px-3 [&>select]:h-10 [&>select]:w-full [&>select]:rounded-md [&>select]:border [&>select]:border-white/10 [&>select]:bg-dash-surface [&>select]:px-3">{children}</span></label>
}

export default function RestaurantReportsPage({ restaurantId, restaurantName }) {
  const [dates, setDates] = useState(initialDates)
  const [periodPreset, setPeriodPreset] = useState('week')
  const [comparisonEnabled, setComparisonEnabled] = useState(false)
  const [comparisonMode, setComparisonMode] = useState('previous_period')
  const [compareDraft, setCompareDraft] = useState(() => ({ ...initialDates(), mode: 'previous_period', enabled: false }))
  const [filters, setFilters] = useState({ category: '', daypart: '', dayOfWeek: '', hour: '', topN: 10, basis: 'revenue' })
  const [report, setReport] = useState(null)
  const [preference, setPreference] = useState({ visible_sections: SECTION_META.map(([id]) => id), section_order: SECTION_META.map(([id]) => id), section_settings: {} })
  const [recipients, setRecipients] = useState([])
  const [canManageRecipients, setCanManageRecipients] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [insights, setInsights] = useState({})

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

  const load = async () => {
    if (!restaurantId) return
    setLoading(true)
    setError('')
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
    try {
      const [nextReport, nextPreference, emailConfig] = await Promise.all([
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports?${query}`),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/preferences`),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/recipients`),
      ])
      setReport(nextReport)
      setPreference(nextPreference)
      setRecipients(emailConfig.recipients || [])
      setCanManageRecipients(Boolean(emailConfig.can_manage))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [restaurantId, dates, comparisonEnabled, filters.category, filters.daypart, filters.dayOfWeek, filters.hour, filters.topN, filters.basis])

  const sections = report?.sections || {}
  const visible = new Set(preference.visible_sections || SECTION_META.map(([id]) => id))
  const orderedSections = (preference.section_order || SECTION_META.map(([id]) => id)).filter((id) => visible.has(id))
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
  }
  const deleteRecipient = async (id) => {
    await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reports/recipients/${id}`, { method: 'DELETE' })
    setRecipients((current) => current.filter((recipient) => recipient.id !== id))
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
    sales_revenue: () => <SalesRevenue section={sections.sales_revenue} filters={filters} setFilters={setFilters} categories={categories} comparisonEnabled={comparisonEnabled} />,
    top_bottom_sellers: () => <TopBottom section={sections.top_bottom_sellers} filters={filters} setFilters={setFilters} />,
    average_check: () => <AverageCheck section={sections.average_check} comparisonEnabled={comparisonEnabled} />,
    employee_reports: () => <EmployeeReports section={sections.employee_reports} insights={insights} onInsight={generateInsight} />,
    payroll_support: () => <Payroll section={sections.payroll_support} comparisonEnabled={comparisonEnabled} />,
    punch_log: () => <PunchLog section={sections.punch_log} />,
    z_report: () => <ZReport section={sections.z_report} />,
    daily_summary: () => <DailySummary section={sections.daily_summary} comparisonEnabled={comparisonEnabled} />,
  }

  return (
    <div className="mx-auto w-full max-w-7xl overflow-x-hidden">
      <header className="sticky top-0 z-30 -mx-3 border-b border-white/10 bg-dash-base/95 px-3 py-4 backdrop-blur-xl sm:-mx-5 sm:px-5">
        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="label-mono">Restaurant reports</p>
              <h1 className="mt-1 truncate text-2xl font-semibold">{restaurantName || report?.restaurant?.name || 'Restaurant'}</h1>
              <p className="mt-1 text-xs text-dash-tertiary">{dates.start} through {dates.end}</p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2 sm:ml-auto">
              <IconButton label="Set comparison" icon={CalendarRange} onClick={() => { setCompareDraft({ ...dates, mode: comparisonMode, enabled: comparisonEnabled }); setModal('compare') }} />
              <IconButton label="Configure" icon={Settings2} onClick={() => setModal('config')} />
              <IconButton label="Email" icon={Mail} onClick={() => setModal('email')} />
              <IconButton label="Refresh" icon={RefreshCw} onClick={load} disabled={loading} />
            </div>
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
      </header>

      {error && <div className="my-5 rounded-md border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
      {loading && !report && <div className="flex min-h-64 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-dash-gold" /></div>}
      {report && orderedSections.map((id) => <div key={id}>{sectionRenderers[id]?.()}</div>)}

      {modal === 'compare' && <Modal title="Comparison period" onClose={() => setModal(null)}><div className="space-y-4"><div className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.025] p-3"><div><p className="text-sm font-semibold">Comparison</p><p className="mt-1 text-xs text-dash-tertiary">Show changes against another period.</p></div><ComparisonToggle enabled={compareDraft.enabled} onChange={(enabled) => setCompareDraft({ ...compareDraft, enabled })} /></div><div className={compareDraft.enabled ? '' : 'pointer-events-none opacity-40'}><div className="space-y-4"><Field label="Compare against"><select value={compareDraft.mode} onChange={(event) => updateComparisonDraftMode(event.target.value)}><option value="previous_period">Previous equal period</option><option value="previous_year">Same period last year</option><option value="custom">Custom period</option></select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Comparison from"><input type="date" value={compareDraft.comparisonStart} onChange={(event) => setCompareDraft({ ...compareDraft, mode: 'custom', comparisonStart: event.target.value })} /></Field><Field label="Comparison through"><input type="date" value={compareDraft.comparisonEnd} onChange={(event) => setCompareDraft({ ...compareDraft, mode: 'custom', comparisonEnd: event.target.value })} /></Field></div></div></div></div><div className="mt-5 flex justify-end"><IconButton label="Save comparison" icon={CalendarRange} primary disabled={compareDraft.enabled && (!compareDraft.comparisonStart || !compareDraft.comparisonEnd || compareDraft.comparisonStart > compareDraft.comparisonEnd)} onClick={() => { setComparisonMode(compareDraft.mode); setComparisonEnabled(compareDraft.enabled); setDates((current) => ({ ...current, comparisonStart: compareDraft.comparisonStart, comparisonEnd: compareDraft.comparisonEnd })); setModal(null) }} /></div></Modal>}
      {modal === 'config' && <ConfigModal preference={preference} onClose={() => setModal(null)} onSave={savePreference} />}
      {modal === 'email' && <EmailModal recipients={recipients} canManage={canManageRecipients} onClose={() => setModal(null)} onSave={saveRecipient} onDelete={deleteRecipient} />}
    </div>
  )
}

function SalesRevenue({ section = {}, filters, setFilters, categories, comparisonEnabled }) {
  const [view, setView] = useState('items')
  const summary = section.summary || {}
  const comparison = comparisonEnabled ? section.comparison || {} : {}
  const rows = view === 'items' ? section.items || [] : section[view] || []
  const columns = view === 'items'
    ? [{ key: 'name', label: 'Item' }, { key: 'category', label: 'Category' }, { key: 'units', label: 'Units', render: number }, { key: 'revenue', label: 'Revenue', render: money }, { key: 'revenue_share_pct', label: '% revenue', render: percent }, { key: 'cost', label: 'Cost', render: money }, { key: 'margin', label: 'Margin', render: money }]
    : [{ key: 'label', label: view === 'days_of_week' ? 'Day' : view.slice(0, -1) }, { key: 'units', label: 'Units', render: number }, { key: 'revenue', label: 'Revenue', render: money }, { key: 'cost', label: 'Cost', render: money }, { key: 'margin', label: 'Margin', render: money }]
  const displayRows = rows.map((row) => view === 'days_of_week' ? { ...row, label: DAY_LABELS[Number(row.label)] || row.label } : view === 'hours' ? { ...row, label: `${String(row.label).padStart(2, '0')}:00` } : row)
  return <Section id="sales-revenue" title="Sales & revenue" subtitle="Labor-adjusted profit is net revenue minus recorded wages; other operating costs are not included yet." exportRows={displayRows}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Net revenue" value={money(summary.net_revenue)} comparison={comparison.net_revenue} comparisonFormat={money} /><Stat label="Employee cost" value={money(summary.labor_cost)} comparison={comparison.labor_cost} comparisonFormat={money} invertDelta /><Stat label="Profit after labor" value={money(summary.labor_adjusted_profit)} comparison={comparison.labor_adjusted_profit} comparisonFormat={money} /><Stat label="Gross revenue" value={money(summary.gross_revenue)} comparison={comparison.gross_revenue} comparisonFormat={money} /><Stat label="Units sold" value={number(summary.units_sold)} comparison={comparison.units_sold} /><Stat label="Item margin" value={money(summary.item_margin)} comparison={comparison.item_margin} comparisonFormat={money} /><Stat label="Tickets" value={number(summary.ticket_count)} comparison={comparison.ticket_count} /></div><div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><Segmented value={view} onChange={setView} options={[{ id: 'items', label: 'Items' }, { id: 'categories', label: 'Category' }, { id: 'dayparts', label: 'Daypart' }, { id: 'days_of_week', label: 'Day' }, { id: 'hours', label: 'Hour' }]} /><div className="grid grid-cols-2 gap-2 sm:flex"><select aria-label="Category filter" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })} className="h-10 rounded-md border border-white/10 bg-dash-surface px-3 text-sm"><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select><select aria-label="Daypart filter" value={filters.daypart} onChange={(event) => setFilters({ ...filters, daypart: event.target.value })} className="h-10 rounded-md border border-white/10 bg-dash-surface px-3 text-sm"><option value="">All dayparts</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="late_night">Late night</option></select></div></div><div className="mt-4"><Table columns={columns} rows={displayRows} /></div></Section>
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
  return <Section id="payroll-support" title="Payroll support" subtitle={section.overtime_rule} exportRows={section.employees || []}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Regular hours" value={number(totals.regular_hours, 1)} comparison={comparison.regular_hours} comparisonFormat={(value) => number(value, 1)} invertDelta /><Stat label="Overtime" value={number(totals.overtime_hours, 1)} comparison={comparison.overtime_hours} comparisonFormat={(value) => number(value, 1)} invertDelta /><Stat label="Wages owed" value={money(totals.wages_owed)} comparison={comparison.wages_owed} comparisonFormat={money} invertDelta /><Stat label="Tips earned" value={money(totals.tips_earned)} comparison={comparison.tips_earned} comparisonFormat={money} /></div><div className="mt-4"><Table columns={[{ key: 'staff_name', label: 'Employee' }, { key: 'role', label: 'Role' }, { key: 'regular_hours', label: 'Regular', render: (v) => number(v, 1) }, { key: 'overtime_hours', label: 'OT', render: (v) => number(v, 1) }, { key: 'wages_owed', label: 'Wages', render: money }, { key: 'tips_earned', label: 'Tips', render: money }, { key: 'tips_declared', label: 'Declared', render: (v) => v == null ? 'Not recorded' : money(v) }]} rows={section.employees || []} /></div></Section>
}

function PunchLog({ section = {} }) {
  const summary = section.summary || {}
  const entries = section.entries || []
  return <Section id="punch-log" title="Punch log" exportRows={entries}><div className="grid gap-3 sm:grid-cols-4"><Stat label="Punches" value={number(summary.punches)} /><Stat label="Missed" value={number(summary.missed_punches)} /><Stat label="Manual edits" value={number(summary.manual_edits)} /><Stat label="Voided" value={number(summary.voided_entries)} /></div><div className="mt-4"><Disclosure title="Punch entries" count={entries.length}><Table columns={[{ key: 'staff_name', label: 'Employee' }, { key: 'clock_in_at', label: 'Clock in', render: (v) => new Date(v).toLocaleString() }, { key: 'clock_out_at', label: 'Clock out', render: (v) => v ? new Date(v).toLocaleString() : 'Missing' }, { key: 'hours', label: 'Hours', render: (v) => number(v, 2) }, { key: 'source', label: 'Source' }, { key: 'edited_by_manager_name', label: 'Editor' }, { key: 'edit_reason', label: 'Edit reason' }]} rows={entries} /></Disclosure></div></Section>
}

function ZReport({ section = {} }) {
  const transactions = section.transactions || []
  return <Section id="z-report" title="End-of-day Z report" exportRows={transactions}><div className="grid gap-6 xl:grid-cols-2"><div><h3 className="mb-2 text-sm font-semibold">Daily closes</h3><Table columns={[{ key: 'business_date', label: 'Date' }, { key: 'closed_by_name', label: 'Closed by' }, { key: 'closed_at', label: 'Closed at', render: (v) => new Date(v).toLocaleString() }, { key: 'totals', label: 'Collected', render: (v) => money(v?.total_collected) }]} rows={section.daily_closes || []} /></div><div><h3 className="mb-2 text-sm font-semibold">Payment mix</h3><Table columns={[{ key: 'business_date', label: 'Date' }, { key: 'payment_method', label: 'Method' }, { key: 'payments', label: 'Count', render: number }, { key: 'amount', label: 'Amount', render: money }, { key: 'expected_deposit', label: 'Deposit', render: money }]} rows={section.payment_mix || []} /></div></div><div className="mt-6"><Disclosure title="Transactions" count={transactions.length}><Table columns={[{ key: 'order_number', label: 'Check' }, { key: 'completed_at', label: 'Completed', render: (v) => new Date(v).toLocaleString() }, { key: 'waiter_name', label: 'Server' }, { key: 'payment_method', label: 'Method' }, { key: 'amount', label: 'Amount', render: money }, { key: 'tip_amount', label: 'Tip', render: money }, { key: 'refunded_at', label: 'Refund', render: (v) => v ? new Date(v).toLocaleDateString() : '—' }, { key: 'deposit_status', label: 'Deposit' }]} rows={transactions} /></Disclosure></div></Section>
}

function DailySummary({ section = {}, comparisonEnabled }) {
  const summary = section.summary || {}
  const comparison = comparisonEnabled ? section.comparison || {} : {}
  return <Section id="daily-summary" title={`Daily summary · ${section.business_date || ''}`} subtitle="Profit after labor excludes food and other operating costs." exportRows={section.top_items || []}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Net sales" value={money(summary.net_revenue)} comparison={comparison.net_revenue} comparisonFormat={money} /><Stat label="Employee cost" value={money(summary.labor_cost)} comparison={comparison.labor_cost} comparisonFormat={money} invertDelta /><Stat label="Profit after labor" value={money(summary.labor_adjusted_profit)} comparison={comparison.labor_adjusted_profit} comparisonFormat={money} /><Stat label="Tickets" value={number(summary.ticket_count)} comparison={comparison.ticket_count} /><Stat label="Labor %" value={percent(summary.labor_pct)} /><Stat label="Discounts" value={money(section.losses?.discounts)} /></div>{section.flags?.length > 0 && <div className="mt-4 grid gap-2">{section.flags.map((flag, index) => <div key={`${flag.message}-${index}`} className="rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{flag.message}</div>)}</div>}<div className="mt-6 grid gap-6 xl:grid-cols-2"><div><h3 className="mb-2 text-sm font-semibold">Payment mix</h3><Table columns={[{ key: 'payment_method', label: 'Method' }, { key: 'payments', label: 'Count', render: number }, { key: 'amount', label: 'Amount', render: money }, { key: 'tips', label: 'Tips', render: money }]} rows={section.payment_mix || []} /></div><div><h3 className="mb-2 text-sm font-semibold">Top five items</h3><Table columns={[{ key: 'name', label: 'Item' }, { key: 'units', label: 'Units', render: number }, { key: 'revenue', label: 'Revenue', render: money }, { key: 'margin', label: 'Margin', render: money }]} rows={section.top_items || []} /></div></div></Section>
}

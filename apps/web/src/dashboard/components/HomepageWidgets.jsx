import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  BarChart3,
  Check,
  Download,
  FileText,
  LineChart as LineChartIcon,
  Layers3,
  RefreshCw,
  Settings2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchWithSupabaseAuth } from '../../shared/query'
import { DEFAULT_API_TIMEOUT_MS } from '../../shared/api/requestDeadline'
import {
  aggregateWidgetRows,
  effectiveHomepageWidgetSettings,
  normalizeReportingScope,
  pruneReportingScope,
  WHOLE_RESTAURANT_SCOPE,
} from './homepageWidgetMath'
import {
  homepageWidgetChartCopy,
  widgetPurposeMeasure,
  widgetSupportingMeasures,
  withWidgetPurposeColumn,
} from './homepageWidgetPresentation'

const KPI_WIDGETS = new Set([
  'net_sales', 'orders', 'covers', 'labor_cost', 'profit_after_labor',
  'average_check', 'tips', 'deposits',
])
const MONEY_IDS = new Set([
  'net_sales', 'gross_sales', 'tips', 'discounts', 'average_check',
  'labor_cost', 'profit_after_labor', 'gross_amount', 'processor_fees',
  'expected_deposit', 'settled_deposit', 'pending_deposit', 'revenue',
  'gross_revenue', 'cost', 'margin', 'declared_cash', 'declared_card', 'declared_other',
  'tips_collected', 'tipout_paid', 'tipout_received', 'final_payout',
  'refunds', 'voided_items',
  'total_amount', 'discount_amount', 'comp_amount', 'item_void_amount', 'check_void_amount',
  'non_taxable_net', 'taxable_net', 'gross_voids', 'tax', 'grand_total',
  'item_discounts', 'check_discounts', 'total_collected', 'card_collected',
  'cash_collected', 'other_collected', 'service_charges', 'employee_service_charges',
  'restaurant_service_charges', 'unclassified_service_charges',
])
const GRAIN_OPTIONS = [
  ['total', 'Total'], ['day', 'Daily'], ['week', 'Weekly'],
  ['month', 'Monthly'], ['detail', 'Detailed rows'],
]

const money = (value) => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const number = (value) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })

function formatValue(value, kind) {
  if (value == null) return '—'
  if (kind === 'money') return money(value)
  if (kind === 'percent') return `${number(value)}%`
  if (kind === 'minutes') return `${number(value)} min`
  if (kind === 'number') return number(value)
  if (kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString()
  }
  if (kind === 'date') return new Date(value).toLocaleDateString()
  return String(value)
}

function periodDates(period, anchorDate) {
  const anchor = anchorDate ? new Date(`${anchorDate}T12:00:00`) : new Date()
  const end = new Date(anchor)
  const start = new Date(anchor)
  if (period === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  else if (period === 'month') start.setDate(1)
  else if (period === 'year') { start.setMonth(0); start.setDate(1) }
  else if (period === 'full') start.setFullYear(2000, 0, 1)
  const key = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  return { start: key(start), end: key(end) }
}

function fileFromBase64(file) {
  const bytes = Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0))
  return new Blob([bytes], { type: file.mime_type })
}

function savePdf(file) {
  const url = URL.createObjectURL(fileFromBase64(file))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.file_name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Modal({ title, onClose, children, width = 'max-w-3xl' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <div className={`max-h-[92vh] w-full ${width} overflow-y-auto rounded-lg border border-dash-border bg-dash-elevated shadow-2xl`}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-dash-border bg-dash-elevated px-5 py-4">
          <h2 className="text-lg font-semibold text-dash-cream">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-md text-dash-secondary hover:bg-white/5"><X size={18} /></button>
        </header>
        {children}
      </div>
    </div>
  )
}

function ConfigureModal({ catalog, visible, order, saving, onClose, onSave }) {
  const [selected, setSelected] = useState(() => [...visible])
  const [draftOrder, setDraftOrder] = useState(() => [...order])
  const selectedSet = new Set(selected)
  const orderedSelected = draftOrder.filter((id) => selectedSet.has(id))
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const move = (id, delta) => setDraftOrder((current) => {
    const next = [...current]
    const index = next.indexOf(id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= next.length) return current
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  return (
    <Modal title="Configure homepage" onClose={onClose}>
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <section>
          <p className="label-mono">Available widgets</p>
          <div className="mt-3 space-y-2">
            {catalog.map((widget) => (
              <button key={widget.id} type="button" onClick={() => toggle(widget.id)} className={`flex w-full items-start justify-between gap-3 rounded-md border p-3 text-left ${selectedSet.has(widget.id) ? 'border-shell-accent bg-shell-accent/10' : 'border-dash-border'}`}>
                <span><span className="block text-sm font-semibold">{widget.label}</span><span className="mt-1 block text-xs text-dash-tertiary">{widget.description}</span></span>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${selectedSet.has(widget.id) ? 'border-shell-accent bg-shell-accent' : 'border-dash-border'}`}>{selectedSet.has(widget.id) && <Check size={13} />}</span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <p className="label-mono">Homepage order</p>
          <p className="mt-1 text-xs text-dash-tertiary">Order applies from top to bottom and left to right.</p>
          <div className="mt-3 space-y-2">
            {orderedSelected.map((id, index) => {
              const widget = catalog.find((item) => item.id === id)
              return <div key={id} className="flex min-h-12 items-center gap-3 rounded-md border border-dash-border px-3"><span className="w-6 font-mono text-xs text-dash-tertiary">{index + 1}</span><span className="flex-1 text-sm font-semibold">{widget?.label || id}</span><button type="button" aria-label={`Move ${widget?.label} up`} disabled={index === 0} onClick={() => move(id, -1)} className="grid h-8 w-8 place-items-center disabled:opacity-25"><ArrowUp size={15} /></button><button type="button" aria-label={`Move ${widget?.label} down`} disabled={index === orderedSelected.length - 1} onClick={() => move(id, 1)} className="grid h-8 w-8 place-items-center disabled:opacity-25"><ArrowDown size={15} /></button></div>
            })}
          </div>
        </section>
      </div>
      <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-dash-border bg-dash-elevated p-5"><button type="button" onClick={onClose} className="h-10 rounded-md border border-dash-border px-4 text-sm">Cancel</button><button type="button" disabled={saving || selected.length === 0} onClick={() => onSave(selected, draftOrder)} className="h-10 rounded-md bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text disabled:opacity-40">{saving ? 'Saving...' : 'Save homepage'}</button></footer>
    </Modal>
  )
}

function Choice({ selected, children, onClick }) {
  return <button type="button" onClick={onClick} className={`min-h-9 rounded-md border px-3 text-sm ${selected ? 'border-shell-accent bg-shell-accent/10 text-dash-cream' : 'border-dash-border text-dash-secondary'}`}>{children}</button>
}

function ReportingScopeFields({ widget, dimensions, value, onChange }) {
  const supported = widget.reporting_dimensions || []
  if (!supported.length) return <p className="rounded-md border border-dash-border p-3 text-xs leading-5 text-dash-tertiary">This widget is restaurant-wide because its source records do not carry a reliable section or device assignment.</p>
  const dimension = value.scope_dimension || 'none'
  const options = dimension === 'revenue_center' ? (dimensions?.sections || []) : dimension === 'device' ? (dimensions?.devices || []) : []
  const ids = value.scope_ids || []
  const toggle = (id) => onChange({ ...value, scope_ids: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id] })
  return <div className="space-y-3 rounded-md border border-dash-border p-4">
    <div><p className="label-mono mb-2">Reporting scope</p><div className="flex flex-wrap gap-2"><Choice selected={dimension === 'none'} onClick={() => onChange({ ...value, scope_dimension: 'none', scope_mode: 'cumulative', scope_ids: [] })}>Whole restaurant</Choice>{supported.includes('revenue_center') && <Choice selected={dimension === 'revenue_center'} onClick={() => onChange({ ...value, scope_dimension: 'revenue_center', scope_ids: [] })}>Sections</Choice>}{supported.includes('device') && <Choice selected={dimension === 'device'} onClick={() => onChange({ ...value, scope_dimension: 'device', scope_ids: [] })}>Devices</Choice>}</div></div>
    {dimension !== 'none' && <>
      <p className="text-xs leading-5 text-dash-tertiary">No selection includes every {dimension === 'device' ? 'device' : 'section'}. Sections are used as revenue centers in reports.</p>
      <div className="flex gap-2"><Choice selected={(value.scope_mode || 'cumulative') === 'cumulative'} onClick={() => onChange({ ...value, scope_mode: 'cumulative' })}>Cumulative total</Choice><Choice selected={value.scope_mode === 'breakdown'} onClick={() => onChange({ ...value, scope_mode: 'breakdown' })}>Break down results</Choice></div>
      <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">{options.map((option) => <label key={option.id} className="flex min-h-10 items-center gap-2 rounded-md border border-dash-border px-3 text-sm"><input type="checkbox" checked={ids.includes(option.id)} onChange={() => toggle(option.id)} /><span className="truncate">{option.restaurant_name ? `${option.restaurant_name} / ` : ''}{option.name}{dimension === 'device' && option.section_name ? <span className="ml-1 text-xs text-dash-tertiary">({option.section_name})</span> : null}</span></label>)}</div>
    </>}
  </div>
}

function scopeControlLabel(value) {
  const scope = normalizeReportingScope(value)
  if (scope.scope_dimension === 'none') return 'Whole restaurant'
  const noun = scope.scope_dimension === 'device' ? 'device' : 'section'
  if (!scope.scope_ids.length) return `All ${noun}s`
  return `${scope.scope_ids.length} ${noun}${scope.scope_ids.length === 1 ? '' : 's'}`
}

function DashboardScopeModal({ dimensions, value, onClose, onSave }) {
  const [draft, setDraft] = useState(() => normalizeReportingScope(value))
  const scopeWidget = { reporting_dimensions: ['revenue_center', 'device'] }
  return <Modal title="Dashboard scope" onClose={onClose}>
    <div className="space-y-4 p-5">
      <p className="text-sm leading-6 text-dash-secondary">This filter applies to every widget whose source data can be reliably assigned to a section or device. Labor and other restaurant-wide records remain unfiltered.</p>
      <ReportingScopeFields widget={scopeWidget} dimensions={dimensions} value={draft} onChange={setDraft} />
    </div>
    <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-dash-border bg-dash-elevated p-5"><button type="button" onClick={onClose} className="h-10 rounded-md border border-dash-border px-4 text-sm">Cancel</button><button type="button" onClick={() => onSave(normalizeReportingScope(draft))} className="h-10 rounded-md bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text">Apply scope</button></footer>
  </Modal>
}

function WidgetSettingsModal({ widget, widgetData, dimensions, settings, dashboardScope, pdfSettings, period, anchorDate, dateRange, scope, restaurantId, groupIds, includeUngrouped, onClose, onSave, onSavePdf }) {
  const dates = dateRange?.start && dateRange?.end ? dateRange : periodDates(period, anchorDate)
  const [tab, setTab] = useState('display')
  const explicitWidgetScope = settings.scope_source === 'widget'
  const effectiveDisplayScope = explicitWidgetScope ? normalizeReportingScope(settings) : normalizeReportingScope(dashboardScope)
  const [draft, setDraft] = useState(() => ({
    display_grain: settings.display_grain || (widget.id === 'sales_trend' ? 'day' : 'total'),
    display_breakdown: settings.display_breakdown || widget.default_breakdown,
    display_columns: withWidgetPurposeColumn(widget, settings.display_columns || widget.default_columns),
    chart_type: settings.chart_type || (widget.id === 'sales_trend' ? 'line' : 'bar'),
    display_mode: settings.display_mode || (widget.id === 'sales_trend' ? 'chart' : 'table'),
    sort_by: settings.sort_by || widget.default_columns[0],
    sort_direction: settings.sort_direction || 'desc',
    limit: settings.limit || 12,
    alert_z_score: settings.alert_z_score || 2,
    alert_min_actions: settings.alert_min_actions || 5,
    scope_source: explicitWidgetScope ? 'widget' : 'global',
    scope_dimension: explicitWidgetScope ? settings.scope_dimension || 'none' : 'none',
    scope_mode: explicitWidgetScope ? settings.scope_mode || 'cumulative' : 'cumulative',
    scope_ids: explicitWidgetScope ? settings.scope_ids || [] : [],
  }))
  const [report, setReport] = useState(() => ({
    start_date: dates.start, end_date: dates.end,
    grain: widget.id === 'sales_trend' ? 'day' : 'total',
    breakdown: widget.default_breakdown,
    columns: [...widget.default_columns], include_chart: widget.id === 'sales_trend',
    chart_type: widget.id === 'sales_trend' ? 'line' : 'bar', title: `${widget.label} report`,
    employee_ids: [], action_types: ['discount', 'comp', 'item_void', 'check_void'],
    reason_codes: [], include_team_average: true,
    alert_z_score: settings.alert_z_score || 2, alert_min_actions: settings.alert_min_actions || 5,
    ...effectiveDisplayScope,
    ...(pdfSettings || {}),
  }))
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const toggleColumn = (key, target, setter) => setter((current) => ({ ...current, [key]: current[key].includes(target) ? current[key].filter((item) => item !== target) : [...current[key], target] }))
  const download = async () => {
    setWorking(true); setError('')
    try {
      const path = scope === 'portfolio' ? `/portfolio-reports/homepage/widgets/${widget.id}/pdf` : `/restaurants/${restaurantId}/reports/homepage/widgets/${widget.id}/pdf`
      const body = { ...report }
      if (scope === 'portfolio') Object.assign(body, { group_ids: groupIds || null, include_ungrouped: includeUngrouped })
      await onSavePdf(body)
      const file = await fetchWithSupabaseAuth(path, { method: 'POST', body: JSON.stringify(body) })
      savePdf(file)
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Could not generate this PDF.') }
    finally { setWorking(false) }
  }
  const renderColumns = (state, setter, key) => <div className="grid gap-2 sm:grid-cols-2">{widget.columns.map((column) => {
    const isPurpose = key === 'display_columns' && column.id === widget.primary_column
    return <label key={column.id} className="flex min-h-10 items-center gap-2 rounded-md border border-dash-border px-3 text-sm"><input type="checkbox" checked={state[key].includes(column.id)} disabled={isPurpose} onChange={() => toggleColumn(key, column.id, setter)} /><span>{column.label}{isPurpose && <span className="ml-1 text-xs text-dash-tertiary">Primary</span>}</span></label>
  })}</div>
  const employeeOptions = (widgetData?.employees || []).filter((employee) => employee.employee_id)
  const reasonOptions = [...new Map((widgetData?.reasons || []).map((reason) => [reason.reason_code, reason])).values()]
  const renderAuditOptions = () => <>
    <div><p className="label-mono mb-2">Employees</p><p className="mb-2 text-xs text-dash-tertiary">No selection includes every employee.</p><div className="grid gap-2 sm:grid-cols-2">{employeeOptions.map((employee) => <label key={employee.employee_id} className="flex min-h-10 items-center gap-2 rounded-md border border-dash-border px-3 text-sm"><input type="checkbox" checked={report.employee_ids.includes(employee.employee_id)} onChange={() => toggleColumn('employee_ids', employee.employee_id, setReport)} /><span className="truncate">{employee.employee_name}<span className="ml-1 text-xs text-dash-tertiary">{employee.restaurant_name}</span></span></label>)}</div></div>
    <div><p className="label-mono mb-2">Actions</p><div className="grid gap-2 sm:grid-cols-2">{[['discount', 'Discounts'], ['comp', 'Comps'], ['item_void', 'Item voids'], ['check_void', 'Check voids']].map(([id, label]) => <label key={id} className="flex min-h-10 items-center gap-2 rounded-md border border-dash-border px-3 text-sm"><input type="checkbox" checked={report.action_types.includes(id)} onChange={() => toggleColumn('action_types', id, setReport)} />{label}</label>)}</div></div>
    {reasonOptions.length > 0 && <div><p className="label-mono mb-2">Reason codes</p><p className="mb-2 text-xs text-dash-tertiary">No selection includes every reason.</p><div className="grid gap-2 sm:grid-cols-2">{reasonOptions.map((reason) => <label key={reason.reason_code} className="flex min-h-10 items-center gap-2 rounded-md border border-dash-border px-3 text-sm"><input type="checkbox" checked={report.reason_codes.includes(reason.reason_code)} onChange={() => toggleColumn('reason_codes', reason.reason_code, setReport)} />{reason.reason_label}</label>)}</div></div>}
    <label className="flex min-h-11 items-center justify-between rounded-md border border-dash-border px-3 text-sm"><span>Include peer averages and outlier scores</span><input type="checkbox" checked={report.include_team_average} onChange={(event) => setReport({ ...report, include_team_average: event.target.checked })} /></label>
  </>
  return (
    <Modal title={widget.label} onClose={onClose}>
      <div className="flex border-b border-dash-border px-5"><button type="button" onClick={() => setTab('display')} className={`h-11 border-b-2 px-4 text-sm font-semibold ${tab === 'display' ? 'border-shell-accent' : 'border-transparent text-dash-tertiary'}`}>Display</button><button type="button" onClick={() => setTab('pdf')} className={`h-11 border-b-2 px-4 text-sm font-semibold ${tab === 'pdf' ? 'border-shell-accent' : 'border-transparent text-dash-tertiary'}`}>PDF report</button></div>
      {tab === 'display' ? <div className="space-y-5 p-5">
        {(widget.reporting_dimensions || []).length ? <div className="space-y-3">
          <div><p className="label-mono mb-2">Filter behavior</p><div className="flex flex-wrap gap-2"><Choice selected={draft.scope_source !== 'widget'} onClick={() => setDraft({ ...draft, scope_source: 'global', scope_dimension: 'none', scope_mode: 'cumulative', scope_ids: [] })}>Use dashboard scope</Choice><Choice selected={draft.scope_source === 'widget'} onClick={() => setDraft({ ...draft, scope_source: 'widget', scope_dimension: 'none', scope_mode: 'cumulative', scope_ids: [] })}>Custom scope</Choice></div><p className="mt-2 text-xs text-dash-tertiary">Dashboard scope: {scopeControlLabel(dashboardScope)}</p></div>
          {draft.scope_source === 'widget' && <ReportingScopeFields widget={widget} dimensions={dimensions} value={draft} onChange={setDraft} />}
        </div> : <ReportingScopeFields widget={widget} dimensions={dimensions} value={draft} onChange={setDraft} />}
        {widget.id === 'discount_review' ? <>
          <p className="text-sm leading-6 text-dash-secondary">Employees are flagged only after meeting the minimum sample and exceeding the selected number of standard deviations above peers at the same restaurant.</p>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Outlier threshold<input type="number" min="1" max="5" step="0.1" value={draft.alert_z_score} onChange={(event) => setDraft({ ...draft, alert_z_score: Number(event.target.value) })} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-dash-surface px-3" /><span className="mt-1 block text-xs text-dash-tertiary">Standard deviations above peers</span></label><label className="text-sm">Minimum actions<input type="number" min="1" max="100" value={draft.alert_min_actions} onChange={(event) => setDraft({ ...draft, alert_min_actions: Number(event.target.value) })} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-dash-surface px-3" /><span className="mt-1 block text-xs text-dash-tertiary">Prevents one-off false alerts</span></label></div>
        </> : <>
        <div><p className="label-mono mb-2">Time grouping</p><div className="flex flex-wrap gap-2">{GRAIN_OPTIONS.filter(([id]) => id !== 'detail' && (widget.grains || []).includes(id) && (!KPI_WIDGETS.has(widget.id) || id === 'total')).map(([id, label]) => <Choice key={id} selected={KPI_WIDGETS.has(widget.id) ? id === 'total' : draft.display_grain === id} onClick={() => setDraft({ ...draft, display_grain: id })}>{label}</Choice>)}</div></div>
        {!KPI_WIDGETS.has(widget.id) && <div><p className="label-mono mb-2">Widget view</p><div className="flex gap-2"><Choice selected={draft.display_mode === 'table'} onClick={() => setDraft({ ...draft, display_mode: 'table' })}>Table</Choice><Choice selected={draft.display_mode === 'chart'} onClick={() => setDraft({ ...draft, display_mode: 'chart' })}>Graph</Choice></div></div>}
        <div><p className="label-mono mb-2">Breakdown</p><select value={draft.display_breakdown} onChange={(event) => setDraft({ ...draft, display_breakdown: event.target.value })} className="h-10 w-full rounded-md border border-dash-border bg-dash-surface px-3 text-sm">{widget.breakdowns.map((item) => <option key={item} value={item}>{item === 'none' ? 'No additional breakdown' : item.replaceAll('_', ' ')}</option>)}</select></div>
        <div><p className="label-mono mb-2">Visible measures</p>{renderColumns(draft, setDraft, 'display_columns')}</div>
        <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm">Sort by<select value={draft.sort_by} onChange={(event) => setDraft({ ...draft, sort_by: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-dash-surface px-2">{widget.columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select></label><label className="text-sm">Direction<select value={draft.sort_direction} onChange={(event) => setDraft({ ...draft, sort_direction: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-dash-surface px-2"><option value="desc">Highest first</option><option value="asc">Lowest first</option></select></label><label className="text-sm">Rows<input type="number" min="1" max="100" value={draft.limit} onChange={(event) => setDraft({ ...draft, limit: Number(event.target.value) })} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-dash-surface px-2" /></label></div>
        </>}
      </div> : <div className="space-y-5 p-5">
        <ReportingScopeFields widget={widget} dimensions={dimensions} value={report} onChange={setReport} />
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">From<input type="date" value={report.start_date} onChange={(event) => setReport({ ...report, start_date: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-dash-surface px-3" /></label><label className="text-sm">Through<input type="date" value={report.end_date} onChange={(event) => setReport({ ...report, end_date: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-dash-surface px-3" /></label></div>
        <label className="block text-sm">Report title<input value={report.title} onChange={(event) => setReport({ ...report, title: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-dash-surface px-3" /></label>
        {widget.id === 'discount_review' ? renderAuditOptions() : <>
        <div><p className="label-mono mb-2">Time grouping</p><div className="flex flex-wrap gap-2">{GRAIN_OPTIONS.filter(([id]) => (widget.grains || GRAIN_OPTIONS.map(([value]) => value)).includes(id)).map(([id, label]) => <Choice key={id} selected={report.grain === id} onClick={() => setReport({ ...report, grain: id })}>{label}</Choice>)}</div></div>
        <div><p className="label-mono mb-2">Break down rows by</p><select value={report.breakdown} onChange={(event) => setReport({ ...report, breakdown: event.target.value })} className="h-10 w-full rounded-md border border-dash-border bg-dash-surface px-3 text-sm">{widget.breakdowns.map((item) => <option key={item} value={item}>{item === 'none' ? 'No additional breakdown' : item.replaceAll('_', ' ')}</option>)}</select></div>
        <div><p className="label-mono mb-2">Report columns</p>{renderColumns(report, setReport, 'columns')}</div>
        <label className="flex min-h-11 items-center justify-between rounded-md border border-dash-border px-3 text-sm"><span>Include graph</span><input type="checkbox" checked={report.include_chart} onChange={(event) => setReport({ ...report, include_chart: event.target.checked })} /></label>
        {report.include_chart && <div className="flex gap-2"><Choice selected={report.chart_type === 'bar'} onClick={() => setReport({ ...report, chart_type: 'bar' })}><span className="inline-flex items-center gap-2"><BarChart3 size={15} />Bar</span></Choice><Choice selected={report.chart_type === 'line'} onClick={() => setReport({ ...report, chart_type: 'line' })}><span className="inline-flex items-center gap-2"><LineChartIcon size={15} />Line</span></Choice></div>}
        </>}
        {error && <p className="rounded-md border border-dash-danger/30 bg-dash-danger/10 p-3 text-sm text-dash-danger">{error}</p>}
      </div>}
      <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-dash-border bg-dash-elevated p-5">{tab === 'display' ? <button type="button" disabled={widget.id !== 'discount_review' && !draft.display_columns.length} onClick={() => onSave(draft)} className="h-10 rounded-md bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text disabled:opacity-40">Save widget</button> : <button type="button" disabled={working || (widget.id !== 'discount_review' && !report.columns.length) || (widget.id === 'discount_review' && !report.action_types.length) || !report.start_date || !report.end_date} onClick={download} className="inline-flex h-10 items-center gap-2 rounded-md bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text disabled:opacity-40"><Download size={15} />{working ? 'Building PDF...' : 'Download PDF'}</button>}</footer>
    </Modal>
  )
}

function WidgetHeader({ widget, onSettings }) {
  return <header className="mb-4 flex items-start justify-between gap-3"><div><p className="label-mono">Homepage widget</p><h2 className="mt-1 text-lg font-semibold">{widget.label}</h2><p className="mt-1 text-xs text-dash-tertiary">{widget.description}</p>{widget.scopeLabel && <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-shell-accent"><Layers3 size={13} />{widget.scopeLabel}</p>}</div><button type="button" onClick={(event) => { event.stopPropagation(); onSettings() }} title={`Configure ${widget.label}`} aria-label={`Configure ${widget.label}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-dash-border text-dash-secondary hover:text-dash-cream"><Settings2 size={16} /></button></header>
}

function measureColumns(data, widget) {
  return data?.measure_columns?.length ? data.measure_columns : (widget.columns || [])
}

function dimensionColumns(data) {
  return data?.dimension_columns || []
}

function tableColumns(data, widget) {
  const dimensions = dimensionColumns(data)
  const measures = measureColumns(data, widget)
  return [...dimensions.map((id) => ({
    id,
    label: id === 'breakdown' ? String(data?.breakdown || 'breakdown').replaceAll('_', ' ').replace('revenue center', 'section') : id.replaceAll('_', ' '),
    kind: id === 'period' ? 'date' : 'text',
  })), ...measures]
}

function primaryMeasure(data, widget) {
  return widgetPurposeMeasure(widget, data)
}

const SALES_SUM_FIELDS = [
  'gross_sales', 'item_discounts', 'check_discounts', 'discounts', 'net_sales',
  'non_taxable_net', 'taxable_net', 'gross_voids', 'void_receipts', 'receipts',
  'covers', 'tax', 'tips', 'grand_total', 'total_collected', 'card_collected',
  'cash_collected', 'other_collected', 'service_charges', 'employee_service_charges',
  'restaurant_service_charges', 'unclassified_service_charges',
]

function aggregateSalesRows(rows = []) {
  const summary = Object.fromEntries(SALES_SUM_FIELDS.map((id) => [id, 0]))
  rows.forEach((row) => SALES_SUM_FIELDS.forEach((id) => { summary[id] += Number(row[id] || 0) }))
  summary.average_check = summary.receipts > 0 ? summary.net_sales / summary.receipts : 0
  return summary
}

function reportingScopeLabel(data, dimensions) {
  const scope = data?.reporting_scope || {}
  if (!scope.dimension || scope.dimension === 'none') return null
  const noun = scope.dimension === 'device' ? 'devices' : 'sections'
  const options = scope.dimension === 'device' ? dimensions?.devices || [] : dimensions?.sections || []
  const selected = new Set((scope.ids || []).map(String))
  const names = options.filter((item) => selected.has(String(item.id))).map((item) => item.restaurant_name && options.some((other) => other.name === item.name && other.restaurant_id !== item.restaurant_id) ? `${item.restaurant_name} / ${item.name}` : item.name)
  if (names.length) return `Filtered: ${names.join(' + ')}`
  return scope.mode === 'breakdown' ? `All ${noun}, broken down` : `All ${noun}`
}

function widgetScopeLabel(widget, data, dimensions, dashboardScope) {
  const applied = reportingScopeLabel(data, dimensions)
  if (applied) return applied
  const globalScope = normalizeReportingScope(dashboardScope)
  if (globalScope.scope_dimension === 'none' || (widget.reporting_dimensions || []).includes(globalScope.scope_dimension)) return null
  return `Whole restaurant · ${globalScope.scope_dimension === 'device' ? 'device' : 'section'} attribution unavailable`
}

function salesTrendRows(rows = []) {
  const periods = new Map()
  rows.filter((row) => row.period != null).forEach((row) => {
    const period = String(row.period)
    const current = periods.get(period) || { period, net_sales: 0 }
    current.net_sales += Number(row.net_sales || 0)
    periods.set(period, current)
  })
  return [...periods.values()].sort((left, right) => left.period.localeCompare(right.period))
}

function MiniBarList({ rows, measure, limit = 5 }) {
  if (!rows?.length || !measure) return null
  const visible = rows.slice(0, limit)
  const max = Math.max(1, ...visible.map((row) => Math.abs(Number(row[measure.id] || 0))))
  return <div className="mt-4 space-y-2">{visible.map((row, index) => <div key={`${row.breakdown || row.period || index}-${index}`}><div className="mb-1 flex items-center justify-between gap-3 text-[11px]"><span className="truncate text-dash-secondary">{row.breakdown || row.period || `Row ${index + 1}`}</span><span className="shrink-0 font-mono text-dash-cream">{formatValue(row[measure.id], measure.kind)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-shell-accent" style={{ width: `${Math.max(2, Math.abs(Number(row[measure.id] || 0)) / max * 100)}%` }} /></div></div>)}</div>
}

function DetailChart({ data, widget, height = 260, ariaLabel }) {
  let rows = data?.rows || []
  const measure = primaryMeasure(data, widget)
  if (!rows.length || !measure) return null
  const hasPeriod = rows.some((row) => row.period != null)
  const hasBreakdown = rows.some((row) => row.breakdown != null)
  if (hasPeriod && hasBreakdown) {
    const byPeriod = new Map()
    rows.forEach((row) => {
      const key = String(row.period)
      const current = byPeriod.get(key) || { period: row.period }
      current[measure.id] = Number(current[measure.id] || 0) + Number(row[measure.id] || 0)
      byPeriod.set(key, current)
    })
    rows = [...byPeriod.values()].sort((left, right) => String(left.period).localeCompare(String(right.period)))
  }
  const dataKey = hasPeriod ? 'period' : hasBreakdown ? 'breakdown' : null
  if (!dataKey) return null
  const tick = measure.kind === 'money' ? (value) => `$${Math.round(Number(value) / 1000)}k` : number
  const tooltip = (value) => formatValue(value, measure.kind)
  return <div aria-label={ariaLabel} className="h-[260px] min-w-0 rounded-md border border-dash-border p-3" style={{ height }}><ResponsiveContainer width="100%" height="100%">{hasPeriod ? <LineChart data={rows}><CartesianGrid stroke="rgba(168,162,158,.2)" vertical={false} /><XAxis dataKey={dataKey} tickFormatter={(value) => String(value).slice(5, 10)} tick={{ fill: '#a8a29e', fontSize: 10 }} /><YAxis tickFormatter={tick} tick={{ fill: '#a8a29e', fontSize: 10 }} /><Tooltip formatter={tooltip} /><Line name={measure.label} type="monotone" dataKey={measure.id} stroke="#4f7ee8" strokeWidth={2.5} dot={{ r: 2 }} connectNulls /></LineChart> : <BarChart data={rows.slice(0, 12)}><CartesianGrid stroke="rgba(168,162,158,.2)" vertical={false} /><XAxis dataKey={dataKey} tick={{ fill: '#a8a29e', fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={60} /><YAxis tickFormatter={tick} tick={{ fill: '#a8a29e', fontSize: 10 }} /><Tooltip formatter={tooltip} /><Bar name={measure.label} dataKey={measure.id} fill="#4f7ee8" radius={[3, 3, 0, 0]} /></BarChart>}</ResponsiveContainer></div>
}

function KpiWidget({ widget, data, onOpenDetails, onSettings }) {
  const column = widgetPurposeMeasure(widget, data)
  const row = data?.summary || aggregateWidgetRows(data?.rows || [])
  const secondary = widgetSupportingMeasures(widget, data)
  const missingRates = widget.id === 'profit_after_labor' ? Number(row.missing_rate_entries || 0) : 0
  return <section onClick={onOpenDetails} className="glass-card min-w-0 cursor-pointer rounded-lg p-5 transition hover:-translate-y-px hover:border-shell-accent/40">
    <WidgetHeader widget={widget} onSettings={onSettings} />
    <p className="truncate font-mono text-3xl tabular-nums text-dash-cream">{formatValue(row[column.id], column.kind)}</p>
    <p className="mt-1 text-xs text-dash-tertiary">{column.label}</p>
    {secondary.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2 border-t border-dash-border pt-3">{secondary.map((item) => <div key={item.id}><p className="label-mono !text-[9px]">{item.label}</p><p className="mt-1 font-mono text-sm text-dash-secondary">{formatValue(row[item.id], item.kind)}</p></div>)}</div>}
    {missingRates > 0 && <p className="mt-3 text-xs text-amber-200">Estimate excludes {number(missingRates)} time entr{missingRates === 1 ? 'y' : 'ies'} without a wage rate.</p>}
  </section>
}

function CardDepositWidget({ widget, data, onOpenDetails, onSettings }) {
  const row = data?.summary || aggregateWidgetRows(data?.rows || [])
  const purpose = widgetPurposeMeasure(widget, data)
  const availableMeasures = data?.measure_columns?.length ? data.measure_columns : (widget.columns || [])
  const metric = (id) => availableMeasures.find((column) => column.id === id)
  const supporting = ['total_collected', 'processor_fees', 'settled_deposit', 'pending_deposit'].map(metric).filter(Boolean)
  const showsSettlement = Boolean(metric('settled_deposit'))
  const expected = Number(row.expected_deposit || 0)
  const settled = Number(row.settled_deposit || 0)
  const settledPercent = expected > 0 ? Math.min(100, Math.max(0, settled / expected * 100)) : 0
  return <section onClick={onOpenDetails} className="glass-card min-w-0 cursor-pointer rounded-lg p-5 transition hover:-translate-y-px hover:border-shell-accent/40 xl:col-span-2">
    <WidgetHeader widget={widget} onSettings={onSettings} />
    <p className="font-mono text-3xl tabular-nums text-dash-cream">{formatValue(row[purpose.id], purpose.kind)}</p>
    <p className="mt-1 text-xs text-dash-tertiary">Expected bank deposit</p>
    {showsSettlement && <><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-dash-success" style={{ width: `${settledPercent}%` }} /></div><div className="mt-2 flex justify-between gap-3 text-[10px] text-dash-tertiary"><span>{number(settledPercent)}% settled</span><span>{formatValue(settled, 'money')} received</span></div></>}
    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-dash-border pt-3">{supporting.map((item) => <div key={item.id}><p className="label-mono !text-[9px]">{item.label}</p><p className="mt-1 font-mono text-sm text-dash-secondary">{formatValue(row[item.id], item.kind)}</p></div>)}</div>
    {Number(row.unknown_fee_payments || 0) > 0 && <p className="mt-3 text-xs text-amber-200">{number(row.unknown_fee_payments)} card payment{Number(row.unknown_fee_payments) === 1 ? '' : 's'} still awaiting processor fees.</p>}
  </section>
}

function SalesWidget({ widget, data, onOpenDetails, onSettings }) {
  const rows = data?.rows || []
  const summary = data?.summary || aggregateSalesRows(rows)
  const measures = (data?.measure_columns || widget.default_columns.map((id) => widget.columns.find((column) => column.id === id)).filter(Boolean)).slice(0, 8)
  const trend = salesTrendRows(rows)
  const trendData = {
    rows: trend,
    measure_columns: [{ id: 'net_sales', label: 'Net sales', kind: 'money' }],
    dimension_columns: ['period'],
  }
  return <section onClick={onOpenDetails} className="glass-card cursor-pointer rounded-lg p-5 transition hover:border-shell-accent/40 xl:col-span-4">
    <WidgetHeader widget={widget} onSettings={onSettings} />
    <div className={`grid gap-5 ${trend.length > 1 ? 'xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]' : ''}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{measures.map((item) => <div key={item.id} className="rounded-md border border-dash-border p-4"><p className="label-mono !text-[9px]">{item.label}</p><p className="mt-2 font-mono text-xl text-dash-cream">{formatValue(summary[item.id], item.kind)}</p></div>)}</div>
      {trend.length > 1 && <div><p className="label-mono mb-3">Net sales trend</p><SalesTrendChart rows={trendData.rows} /></div>}
    </div>
  </section>
}

function SalesTrendChart({ rows }) {
  const chartRows = rows.map((row) => ({ ...row, net_sales: Number(row.net_sales || 0) }))
  return <div className="h-[230px] min-w-0 rounded-md border border-dash-border p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows}><CartesianGrid stroke="rgba(168,162,158,.2)" vertical={false} /><XAxis dataKey="period" tickFormatter={(value) => String(value).slice(5, 10)} tick={{ fill: '#a8a29e', fontSize: 10 }} /><YAxis domain={['auto', 'auto']} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} tick={{ fill: '#a8a29e', fontSize: 10 }} /><Tooltip formatter={(value) => money(value)} /><Line type="monotone" dataKey="net_sales" stroke="#4f7ee8" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
}

const SCOPE_COLORS = ['#4f7ee8', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#a78bfa', '#f97316', '#06b6d4']

function scopedBreakdown(data) {
  const scope = data?.reporting_scope || {}
  return scope.mode === 'breakdown' && ['revenue_center', 'device'].includes(scope.dimension)
}

function scopeNoun(data) {
  return data?.reporting_scope?.dimension === 'device' ? 'device' : 'section'
}

function ScopedBreakdownWidget({ widget, data, settings, onSettings, onOpenDetails }) {
  const rows = data?.rows || []
  const measures = data?.measure_columns || []
  const primary = widgetPurposeMeasure(widget, data)
  const noun = scopeNoun(data)
  const hasPeriods = rows.some((row) => row.period != null)
  const names = [...new Set(rows.map((row) => String(row.breakdown || `Unassigned ${noun}`)))]

  if (hasPeriods && names.length) {
    const periods = [...new Set(rows.map((row) => String(row.period)))].sort()
    const chartRows = periods.map((period) => {
      const point = { period }
      rows.filter((row) => String(row.period) === period).forEach((row) => {
        point[String(row.breakdown || `Unassigned ${noun}`)] = Number(row[primary.id] || 0)
      })
      return point
    })
    return <section onClick={onOpenDetails} className="glass-card cursor-pointer rounded-lg p-5 transition hover:border-shell-accent/40 xl:col-span-2">
      <WidgetHeader widget={widget} onSettings={onSettings} />
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-dash-secondary"><Layers3 size={15} /><span className="capitalize">Trend by {noun}</span></div>
      <div className="h-72"><ResponsiveContainer width="100%" height="100%">{settings?.chart_type === 'bar' ? <BarChart data={chartRows}><CartesianGrid stroke="rgba(168,162,158,.2)" vertical={false} /><XAxis dataKey="period" tickFormatter={(value) => String(value).slice(5, 10)} tick={{ fill: '#a8a29e', fontSize: 10 }} /><YAxis tickFormatter={(value) => MONEY_IDS.has(primary.id) ? `$${Math.round(value / 1000)}k` : number(value)} tick={{ fill: '#a8a29e', fontSize: 10 }} /><Tooltip formatter={(value) => formatValue(value, primary.kind)} /><Legend wrapperStyle={{ fontSize: 11 }} />{names.map((name, index) => <Bar key={name} dataKey={name} fill={SCOPE_COLORS[index % SCOPE_COLORS.length]} radius={[2, 2, 0, 0]} />)}</BarChart> : <LineChart data={chartRows}><CartesianGrid stroke="rgba(168,162,158,.2)" vertical={false} /><XAxis dataKey="period" tickFormatter={(value) => String(value).slice(5, 10)} tick={{ fill: '#a8a29e', fontSize: 10 }} /><YAxis tickFormatter={(value) => MONEY_IDS.has(primary.id) ? `$${Math.round(value / 1000)}k` : number(value)} tick={{ fill: '#a8a29e', fontSize: 10 }} /><Tooltip formatter={(value) => formatValue(value, primary.kind)} /><Legend wrapperStyle={{ fontSize: 11 }} />{names.map((name, index) => <Line key={name} type="monotone" dataKey={name} stroke={SCOPE_COLORS[index % SCOPE_COLORS.length]} strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls />)}</LineChart>}</ResponsiveContainer></div>
    </section>
  }

  const max = Math.max(1, ...rows.map((row) => Math.abs(Number(row[primary.id] || 0))))
  return <section onClick={onOpenDetails} className="glass-card cursor-pointer rounded-lg p-5 transition hover:border-shell-accent/40 xl:col-span-2">
    <WidgetHeader widget={widget} onSettings={onSettings} />
    <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-dash-secondary"><Layers3 size={15} /><span className="capitalize">Results by {noun}</span></div>
    {rows.length ? <div className="space-y-3">{rows.map((row, index) => <div key={`${row.breakdown || noun}-${index}`} className="rounded-md border border-dash-border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-dash-cream">{row.breakdown || `Unassigned ${noun}`}</p><p className="mt-1 text-[10px] text-dash-tertiary">{measures.slice(1, 4).map((item) => `${item.label}: ${formatValue(row[item.id], item.kind)}`).join(' · ')}</p></div><p className="shrink-0 font-mono text-sm text-dash-cream">{formatValue(row[primary.id], primary.kind)}</p></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-shell-accent" style={{ width: `${Math.max(2, Math.abs(Number(row[primary.id] || 0)) / max * 100)}%` }} /></div></div>)}</div> : <p className="py-8 text-center text-sm text-dash-tertiary">No attributed {noun} data for this range.</p>}
  </section>
}

function ChartWidget({ widget, data, settings, onSettings, onOpenDetails }) {
  const measure = widgetPurposeMeasure(widget, data)
  const rows = data?.rows || []
  const chartType = settings.chart_type || 'line'
  const dataKey = (row) => row.period || row.breakdown || 'Total'
  const latest = rows.at(-1) || {}
  return <section onClick={onOpenDetails} className="glass-card cursor-pointer rounded-lg p-5 transition hover:border-shell-accent/40 xl:col-span-2"><WidgetHeader widget={widget} onSettings={onSettings} />{data?.measure_columns?.length > 1 && <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{data.measure_columns.slice(0, 4).map((item) => <div key={item.id} className="rounded-md border border-dash-border p-3"><p className="label-mono !text-[9px]">Latest {item.label}</p><p className="mt-1 font-mono text-sm text-dash-cream">{formatValue(latest[item.id], item.kind)}</p></div>)}</div>}<div className="h-72"><ResponsiveContainer width="100%" height="100%">{chartType === 'bar' ? <BarChart data={rows}><CartesianGrid stroke="rgba(168,162,158,.2)" vertical={false} /><XAxis dataKey={dataKey} tick={{ fill: '#a8a29e', fontSize: 11 }} /><YAxis tickFormatter={(value) => MONEY_IDS.has(measure.id) ? `$${Math.round(value / 1000)}k` : number(value)} tick={{ fill: '#a8a29e', fontSize: 11 }} /><Tooltip formatter={(value) => formatValue(value, measure.kind)} /><Bar dataKey={measure.id} fill="#4f7ee8" radius={[4, 4, 0, 0]} /></BarChart> : <LineChart data={rows}><CartesianGrid stroke="rgba(168,162,158,.2)" vertical={false} /><XAxis dataKey={dataKey} tick={{ fill: '#a8a29e', fontSize: 11 }} /><YAxis tickFormatter={(value) => MONEY_IDS.has(measure.id) ? `$${Math.round(value / 1000)}k` : number(value)} tick={{ fill: '#a8a29e', fontSize: 11 }} /><Tooltip formatter={(value) => formatValue(value, measure.kind)} /><Line type="monotone" dataKey={measure.id} stroke="#4f7ee8" strokeWidth={3} dot={{ r: 3 }} connectNulls /></LineChart>}</ResponsiveContainer></div></section>
}

function MenuPerformanceWidget({ widget, data, settings, onSettings, onOpenDetails }) {
  const rows = [...(data?.rows || [])]
  const measures = data?.measure_columns || []
  const metric = measures.find((item) => item.id === settings.sort_by) || measures.find((item) => item.id === 'revenue') || measures[0]
  rows.sort((left, right) => Number(right[metric?.id] || 0) - Number(left[metric?.id] || 0))
  const take = Math.min(5, Math.max(1, Math.ceil(rows.length / 2)))
  const top = rows.slice(0, take)
  const bottom = rows.slice(-take).reverse()
  const max = Math.max(1, ...rows.map((row) => Number(row[metric?.id] || 0)))
  const List = ({ title, icon: Icon, items, tone }) => <div><div className="mb-3 flex items-center gap-2"><Icon size={16} className={tone} /><h3 className="text-sm font-semibold">{title}</h3></div><div className="space-y-2">{items.map((row, index) => <div key={`${row.breakdown}-${index}`} className="rounded-md border border-dash-border p-3"><div className="flex items-baseline justify-between gap-3"><span className="truncate text-sm font-semibold">{row.breakdown || `Item ${index + 1}`}</span><span className="font-mono text-sm">{formatValue(row[metric?.id], metric?.kind)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-shell-accent" style={{ width: `${Math.max(2, Number(row[metric?.id] || 0) / max * 100)}%` }} /></div><p className="mt-2 text-[10px] text-dash-tertiary">{measures.filter((item) => item.id !== metric?.id).slice(0, 3).map((item) => `${item.label}: ${formatValue(row[item.id], item.kind)}`).join(' · ')}</p></div>)}</div></div>
  return <section onClick={onOpenDetails} className="glass-card cursor-pointer rounded-lg p-5 transition hover:border-shell-accent/40 xl:col-span-4"><WidgetHeader widget={widget} onSettings={onSettings} />{rows.length ? <div className="grid gap-6 lg:grid-cols-2"><List title="Top performers" icon={TrendingUp} items={top} tone="text-dash-success" /><List title="Bottom performers" icon={TrendingDown} items={bottom} tone="text-dash-warning" /></div> : <p className="py-8 text-center text-sm text-dash-tertiary">No menu sales for this range.</p>}</section>
}

function SummaryWidget({ widget, data, onSettings, onOpenDetails }) {
  const row = data?.summary || aggregateWidgetRows(data?.rows || [])
  const measures = data?.measure_columns || []
  const preview = measures.slice(0, 6)
  return <section onClick={onOpenDetails} className="glass-card cursor-pointer rounded-lg p-5 transition hover:border-shell-accent/40 xl:col-span-2"><WidgetHeader widget={widget} onSettings={onSettings} /><div className="grid gap-3 sm:grid-cols-2">{preview.map((item) => <div key={item.id} className="rounded-md border border-dash-border p-4"><p className="label-mono !text-[9px]">{item.label}</p><p className="mt-2 font-mono text-xl text-dash-cream">{formatValue(row[item.id], item.kind)}</p></div>)}</div>{measures.length > preview.length && <p className="mt-3 text-xs font-semibold text-shell-accent">View all details</p>}</section>
}

function TableWidget({ widget, data, onSettings, onOpenDetails }) {
  const columns = tableColumns(data, widget)
  const measure = primaryMeasure(data, widget)
  const rows = (data?.rows || []).slice(0, 6)
  return <section onClick={onOpenDetails} className="glass-card cursor-pointer overflow-hidden rounded-lg transition hover:border-shell-accent/40 xl:col-span-2"><div className="p-5 pb-1"><WidgetHeader widget={widget} onSettings={onSettings} /></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-y border-dash-border">{columns.map((column) => <th key={column.id} className="label-mono px-4 py-3 !text-[10px] capitalize">{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.period || ''}-${row.breakdown || ''}-${index}`} className="border-b border-dash-border last:border-0">{columns.map((column) => <td key={column.id} className="px-4 py-3 font-mono text-dash-secondary">{formatValue(row[column.id], column.kind)}</td>)}</tr>)}{!data?.rows?.length && <tr><td colSpan={Math.max(1, columns.length)} className="px-4 py-8 text-center text-dash-tertiary">No data for this range.</td></tr>}</tbody></table></div><div className="px-5 pb-4"><MiniBarList rows={data?.rows || []} measure={measure} /></div>{(data?.rows || []).length > rows.length && <div className="border-t border-dash-border px-5 py-3"><p className="text-xs font-semibold text-shell-accent">View all details</p></div>}</section>
}

function DrilldownResult({ query, data, widget, loadingLabel, emptyLabel, chartLabel }) {
  if (query.isFetching) {
    return <p className="rounded-md border border-dash-border p-5 text-sm text-dash-tertiary">{loadingLabel}</p>
  }
  if (query.isError) {
    return (
      <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-100">
        <p>Unable to load this widget data.</p>
        <button type="button" onClick={() => query.refetch()} className="mt-3 rounded-md border border-red-300/40 px-3 py-1.5 text-xs font-semibold text-red-50 hover:bg-red-500/20">Retry</button>
      </div>
    )
  }
  if (data?.rows?.length) return <DetailChart data={data} widget={widget} ariaLabel={chartLabel} />
  return <p className="rounded-md border border-dash-border p-5 text-sm text-dash-tertiary">{emptyLabel}</p>
}

function WidgetDetailModal({ widget, data, period, anchorDate, dateRange, scope, restaurantId, groupIds, includeUngrouped, settings, onClose }) {
  const dates = dateRange?.start && dateRange?.end ? dateRange : periodDates(period, anchorDate)
  const measures = widget.id === 'sales_summary' ? widget.columns || [] : measureColumns(data, widget)
  const rows = data?.rows || []
  const summaryRow = data?.summary || (widget.id === 'sales_summary' ? aggregateSalesRows(rows) : aggregateWidgetRows(rows))
  const commonBody = {
    start_date: dates.start,
    end_date: dates.end,
    columns: (widget.columns || []).map((column) => column.id),
    chart_type: settings?.chart_type || 'bar',
    scope_dimension: settings?.scope_dimension || 'none',
    scope_mode: settings?.scope_mode || 'cumulative',
    scope_ids: settings?.scope_ids || [],
    ...(scope === 'portfolio' ? { group_ids: groupIds || null, include_ungrouped: includeUngrouped } : {}),
  }
  const path = scope === 'portfolio' ? `/portfolio-reports/homepage/widgets/${widget.id}/data` : `/restaurants/${restaurantId}/reports/homepage/widgets/${widget.id}/data`
  const defaultBreakdown = widget.id === 'sales_summary'
    ? scope === 'portfolio' ? 'restaurant' : 'employee'
    : widget.default_breakdown && widget.default_breakdown !== 'none' ? widget.default_breakdown : (widget.breakdowns || []).includes('restaurant') ? 'restaurant' : 'none'
  const trendBreakdown = (widget.breakdowns || []).includes('none') ? 'none' : defaultBreakdown
  const canTrend = (widget.grains || []).includes('day') && widget.id !== 'discount_review'
  const trendQuery = useQuery({
    queryKey: ['homepage-widget-drilldown', scope, restaurantId, widget.id, 'trend', period, anchorDate, dates.start, dates.end, (groupIds || []).join(','), includeUngrouped, JSON.stringify(settings || {})],
    queryFn: () => fetchWithSupabaseAuth(path, { method: 'POST', body: JSON.stringify({ ...commonBody, grain: 'day', breakdown: trendBreakdown }), timeoutMs: DEFAULT_API_TIMEOUT_MS }),
    enabled: canTrend,
  })
  const breakdown = defaultBreakdown
  const breakdownQuery = useQuery({
    queryKey: ['homepage-widget-drilldown', scope, restaurantId, widget.id, 'breakdown', period, anchorDate, dates.start, dates.end, breakdown, (groupIds || []).join(','), includeUngrouped, JSON.stringify(settings || {})],
    queryFn: () => fetchWithSupabaseAuth(path, { method: 'POST', body: JSON.stringify({ ...commonBody, grain: 'total', breakdown }), timeoutMs: DEFAULT_API_TIMEOUT_MS }),
    enabled: widget.id !== 'discount_review',
  })
  const detailQuery = useQuery({
    queryKey: ['homepage-widget-drilldown', scope, restaurantId, widget.id, 'detail', period, anchorDate, dates.start, dates.end, (groupIds || []).join(','), includeUngrouped, JSON.stringify(settings || {})],
    queryFn: () => fetchWithSupabaseAuth(path, { method: 'POST', body: JSON.stringify({ ...commonBody, grain: 'detail', breakdown }), timeoutMs: DEFAULT_API_TIMEOUT_MS }),
    enabled: (widget.grains || []).includes('detail') && widget.id !== 'discount_review',
  })
  const trendData = trendQuery.data
  const breakdownData = breakdownQuery.data
  const detailData = detailQuery.data
  const tableData = detailData?.rows?.length ? detailData : breakdownData?.rows?.length ? breakdownData : data
  const table = tableColumns(tableData, widget)
  const chartCopy = homepageWidgetChartCopy(widget, trendData || data, breakdownData?.breakdown || breakdown)
  if (widget.id === 'discount_review') {
    const summary = data?.summary || {}
    const employees = data?.employees || []
    const reasons = data?.reasons || []
    const events = data?.recent_events || []
    return (
      <Modal title={`${widget.label} details`} onClose={onClose} width="max-w-6xl">
        <div className="space-y-5 p-5">
          {widget.scopeLabel && <p className="inline-flex items-center gap-2 rounded-md border border-shell-accent/30 bg-shell-accent/10 px-3 py-2 text-xs font-semibold text-shell-accent"><Layers3 size={14} />{widget.scopeLabel}</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[['Total impact', summary.total_amount, 'money'], ['Actions', summary.action_count, 'number'], ['Average action', summary.average_action_amount, 'money'], ['Flagged employees', summary.flagged_employees, 'number'], ['Unattributed actions', summary.unattributed_actions, 'number']].map(([label, value, kind]) => <div key={label} className="rounded-md border border-dash-border p-4"><p className="label-mono !text-[9px]">{label}</p><p className="mt-2 font-mono text-lg text-dash-cream">{formatValue(value, kind)}</p></div>)}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <section><p className="label-mono mb-3">Discount and void impact by employee</p><DetailChart ariaLabel="Discount and void impact by employee" data={{ rows: employees.slice(0, 12).map((row) => ({ ...row, breakdown: row.employee_name || row.employee || 'Unknown' })), measure_columns: [{ id: 'total_amount', label: 'Total impact', kind: 'money' }], dimension_columns: ['breakdown'], breakdown: 'employee' }} widget={{ ...widget, columns: [{ id: 'total_amount', label: 'Total impact', kind: 'money' }] }} /></section>
            <section><p className="label-mono mb-3">Discount and void impact by reason code</p><DetailChart ariaLabel="Discount and void impact by reason code" data={{ rows: reasons.slice(0, 12).map((row) => ({ ...row, breakdown: row.reason_label || row.reason_code })), measure_columns: [{ id: 'total_amount', label: 'Total impact', kind: 'money' }], dimension_columns: ['breakdown'], breakdown: 'reason' }} widget={{ ...widget, columns: [{ id: 'total_amount', label: 'Total impact', kind: 'money' }] }} /></section>
          </div>
          <div className="overflow-x-auto rounded-md border border-dash-border">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead><tr className="border-b border-dash-border">{['When', 'Employee', 'Action', 'Reason', 'Amount', 'Restaurant'].map((label) => <th key={label} className="label-mono px-4 py-3 !text-[10px]">{label}</th>)}</tr></thead>
              <tbody>{events.map((row, index) => <tr key={`${row.period || row.occurred_at || index}-${index}`} className="border-b border-dash-border last:border-0"><td className="px-4 py-3 font-mono text-dash-secondary">{formatValue(row.period || row.occurred_at, 'date')}</td><td className="px-4 py-3 text-dash-secondary">{row.employee_name || row.employee || 'Unknown'}</td><td className="px-4 py-3 capitalize text-dash-secondary">{String(row.action_type || row.action || '').replaceAll('_', ' ')}</td><td className="px-4 py-3 text-dash-secondary">{row.reason_label || row.reason || row.reason_code || '—'}</td><td className="px-4 py-3 font-mono text-dash-secondary">{formatValue(row.amount || row.total_amount, 'money')}</td><td className="px-4 py-3 text-dash-secondary">{row.restaurant_name || row.restaurant || '—'}</td></tr>)}{!events.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-dash-tertiary">No discount or void events for this range.</td></tr>}</tbody>
            </table>
          </div>
        </div>
      </Modal>
    )
  }
  if (widget.id === 'sales_summary') {
    const metric = (id) => widget.columns.find((column) => column.id === id)
    const groups = [
      ['Sales', ['gross_sales', 'item_discounts', 'check_discounts', 'discounts', 'net_sales', 'non_taxable_net', 'taxable_net', 'gross_voids']],
      ['Checks and guests', ['receipts', 'void_receipts', 'covers', 'average_check']],
      ['Tax, service charges, tips, and tenders', ['tax', 'service_charges', 'employee_service_charges', 'restaurant_service_charges', 'unclassified_service_charges', 'tips', 'grand_total', 'total_collected', 'card_collected', 'cash_collected', 'other_collected']],
    ]
    const netSalesWidget = { ...widget, primary_column: 'net_sales', columns: [metric('net_sales'), ...widget.columns.filter((column) => column.id !== 'net_sales')].filter(Boolean) }
    const tenderData = {
      rows: [
        { breakdown: 'Card', total_collected: summaryRow.card_collected },
        { breakdown: 'Cash', total_collected: summaryRow.cash_collected },
        { breakdown: 'Other', total_collected: summaryRow.other_collected },
      ],
      measure_columns: [{ id: 'total_collected', label: 'Collected', kind: 'money' }],
      dimension_columns: ['breakdown'],
      breakdown: 'payment method',
    }
    return <Modal title="Sales details" onClose={onClose} width="max-w-6xl">
      <div className="space-y-6 p-5">
        {widget.scopeLabel && <p className="inline-flex items-center gap-2 rounded-md border border-shell-accent/30 bg-shell-accent/10 px-3 py-2 text-xs font-semibold text-shell-accent"><Layers3 size={14} />{widget.scopeLabel}</p>}
        {groups.map(([title, ids]) => <section key={title}><p className="label-mono mb-3">{title}</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{ids.map(metric).filter(Boolean).map((item) => <div key={item.id} className="rounded-md border border-dash-border p-4"><p className="label-mono !text-[9px]">{item.label}</p><p className="mt-2 font-mono text-lg text-dash-cream">{formatValue(summaryRow[item.id], item.kind)}</p></div>)}</div></section>)}
        <div className="grid gap-5 xl:grid-cols-3">
          <section><p className="label-mono mb-3">Sales: net sales by business day</p><DrilldownResult chartLabel="Sales: net sales by business day" query={trendQuery} data={trendData} widget={netSalesWidget} loadingLabel="Loading daily net sales..." emptyLabel="No daily net sales available." /></section>
          <section><p className="label-mono mb-3 capitalize">Sales: net sales by {defaultBreakdown.replaceAll('_', ' ')}</p><DrilldownResult chartLabel={`Sales: net sales by ${defaultBreakdown.replaceAll('_', ' ')}`} query={breakdownQuery} data={breakdownData} widget={netSalesWidget} loadingLabel={`Loading net sales by ${defaultBreakdown.replaceAll('_', ' ')}...`} emptyLabel={`No net sales by ${defaultBreakdown.replaceAll('_', ' ')} available.`} /></section>
          <section><p className="label-mono mb-3">Sales: collected tenders by payment method</p><DetailChart ariaLabel="Sales: collected tenders by payment method" data={tenderData} widget={{ ...widget, columns: tenderData.measure_columns }} /></section>
        </div>
        <section><p className="label-mono mb-3">Order activity</p><div className="max-h-[480px] overflow-auto rounded-md border border-dash-border"><table className="w-full min-w-[1500px] text-left text-sm"><thead className="sticky top-0 bg-dash-elevated"><tr className="border-b border-dash-border">{table.map((column) => <th key={column.id} className="label-mono px-4 py-3 !text-[10px] capitalize">{column.label}</th>)}</tr></thead><tbody>{(tableData?.rows || []).map((row, index) => <tr key={`${row.period || ''}-${row.order_number || ''}-${index}`} className="border-b border-dash-border last:border-0">{table.map((column) => <td key={column.id} className="px-4 py-3 font-mono text-dash-secondary">{formatValue(row[column.id], column.kind)}</td>)}</tr>)}{!(tableData?.rows || []).length && <tr><td colSpan={Math.max(1, table.length)} className="px-4 py-10 text-center text-dash-tertiary">No sales or voided checks for this range.</td></tr>}</tbody></table></div></section>
      </div>
    </Modal>
  }
  return (
    <Modal title={`${widget.label} details`} onClose={onClose} width="max-w-6xl">
      <div className="space-y-5 p-5">
        {widget.scopeLabel && <p className="inline-flex items-center gap-2 rounded-md border border-shell-accent/30 bg-shell-accent/10 px-3 py-2 text-xs font-semibold text-shell-accent"><Layers3 size={14} />{widget.scopeLabel}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {measures.map((item) => <div key={item.id} className="rounded-md border border-dash-border p-4"><p className="label-mono !text-[9px]">{item.label}</p><p className="mt-2 font-mono text-lg text-dash-cream">{formatValue(summaryRow[item.id], item.kind)}</p></div>)}
        </div>
        <div className={`grid gap-5 ${canTrend ? 'lg:grid-cols-2' : ''}`}>
          {canTrend && <section><p className="label-mono">{chartCopy.trend.title}</p><p className="mb-3 mt-1 text-xs text-dash-tertiary">{chartCopy.trend.description}</p><DrilldownResult chartLabel={chartCopy.trend.title} query={trendQuery} data={trendData} widget={widget} loadingLabel={`Loading ${chartCopy.trend.title.toLowerCase()}...`} emptyLabel={`No ${chartCopy.trend.title.toLowerCase()} available.`} /></section>}
          <section><p className="label-mono">{chartCopy.breakdown.title}</p><p className="mb-3 mt-1 text-xs text-dash-tertiary">{chartCopy.breakdown.description}</p><DrilldownResult chartLabel={chartCopy.breakdown.title} query={breakdownQuery} data={breakdownData} widget={widget} loadingLabel={`Loading ${chartCopy.breakdown.title.toLowerCase()}...`} emptyLabel={`No ${chartCopy.breakdown.title.toLowerCase()} available.`} /></section>
        </div>
        <div className="overflow-x-auto rounded-md border border-dash-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr className="border-b border-dash-border">{table.map((column) => <th key={column.id} className="label-mono px-4 py-3 !text-[10px] capitalize">{column.label}</th>)}</tr></thead>
            <tbody>{(tableData?.rows || []).map((row, index) => <tr key={`${row.period || ''}-${row.breakdown || ''}-${index}`} className="border-b border-dash-border last:border-0">{table.map((column) => <td key={column.id} className="px-4 py-3 font-mono text-dash-secondary">{formatValue(row[column.id], column.kind)}</td>)}</tr>)}{!(tableData?.rows || []).length && <tr><td colSpan={Math.max(1, table.length)} className="px-4 py-10 text-center text-dash-tertiary">No data for this range.</td></tr>}</tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}

function DiscountReviewWidget({ widget, data, onSettings, onOpenDetails }) {
  const summary = data?.summary || {}
  const employees = (data?.employees || []).filter((employee) => employee.action_count > 0).slice(0, 10)
  const alerts = data?.alerts || []
  const reasons = data?.reasons || []
  const scopeRows = data?.scope_breakdown || []
  const scopeName = scopeNoun(data)
  return <section onClick={onOpenDetails} className="glass-card cursor-pointer rounded-lg p-5 transition hover:border-shell-accent/40 xl:col-span-4">
    <WidgetHeader widget={widget} onSettings={onSettings} />
    {scopedBreakdown(data) && <div className="mb-5 rounded-md border border-dash-border p-4"><div className="mb-3 flex items-center gap-2"><Layers3 size={15} className="text-dash-secondary" /><h3 className="text-sm font-semibold capitalize">Impact by {scopeName}</h3></div>{scopeRows.length ? <div className="grid gap-2 md:grid-cols-2">{scopeRows.map((row) => <div key={row.breakdown} className="flex items-center justify-between gap-3 rounded-md bg-white/[0.03] p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{row.breakdown}</p><p className="text-[10px] text-dash-tertiary">{number(row.action_count)} actions · {money(row.average_action_amount)} average</p></div><p className="shrink-0 font-mono text-sm">{money(row.total_amount)}</p></div>)}</div> : <p className="text-sm text-dash-tertiary">No attributed {scopeName} activity for this range.</p>}</div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {[['Total impact', summary.total_amount, 'money'], ['Actions', summary.action_count, 'number'], ['Average action', summary.average_action_amount, 'money'], ['Flagged employees', summary.flagged_employees, 'number'], ['Unattributed actions', summary.unattributed_actions, 'number']].map(([label, value, kind]) => <div key={label} className={`rounded-md border p-3 ${label === 'Flagged employees' && Number(value) > 0 ? 'border-red-500/50 bg-red-500/10' : 'border-dash-border'}`}><p className="label-mono !text-[9px]">{label}</p><p className={`mt-1 font-mono text-lg ${label === 'Flagged employees' && Number(value) > 0 ? 'text-red-300' : 'text-dash-cream'}`}>{formatValue(value, kind)}</p></div>)}
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
      <div>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Employee financial impact</h3><span className="text-xs text-dash-tertiary">Red indicates a statistical alert</span></div>
        {employees.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={employees} layout="vertical" margin={{ left: 20, right: 20 }}><CartesianGrid stroke="rgba(168,162,158,.2)" horizontal={false} /><XAxis type="number" tickFormatter={(value) => `$${Math.round(value)}`} tick={{ fill: '#a8a29e', fontSize: 10 }} /><YAxis type="category" dataKey="employee_name" width={110} tick={{ fill: '#d6d3d1', fontSize: 10 }} /><Tooltip formatter={(value) => money(value)} labelFormatter={(label, payload) => payload?.[0]?.payload?.restaurant_name ? `${label} · ${payload[0].payload.restaurant_name}` : label} /><Bar dataKey="total_amount" radius={[0, 4, 4, 0]}>{employees.map((employee) => <Cell key={`${employee.restaurant_id}-${employee.employee_id || 'none'}`} fill={employee.is_flagged ? '#ef4444' : '#4f7ee8'} />)}</Bar></BarChart></ResponsiveContainer></div> : <p className="flex h-64 items-center justify-center text-sm text-dash-tertiary">No discount or void activity for this range.</p>}
      </div>
      <div>
        <h3 className="text-sm font-semibold">Review alerts</h3>
        {alerts.length ? <div className="mt-3 space-y-2">{alerts.map((employee) => <div key={`${employee.restaurant_id}-${employee.employee_id}`} className="rounded-md border border-red-500/40 bg-red-500/10 p-3"><div className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-300" /><div><p className="text-sm font-semibold text-red-200">{employee.employee_name}</p><p className="text-xs text-red-200/70">{employee.restaurant_name} · {money(employee.total_amount)} across {number(employee.action_count)} actions</p></div></div><ul className="mt-2 space-y-1 text-xs leading-5 text-red-100/80">{employee.alert_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>)}</div> : <p className="mt-3 rounded-md border border-dash-border p-4 text-sm text-dash-tertiary">No employees crossed the configured threshold.</p>}
      </div>
    </div>
    <div className="mt-5 overflow-x-auto border-t border-dash-border pt-5"><h3 className="mb-3 text-sm font-semibold">Reason-code activity</h3><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-y border-dash-border">{['Reason', 'Action', 'Restaurant', 'Count', 'Total', 'Average', 'Share'].map((label) => <th key={label} className="label-mono px-3 py-2 !text-[9px]">{label}</th>)}</tr></thead><tbody>{reasons.slice(0, 10).map((reason) => <tr key={`${reason.restaurant_id}-${reason.action_type}-${reason.reason_code}`} className="border-b border-dash-border"><td className="px-3 py-2"><span className="block font-semibold">{reason.reason_label}</span><span className="font-mono text-[10px] text-dash-tertiary">{reason.reason_code}</span></td><td className="px-3 py-2 capitalize text-dash-secondary">{reason.action_type.replaceAll('_', ' ')}</td><td className="px-3 py-2 text-dash-secondary">{reason.restaurant_name}</td><td className="px-3 py-2 font-mono">{number(reason.count)}</td><td className="px-3 py-2 font-mono">{money(reason.total_amount)}</td><td className="px-3 py-2 font-mono">{money(reason.average_amount)}</td><td className="px-3 py-2 font-mono">{number(reason.share_percent)}%</td></tr>)}</tbody></table></div>
  </section>
}

export default function HomepageWidgets({ scope, restaurantId, period, anchorDate, dateRange = null, dashboardScope = WHOLE_RESTAURANT_SCOPE, onDashboardScopeChange = null, groupIds = null, includeUngrouped = false, onScopeLoaded = null }) {
  const queryClient = useQueryClient()
  const [configureOpen, setConfigureOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [settingsId, setSettingsId] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [saving, setSaving] = useState(false)
  const preferencePath = scope === 'portfolio' ? '/portfolio-reports/homepage/preferences' : `/restaurants/${restaurantId}/reports/homepage/preferences`
  const preferenceQuery = useQuery({ queryKey: ['homepage-preferences', scope, restaurantId], queryFn: () => fetchWithSupabaseAuth(preferencePath, { timeoutMs: DEFAULT_API_TIMEOUT_MS }), enabled: scope === 'portfolio' || Boolean(restaurantId) })
  const preference = preferenceQuery.data || { visible_widgets: [], widget_order: [], widget_settings: {}, widget_pdf_settings: {}, catalog: [] }
  const dimensionPath = scope === 'portfolio'
    ? `/portfolio-reports/dimensions?${new URLSearchParams({ ...(groupIds?.length ? { group_ids: groupIds.join(',') } : {}), include_ungrouped: String(includeUngrouped) })}`
    : `/restaurants/${restaurantId}/reports/dimensions`
  const dimensionQuery = useQuery({ queryKey: ['reporting-dimensions', scope, restaurantId, (groupIds || []).join(','), includeUngrouped], queryFn: () => fetchWithSupabaseAuth(dimensionPath, { timeoutMs: DEFAULT_API_TIMEOUT_MS }), enabled: scope === 'portfolio' || Boolean(restaurantId) })
  const resolvedDashboardScope = useMemo(
    () => pruneReportingScope(dashboardScope, dimensionQuery.data),
    [dashboardScope, dimensionQuery.data],
  )
  useEffect(() => {
    if (!dimensionQuery.data || !onDashboardScopeChange) return
    if (JSON.stringify(resolvedDashboardScope) !== JSON.stringify(normalizeReportingScope(dashboardScope))) {
      onDashboardScopeChange(resolvedDashboardScope)
    }
  }, [dashboardScope, dimensionQuery.data, onDashboardScopeChange, resolvedDashboardScope])
  const orderedVisible = useMemo(() => (preference.widget_order || []).filter((id) => (preference.visible_widgets || []).includes(id)), [preference])
  const effectiveSettings = useMemo(
    () => effectiveHomepageWidgetSettings(preference.widget_settings || {}, orderedVisible, resolvedDashboardScope),
    [preference.widget_settings, orderedVisible, resolvedDashboardScope],
  )
  const dataPath = scope === 'portfolio' ? '/portfolio-reports/homepage/data' : `/restaurants/${restaurantId}/reports/homepage/data`
  const portfolioScope = scope === 'portfolio'
    ? { ...(groupIds?.length ? { group_ids: groupIds } : {}), include_ungrouped: includeUngrouped }
    : {}
  const dataQuery = useQuery({
    queryKey: ['homepage-data', scope, restaurantId, period, anchorDate, dateRange?.start, dateRange?.end, (groupIds || []).join(','), includeUngrouped, orderedVisible.join(','), JSON.stringify(effectiveSettings)],
    queryFn: () => fetchWithSupabaseAuth(dataPath, { method: 'POST', body: JSON.stringify({ period, anchor_date: anchorDate || null, ...(dateRange?.start && dateRange?.end ? { start_date: dateRange.start, end_date: dateRange.end } : {}), widget_ids: orderedVisible, widget_settings: effectiveSettings, ...portfolioScope }), timeoutMs: DEFAULT_API_TIMEOUT_MS }),
    enabled: orderedVisible.length > 0,
  })
  useEffect(() => {
    if (dataQuery.data?.scope && onScopeLoaded) onScopeLoaded(dataQuery.data.scope)
  }, [dataQuery.data?.scope, onScopeLoaded])
  const savePreference = async (next) => {
    setSaving(true)
    try {
      await fetchWithSupabaseAuth(preferencePath, { method: 'PUT', body: JSON.stringify(next) })
      await queryClient.invalidateQueries({ queryKey: ['homepage-preferences', scope, restaurantId] })
      setConfigureOpen(false); setSettingsId(null)
    } finally { setSaving(false) }
  }
  const saveWidgetPreference = async (kind, settings) => {
    const path = `${preferencePath}/widgets/${settingsId}`
    const saved = await fetchWithSupabaseAuth(path, {
      method: 'PATCH',
      body: JSON.stringify({ [kind === 'display' ? 'display_settings' : 'pdf_settings']: settings }),
    })
    queryClient.setQueryData(['homepage-preferences', scope, restaurantId], saved)
    if (kind === 'display') {
      await queryClient.invalidateQueries({ queryKey: ['homepage-data', scope, restaurantId] })
      setSettingsId(null)
    }
  }
  const saveSettings = async (settings) => saveWidgetPreference('display', settings)
  const selectedWidget = (preference.catalog || []).find((widget) => widget.id === settingsId)
  const detailWidget = (preference.catalog || []).find((widget) => widget.id === detailId) || { label: 'Widget', columns: [] }
  if (preferenceQuery.isPending) return <p className="p-6 text-sm text-dash-tertiary">Loading homepage...</p>
  if (preferenceQuery.isError) return <div className="flex items-center justify-between gap-3 rounded-md border border-dash-danger/30 bg-dash-danger/10 p-4 text-sm text-dash-danger"><span>{preferenceQuery.error?.message || 'Could not load homepage settings.'}</span><button type="button" onClick={() => preferenceQuery.refetch()} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-dash-danger/30 px-2.5 py-1.5 text-xs font-semibold"><RefreshCw size={13} />Retry</button></div>
  return <div className="space-y-4">
    <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setScopeOpen(true)} className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${resolvedDashboardScope.scope_dimension === 'none' ? 'border-dash-border text-dash-secondary hover:text-dash-cream' : 'border-shell-accent bg-shell-accent/10 text-dash-cream'}`}><Layers3 size={15} />{scopeControlLabel(resolvedDashboardScope)}</button><button type="button" onClick={() => setConfigureOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-md border border-dash-border px-3 text-sm font-semibold text-dash-secondary hover:text-dash-cream"><Settings2 size={15} />Customize homepage</button></div>
    {dataQuery.isError && <div className="flex items-center justify-between gap-3 rounded-md border border-dash-danger/30 bg-dash-danger/10 p-4 text-sm text-dash-danger"><span>{dataQuery.error?.message || 'Could not load homepage widgets.'}</span><button type="button" onClick={() => dataQuery.refetch()} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-dash-danger/30 px-2.5 py-1.5 text-xs font-semibold"><RefreshCw size={13} />Retry</button></div>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {orderedVisible.map((id) => {
        const catalogWidget = preference.catalog.find((item) => item.id === id)
        if (!catalogWidget) return null
        const data = dataQuery.data?.widgets?.[id]
        const widget = { ...catalogWidget, scopeLabel: widgetScopeLabel(catalogWidget, data, dimensionQuery.data, resolvedDashboardScope) }
        const onSettings = () => setSettingsId(id)
        const onOpenDetails = () => setDetailId(id)
        const settings = effectiveSettings[id] || {}
        if (id === 'sales_summary') return <SalesWidget key={id} widget={widget} data={data} onSettings={onSettings} onOpenDetails={onOpenDetails} />
        if (scopedBreakdown(data) && id !== 'discount_review') return <ScopedBreakdownWidget key={id} widget={widget} data={data} settings={settings} onSettings={onSettings} onOpenDetails={onOpenDetails} />
        if (id === 'credit_card_deposit' && settings.display_mode !== 'chart') return <CardDepositWidget key={id} widget={widget} data={data} onSettings={onSettings} onOpenDetails={onOpenDetails} />
        if (KPI_WIDGETS.has(id)) return <KpiWidget key={id} widget={widget} data={data} onSettings={onSettings} onOpenDetails={onOpenDetails} />
        if (id === 'discount_review') return <DiscountReviewWidget key={id} widget={widget} data={data} onSettings={onSettings} onOpenDetails={onOpenDetails} />
        if (id === 'menu_performance') return <MenuPerformanceWidget key={id} widget={widget} data={data} settings={settings} onSettings={onSettings} onOpenDetails={onOpenDetails} />
        if (id === 'sales_trend' || settings.display_mode === 'chart') return <ChartWidget key={id} widget={widget} data={data} settings={settings} onSettings={onSettings} onOpenDetails={onOpenDetails} />
        if (!(data?.dimension_columns || []).length && (data?.rows || []).length <= 1 && (data?.measure_columns || []).length > 1) return <SummaryWidget key={id} widget={widget} data={data} onSettings={onSettings} onOpenDetails={onOpenDetails} />
        return <TableWidget key={id} widget={widget} data={data} onSettings={onSettings} onOpenDetails={onOpenDetails} />
      })}
    </div>
    {!orderedVisible.length && <div className="rounded-md border border-dash-border p-8 text-center"><FileText className="mx-auto text-dash-tertiary" /><p className="mt-3 text-sm text-dash-secondary">Choose widgets to build this homepage.</p></div>}
    {scopeOpen && <DashboardScopeModal dimensions={dimensionQuery.data} value={resolvedDashboardScope} onClose={() => setScopeOpen(false)} onSave={(next) => { onDashboardScopeChange?.(next); setScopeOpen(false) }} />}
    {configureOpen && <ConfigureModal catalog={preference.catalog || []} visible={preference.visible_widgets || []} order={preference.widget_order || []} saving={saving} onClose={() => setConfigureOpen(false)} onSave={(visible, order) => savePreference({ visible_widgets: visible, widget_order: order, widget_settings: preference.widget_settings || {} })} />}
    {selectedWidget && <WidgetSettingsModal widget={selectedWidget} widgetData={dataQuery.data?.widgets?.[settingsId]} dimensions={dimensionQuery.data} settings={preference.widget_settings?.[settingsId] || {}} dashboardScope={resolvedDashboardScope} pdfSettings={preference.widget_pdf_settings?.[settingsId] || {}} period={period} anchorDate={anchorDate} dateRange={dateRange} scope={scope} restaurantId={restaurantId} groupIds={groupIds} includeUngrouped={includeUngrouped} onClose={() => setSettingsId(null)} onSave={saveSettings} onSavePdf={(settings) => saveWidgetPreference('pdf', settings)} />}
    {detailId && <WidgetDetailModal widget={{ ...detailWidget, scopeLabel: widgetScopeLabel(detailWidget, dataQuery.data?.widgets?.[detailId], dimensionQuery.data, resolvedDashboardScope) }} data={dataQuery.data?.widgets?.[detailId]} period={period} anchorDate={anchorDate} dateRange={dateRange} scope={scope} restaurantId={restaurantId} groupIds={groupIds} includeUngrouped={includeUngrouped} settings={effectiveSettings[detailId] || {}} onClose={() => setDetailId(null)} />}
  </div>
}

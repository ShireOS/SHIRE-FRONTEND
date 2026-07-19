import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  BarChart3,
  Check,
  Download,
  FileText,
  LineChart as LineChartIcon,
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchWithSupabaseAuth } from '../../shared/query'

const KPI_WIDGETS = new Set([
  'net_sales', 'orders', 'covers', 'labor_cost', 'profit_after_labor',
  'average_check', 'tips', 'deposits',
])
const MONEY_IDS = new Set([
  'net_sales', 'gross_sales', 'tips', 'discounts', 'average_check',
  'labor_cost', 'profit_after_labor', 'gross_amount', 'processor_fees',
  'expected_deposit', 'settled_deposit', 'pending_deposit', 'revenue',
  'cost', 'margin', 'declared_cash', 'declared_card', 'declared_other',
  'tips_collected', 'tipout_paid', 'tipout_received', 'final_payout',
  'refunds', 'voided_items',
  'total_amount', 'discount_amount', 'comp_amount', 'item_void_amount', 'check_void_amount',
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

function WidgetSettingsModal({ widget, widgetData, dimensions, settings, period, anchorDate, scope, restaurantId, groupIds, includeUngrouped, onClose, onSave }) {
  const dates = periodDates(period, anchorDate)
  const [tab, setTab] = useState('display')
  const [draft, setDraft] = useState(() => ({
    display_grain: settings.display_grain || (widget.id === 'sales_trend' ? 'day' : 'total'),
    display_breakdown: settings.display_breakdown || widget.default_breakdown,
    display_columns: settings.display_columns || widget.default_columns,
    chart_type: settings.chart_type || (widget.id === 'sales_trend' ? 'line' : 'bar'),
    display_mode: settings.display_mode || (widget.id === 'sales_trend' ? 'chart' : 'table'),
    sort_by: settings.sort_by || widget.default_columns[0],
    sort_direction: settings.sort_direction || 'desc',
    limit: settings.limit || 12,
    alert_z_score: settings.alert_z_score || 2,
    alert_min_actions: settings.alert_min_actions || 5,
    scope_dimension: settings.scope_dimension || 'none', scope_mode: settings.scope_mode || 'cumulative', scope_ids: settings.scope_ids || [],
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
    scope_dimension: settings.scope_dimension || 'none', scope_mode: settings.scope_mode || 'cumulative', scope_ids: settings.scope_ids || [],
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
      const file = await fetchWithSupabaseAuth(path, { method: 'POST', body: JSON.stringify(body) })
      savePdf(file)
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Could not generate this PDF.') }
    finally { setWorking(false) }
  }
  const renderColumns = (state, setter, key) => <div className="grid gap-2 sm:grid-cols-2">{widget.columns.map((column) => <label key={column.id} className="flex min-h-10 items-center gap-2 rounded-md border border-dash-border px-3 text-sm"><input type="checkbox" checked={state[key].includes(column.id)} onChange={() => toggleColumn(key, column.id, setter)} />{column.label}</label>)}</div>
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
        <ReportingScopeFields widget={widget} dimensions={dimensions} value={draft} onChange={setDraft} />
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
  return <header className="mb-4 flex items-start justify-between gap-3"><div><p className="label-mono">Homepage widget</p><h2 className="mt-1 text-lg font-semibold">{widget.label}</h2><p className="mt-1 text-xs text-dash-tertiary">{widget.description}</p></div><button type="button" onClick={(event) => { event.stopPropagation(); onSettings() }} title={`Configure ${widget.label}`} aria-label={`Configure ${widget.label}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-dash-border text-dash-secondary hover:text-dash-cream"><Settings2 size={16} /></button></header>
}

function richKpiDetail(widgetId, payload) {
  if (!payload) return null
  const orders = payload.series?.orders || []
  const covers = payload.series?.covers || []
  const servers = payload.contributors?.servers || []
  const labor = payload.contributors?.labor_staff || []
  const definitions = {
    net_sales: { rows: orders, valueKey: 'net_sales', contributors: servers.map((row) => ({ name: row.name, primary: money(row.net_sales), secondary: `${number(row.transactions)} checks` })) },
    orders: { rows: orders, valueKey: 'transactions', contributors: servers.map((row) => ({ name: row.name, primary: number(row.transactions), secondary: money(row.net_sales) })) },
    covers: { rows: covers, valueKey: 'covers', contributors: [] },
    average_check: { rows: orders.map((row) => ({ ...row, average_check: Number(row.transactions) ? Number(row.net_sales) / Number(row.transactions) : 0 })), valueKey: 'average_check', contributors: [] },
    tips: { rows: orders, valueKey: 'tips', contributors: servers.map((row) => ({ name: row.name, primary: money(row.tips), secondary: `${number(row.transactions)} checks` })) },
    labor_cost: { rows: [], valueKey: 'labor_cost', contributors: labor.map((row) => ({ name: row.name, primary: money(row.labor_cost), secondary: `${number(Number(row.worked_minutes || 0) / 60)} hrs` })) },
  }
  return definitions[widgetId] || null
}

function KpiWidget({ widget, data, detail, expanded, onToggle, onSettings }) {
  const column = data?.measure_columns?.[0] || widget.columns[0]
  const row = data?.rows?.[0] || {}
  const secondary = (data?.measure_columns || []).slice(1, 3)
  const canExpand = Boolean(detail?.rows?.length || detail?.contributors?.length)
  return <section onClick={canExpand ? onToggle : undefined} className={`glass-card min-w-0 rounded-lg p-5 transition ${canExpand ? 'cursor-pointer hover:-translate-y-px' : ''} ${expanded ? 'md:col-span-2 xl:col-span-2' : ''}`}>
    <WidgetHeader widget={widget} onSettings={onSettings} />
    <p className="truncate font-mono text-3xl tabular-nums text-dash-cream">{formatValue(row[column.id], column.kind)}</p>
    <p className="mt-1 text-xs text-dash-tertiary">{column.label}{canExpand ? ' · Select for trend and contributors' : ''}</p>
    {secondary.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2 border-t border-dash-border pt-3">{secondary.map((item) => <div key={item.id}><p className="label-mono !text-[9px]">{item.label}</p><p className="mt-1 font-mono text-sm text-dash-secondary">{formatValue(row[item.id], item.kind)}</p></div>)}</div>}
    {expanded && detail && <div className="mt-5 grid gap-5 border-t border-dash-border pt-5 lg:grid-cols-[minmax(0,1fr)_240px]" onClick={(event) => event.stopPropagation()}>
      <div>{detail.rows.length > 0 ? <div className="h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={detail.rows}><CartesianGrid stroke="rgba(168,162,158,.2)" vertical={false} /><XAxis dataKey="bucket" tickFormatter={(value) => String(value).slice(5, 10)} tick={{ fill: '#a8a29e', fontSize: 10 }} /><YAxis tickFormatter={(value) => MONEY_IDS.has(detail.valueKey) || detail.valueKey === 'average_check' ? `$${Math.round(value)}` : number(value)} tick={{ fill: '#a8a29e', fontSize: 10 }} /><Tooltip formatter={(value) => MONEY_IDS.has(detail.valueKey) || detail.valueKey === 'average_check' ? money(value) : number(value)} /><Bar dataKey={detail.valueKey} fill="#4f7ee8" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="flex h-44 items-center justify-center text-sm text-dash-tertiary">No time series for this metric.</p>}</div>
      <div><p className="label-mono !text-[10px]">Contributors</p>{detail.contributors.length > 0 ? <ul className="mt-3 space-y-2">{detail.contributors.slice(0, 6).map((item) => <li key={item.name} className="flex items-baseline justify-between gap-3 text-sm"><span className="truncate text-dash-secondary">{item.name}</span><span className="shrink-0 text-right"><span className="block font-mono text-dash-cream">{item.primary}</span><span className="block text-[10px] text-dash-tertiary">{item.secondary}</span></span></li>)}</ul> : <p className="mt-3 text-xs leading-5 text-dash-tertiary">No contributor breakdown for this range.</p>}</div>
    </div>}
  </section>
}

function ChartWidget({ widget, data, settings, onSettings }) {
  const measure = data?.measure_columns?.[0] || widget.columns[0]
  const rows = data?.rows || []
  const chartType = settings.chart_type || 'line'
  const dataKey = (row) => row.period || row.breakdown || 'Total'
  const latest = rows.at(-1) || {}
  return <section className="glass-card rounded-lg p-5 xl:col-span-2"><WidgetHeader widget={widget} onSettings={onSettings} />{data?.measure_columns?.length > 1 && <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{data.measure_columns.slice(0, 4).map((item) => <div key={item.id} className="rounded-md border border-dash-border p-3"><p className="label-mono !text-[9px]">Latest {item.label}</p><p className="mt-1 font-mono text-sm text-dash-cream">{formatValue(latest[item.id], item.kind)}</p></div>)}</div>}<div className="h-72"><ResponsiveContainer width="100%" height="100%">{chartType === 'bar' ? <BarChart data={rows}><CartesianGrid stroke="rgba(168,162,158,.2)" vertical={false} /><XAxis dataKey={dataKey} tick={{ fill: '#a8a29e', fontSize: 11 }} /><YAxis tickFormatter={(value) => MONEY_IDS.has(measure.id) ? `$${Math.round(value / 1000)}k` : number(value)} tick={{ fill: '#a8a29e', fontSize: 11 }} /><Tooltip formatter={(value) => formatValue(value, measure.kind)} /><Bar dataKey={measure.id} fill="#4f7ee8" radius={[4, 4, 0, 0]} /></BarChart> : <LineChart data={rows}><CartesianGrid stroke="rgba(168,162,158,.2)" vertical={false} /><XAxis dataKey={dataKey} tick={{ fill: '#a8a29e', fontSize: 11 }} /><YAxis tickFormatter={(value) => MONEY_IDS.has(measure.id) ? `$${Math.round(value / 1000)}k` : number(value)} tick={{ fill: '#a8a29e', fontSize: 11 }} /><Tooltip formatter={(value) => formatValue(value, measure.kind)} /><Line type="monotone" dataKey={measure.id} stroke="#4f7ee8" strokeWidth={3} dot={{ r: 3 }} connectNulls /></LineChart>}</ResponsiveContainer></div></section>
}

function MenuPerformanceWidget({ widget, data, settings, onSettings }) {
  const rows = [...(data?.rows || [])]
  const measures = data?.measure_columns || []
  const metric = measures.find((item) => item.id === settings.sort_by) || measures.find((item) => item.id === 'revenue') || measures[0]
  rows.sort((left, right) => Number(right[metric?.id] || 0) - Number(left[metric?.id] || 0))
  const take = Math.min(5, Math.max(1, Math.ceil(rows.length / 2)))
  const top = rows.slice(0, take)
  const bottom = rows.slice(-take).reverse()
  const max = Math.max(1, ...rows.map((row) => Number(row[metric?.id] || 0)))
  const List = ({ title, icon: Icon, items, tone }) => <div><div className="mb-3 flex items-center gap-2"><Icon size={16} className={tone} /><h3 className="text-sm font-semibold">{title}</h3></div><div className="space-y-2">{items.map((row, index) => <div key={`${row.breakdown}-${index}`} className="rounded-md border border-dash-border p-3"><div className="flex items-baseline justify-between gap-3"><span className="truncate text-sm font-semibold">{row.breakdown || `Item ${index + 1}`}</span><span className="font-mono text-sm">{formatValue(row[metric?.id], metric?.kind)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-shell-accent" style={{ width: `${Math.max(2, Number(row[metric?.id] || 0) / max * 100)}%` }} /></div><p className="mt-2 text-[10px] text-dash-tertiary">{measures.filter((item) => item.id !== metric?.id).slice(0, 3).map((item) => `${item.label}: ${formatValue(row[item.id], item.kind)}`).join(' · ')}</p></div>)}</div></div>
  return <section className="glass-card rounded-lg p-5 xl:col-span-4"><WidgetHeader widget={widget} onSettings={onSettings} />{rows.length ? <div className="grid gap-6 lg:grid-cols-2"><List title="Top performers" icon={TrendingUp} items={top} tone="text-dash-success" /><List title="Bottom performers" icon={TrendingDown} items={bottom} tone="text-dash-warning" /></div> : <p className="py-8 text-center text-sm text-dash-tertiary">No menu sales for this range.</p>}</section>
}

function SummaryWidget({ widget, data, onSettings }) {
  const row = data?.rows?.[0] || {}
  const measures = data?.measure_columns || []
  return <section className="glass-card rounded-lg p-5 xl:col-span-2"><WidgetHeader widget={widget} onSettings={onSettings} /><div className="grid gap-3 sm:grid-cols-2">{measures.map((item) => <div key={item.id} className="rounded-md border border-dash-border p-4"><p className="label-mono !text-[9px]">{item.label}</p><p className="mt-2 font-mono text-xl text-dash-cream">{formatValue(row[item.id], item.kind)}</p></div>)}</div></section>
}

function TableWidget({ widget, data, onSettings }) {
  const dimensions = data?.dimension_columns || []
  const measures = data?.measure_columns || []
  const columns = [...dimensions.map((id) => ({ id, label: id.replaceAll('_', ' '), kind: id === 'period' ? 'date' : 'text' })), ...measures]
  return <section className="glass-card overflow-hidden rounded-lg xl:col-span-2"><div className="p-5 pb-1"><WidgetHeader widget={widget} onSettings={onSettings} /></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-y border-dash-border">{columns.map((column) => <th key={column.id} className="label-mono px-4 py-3 !text-[10px] capitalize">{column.label}</th>)}</tr></thead><tbody>{(data?.rows || []).map((row, index) => <tr key={`${row.period || ''}-${row.breakdown || ''}-${index}`} className="border-b border-dash-border last:border-0">{columns.map((column) => <td key={column.id} className="px-4 py-3 font-mono text-dash-secondary">{formatValue(row[column.id], column.kind)}</td>)}</tr>)}{!data?.rows?.length && <tr><td colSpan={Math.max(1, columns.length)} className="px-4 py-8 text-center text-dash-tertiary">No data for this range.</td></tr>}</tbody></table></div></section>
}

function DiscountReviewWidget({ widget, data, onSettings }) {
  const summary = data?.summary || {}
  const employees = (data?.employees || []).filter((employee) => employee.action_count > 0).slice(0, 10)
  const alerts = data?.alerts || []
  const reasons = data?.reasons || []
  return <section className="glass-card rounded-lg p-5 xl:col-span-4">
    <WidgetHeader widget={widget} onSettings={onSettings} />
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

export default function HomepageWidgets({ scope, restaurantId, period, anchorDate, groupIds = null, includeUngrouped = false }) {
  const queryClient = useQueryClient()
  const [configureOpen, setConfigureOpen] = useState(false)
  const [settingsId, setSettingsId] = useState(null)
  const [expandedKpi, setExpandedKpi] = useState(null)
  const [saving, setSaving] = useState(false)
  const preferencePath = scope === 'portfolio' ? '/portfolio-reports/homepage/preferences' : `/restaurants/${restaurantId}/reports/homepage/preferences`
  const preferenceQuery = useQuery({ queryKey: ['homepage-preferences', scope, restaurantId], queryFn: () => fetchWithSupabaseAuth(preferencePath), enabled: scope === 'portfolio' || Boolean(restaurantId) })
  const preference = preferenceQuery.data || { visible_widgets: [], widget_order: [], widget_settings: {}, catalog: [] }
  const dimensionPath = scope === 'portfolio'
    ? `/portfolio-reports/dimensions?${new URLSearchParams({ ...(groupIds?.length ? { group_ids: groupIds.join(',') } : {}), include_ungrouped: String(includeUngrouped) })}`
    : `/restaurants/${restaurantId}/reports/dimensions`
  const dimensionQuery = useQuery({ queryKey: ['reporting-dimensions', scope, restaurantId, (groupIds || []).join(','), includeUngrouped], queryFn: () => fetchWithSupabaseAuth(dimensionPath), enabled: scope === 'portfolio' || Boolean(restaurantId) })
  const orderedVisible = useMemo(() => (preference.widget_order || []).filter((id) => (preference.visible_widgets || []).includes(id)), [preference])
  const dataPath = scope === 'portfolio' ? '/portfolio-reports/homepage/data' : `/restaurants/${restaurantId}/reports/homepage/data`
  const portfolioScope = scope === 'portfolio'
    ? { ...(groupIds?.length ? { group_ids: groupIds } : {}), include_ungrouped: includeUngrouped }
    : {}
  const dataQuery = useQuery({
    queryKey: ['homepage-data', scope, restaurantId, period, anchorDate, (groupIds || []).join(','), includeUngrouped, orderedVisible.join(','), JSON.stringify(preference.widget_settings || {})],
    queryFn: () => fetchWithSupabaseAuth(dataPath, { method: 'POST', body: JSON.stringify({ period, anchor_date: anchorDate || null, widget_ids: orderedVisible, widget_settings: preference.widget_settings || {}, ...portfolioScope }) }),
    enabled: orderedVisible.length > 0,
  })
  const richMetricsQuery = useQuery({
    queryKey: ['owner-metrics', restaurantId, period],
    queryFn: () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/owner-analytics/metrics?period=${period}`),
    enabled: scope === 'restaurant' && Boolean(restaurantId),
    placeholderData: keepPreviousData,
  })
  const savePreference = async (next) => {
    setSaving(true)
    try {
      await fetchWithSupabaseAuth(preferencePath, { method: 'PUT', body: JSON.stringify(next) })
      await queryClient.invalidateQueries({ queryKey: ['homepage-preferences', scope, restaurantId] })
      setConfigureOpen(false); setSettingsId(null)
    } finally { setSaving(false) }
  }
  const saveSettings = async (settings) => savePreference({ visible_widgets: preference.visible_widgets, widget_order: preference.widget_order, widget_settings: { ...(preference.widget_settings || {}), [settingsId]: settings } })
  const selectedWidget = (preference.catalog || []).find((widget) => widget.id === settingsId)
  if (preferenceQuery.isPending) return <p className="p-6 text-sm text-dash-tertiary">Loading homepage...</p>
  return <div className="space-y-4">
    <div className="flex justify-end"><button type="button" onClick={() => setConfigureOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-md border border-dash-border px-3 text-sm font-semibold text-dash-secondary hover:text-dash-cream"><Settings2 size={15} />Customize homepage</button></div>
    {dataQuery.isError && <p className="rounded-md border border-dash-danger/30 bg-dash-danger/10 p-4 text-sm text-dash-danger">{dataQuery.error?.message || 'Could not load homepage widgets.'}</p>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {orderedVisible.map((id) => {
        const widget = preference.catalog.find((item) => item.id === id)
        if (!widget) return null
        const data = dataQuery.data?.widgets?.[id]
        const onSettings = () => setSettingsId(id)
        if (KPI_WIDGETS.has(id)) return <KpiWidget key={id} widget={widget} data={data} detail={richKpiDetail(id, richMetricsQuery.data)} expanded={expandedKpi === id} onToggle={() => setExpandedKpi((current) => current === id ? null : id)} onSettings={onSettings} />
        const settings = preference.widget_settings?.[id] || {}
        if (id === 'discount_review') return <DiscountReviewWidget key={id} widget={widget} data={data} onSettings={onSettings} />
        if (id === 'menu_performance') return <MenuPerformanceWidget key={id} widget={widget} data={data} settings={settings} onSettings={onSettings} />
        if (id === 'sales_trend' || settings.display_mode === 'chart') return <ChartWidget key={id} widget={widget} data={data} settings={settings} onSettings={onSettings} />
        if (!(data?.dimension_columns || []).length && (data?.rows || []).length <= 1 && (data?.measure_columns || []).length > 1) return <SummaryWidget key={id} widget={widget} data={data} onSettings={onSettings} />
        return <TableWidget key={id} widget={widget} data={data} onSettings={onSettings} />
      })}
    </div>
    {!orderedVisible.length && <div className="rounded-md border border-dash-border p-8 text-center"><FileText className="mx-auto text-dash-tertiary" /><p className="mt-3 text-sm text-dash-secondary">Choose widgets to build this homepage.</p></div>}
    {configureOpen && <ConfigureModal catalog={preference.catalog || []} visible={preference.visible_widgets || []} order={preference.widget_order || []} saving={saving} onClose={() => setConfigureOpen(false)} onSave={(visible, order) => savePreference({ visible_widgets: visible, widget_order: order, widget_settings: preference.widget_settings || {} })} />}
    {selectedWidget && <WidgetSettingsModal widget={selectedWidget} widgetData={dataQuery.data?.widgets?.[settingsId]} dimensions={dimensionQuery.data} settings={preference.widget_settings?.[settingsId] || {}} period={period} anchorDate={anchorDate} scope={scope} restaurantId={restaurantId} groupIds={groupIds} includeUngrouped={includeUngrouped} onClose={() => setSettingsId(null)} onSave={saveSettings} />}
  </div>
}

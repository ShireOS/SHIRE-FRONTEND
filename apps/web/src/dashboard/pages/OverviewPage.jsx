import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Check,
  ChevronDown,
  Filter,
  Mail,
  RefreshCw,
  Settings2,
  X,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchWithSupabaseAuth, STALE_TIMES } from '../../shared/query'
import PortfolioEmailPanel from './PortfolioEmailPanel'
import HomepageWidgets from '../components/HomepageWidgets'

const PERIODS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'full', label: 'Full' },
]

const MODULES = [
  { id: 'profit_after_labor', label: 'Profit after labor', description: 'Add portfolio profit after recorded hourly labor.' },
  { id: 'period_comparison', label: 'Period comparison', description: 'Show changes against the immediately preceding period.' },
  { id: 'portfolio_trends', label: 'Portfolio trends', description: 'Chart consolidated sales over the selected period.' },
  { id: 'group_performance', label: 'Group performance', description: 'Compare sales, profit, and labor across groups.' },
  { id: 'store_rankings', label: 'Store rankings', description: 'Add rank, profit, and period movement to the store table.' },
]

const money = (value) => value == null
  ? '—'
  : Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const count = (value) => value == null ? '—' : Number(value).toLocaleString('en-US')

function MetricCard({ label, value, detail, comparison }) {
  const delta = comparison?.delta
  return (
    <div className="glass-card min-w-0 rounded-2xl p-5">
      <p className="label-mono">{label}</p>
      <p className="mt-2 truncate font-mono text-2xl tabular-nums text-dash-cream">{value}</p>
      {comparison && (
        <p className={`mt-1 text-xs font-semibold ${Number(delta) >= 0 ? 'text-dash-success' : 'text-dash-danger'}`}>
          {Number(delta) > 0 ? '+' : ''}{money(delta)}
          {comparison.percent != null ? ` (${Number(comparison.percent) > 0 ? '+' : ''}${Number(comparison.percent).toFixed(1)}%)` : ''}
          {' '}from prior period
        </p>
      )}
      {detail && <p className="mt-1 text-xs text-dash-tertiary">{detail}</p>}
    </div>
  )
}

function Modal({ title, onClose, children, width = 'max-w-xl' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className={`max-h-[90vh] w-full ${width} overflow-y-auto rounded-2xl border border-dash-border bg-dash-elevated shadow-2xl`}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-dash-border bg-dash-elevated px-5 py-4">
          <h2 className="text-lg font-semibold text-dash-cream">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl text-dash-secondary hover:bg-[var(--glass-bg-hover)] hover:text-dash-cream">
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

function FilterModal({ groups, selected, includeUngrouped, onApply, onClose }) {
  const [draft, setDraft] = useState(() => new Set(selected))
  const [ungrouped, setUngrouped] = useState(includeUngrouped)
  const allSelected = draft.size === 0 && !ungrouped
  const toggle = (id) => setDraft((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  return (
    <Modal title="Filter portfolio" onClose={onClose}>
      <div className="space-y-2 p-5">
        <button type="button" onClick={() => { setDraft(new Set()); setUngrouped(false) }} className={`flex w-full items-center justify-between rounded-xl border p-4 text-left ${allSelected ? 'border-shell-accent bg-shell-accent/10' : 'border-dash-border'}`}>
          <span><span className="block font-semibold">All groups</span><span className="text-xs text-dash-tertiary">Every restaurant currently available to you</span></span>
          {allSelected && <Check size={18} className="text-shell-accent" />}
        </button>
        {groups.map((group) => (
          <button key={group.id} type="button" onClick={() => toggle(group.id)} className={`flex w-full items-center justify-between rounded-xl border p-4 text-left ${draft.has(group.id) ? 'border-shell-accent bg-shell-accent/10' : 'border-dash-border'}`}>
            <span className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} /><span><span className="block font-semibold">{group.name}</span><span className="text-xs text-dash-tertiary">{group.restaurant_ids?.length || 0} stores</span></span></span>
            {draft.has(group.id) && <Check size={18} className="text-shell-accent" />}
          </button>
        ))}
        <button type="button" onClick={() => setUngrouped((value) => !value)} className={`flex w-full items-center justify-between rounded-xl border p-4 text-left ${ungrouped ? 'border-shell-accent bg-shell-accent/10' : 'border-dash-border'}`}>
          <span className="flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-gray-400" /><span className="font-semibold">Ungrouped</span></span>
          {ungrouped && <Check size={18} className="text-shell-accent" />}
        </button>
      </div>
      <footer className="flex justify-end gap-2 border-t border-dash-border p-5">
        <button type="button" onClick={onClose} className="h-10 rounded-xl border border-dash-border px-4 text-sm font-semibold text-dash-secondary">Cancel</button>
        <button type="button" onClick={() => onApply(draft, ungrouped)} className="h-10 rounded-xl bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text">Apply filter</button>
      </footer>
    </Modal>
  )
}

function ConfigureModal({ visibleModules, onSave, onClose, saving }) {
  const [draft, setDraft] = useState(() => new Set(visibleModules))
  const toggle = (id) => setDraft((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  return (
    <Modal title="Configure Overview" onClose={onClose}>
      <div className="space-y-2 p-5">
        <p className="mb-4 text-sm text-dash-secondary">Choose additional rollup analytics. New accounts start with only the baseline overview.</p>
        {MODULES.map((module) => (
          <button key={module.id} type="button" onClick={() => toggle(module.id)} className={`flex w-full items-start justify-between gap-4 rounded-xl border p-4 text-left ${draft.has(module.id) ? 'border-shell-accent bg-shell-accent/10' : 'border-dash-border'}`}>
            <span><span className="block font-semibold text-dash-cream">{module.label}</span><span className="mt-1 block text-xs text-dash-tertiary">{module.description}</span></span>
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${draft.has(module.id) ? 'border-shell-accent bg-shell-accent text-shell-cta-text' : 'border-dash-border'}`}>{draft.has(module.id) && <Check size={13} />}</span>
          </button>
        ))}
      </div>
      <footer className="flex justify-end gap-2 border-t border-dash-border p-5">
        <button type="button" onClick={onClose} className="h-10 rounded-xl border border-dash-border px-4 text-sm font-semibold text-dash-secondary">Cancel</button>
        <button type="button" disabled={saving} onClick={() => onSave([...draft])} className="h-10 rounded-xl bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text disabled:opacity-50">{saving ? 'Saving…' : 'Save layout'}</button>
      </footer>
    </Modal>
  )
}

export default function OverviewPage({ restaurantBase = '/restaurants' }) {
  const [period, setPeriod] = useState(() => localStorage.getItem('shire_overview_period') || 'week')
  const [tab, setTab] = useState('overview')
  const [selectedGroups, setSelectedGroups] = useState(new Set())
  const [includeUngrouped, setIncludeUngrouped] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => localStorage.setItem('shire_overview_period', period), [period])
  const groupQuery = [...selectedGroups].sort().join(',')
  const reportQuery = useQuery({
    queryKey: ['portfolio-report', period, groupQuery, includeUngrouped],
    queryFn: () => fetchWithSupabaseAuth(`/portfolio-reports?period=${period}${groupQuery ? `&group_ids=${groupQuery}` : ''}${includeUngrouped ? '&include_ungrouped=true' : ''}`),
    staleTime: STALE_TIMES.analytics,
  })
  const report = reportQuery.data || {}
  const totals = report.totals || {}
  const groups = report.scope?.groups || []

  const filterLabel = useMemo(() => {
    if (selectedGroups.size === 0 && !includeUngrouped) return 'All groups'
    const countSelected = selectedGroups.size + (includeUngrouped ? 1 : 0)
    return `${countSelected} group${countSelected === 1 ? '' : 's'}`
  }, [selectedGroups, includeUngrouped])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="label-mono">Enterprise</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-dash-cream">Overview</h1>
          <p className="mt-2 text-sm text-dash-secondary">{totals.store_count || 0} stores · {totals.reporting_stores || 0} reporting data</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFilterOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-dash-border px-3 text-sm font-semibold text-dash-secondary hover:border-shell-accent/40 hover:text-dash-cream">
            <Filter size={15} />{filterLabel}<ChevronDown size={14} />
          </button>
          <nav className="grid grid-cols-5 rounded-xl border border-dash-border p-1">
            {PERIODS.map((item) => (
              <button key={item.id} type="button" onClick={() => setPeriod(item.id)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${period === item.id ? 'bg-shell-accent text-shell-cta-text' : 'text-dash-secondary hover:text-dash-cream'}`}>{item.label}</button>
            ))}
          </nav>
          <button type="button" onClick={() => void reportQuery.refetch()} aria-label="Refresh data" title="Refresh data" className="grid h-10 w-10 place-items-center rounded-xl border border-dash-border text-dash-secondary hover:text-dash-cream"><RefreshCw size={15} className={reportQuery.isFetching ? 'animate-spin' : ''} /></button>
        </div>
      </header>

      <div className="flex border-b border-dash-border">
        {[{ id: 'overview', label: 'Overview', icon: null }, { id: 'email', label: 'Email reports', icon: Mail }].map((item) => {
          const Icon = item.icon
          return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${tab === item.id ? 'border-shell-accent text-dash-cream' : 'border-transparent text-dash-tertiary hover:text-dash-secondary'}`}>{Icon && <Icon size={15} />}{item.label}</button>
        })}
      </div>

      {tab === 'email' ? <PortfolioEmailPanel /> : <HomepageWidgets scope="portfolio" period={period} groupIds={[...selectedGroups]} includeUngrouped={includeUngrouped} />}

      {filterOpen && <FilterModal groups={groups} selected={selectedGroups} includeUngrouped={includeUngrouped} onClose={() => setFilterOpen(false)} onApply={(next, ungrouped) => { setSelectedGroups(next); setIncludeUngrouped(ungrouped); setFilterOpen(false) }} />}
    </div>
  )
}

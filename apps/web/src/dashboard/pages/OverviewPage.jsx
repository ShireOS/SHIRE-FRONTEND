import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  Filter,
  Mail,
  X,
} from 'lucide-react'
import { fetchWithSupabaseAuth } from '../../shared/query'
import HomepageWidgets from '../components/HomepageWidgets'
import { normalizeReportingScope, WHOLE_RESTAURANT_SCOPE } from '../components/homepageWidgetMath'
import PortfolioEmailPanel from './PortfolioEmailPanel'

const PERIODS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'full', label: 'Full' },
]

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

export default function OverviewPage() {
  const [period, setPeriod] = useState('week')
  const [tab, setTab] = useState('overview')
  const [selectedGroups, setSelectedGroups] = useState(new Set())
  const [includeUngrouped, setIncludeUngrouped] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [portfolioScope, setPortfolioScope] = useState(null)
  const [reportingScope, setReportingScope] = useState(() => ({ ...WHOLE_RESTAURANT_SCOPE }))
  const [viewHydrated, setViewHydrated] = useState(false)
  const [viewPersistenceReady, setViewPersistenceReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchWithSupabaseAuth('/portfolio-reports/view-preferences')
      .then((payload) => {
        if (cancelled) return
        const saved = payload.settings?.overview
        if (saved) {
          setPeriod(saved.period || 'week')
          setSelectedGroups(new Set(saved.group_ids || []))
          setIncludeUngrouped(Boolean(saved.include_ungrouped))
          setReportingScope(normalizeReportingScope(saved))
        }
        setViewPersistenceReady(true)
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setViewHydrated(true) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!viewHydrated || !viewPersistenceReady) return
    const timeout = window.setTimeout(() => {
      fetchWithSupabaseAuth('/portfolio-reports/view-preferences/overview', {
        method: 'PUT',
        body: JSON.stringify({ settings: { period, group_ids: [...selectedGroups], include_ungrouped: includeUngrouped, ...reportingScope } }),
      }).catch(() => undefined)
    }, 450)
    return () => window.clearTimeout(timeout)
  }, [viewHydrated, viewPersistenceReady, period, selectedGroups, includeUngrouped, reportingScope])
  const groupQuery = [...selectedGroups].sort().join(',')
  const groups = portfolioScope?.groups || []
  const handleScopeLoaded = useCallback((scope) => setPortfolioScope(scope), [])

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
          <p className="mt-2 text-sm text-dash-secondary">{portfolioScope?.restaurant_count || 0} stores in scope</p>
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
        </div>
      </header>

      <div className="flex border-b border-dash-border">
        {[{ id: 'overview', label: 'Overview', icon: null }, { id: 'email', label: 'Email reports', icon: Mail }].map((item) => {
          const Icon = item.icon
          return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${tab === item.id ? 'border-shell-accent text-dash-cream' : 'border-transparent text-dash-tertiary hover:text-dash-secondary'}`}>{Icon && <Icon size={15} />}{item.label}</button>
        })}
      </div>

      {tab === 'email' ? <PortfolioEmailPanel /> : viewHydrated && (
        <HomepageWidgets
          scope="portfolio"
          period={period}
          dashboardScope={reportingScope}
          onDashboardScopeChange={setReportingScope}
          groupIds={groupQuery ? [...selectedGroups] : null}
          includeUngrouped={includeUngrouped}
          onScopeLoaded={handleScopeLoaded}
        />
      )}

      {filterOpen && <FilterModal groups={groups} selected={selectedGroups} includeUngrouped={includeUngrouped} onClose={() => setFilterOpen(false)} onApply={(next, ungrouped) => { setSelectedGroups(next); setIncludeUngrouped(ungrouped); setFilterOpen(false) }} />}
    </div>
  )
}

import { Fragment, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BadgeDollarSign, Download, FileText } from 'lucide-react'
import { fetchCached, fetchWithSupabaseAuth, queryKeys } from '../../shared/query'
import { posTimeClockApi } from '../../shared/api/posClient'
import { useAuth } from '../../auth'
import { useBackOfficeAccess } from '../../shared/hooks/useBackOfficeAccess'
import { normalizeJobCodes } from '@shire/settings'
import IntervalControls from '../components/payroll/IntervalControls'
import { currentBrowsingInterval, intervalLabel } from '../utils/payrollIntervals'
import {
  exportLaborCostCsv,
  exportLaborCostPdf,
  hours,
  makeRateResolver,
  money,
  summarizeLaborCost,
} from '../utils/laborCost'

const VIEWS = [
  { id: 'role', label: 'By role' },
  { id: 'employee', label: 'By employee' },
  { id: 'day', label: 'By day' },
]

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`
}

function StatCard({ label, value, sub, warn }) {
  return (
    <div className="rounded-2xl border border-dash-border bg-dash-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dash-tertiary">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-dash-cream">{value}</p>
      {sub ? <p className={`mt-1 text-xs ${warn ? 'text-amber-200' : 'text-dash-secondary'}`}>{sub}</p> : null}
    </div>
  )
}

function BreakdownTable({ rows, kind }) {
  const [expanded, setExpanded] = useState(() => new Set())
  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!rows.length) {
    return <div className="rounded-2xl border border-dash-border bg-dash-panel p-6 text-sm text-dash-secondary">No labor cost in this interval.</div>
  }

  return (
    <section className="rounded-2xl border border-dash-border bg-dash-panel p-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-dash-border text-right font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">
              <th className="py-2 pr-3 text-left">{kind === 'role' ? 'Role' : kind === 'employee' ? 'Employee' : 'Day'}</th>
              <th className="py-2 pr-3">Hours</th>
              <th className="py-2 pr-3">Wages</th>
              <th className="py-2 pr-3">Tips</th>
              <th className="py-2 pr-3">Total labor</th>
              <th className="py-2 pr-3">Share</th>
              <th className="py-2 text-right">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOpen = expanded.has(row.key)
              return (
                <Fragment key={row.key}>
                  <tr className="border-b border-dash-border/50 text-right text-dash-cream">
                    <td className="py-2.5 pr-3 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{row.label}</span>
                        {row.missingRate ? <AlertTriangle size={13} className="text-amber-300" /> : null}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-dash-secondary">{hours(row.hours)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{money(row.wages)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{money(row.tips)}</td>
                    <td className="py-2.5 pr-3 font-semibold tabular-nums">{money(row.gross)}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-dash-secondary">{pct(row.share)}</td>
                    <td className="py-2.5 text-right">
                      <button type="button" onClick={() => toggle(row.key)} className="rounded-lg border border-dash-border px-2.5 py-1 text-xs text-dash-secondary hover:text-dash-cream">
                        {isOpen ? 'Hide' : 'Open'}
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-b border-dash-border/40 bg-white/[0.02]">
                      <td colSpan={7} className="px-3 py-3">
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {row.children.slice(0, 18).map((child, index) => (
                            <div key={`${row.key}-${index}`} className="rounded-xl border border-dash-border bg-black/15 px-3 py-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-dash-cream">{child.staff_name || child.day}</span>
                                <span className="text-dash-tertiary">{child.day}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-dash-secondary">
                                <span>{hours(child.hours)} hrs</span>
                                <span>{money(child.wages)} wages</span>
                                <span>{money(child.tips)} tips</span>
                                <span className="text-dash-cream">{money(child.gross)} total</span>
                              </div>
                            </div>
                          ))}
                          {row.children.length > 18 ? <p className="text-xs text-dash-tertiary">Showing first 18 detail rows.</p> : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function LaborCostPage({ restaurantId }) {
  const auth = useAuth()
  const access = useBackOfficeAccess(auth, restaurantId)
  const canExport = access.can('payroll.export')
  const [preset, setPreset] = useState('week')
  const [interval, setInterval] = useState(() => currentBrowsingInterval('week'))
  const [view, setView] = useState('role')
  const [jobCodes, setJobCodes] = useState([])
  const [waiters, setWaiters] = useState([])
  const [timeReport, setTimeReport] = useState(null)
  const [payRuns, setPayRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tipsUnavailable, setTipsUnavailable] = useState(false)

  const restaurantName = 'Labor Cost'
  const rateFor = useMemo(() => makeRateResolver(jobCodes, waiters), [jobCodes, waiters])
  const summary = useMemo(() => summarizeLaborCost({ timeReport, payRuns, jobCodes, waiters, rateFor }), [timeReport, payRuns, jobCodes, waiters, rateFor])
  const activeRows = view === 'employee' ? summary.byEmployee : view === 'day' ? summary.byDay : summary.byRole
  const averageHourly = summary.totals.hours > 0 ? summary.totals.gross / summary.totals.hours : 0

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [timeData, jobCodeRows, waiterRows, runRows] = await Promise.all([
          fetchCached(
            queryKeys.timeClockRange(restaurantId, interval.start, interval.end),
            () => posTimeClockApi.rangeReport(restaurantId, interval.start, interval.end),
            60 * 1000,
          ),
          fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes`).catch(() => []),
          fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=true`).catch(() => []),
          fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/runs`).catch((err) => {
            if (err?.status === 404 || /not found|404/i.test(err?.message || '')) return null
            throw err
          }),
        ])
        if (cancelled) return
        const normalizedJobCodes = normalizeJobCodes(jobCodeRows)
        const waiterList = Array.isArray(waiterRows) ? waiterRows : []
        setTimeReport(timeData)
        setJobCodes(normalizedJobCodes)
        setWaiters(waiterList)
        if (runRows == null) {
          setTipsUnavailable(true)
          setPayRuns([])
        } else {
          setTipsUnavailable(false)
          const overlapping = (Array.isArray(runRows) ? runRows : []).filter((run) => {
            if (run.status === 'voided') return false
            const start = String(run.window_start || '').slice(0, 10)
            const end = String(run.window_end || '').slice(0, 10)
            return start <= interval.end && end >= interval.start
          })
          const details = await Promise.all(
            overlapping.map((run) => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/runs/${run.id}`).catch(() => null)),
          )
          if (!cancelled) setPayRuns(details.filter(Boolean))
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load labor cost')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [restaurantId, interval.start, interval.end])

  const updateInterval = ({ preset: nextPreset, interval: nextInterval }) => {
    setPreset(nextPreset)
    setInterval(nextInterval)
  }

  const exportCsv = () => {
    if (canExport) exportLaborCostCsv(summary, interval, restaurantName)
  }
  const exportPdf = () => {
    if (canExport) exportLaborCostPdf(summary, interval, restaurantName)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BadgeDollarSign size={15} className="text-dash-tertiary" />
              <p className="label-mono text-dash-tertiary">Team</p>
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-dash-cream">Labor Cost</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-dash-secondary">
              See where payroll dollars are going by role, employee, and day.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportPdf} disabled={loading || !canExport} className="inline-flex items-center gap-1.5 rounded-lg border border-dash-border px-3 py-1.5 text-sm text-dash-cream hover:border-dash-gold disabled:opacity-50">
              <FileText size={14} /> PDF
            </button>
            <button type="button" onClick={exportCsv} disabled={loading || !canExport} className="inline-flex items-center gap-1.5 rounded-lg border border-dash-border px-3 py-1.5 text-sm text-dash-cream hover:border-dash-gold disabled:opacity-50">
              <Download size={14} /> CSV
            </button>
          </div>
        </div>
        <IntervalControls interval={interval} preset={preset} onChange={updateInterval} className="mt-4" />
      </section>

      {tipsUnavailable ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/[0.08] p-4 text-sm text-amber-100">
          Tip pay-run data is not available from this server yet, so this view is showing wage labor only.
        </div>
      ) : null}
      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

      {loading ? (
        <div className="rounded-2xl border border-dash-border bg-dash-panel p-5 text-sm text-dash-secondary">Loading labor cost...</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total labor" value={money(summary.totals.gross)} sub={intervalLabel(interval)} />
            <StatCard label="Wages" value={money(summary.totals.wages)} sub={`${hours(summary.totals.hours)} hrs clocked`} warn={summary.totals.missingRate} />
            <StatCard label="Tips paid" value={money(summary.totals.tips)} sub={`${payRuns.length} pay runs included`} />
            <StatCard label="Hours" value={hours(summary.totals.hours)} sub="worked hours" />
            <StatCard label="Avg labor / hr" value={money(averageHourly)} sub={summary.totals.missingRate ? 'some rates missing' : 'wages + tips'} warn={summary.totals.missingRate} />
          </div>

          <section className="rounded-2xl border border-dash-border bg-dash-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex overflow-hidden rounded-lg border border-dash-border">
                {VIEWS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setView(item.id)}
                    className={`px-3.5 py-2 text-sm font-medium transition ${
                      view === item.id ? 'bg-dash-gold/15 text-dash-gold' : 'text-dash-secondary hover:text-dash-cream'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {summary.totals.missingRate ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-200">
                  <AlertTriangle size={13} /> Some punches have no saved labor rate.
                </span>
              ) : null}
            </div>
          </section>

          <BreakdownTable rows={activeRows} kind={view} />
        </>
      )}
    </div>
  )
}

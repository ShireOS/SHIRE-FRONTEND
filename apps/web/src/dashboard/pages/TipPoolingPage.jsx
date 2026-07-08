import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchWithSupabaseAuth } from '../../shared/query'
import {
  TipRulesFields,
  PayrollSetupFields,
  defaultTipPayrollSettings,
  normalizeJobCodes,
  normalizeTipPayrollSettings,
  tipPayrollPayload,
} from '../RestaurantSetupPanel'
import { buildPayrollRows, payrollTotals, exportPayrollCsv, exportPayrollPdf } from './payrollExport'

const MODE_LABELS = {
  individual: 'Keep own',
  pooled: 'Pooled (equal)',
  role_based: 'Role points',
  points_based: 'Points',
  hours_based: 'By hours',
  sales_based: 'By sales',
}

const STATUS_STYLES = {
  draft: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  finalized: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  voided: 'border-dash-border bg-dash-panel text-dash-tertiary',
}

const SUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'run', label: 'Pay Run' },
  { id: 'rules', label: 'Tip & Tipout Rules' },
  { id: 'payroll', label: 'Payroll Setup' },
]

function money(value) {
  const num = Number(value ?? 0)
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function windowLabel(run) {
  const start = new Date(run.window_start)
  const end = new Date(run.window_end)
  const sameDay = end.getTime() - start.getTime() <= 26 * 60 * 60 * 1000
  const dateFmt = { month: 'short', day: 'numeric' }
  if (sameDay) return start.toLocaleDateString('en-US', { ...dateFmt, year: 'numeric' })
  return `${start.toLocaleDateString('en-US', dateFmt)} – ${end.toLocaleDateString('en-US', { ...dateFmt, year: 'numeric' })}`
}

function yesterdayISO() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

// A 404 from the tip-pool routes means the backend serving this app doesn't
// expose them yet (older process / migration 0054 not applied).
function isRunsUnprovisioned(err) {
  const msg = err?.message || ''
  return err?.status === 404 || /not found/i.test(msg) || /404/.test(msg)
}

// Classify a role into a labor-cost category using its job code.
function categoryForRole(roleKey, jobCodes) {
  const jc = jobCodes.find(code => code.code === roleKey)
  if (!jc) return 'Other'
  if (jc.permission_tier === 'owner' || jc.permission_tier === 'manager') return 'Management'
  return jc.is_tipped ? 'FOH wages' : 'BOH wages'
}

const CATEGORY_COLORS = {
  'FOH wages': '#d4b878',
  'BOH wages': '#8a7a5a',
  'Management': '#6b6f8a',
  'Other': '#4a4a52',
  'Tips to staff': '#5f7f6b',
}

function StatusChip({ status }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${STATUS_STYLES[status] || STATUS_STYLES.voided}`}>
      {status}
    </span>
  )
}

function PayRunTable({ payouts, rateFor, editable, onAdjust }) {
  if (!payouts?.length) {
    return <p className="text-sm text-dash-secondary">No tips or clocked hours in this window.</p>
  }
  const rows = buildPayrollRows(payouts, rateFor)
  const totals = payrollTotals(rows)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-dash-border text-right font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">
            <th className="py-2 pr-3 text-left">Employee</th>
            <th className="py-2 pr-3">Hours</th>
            <th className="py-2 pr-3">Rate</th>
            <th className="py-2 pr-3">Base wage</th>
            <th className="py-2 pr-3">Tips coll.</th>
            <th className="py-2 pr-3">Pool</th>
            <th className="py-2 pr-3">Tipout −/+</th>
            <th className="py-2 pr-3">Adjust</th>
            <th className="py-2 pr-3">Tips net</th>
            <th className="py-2 text-right">Gross pay</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p, index) => {
            const r = rows[index]
            return (
              <tr key={p.id || `${p.staff_id}-${index}`} className="border-b border-dash-border/50 text-right text-dash-cream">
                <td className="py-2 pr-3 text-left">
                  <div className="font-medium">{r.staff_name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.05em] text-dash-tertiary">{r.role_key}</div>
                </td>
                <td className="py-2 pr-3 text-dash-secondary tabular-nums">{r.hours.toFixed(2)}</td>
                <td className="py-2 pr-3 text-dash-secondary tabular-nums">{money(r.rate)}</td>
                <td className="py-2 pr-3 tabular-nums">{money(r.base_wage)}</td>
                <td className="py-2 pr-3 text-dash-secondary tabular-nums">{money(r.tips_collected)}</td>
                <td className="py-2 pr-3 text-dash-secondary tabular-nums">{money(r.pool_share)}</td>
                <td className="py-2 pr-3 tabular-nums text-dash-secondary">
                  {r.tipout_paid > 0 ? `−${money(r.tipout_paid)} ` : ''}
                  {r.tipout_received > 0 ? `+${money(r.tipout_received)}` : ''}
                  {r.tipout_paid <= 0 && r.tipout_received <= 0 ? '—' : ''}
                </td>
                <td className="py-2 pr-3 text-right">
                  {editable && p.id ? (
                    <button type="button" onClick={() => onAdjust(p)} className="rounded border border-dash-border px-2 py-0.5 text-xs text-dash-secondary hover:text-dash-cream">
                      {r.adjustment !== 0 ? money(r.adjustment) : 'Edit'}
                    </button>
                  ) : (
                    <span className="text-dash-secondary">{r.adjustment !== 0 ? money(r.adjustment) : '—'}</span>
                  )}
                </td>
                <td className="py-2 pr-3 tabular-nums">{money(r.tips_net)}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{money(r.gross_pay)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-dash-border text-right font-semibold text-dash-cream">
            <td className="py-2.5 pr-3 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-dash-secondary">Totals · {rows.length} staff</td>
            <td className="py-2.5 pr-3 tabular-nums">{totals.hours.toFixed(2)}</td>
            <td className="py-2.5 pr-3" />
            <td className="py-2.5 pr-3 tabular-nums">{money(totals.base_wage)}</td>
            <td className="py-2.5 pr-3 tabular-nums">{money(totals.tips_collected)}</td>
            <td className="py-2.5 pr-3 tabular-nums">{money(totals.pool_share)}</td>
            <td className="py-2.5 pr-3" />
            <td className="py-2.5 pr-3" />
            <td className="py-2.5 pr-3 tabular-nums">{money(totals.tips_net)}</td>
            <td className="py-2.5 text-right tabular-nums">{money(totals.gross_pay)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function ExportMenu({ disabled, onExport }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])
  const choose = (variant) => { setOpen(false); onExport(variant) }
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        disabled={disabled}
        className="rounded-lg border border-dash-gold bg-dash-gold/10 px-3 py-1.5 text-sm font-medium text-dash-gold hover:bg-dash-gold/20 disabled:opacity-40"
      >
        Export payroll ▾
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-64 rounded-xl border border-dash-border bg-dash-panel p-1.5 shadow-xl">
          {[
            ['csv', 'CSV', 'For Gusto / ADP import'],
            ['summary', 'PDF summary', 'One-page totals sheet'],
            ['stubs', 'PDF pay stubs', 'One printable page per employee'],
          ].map(([variant, label, hint]) => (
            <button key={variant} type="button" onClick={() => choose(variant)} className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-dash-gold/10">
              <span className="text-sm font-medium text-dash-cream">{label}</span>
              <span className="text-[11px] text-dash-tertiary">{hint}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function BackendNotice() {
  return (
    <div className="rounded-2xl border border-amber-400/40 bg-amber-400/[0.06] p-5 text-sm text-amber-100/90">
      <p className="font-semibold text-amber-200">Pay runs aren’t available on this server yet</p>
      <p className="mt-2 max-w-2xl leading-relaxed text-amber-100/80">
        The tip &amp; tipout <span className="font-medium">rules</span> save fine, but the backend serving this app doesn’t expose the
        pay-run endpoints. Restart the API with the current code and apply migration <span className="font-mono">0054_tip_pool_runs</span>,
        then reload — Overview and Pay Run will populate automatically.
      </p>
    </div>
  )
}

function StatCard({ label, value, sub, muted }) {
  return (
    <div className="rounded-2xl border border-dash-border bg-dash-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dash-tertiary">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${muted ? 'text-dash-secondary' : 'text-dash-cream'}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-dash-secondary">{sub}</p> : null}
    </div>
  )
}

export default function TipPoolingPage({ restaurantId }) {
  const [activeSubTab, setActiveSubTab] = useState('overview')
  const [runs, setRuns] = useState([])
  const [selectedRun, setSelectedRun] = useState(null)
  const [preview, setPreview] = useState(null)
  const [businessDate, setBusinessDate] = useState(yesterdayISO())
  const [jobCodes, setJobCodes] = useState([])
  const [tipPayrollSettings, setTipPayrollSettings] = useState(defaultTipPayrollSettings())
  const [overview, setOverview] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [configLoading, setConfigLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [configMessage, setConfigMessage] = useState('')
  const [configError, setConfigError] = useState('')
  // True when the tip-pool run endpoints 404 — the backend serving this app
  // predates the pay-run routes (needs a restart + migration 0054). Config still
  // works, so we show a clear notice instead of a scary error.
  const [runsUnavailable, setRunsUnavailable] = useState(false)

  const restaurantName = 'Payroll'
  const rateFor = useMemo(() => {
    const map = new Map(jobCodes.map(code => [code.code, Number(code.default_hourly_rate) || 0]))
    return (roleKey) => map.get(roleKey) || 0
  }, [jobCodes])

  const loadRuns = async () => {
    setError('')
    try {
      const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/runs`)
      setRuns(Array.isArray(data) ? data : [])
      setRunsUnavailable(false)
      return Array.isArray(data) ? data : []
    } catch (err) {
      // A 404 means the pay-run routes aren't served by this backend yet — show a
      // clear "not deployed" notice rather than a red error. Config still works.
      if (isRunsUnprovisioned(err)) {
        setRuns([])
        setRunsUnavailable(true)
      } else {
        setError(err?.message || 'Could not load tipout runs')
      }
      return []
    } finally {
      setLoading(false)
    }
  }

  const loadTipConfig = async () => {
    setConfigError('')
    setConfigMessage('')
    try {
      const [jobCodeRows, tipPayrollData] = await Promise.all([
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes`).catch(() => []),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tips-payroll-settings`).catch(() => null),
      ])
      const normalizedJobCodes = normalizeJobCodes(jobCodeRows)
      setJobCodes(normalizedJobCodes)
      setTipPayrollSettings(normalizeTipPayrollSettings(tipPayrollData, normalizedJobCodes))
    } catch (err) {
      setConfigError(err?.message || 'Could not load tipout configuration')
    } finally {
      setConfigLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    setConfigLoading(true)
    setSelectedRun(null)
    setPreview(null)
    setOverview(null)
    void loadRuns()
    void loadTipConfig()
  }, [restaurantId])

  // Build the weekly labor-cost aggregate by fetching detail for recent runs.
  const loadOverview = async (runList, codes) => {
    const recent = (runList || []).filter(r => r.status !== 'voided').slice(0, 7)
    if (!recent.length) { setOverview({ empty: true }); return }
    setOverviewLoading(true)
    try {
      const details = await Promise.all(
        recent.map(r => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/runs/${r.id}`).catch(() => null)),
      )
      const rateMap = new Map(codes.map(c => [c.code, Number(c.default_hourly_rate) || 0]))
      const byCategory = {}
      const staff = new Set()
      let wages = 0, tips = 0, hours = 0
      details.filter(Boolean).forEach(run => {
        (run.payouts || []).forEach(p => {
          const h = Number(p.hours_worked ?? 0)
          const wage = h * (rateMap.get(p.role_key) || 0)
          const tipNet = Number(p.final_amount ?? 0)
          const cat = categoryForRole(p.role_key, codes)
          byCategory[cat] = (byCategory[cat] || 0) + wage
          wages += wage
          tips += tipNet
          hours += h
          if (p.staff_id) staff.add(p.staff_id)
        })
      })
      byCategory['Tips to staff'] = tips
      setOverview({
        wages, tips, hours,
        staff: staff.size,
        runs: details.filter(Boolean).length,
        categories: Object.entries(byCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]),
        windowText: recent.length > 1 ? `${windowLabel(recent[recent.length - 1])} – ${windowLabel(recent[0])}` : windowLabel(recent[0]),
      })
    } finally {
      setOverviewLoading(false)
    }
  }

  useEffect(() => {
    if (activeSubTab === 'overview' && !overview && !overviewLoading && !loading && !configLoading) {
      void loadOverview(runs, jobCodes)
    }
  }, [activeSubTab, overview, overviewLoading, loading, configLoading, runs, jobCodes])

  const updateTipPayrollSettings = (patch) => {
    setTipPayrollSettings(prev => ({ ...prev, ...patch }))
    setConfigMessage('')
  }

  const updateTipRoleRule = (index, patch) => {
    setTipPayrollSettings(prev => ({
      ...prev,
      role_tip_rules: prev.role_tip_rules.map((rule, currentIndex) => currentIndex === index ? { ...rule, ...patch } : rule),
    }))
    setConfigMessage('')
  }

  const saveTipConfig = async () => {
    setConfigSaving(true)
    setConfigMessage('')
    setConfigError('')
    try {
      const saved = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tips-payroll-settings`, {
        method: 'PUT',
        body: JSON.stringify(tipPayrollPayload(tipPayrollSettings, jobCodes)),
      })
      setTipPayrollSettings(normalizeTipPayrollSettings(saved, jobCodes))
      setConfigMessage('Saved configuration')
      const list = await loadRuns()
      setOverview(null) // recompute next time Overview is opened
      void list
    } catch (err) {
      setConfigError(err?.message || 'Could not save configuration')
    } finally {
      setConfigSaving(false)
    }
  }

  const openRun = async (runId) => {
    setError('')
    setPreview(null)
    try {
      const run = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/runs/${runId}`)
      setSelectedRun(run)
    } catch (err) {
      setError(err?.message || 'Could not load run detail')
    }
  }

  const previewWindow = async () => {
    setWorking(true)
    setMessage('')
    setError('')
    setSelectedRun(null)
    try {
      const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/preview?business_date=${businessDate}`)
      setPreview(data)
      setRunsUnavailable(false)
    } catch (err) {
      if (isRunsUnprovisioned(err)) setRunsUnavailable(true)
      else setError(err?.message || 'Could not compute preview')
    } finally {
      setWorking(false)
    }
  }

  const createRun = async () => {
    setWorking(true)
    setMessage('')
    setError('')
    try {
      const run = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/runs`, {
        method: 'POST',
        body: JSON.stringify({ business_date: businessDate }),
      })
      setPreview(null)
      setSelectedRun(run)
      setMessage('Draft run created')
      setRunsUnavailable(false)
      await loadRuns()
      setOverview(null)
    } catch (err) {
      if (isRunsUnprovisioned(err)) setRunsUnavailable(true)
      else setError(err?.message || 'Could not create run')
    } finally {
      setWorking(false)
    }
  }

  const adjustPayout = async (payout) => {
    const raw = window.prompt(`Adjustment for ${payout.staff_name || 'staff'} (positive or negative dollars):`, String(payout.adjustment ?? '0'))
    if (raw == null) return
    const amount = Number(raw)
    if (!Number.isFinite(amount)) { setError('Adjustment must be a number'); return }
    const reason = window.prompt('Reason for adjustment (optional):', payout.adjustment_reason || '') || null
    setWorking(true)
    setMessage('')
    setError('')
    try {
      await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/payouts/${payout.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ adjustment: amount, reason }),
      })
      await openRun(selectedRun.id)
      setMessage('Adjustment saved')
    } catch (err) {
      setError(err?.message || 'Could not save adjustment')
    } finally {
      setWorking(false)
    }
  }

  const setRunStatus = async (runId, action) => {
    if (action === 'finalize' && !window.confirm('Finalize this run? Payouts lock after finalizing.')) return
    if (action === 'void' && !window.confirm('Void this run? The scheduler or a manual run can recreate the window.')) return
    setWorking(true)
    setMessage('')
    setError('')
    try {
      const run = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/runs/${runId}/${action}`, { method: 'POST' })
      setSelectedRun(run)
      setMessage(action === 'finalize' ? 'Run finalized' : 'Run voided')
      await loadRuns()
      setOverview(null)
    } catch (err) {
      setError(err?.message || `Could not ${action} run`)
    } finally {
      setWorking(false)
    }
  }

  const activePayouts = selectedRun?.payouts || preview?.payouts || null
  const activeRun = selectedRun || (preview ? { window_start: `${businessDate}T00:00:00`, window_end: `${businessDate}T23:59:59`, status: 'preview' } : null)

  const handleExport = (variant) => {
    if (!activePayouts?.length) {
      setActiveSubTab('run')
      setError('Open or preview a run first, then export.')
      return
    }
    const rows = buildPayrollRows(activePayouts, rateFor)
    if (variant === 'csv') exportPayrollCsv(activeRun, rows, restaurantName)
    else exportPayrollPdf(activeRun, rows, restaurantName, variant)
  }

  const saveDisabled = configSaving || configLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-mono text-dash-tertiary">Payroll &amp; Tips</p>
            <h1 className="mt-1 text-2xl font-semibold text-dash-cream">Payroll &amp; Tips</h1>
            <p className="mt-2 max-w-2xl text-sm text-dash-secondary">
              Everything that decides what a person gets paid — labor cost, the pay run you export, and the tip rules that drive it.
            </p>
          </div>
          <ExportMenu disabled={false} onExport={handleExport} />
        </div>

        {/* Subtabs */}
        <div className="mt-5 flex flex-wrap gap-1 border-b border-dash-border">
          {SUB_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`-mb-px border-b-2 px-3.5 py-2 text-sm transition ${
                activeSubTab === tab.id ? 'border-dash-gold text-dash-gold' : 'border-transparent text-dash-secondary hover:text-dash-cream'
              }`}
            >
              {tab.label}
              {tab.id === 'run' && runs.length ? <span className="ml-2 rounded-full border border-dash-border px-1.5 text-[10px] text-dash-tertiary">{runs.length}</span> : null}
            </button>
          ))}
        </div>
      </section>

      {/* ---------- OVERVIEW ---------- */}
      {activeSubTab === 'overview' ? (
        <div className="space-y-4">
          {runsUnavailable ? (
            <BackendNotice />
          ) : loading ? (
            <div className="rounded-xl border border-dash-border bg-dash-panel p-4 text-sm text-dash-secondary">Computing labor cost…</div>
          ) : !runs.length ? (
            <div className="rounded-xl border border-dash-border bg-dash-panel p-6 text-sm text-dash-secondary">
              No runs yet. Create one in <button type="button" className="text-dash-gold underline" onClick={() => setActiveSubTab('run')}>Pay Run</button> and the labor-cost breakdown appears here.
            </div>
          ) : (overviewLoading || !overview) ? (
            <div className="rounded-xl border border-dash-border bg-dash-panel p-4 text-sm text-dash-secondary">Computing labor cost…</div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total paid to staff" value={money(overview.wages + overview.tips)} sub={overview.windowText} />
                <StatCard label="Wages" value={money(overview.wages)} sub={`${overview.hours.toFixed(1)} hrs clocked`} />
                <StatCard label="Tips to staff" value={money(overview.tips)} sub={`${overview.staff} staff paid`} />
                <StatCard label="Runs included" value={String(overview.runs)} sub="most recent windows" muted />
              </div>
              <div className="rounded-2xl border border-dash-border bg-dash-panel p-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-base font-semibold text-dash-cream">Where the money went</h2>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-dash-tertiary">by category</span>
                </div>
                {(() => {
                  const total = overview.categories.reduce((s, [, v]) => s + v, 0) || 1
                  return (
                    <>
                      <div className="mb-4 flex h-3.5 overflow-hidden rounded-full border border-dash-border">
                        {overview.categories.map(([cat, val]) => (
                          <span key={cat} style={{ width: `${(val / total) * 100}%`, background: CATEGORY_COLORS[cat] || '#4a4a52' }} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-dash-secondary">
                        {overview.categories.map(([cat, val]) => (
                          <span key={cat} className="inline-flex items-center gap-2">
                            <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: CATEGORY_COLORS[cat] || '#4a4a52' }} />
                            {cat} <b className="tabular-nums text-dash-cream">{money(val)}</b>
                          </span>
                        ))}
                      </div>
                    </>
                  )
                })()}
                <p className="mt-4 text-xs text-dash-tertiary">
                  Wages estimated from clocked hours × role rate (set on <span className="text-dash-secondary">Team</span>). Tips are actual distributed amounts. A scheduling-based forecast will surface here from the Scheduling page.
                </p>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* ---------- PAY RUN ---------- */}
      {activeSubTab === 'run' ? (
        <div className="space-y-4">
          {runsUnavailable ? <BackendNotice /> : null}
          {error && !runsUnavailable ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
          {message ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div> : null}
          <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-mono text-dash-tertiary">Compute a run</p>
                <p className="mt-1 text-sm text-dash-secondary">Preview a day’s distribution, then save it as a draft to review and export.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} className="rounded-lg border border-dash-border bg-transparent px-3 py-1.5 text-sm text-dash-cream" />
                <button type="button" onClick={previewWindow} disabled={working || !businessDate} className="rounded-lg border border-dash-border px-3 py-1.5 text-sm text-dash-cream hover:border-dash-gold disabled:opacity-50">Preview</button>
                <button type="button" onClick={createRun} disabled={working || !businessDate} className="rounded-lg border border-dash-gold bg-dash-gold/10 px-3 py-1.5 text-sm font-medium text-dash-gold hover:bg-dash-gold/20 disabled:opacity-50">Run for date</button>
              </div>
            </div>
          </section>

          {loading ? <div className="rounded-xl border border-dash-border bg-dash-panel p-4 text-sm text-dash-secondary">Loading runs…</div> : null}

          {!loading && !runsUnavailable && !runs.length && !preview ? (
            <div className="rounded-xl border border-dash-border bg-dash-panel p-4 text-sm text-dash-secondary">
              No runs yet. Enable pooling in <button type="button" className="text-dash-gold underline" onClick={() => setActiveSubTab('rules')}>Tip &amp; Tipout Rules</button>, and runs appear automatically each day — or use “Run for date”.
            </div>
          ) : null}

          {runs.length ? (
            <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
              <p className="label-mono mb-3 text-dash-tertiary">Runs</p>
              <div className="space-y-2">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => openRun(run.id)}
                    className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition ${
                      selectedRun?.id === run.id ? 'border-dash-gold bg-dash-gold/5' : 'border-dash-border hover:border-dash-gold/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-dash-cream">{windowLabel(run)}</span>
                      <StatusChip status={run.status} />
                      {run.auto_generated ? <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">auto</span> : null}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-dash-secondary">
                      <span>{MODE_LABELS[run.distribution_mode] || run.distribution_mode}</span>
                      <span>{run.payout_count ?? 0} staff</span>
                      <span className="font-semibold text-dash-cream">{money(run.total_tips)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {preview ? (
            <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="label-mono text-dash-tertiary">
                  Preview · {MODE_LABELS[preview.mode] || preview.mode} · {money(preview.totals?.total_tips)} tips
                  {Number(preview.totals?.total_card_fees_withheld) > 0 ? ` · ${money(preview.totals.total_card_fees_withheld)} card fees withheld` : ''}
                </p>
                <span className="text-xs text-dash-tertiary">Not saved — use “Run for date” to create a draft.</span>
              </div>
              <PayRunTable payouts={preview.payouts} rateFor={rateFor} editable={false} />
            </section>
          ) : null}

          {selectedRun ? (
            <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-dash-cream">{windowLabel(selectedRun)}</p>
                  <StatusChip status={selectedRun.status} />
                  <span className="text-sm text-dash-secondary">{MODE_LABELS[selectedRun.distribution_mode] || selectedRun.distribution_mode} · pooled {money(selectedRun.total_pooled)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ExportMenu disabled={!selectedRun.payouts?.length} onExport={handleExport} />
                  {selectedRun.status === 'draft' ? (
                    <>
                      <button type="button" onClick={() => setRunStatus(selectedRun.id, 'void')} disabled={working} className="rounded-lg border border-dash-border px-3 py-1.5 text-sm text-dash-secondary hover:text-red-300 disabled:opacity-50">Void</button>
                      <button type="button" onClick={() => setRunStatus(selectedRun.id, 'finalize')} disabled={working} className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50">Finalize</button>
                    </>
                  ) : null}
                </div>
              </div>
              <PayRunTable payouts={selectedRun.payouts} rateFor={rateFor} editable={selectedRun.status === 'draft'} onAdjust={adjustPayout} />
            </section>
          ) : null}
        </div>
      ) : null}

      {/* ---------- RULES ---------- */}
      {activeSubTab === 'rules' ? (
        <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label-mono text-dash-tertiary">Configuration</p>
              <h2 className="mt-1 text-xl font-semibold text-dash-cream">Tip &amp; Tipout Rules</h2>
              <p className="mt-2 max-w-2xl text-sm text-dash-secondary">How tips are split, role-to-role tipouts, and per-role eligibility. Applies to future runs.</p>
            </div>
            <button type="button" onClick={() => void saveTipConfig()} disabled={saveDisabled} className="rounded-lg border border-dash-gold bg-dash-gold/10 px-3 py-1.5 text-sm font-medium text-dash-gold hover:bg-dash-gold/20 disabled:opacity-50">{configSaving ? 'Saving…' : 'Save rules'}</button>
          </div>
          {configLoading ? (
            <div className="rounded-xl border border-dash-border bg-white/[0.025] p-4 text-sm text-dash-secondary">Loading configuration…</div>
          ) : (
            <TipRulesFields settings={tipPayrollSettings} jobCodes={jobCodes} onUpdateSettings={updateTipPayrollSettings} onUpdateRoleRule={updateTipRoleRule} />
          )}
          {configError ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{configError}</div> : null}
          {configMessage ? <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{configMessage}</div> : null}
        </section>
      ) : null}

      {/* ---------- PAYROLL SETUP ---------- */}
      {activeSubTab === 'payroll' ? (
        <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label-mono text-dash-tertiary">Configuration</p>
              <h2 className="mt-1 text-xl font-semibold text-dash-cream">Payroll Setup</h2>
              <p className="mt-2 max-w-2xl text-sm text-dash-secondary">Provider, export cadence, cash &amp; credit tip handling, and card-fee defaults.</p>
            </div>
            <button type="button" onClick={() => void saveTipConfig()} disabled={saveDisabled} className="rounded-lg border border-dash-gold bg-dash-gold/10 px-3 py-1.5 text-sm font-medium text-dash-gold hover:bg-dash-gold/20 disabled:opacity-50">{configSaving ? 'Saving…' : 'Save payroll setup'}</button>
          </div>
          {configLoading ? (
            <div className="rounded-xl border border-dash-border bg-white/[0.025] p-4 text-sm text-dash-secondary">Loading configuration…</div>
          ) : (
            <PayrollSetupFields settings={tipPayrollSettings} onUpdateSettings={updateTipPayrollSettings} />
          )}
          {configError ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{configError}</div> : null}
          {configMessage ? <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{configMessage}</div> : null}
        </section>
      ) : null}
    </div>
  )
}

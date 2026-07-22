import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchWithSupabaseAuth } from '../../shared/query'
import { useAuth } from '../../auth'
import { useBackOfficeAccess } from '../../shared/hooks/useBackOfficeAccess'
import {
  PayrollSetupFields,
  defaultTipPayrollSettings,
  normalizeJobCodes,
  normalizeTipPayrollSettings,
  tipPayrollPayload,
} from '../RestaurantSetupPanel'
import EmailPayrollModal from '../components/payroll/EmailPayrollModal'
import IntervalControls from '../components/payroll/IntervalControls'
import TipRulesEditor from '../components/payroll/TipRulesEditor'
import { buildPayrollRows, payrollTotals, exportPayrollCsv, exportPayrollPdf } from './payrollExport'
import { closedPayrollInterval, intervalDays, intervalLabel, isSingleDay, isoWindow } from '../utils/payrollIntervals'

const MODE_LABELS = {
  individual: 'Keep own',
  pooled: 'Pooled (equal)',
  role_based: 'Role points',
  points_based: 'Points',
  hours_based: 'By hours',
  sales_based: 'By sales',
  role_shares: 'Role shares',
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

function intervalFromPayPeriodCalendar(calendar, fallbackFrequency = 'biweekly') {
  const key = calendar?.default_period === 'current_open' ? 'current_open' : 'last_completed'
  const period = calendar?.available ? calendar?.periods?.[key] : null
  if (!period?.start_date || !period?.end_date) return closedPayrollInterval(fallbackFrequency)
  return { start: period.start_date, end: period.end_date, preset: 'pay_period', period_id: period.id }
}

function yesterdayISO() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function isRangeUnsupported(err) {
  return err?.status === 400 || err?.status === 422 || /window_start|window_end|business_date|validation/i.test(err?.message || '')
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

function numericRate(value) {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function mergePreviewPayouts(previews, interval) {
  const byPerson = new Map()
  const totals = {}
  previews.filter(Boolean).forEach((preview) => {
    Object.entries(preview.totals || {}).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + Number(value || 0)
    })
    ;(preview.payouts || []).forEach((payout) => {
      const key = `${payout.staff_id || payout.staff_name || 'staff'}:${payout.role_key || ''}`
      const row = byPerson.get(key) || {
        ...payout,
        id: null,
        hours_worked: 0,
        tips_collected: 0,
        pool_share: 0,
        tipout_paid: 0,
        tipout_received: 0,
        adjustment: 0,
        final_amount: 0,
        sales_total: 0,
      }
      ;['hours_worked', 'tips_collected', 'pool_share', 'tipout_paid', 'tipout_received', 'adjustment', 'final_amount', 'sales_total'].forEach((field) => {
        row[field] = Number(row[field] || 0) + Number(payout[field] || 0)
      })
      byPerson.set(key, row)
    })
  })
  return {
    mode: previews.find(Boolean)?.mode || 'individual',
    distribution_mode: previews.find(Boolean)?.distribution_mode || previews.find(Boolean)?.mode || 'individual',
    totals,
    payouts: [...byPerson.values()],
    window_start: `${interval.start}T00:00:00`,
    window_end: `${interval.end}T23:59:59`,
    range_fallback: true,
  }
}

async function fetchPreviewForInterval(restaurantId, interval) {
  if (isSingleDay(interval)) {
    return fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/preview?business_date=${interval.start}`)
  }
  try {
    return await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/preview?window_start=${interval.start}&window_end=${interval.end}`)
  } catch (err) {
    if (!isRangeUnsupported(err)) throw err
    const days = intervalDays(interval)
    const previews = await Promise.all(
      days.map((day) => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/preview?business_date=${day}`).catch(() => null)),
    )
    const successful = previews.filter(Boolean)
    if (!successful.length) throw err
    return mergePreviewPayouts(successful, interval)
  }
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
                  {Array.isArray(p.tipout_breakdown) && p.tipout_breakdown.length ? (
                    <details className="mt-1 text-left text-[10px] font-normal text-dash-tertiary">
                      <summary className="cursor-pointer text-dash-gold">breakdown</summary>
                      {p.tipout_breakdown.map((entry, breakdownIndex) => (
                        <div key={`${entry.scope_type}-${entry.scope_id}-${entry.target_role}-${breakdownIndex}`} className="mt-0.5 whitespace-nowrap">
                          {entry.scope_name || 'Restaurant default'} → {entry.target_role}: −{money(entry.amount)}
                        </div>
                      ))}
                    </details>
                  ) : null}
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
  const auth = useAuth()
  const access = useBackOfficeAccess(auth, restaurantId)
  const canRunPayroll = access.can('payroll.run')
  const canExportPayroll = access.can('payroll.export')
  const canAdjustTips = access.can('payroll.adjust_tips')
  // The active section travels in the URL hash (#overview/#run/#rules/#payroll)
  // so the sidebar's Payroll & Tips sub-nav and this page stay in sync.
  const location = useLocation()
  const navigate = useNavigate()
  const hashId = (location.hash || '').replace('#', '')
  const activeSubTab = SUB_TABS.some(tab => tab.id === hashId) ? hashId : 'overview'
  const setActiveSubTab = (id) => navigate(`#${id}`)
  const [runs, setRuns] = useState([])
  const [selectedRun, setSelectedRun] = useState(null)
  const [preview, setPreview] = useState(null)
  const [runPreset, setRunPreset] = useState('pay_period')
  const [runInterval, setRunInterval] = useState(() => closedPayrollInterval('biweekly'))
  const [jobCodes, setJobCodes] = useState([])
  const [waiters, setWaiters] = useState([])
  const [menuCategories, setMenuCategories] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [tipPayrollSettings, setTipPayrollSettings] = useState(defaultTipPayrollSettings())
  const [payPeriodCalendar, setPayPeriodCalendar] = useState(null)
  const [closeoutRecipients, setCloseoutRecipients] = useState([])
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
  const [emailOpen, setEmailOpen] = useState(false)
  // True when the tip-pool run endpoints 404 — the backend serving this app
  // predates the pay-run routes (needs a restart + migration 0054). Config still
  // works, so we show a clear notice instead of a scary error.
  const [runsUnavailable, setRunsUnavailable] = useState(false)

  const restaurantName = 'Payroll'
  const defaultEmailRecipients = useMemo(() => (
    [...new Set([auth.user?.email, ...closeoutRecipients].filter(Boolean))]
  ), [auth.user?.email, closeoutRecipients])
  const rateFor = useMemo(() => {
    const roleRates = new Map(jobCodes.map(code => [code.code, numericRate(code.default_hourly_rate) ?? 0]))
    const jobCodeRates = new Map(jobCodes.filter(code => code.id).map(code => [code.id, numericRate(code.default_hourly_rate) ?? 0]))
    const waitersById = new Map((waiters || []).filter(waiter => waiter?.id).map(waiter => [waiter.id, waiter]))
    return (payoutOrRole) => {
      if (payoutOrRole && typeof payoutOrRole === 'object') {
        const directRate = [payoutOrRole.hourly_rate, payoutOrRole.pay_rate, payoutOrRole.base_hourly_rate]
          .map(numericRate)
          .find(rate => rate != null)
        if (directRate != null) return directRate
        const waiter = waitersById.get(payoutOrRole.staff_id)
        const waiterRate = numericRate(waiter?.hourly_rate)
        if (waiterRate != null) return waiterRate
        if (waiter?.job_code_id && jobCodeRates.has(waiter.job_code_id)) return jobCodeRates.get(waiter.job_code_id) || 0
        return roleRates.get(payoutOrRole.role_key) || 0
      }
      return roleRates.get(payoutOrRole) || 0
    }
  }, [jobCodes, waiters])

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
      const [jobCodeRows, tipPayrollData, waiterRows, menuCategoryData, menuItemData, closeoutSettings, resolvedPeriods] = await Promise.all([
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes`).catch(() => []),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tips-payroll-settings`).catch(() => null),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=true`).catch(() => []),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/categories`).catch(() => null),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/items`).catch(() => null),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/closeout-settings`).catch(() => null),
        fetchWithSupabaseAuth(`/restaurants/${restaurantId}/pay-periods`).catch(() => null),
      ])
      const normalizedJobCodes = normalizeJobCodes(jobCodeRows)
      const normalizedTipPayroll = normalizeTipPayrollSettings(tipPayrollData, normalizedJobCodes)
      setJobCodes(normalizedJobCodes)
      setWaiters(Array.isArray(waiterRows) ? waiterRows : [])
      setMenuCategories(Array.isArray(menuCategoryData?.categories) ? menuCategoryData.categories.filter(c => c?.is_active !== false) : [])
      setMenuItems(Array.isArray(menuItemData?.items) ? menuItemData.items.filter(item => item?.is_active !== false) : Array.isArray(menuItemData) ? menuItemData.filter(item => item?.is_active !== false) : [])
      setTipPayrollSettings(normalizedTipPayroll)
      setPayPeriodCalendar(resolvedPeriods)
      setRunPreset('pay_period')
      setRunInterval(intervalFromPayPeriodCalendar(resolvedPeriods, normalizedTipPayroll.payroll_export_frequency))
      setCloseoutRecipients(Array.isArray(closeoutSettings?.eod_report_recipients) ? closeoutSettings.eod_report_recipients.map(String).filter(Boolean) : [])
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
    setWaiters([])
    setMenuItems([])
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
      const byCategory = {}
      const staff = new Set()
      let wages = 0, tips = 0, hours = 0
      details.filter(Boolean).forEach(run => {
        (run.payouts || []).forEach(p => {
          const h = Number(p.hours_worked ?? 0)
          const wage = h * rateFor(p)
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
  }, [activeSubTab, overview, overviewLoading, loading, configLoading, runs, jobCodes, rateFor])

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

  // Per-person overrides (Exceptions): PATCH the waiter row, then refresh the
  // list so the editor reflects the saved values. Saved immediately — these
  // live on `waiters`, not in the rules payload.
  const saveWaiterOverride = async (waiterId, patch) => {
    try {
      await fetchWithSupabaseAuth(`/waiters/${waiterId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      const waiterRows = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=true`).catch(() => null)
      if (Array.isArray(waiterRows)) setWaiters(waiterRows)
    } catch (err) {
      setConfigError(err?.message || 'Could not save the exception')
    }
  }

  const fetchRealPreview = () =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/preview?business_date=${yesterdayISO()}`)

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
      const resolvedPeriods = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/pay-periods`).catch(() => null)
      setPayPeriodCalendar(resolvedPeriods)
      if (resolvedPeriods?.available) {
        setRunPreset('pay_period')
        setRunInterval(intervalFromPayPeriodCalendar(resolvedPeriods, saved.payroll_export_frequency))
      }
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
      const data = await fetchPreviewForInterval(restaurantId, runInterval)
      setPreview(data)
      if (data.range_fallback) setMessage('Preview combined daily tip runs for this interval. Draft creation still needs range support on the API.')
      setRunsUnavailable(false)
    } catch (err) {
      if (isRunsUnprovisioned(err)) setRunsUnavailable(true)
      else setError(err?.message || 'Could not compute preview')
    } finally {
      setWorking(false)
    }
  }

  const createRun = async () => {
    if (!canRunPayroll) {
      setError('You need payroll.run permission to create a draft run.')
      return
    }
    setWorking(true)
    setMessage('')
    setError('')
    try {
      const body = isSingleDay(runInterval)
        ? { business_date: runInterval.start }
        : isoWindow(runInterval)
      const run = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/runs`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setPreview(null)
      setSelectedRun(run)
      setMessage('Draft run created')
      setRunsUnavailable(false)
      await loadRuns()
      setOverview(null)
    } catch (err) {
      if (isRunsUnprovisioned(err)) setRunsUnavailable(true)
      else if (!isSingleDay(runInterval) && isRangeUnsupported(err)) setError('This API can preview the interval, but range draft creation is not deployed yet. Use a one-day run or deploy the window_start/window_end endpoint.')
      else setError(err?.message || 'Could not create run')
    } finally {
      setWorking(false)
    }
  }

  const adjustPayout = async (payout) => {
    if (!canAdjustTips) {
      setError('You need payroll.adjust_tips permission to edit payouts.')
      return
    }
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
    if (!canRunPayroll) {
      setError('You need payroll.run permission to change a run status.')
      return
    }
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
  const activeRun = selectedRun || (preview ? { ...isoWindow(runInterval), status: 'preview' } : null)

  const handleExport = (variant) => {
    if (!canExportPayroll) {
      setError('You need payroll.export permission to export payroll.')
      return
    }
    if (!activePayouts?.length) {
      setActiveSubTab('run')
      setError('Open or preview a run first, then export.')
      return
    }
    const rows = buildPayrollRows(activePayouts, rateFor)
    if (variant === 'csv') exportPayrollCsv(activeRun, rows, restaurantName)
    else exportPayrollPdf(activeRun, rows, restaurantName, variant)
  }

  const handleEmail = () => {
    if (!canExportPayroll) {
      setError('You need payroll.export permission to email payroll.')
      return
    }
    if (!activePayouts?.length) {
      setActiveSubTab('run')
      setError('Open or preview a run first, then email payroll.')
      return
    }
    setEmailOpen(true)
  }

  const updateRunInterval = ({ preset, interval }) => {
    setRunPreset(preset)
    setRunInterval(interval)
    setPreview(null)
    setSelectedRun(null)
    setMessage('')
    setError('')
  }

  const saveDisabled = configSaving || configLoading || !canAdjustTips

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-mono text-dash-tertiary">Payroll &amp; Tips</p>
            <h1 className="mt-1 text-2xl font-semibold text-dash-cream">{SUB_TABS.find(tab => tab.id === activeSubTab)?.label || 'Payroll & Tips'}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleEmail} disabled={!canExportPayroll || !activePayouts?.length} className="rounded-lg border border-dash-border px-3 py-1.5 text-sm font-medium text-dash-cream hover:border-dash-gold disabled:opacity-40">
              Email payroll
            </button>
            <ExportMenu disabled={!canExportPayroll || !activePayouts?.length} onExport={handleExport} />
          </div>
        </div>
        {/* Section navigation lives in the left sidebar (Payroll & Tips sub-items). */}
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
                <p className="mt-1 text-sm text-dash-secondary">Preview a pay period, then save it as a draft to review, finalize, export, or email.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={previewWindow} disabled={working || !runInterval.start || !runInterval.end} className="rounded-lg border border-dash-border px-3 py-1.5 text-sm text-dash-cream hover:border-dash-gold disabled:opacity-50">Preview period</button>
                <button type="button" onClick={createRun} disabled={!canRunPayroll || working || !runInterval.start || !runInterval.end} className="rounded-lg border border-dash-gold bg-dash-gold/10 px-3 py-1.5 text-sm font-medium text-dash-gold hover:bg-dash-gold/20 disabled:opacity-50">Create draft</button>
              </div>
            </div>
            <IntervalControls interval={runInterval} preset={runPreset} payrollFrequency={tipPayrollSettings.payroll_export_frequency} payPeriodCalendar={payPeriodCalendar} onChange={updateRunInterval} className="mt-4" />
          </section>

          {loading ? <div className="rounded-xl border border-dash-border bg-dash-panel p-4 text-sm text-dash-secondary">Loading runs…</div> : null}

          {!loading && !runsUnavailable && !runs.length && !preview ? (
            <div className="rounded-xl border border-dash-border bg-dash-panel p-4 text-sm text-dash-secondary">
              No runs yet. Enable pooling in <button type="button" className="text-dash-gold underline" onClick={() => setActiveSubTab('rules')}>Tip &amp; Tipout Rules</button>, then preview a pay period and create a draft.
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
                  Preview · {intervalLabel(runInterval)} · {MODE_LABELS[preview.mode] || preview.mode} · {money(preview.totals?.total_tips)} tips
                  {Number(preview.totals?.total_card_fees_withheld) > 0 ? ` · ${money(preview.totals.total_card_fees_withheld)} card fees withheld` : ''}
                </p>
                <span className="text-xs text-dash-tertiary">Not saved — create a draft to finalize and export.</span>
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
                  <button type="button" onClick={handleEmail} disabled={!canExportPayroll || !selectedRun.payouts?.length} className="rounded-lg border border-dash-border px-3 py-1.5 text-sm text-dash-cream hover:border-dash-gold disabled:opacity-50">Email</button>
                  <ExportMenu disabled={!canExportPayroll || !selectedRun.payouts?.length} onExport={handleExport} />
                  {selectedRun.status === 'draft' ? (
                    <>
                      <button type="button" onClick={() => setRunStatus(selectedRun.id, 'void')} disabled={!canRunPayroll || working} className="rounded-lg border border-dash-border px-3 py-1.5 text-sm text-dash-secondary hover:text-red-300 disabled:opacity-50">Void</button>
                      <button type="button" onClick={() => setRunStatus(selectedRun.id, 'finalize')} disabled={!canRunPayroll || working} className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50">Finalize</button>
                    </>
                  ) : null}
                </div>
              </div>
              <PayRunTable payouts={selectedRun.payouts} rateFor={rateFor} editable={selectedRun.status === 'draft' && canAdjustTips} onAdjust={adjustPayout} />
            </section>
          ) : null}
        </div>
      ) : null}

      {/* ---------- RULES ---------- */}
      {activeSubTab === 'rules' ? (
        <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm text-dash-secondary">Changes apply to future runs. Nothing saves until you hit Save.</p>
            <button type="button" onClick={() => void saveTipConfig()} disabled={saveDisabled} title={!canAdjustTips ? 'Requires payroll.adjust_tips permission' : undefined} className="rounded-lg border border-dash-gold bg-dash-gold/10 px-3 py-1.5 text-sm font-medium text-dash-gold hover:bg-dash-gold/20 disabled:opacity-50">{configSaving ? 'Saving…' : 'Save rules'}</button>
          </div>
          {configLoading ? (
            <div className="rounded-xl border border-dash-border bg-white/[0.025] p-4 text-sm text-dash-secondary">Loading configuration…</div>
          ) : (
            <TipRulesEditor
              settings={tipPayrollSettings}
              jobCodes={jobCodes}
              waiters={waiters}
              menuCategories={menuCategories}
              menuItems={menuItems}
              readOnly={!canAdjustTips}
              onUpdateSettings={updateTipPayrollSettings}
              onUpdateRoleRule={updateTipRoleRule}
              onSaveWaiterOverride={saveWaiterOverride}
              onFetchRealPreview={fetchRealPreview}
            />
          )}
          {configError ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{configError}</div> : null}
          {configMessage ? <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{configMessage}</div> : null}
        </section>
      ) : null}

      {/* ---------- PAYROLL SETUP ---------- */}
      {activeSubTab === 'payroll' ? (
        <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm text-dash-secondary">Provider, export cadence, cash &amp; credit tip handling, and card fees.</p>
            <button type="button" onClick={() => void saveTipConfig()} disabled={saveDisabled} className="rounded-lg border border-dash-gold bg-dash-gold/10 px-3 py-1.5 text-sm font-medium text-dash-gold hover:bg-dash-gold/20 disabled:opacity-50">{configSaving ? 'Saving…' : 'Save payroll setup'}</button>
          </div>
          {configLoading ? (
            <div className="rounded-xl border border-dash-border bg-white/[0.025] p-4 text-sm text-dash-secondary">Loading configuration…</div>
          ) : (
            <PayrollSetupFields settings={tipPayrollSettings} onUpdateSettings={updateTipPayrollSettings} payPeriodCalendar={payPeriodCalendar} />
          )}
          {configError ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{configError}</div> : null}
          {configMessage ? <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{configMessage}</div> : null}
        </section>
      ) : null}
      {emailOpen ? (
        <EmailPayrollModal
          restaurantId={restaurantId}
          run={activeRun}
          rows={buildPayrollRows(activePayouts || [], rateFor)}
          restaurantName={restaurantName}
          defaultRecipients={defaultEmailRecipients}
          onClose={() => setEmailOpen(false)}
          onFallbackExport={handleExport}
        />
      ) : null}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { fetchWithSupabaseAuth } from '../../shared/query'
import {
  TipPayrollSettingsFields,
  defaultTipPayrollSettings,
  normalizeJobCodes,
  normalizeTipPayrollSettings,
  tipPayrollPayload,
} from '../RestaurantSetupPanel'

const MODE_LABELS = {
  individual: 'Individual',
  pooled: 'Pooled (equal split)',
  role_based: 'Role-based points',
  points_based: 'Points',
  hours_based: 'Hours worked',
  sales_based: 'Sales',
}

const STATUS_STYLES = {
  draft: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  finalized: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  voided: 'border-dash-border bg-dash-panel text-dash-tertiary',
}

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

function StatusChip({ status }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${STATUS_STYLES[status] || STATUS_STYLES.voided}`}>
      {status}
    </span>
  )
}

function PayoutTable({ payouts, editable, onAdjust }) {
  if (!payouts?.length) {
    return <p className="text-sm text-dash-secondary">No tips or clocked hours in this window.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-dash-border text-left font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">
            <th className="py-2 pr-3">Staff</th>
            <th className="py-2 pr-3">Role</th>
            <th className="py-2 pr-3 text-right">Hours</th>
            <th className="py-2 pr-3 text-right">Collected</th>
            <th className="py-2 pr-3 text-right">To pool</th>
            <th className="py-2 pr-3 text-right">Pool share</th>
            <th className="py-2 pr-3 text-right">Tipout −/+</th>
            <th className="py-2 pr-3 text-right">Adjust</th>
            <th className="py-2 text-right">Final</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p, index) => (
            <tr key={p.id || `${p.staff_id}-${index}`} className="border-b border-dash-border/50 text-dash-cream">
              <td className="py-2 pr-3">{p.staff_name || 'Unknown'}</td>
              <td className="py-2 pr-3 text-dash-secondary">{p.role_key}</td>
              <td className="py-2 pr-3 text-right text-dash-secondary">{Number(p.hours_worked ?? 0).toFixed(2)}</td>
              <td className="py-2 pr-3 text-right">{money(p.tips_collected)}</td>
              <td className="py-2 pr-3 text-right text-dash-secondary">{money(p.contributed_to_pool)}</td>
              <td className="py-2 pr-3 text-right">{money(p.pool_share)}</td>
              <td className="py-2 pr-3 text-right text-dash-secondary">
                {Number(p.tipout_paid) > 0 ? `−${money(p.tipout_paid)} ` : ''}
                {Number(p.tipout_received) > 0 ? `+${money(p.tipout_received)}` : ''}
                {Number(p.tipout_paid) <= 0 && Number(p.tipout_received) <= 0 ? '—' : ''}
              </td>
              <td className="py-2 pr-3 text-right">
                {editable && p.id ? (
                  <button
                    type="button"
                    onClick={() => onAdjust(p)}
                    className="rounded border border-dash-border px-2 py-0.5 text-xs text-dash-secondary hover:text-dash-cream"
                  >
                    {Number(p.adjustment) !== 0 ? money(p.adjustment) : 'Edit'}
                  </button>
                ) : (
                  <span className="text-dash-secondary">{Number(p.adjustment) !== 0 ? money(p.adjustment) : '—'}</span>
                )}
              </td>
              <td className="py-2 text-right font-semibold">{money(p.final_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TipPoolingPage({ restaurantId }) {
  const [runs, setRuns] = useState([])
  const [selectedRun, setSelectedRun] = useState(null)
  const [preview, setPreview] = useState(null)
  const [businessDate, setBusinessDate] = useState(yesterdayISO())
  const [jobCodes, setJobCodes] = useState([])
  const [tipPayrollSettings, setTipPayrollSettings] = useState(defaultTipPayrollSettings())
  const [loading, setLoading] = useState(true)
  const [configLoading, setConfigLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [configMessage, setConfigMessage] = useState('')
  const [configError, setConfigError] = useState('')

  const loadRuns = async () => {
    setError('')
    try {
      const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/runs`)
      setRuns(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err?.message || 'Could not load tipout runs')
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
    void loadRuns()
    void loadTipConfig()
  }, [restaurantId])

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
      setConfigMessage('Saved tipout configuration')
      await loadRuns()
    } catch (err) {
      setConfigError(err?.message || 'Could not save tipout configuration')
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
      const data = await fetchWithSupabaseAuth(
        `/restaurants/${restaurantId}/tip-pools/preview?business_date=${businessDate}`,
      )
      setPreview(data)
    } catch (err) {
      setError(err?.message || 'Could not compute preview')
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
      await loadRuns()
    } catch (err) {
      setError(err?.message || 'Could not create run')
    } finally {
      setWorking(false)
    }
  }

  const adjustPayout = async (payout) => {
    const raw = window.prompt(
      `Adjustment for ${payout.staff_name || 'staff'} (positive or negative dollars):`,
      String(payout.adjustment ?? '0'),
    )
    if (raw == null) return
    const amount = Number(raw)
    if (!Number.isFinite(amount)) {
      setError('Adjustment must be a number')
      return
    }
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
      const run = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/runs/${runId}/${action}`, {
        method: 'POST',
      })
      setSelectedRun(run)
      setMessage(action === 'finalize' ? 'Run finalized' : 'Run voided')
      await loadRuns()
    } catch (err) {
      setError(err?.message || `Could not ${action} run`)
    } finally {
      setWorking(false)
    }
  }

  const activePayouts = selectedRun?.payouts || preview?.payouts || null

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-mono text-dash-tertiary">Tips</p>
            <h1 className="mt-1 text-2xl font-semibold text-dash-cream">Tipout</h1>
            <p className="mt-2 max-w-2xl text-sm text-dash-secondary">
              Calculated tip distributions from your Pool &amp; Tipout rules below. Windows with pooling enabled are
              computed automatically each day; review drafts, adjust if needed, and finalize.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={businessDate}
              onChange={(event) => setBusinessDate(event.target.value)}
              className="rounded-lg border border-dash-border bg-transparent px-3 py-1.5 text-sm text-dash-cream"
            />
            <button
              type="button"
              onClick={previewWindow}
              disabled={working || !businessDate}
              className="rounded-lg border border-dash-border px-3 py-1.5 text-sm text-dash-cream hover:border-dash-gold disabled:opacity-50"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={createRun}
              disabled={working || !businessDate}
              className="rounded-lg border border-dash-gold bg-dash-gold/10 px-3 py-1.5 text-sm font-medium text-dash-gold hover:bg-dash-gold/20 disabled:opacity-50"
            >
              Run for date
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-mono text-dash-tertiary">Configuration</p>
            <h2 className="mt-1 text-xl font-semibold text-dash-cream">Pool & Tipout Rules</h2>
            <p className="mt-2 max-w-2xl text-sm text-dash-secondary">
              Set tip ownership, pooling windows, tipout rules, role eligibility, and payroll defaults for future tipout runs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void saveTipConfig()}
            disabled={configSaving || configLoading}
            className="rounded-lg border border-dash-gold bg-dash-gold/10 px-3 py-1.5 text-sm font-medium text-dash-gold hover:bg-dash-gold/20 disabled:opacity-50"
          >
            {configSaving ? 'Saving...' : 'Save configuration'}
          </button>
        </div>
        {configLoading ? (
          <div className="rounded-xl border border-dash-border bg-white/[0.025] p-4 text-sm text-dash-secondary">Loading configuration...</div>
        ) : (
          <TipPayrollSettingsFields
            settings={tipPayrollSettings}
            jobCodes={jobCodes}
            onUpdateSettings={updateTipPayrollSettings}
            onUpdateRoleRule={updateTipRoleRule}
          />
        )}
        {configError ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{configError}</div> : null}
        {configMessage ? <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{configMessage}</div> : null}
      </section>

      {loading ? <div className="rounded-xl border border-dash-border bg-dash-panel p-4 text-sm text-dash-secondary">Loading runs...</div> : null}
      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div> : null}

      {!loading && !runs.length && !preview ? (
        <div className="rounded-xl border border-dash-border bg-dash-panel p-4 text-sm text-dash-secondary">
          No tipout runs yet. Enable pooling in the configuration above, and runs will appear here automatically, or use
          “Run for date” above.
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
                  {run.auto_generated ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">auto</span>
                  ) : null}
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
              {Number(preview.totals?.total_card_fees_withheld) > 0
                ? ` · ${money(preview.totals.total_card_fees_withheld)} card fees withheld`
                : ''}
            </p>
            <span className="text-xs text-dash-tertiary">Not saved — use “Run for date” to create a draft.</span>
          </div>
          <PayoutTable payouts={preview.payouts} editable={false} />
        </section>
      ) : null}

      {selectedRun ? (
        <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-dash-cream">{windowLabel(selectedRun)}</p>
              <StatusChip status={selectedRun.status} />
              <span className="text-sm text-dash-secondary">
                {MODE_LABELS[selectedRun.distribution_mode] || selectedRun.distribution_mode} · pooled {money(selectedRun.total_pooled)}
              </span>
            </div>
            {selectedRun.status === 'draft' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRunStatus(selectedRun.id, 'void')}
                  disabled={working}
                  className="rounded-lg border border-dash-border px-3 py-1.5 text-sm text-dash-secondary hover:text-red-300 disabled:opacity-50"
                >
                  Void
                </button>
                <button
                  type="button"
                  onClick={() => setRunStatus(selectedRun.id, 'finalize')}
                  disabled={working}
                  className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  Finalize
                </button>
              </div>
            ) : null}
          </div>
          <PayoutTable
            payouts={selectedRun.payouts}
            editable={selectedRun.status === 'draft'}
            onAdjust={adjustPayout}
          />
        </section>
      ) : null}
    </div>
  )
}

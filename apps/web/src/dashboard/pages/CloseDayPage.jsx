import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ReceiptText,
  Users,
  X,
} from 'lucide-react'
import { posCloseDayApi } from '../../shared/api/posClient'
import { queryClient } from '../../shared/query'
import {
  ReconciliationBanner,
  acknowledgeReconciliation,
  failedChecks,
  fetchReconciliation,
} from '../../shared/components/ReconciliationBanner'
import { useAuth } from '../../auth'
import { useBackOfficeAccess } from '../../shared/hooks/useBackOfficeAccess'
import CashCloseDaySettings from '../components/CashCloseDaySettings'

const INITIAL_CASH = {
  opening_bank: '0.00',
  paid_in: '0.00',
  paid_out: '0.00',
  cash_refunds: '0.00',
  counted_cash: '',
  retained_bank: '0.00',
  deposit_amount: '0.00',
  variance_reason: '',
}

const money = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(Number(value || 0))

const numberValue = (value) => Number.parseFloat(String(value || '0')) || 0

const durationLabel = (minutes) => {
  const total = Math.max(0, Number(minutes || 0))
  const hours = Math.floor(total / 60)
  const remainder = total % 60
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`
}

const clockLabel = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Unknown time'
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function newAttemptId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function Metric({ icon: Icon, label, value, tone = 'default' }) {
  const toneClass = tone === 'danger'
    ? 'text-red-300'
    : tone === 'warning'
      ? 'text-amber-300'
      : 'text-dash-cream'
  return (
    <div className="border-b border-dash-border py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0">
      <div className="flex items-center gap-2 text-dash-tertiary">
        <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
        <span className="label-mono">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

function CashInput({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="label-mono">{label}</span>
      <div className="mt-1.5 flex min-h-[42px] items-center border border-dash-border bg-[var(--glass-bg)] px-3 focus-within:border-shell-accent/70">
        <span className="mr-1 text-sm text-dash-tertiary">$</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-dash-cream outline-none"
        />
      </div>
    </label>
  )
}

function ActionModal({ title, children, onClose, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-lg border border-dash-border bg-dash-base shadow-2xl">
        <div className="flex items-center justify-between border-b border-dash-border px-5 py-4">
          <h2 className="text-lg font-semibold text-dash-cream">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center text-dash-tertiary hover:text-dash-cream">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-5">{children}</div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-dash-border px-5 py-4">{footer}</div>
      </div>
    </div>
  )
}

export default function CloseDayPage({ restaurantId, restaurantName }) {
  const navigate = useNavigate()
  const auth = useAuth()
  const access = useBackOfficeAccess(auth, restaurantId)
  const [preview, setPreview] = useState(null)
  const [cash, setCash] = useState(INITIAL_CASH)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [result, setResult] = useState(null)
  const [clockOutEntryIds, setClockOutEntryIds] = useState([])
  const [recentActivityConfirmed, setRecentActivityConfirmed] = useState(false)
  const [recon, setRecon] = useState(null)
  const [reconLoading, setReconLoading] = useState(false)
  const [cashCountStatus, setCashCountStatus] = useState('counted')
  const [uncountedCashReason, setUncountedCashReason] = useState('')
  const [verificationReason, setVerificationReason] = useState('')
  const [verificationExceptionStatus, setVerificationExceptionStatus] = useState(null)
  const attemptId = useRef(newAttemptId())
  const cashBusinessDate = useRef(null)

  const loadPreview = useCallback(async (businessDate) => {
    setLoading(true)
    setError('')
    try {
      const next = await posCloseDayApi.preview(restaurantId, businessDate)
      setPreview(next)
      if (next?.business_date) {
        setReconLoading(true)
        try {
          setRecon(await fetchReconciliation(restaurantId, next.business_date, next.business_date))
        } catch {
          setRecon(null)
        } finally {
          setReconLoading(false)
        }
      }
      setClockOutEntryIds((next.open_timeclock_entries || []).map((entry) => entry.id))
      if (cashBusinessDate.current !== next.business_date) {
        const reconciliation = next.cash_reconciliation || {}
        cashBusinessDate.current = next.business_date
        attemptId.current = newAttemptId()
        setRecentActivityConfirmed(false)
        setResult(null)
        setCashCountStatus('counted')
        setUncountedCashReason('')
        setVerificationReason('')
        setVerificationExceptionStatus(null)
        setCash((current) => ({
          ...current,
          opening_bank: Number(reconciliation.opening_bank || 0).toFixed(2),
          paid_in: Number(reconciliation.paid_in || 0).toFixed(2),
          paid_out: Number(reconciliation.paid_out || 0).toFixed(2),
          cash_refunds: Number(reconciliation.cash_refunds || 0).toFixed(2),
          counted_cash: '',
          retained_bank: '0.00',
          deposit_amount: '0.00',
          variance_reason: '',
        }))
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load close-day readiness.')
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    cashBusinessDate.current = null
    attemptId.current = newAttemptId()
    setCash(INITIAL_CASH)
    setCashCountStatus('counted')
    setUncountedCashReason('')
    setVerificationReason('')
    setVerificationExceptionStatus(null)
    setResult(null)
    void loadPreview()
  }, [loadPreview])

  const closeoutSettings = preview?.closeout_settings
  const openingBankPolicy = preview?.cash_reconciliation?.opening_bank_policy
  const effectiveOpeningBank = numberValue(preview?.cash_reconciliation?.opening_bank)
  const showFloat = effectiveOpeningBank > 0 || openingBankPolicy?.source === 'previous_retained'
  const trackDeposit = Boolean(closeoutSettings?.track_deposit_at_close)
  const showRetainedBank = trackDeposit || openingBankPolicy?.source === 'previous_retained'
  const expectedCash = numberValue(preview?.cash_reconciliation?.expected_cash)
  const cashCountEntered = cashCountStatus === 'not_counted' || String(cash.counted_cash).trim() !== ''
  const revealExpected = !closeoutSettings?.blind_drawer_close || (cashCountStatus === 'counted' && cashCountEntered)
  const variance = cashCountStatus === 'counted' ? numberValue(cash.counted_cash) - expectedCash : null
  const threshold = Number(preview?.closeout_settings?.cash_variance_threshold || 0)
  const openEmployees = preview?.open_timeclock_entries || []
  const isClosed = preview?.business_day?.status === 'closed'
  const unresolvedExceptions = Number(preview?.exception_count || 0)
  const blockingExceptions = Number(preview?.blocking_exception_count || 0)
  const pendingPrintJobs = Number(preview?.pending_print_jobs || 0)
  const overdueCloseAlerts = preview?.overdue_close_alerts || []

  const updateCash = (key, value) => setCash((current) => ({ ...current, [key]: value }))

  // Close-day preview totals vs the independent recompute (client-side diff:
  // the preview is POS-computed, the recompute comes from raw rows).
  const reconExtraChecks = (() => {
    if (!recon?.recomputed || !preview || isClosed) return []
    const pairs = [
      ['closeday_total_collected', 'Collected (close-day preview vs transactions)', preview.total_collected, recon.recomputed.total_collected],
      ['closeday_tips', 'Tips (close-day preview vs payments)', preview.tips, recon.recomputed.tips_total],
      ['closeday_cash_collected', 'Cash collected (close-day preview vs payments)', preview.cash_collected, recon.recomputed.cash_collected],
      ['closeday_card_collected', 'Card collected (close-day preview vs payments)', preview.card_collected, recon.recomputed.card_collected],
    ]
    return pairs
      .filter(([, , previewValue]) => previewValue != null)
      .map(([id, label, previewValue, recomputed]) => {
        const delta = Math.round((Number(previewValue) - Number(recomputed)) * 100) / 100
        return {
          id,
          label,
          report_value: Number(previewValue),
          recomputed_value: Number(recomputed),
          delta,
          ok: Math.abs(delta) <= 0.011,
          severity: 'warning',
          order_ids: [],
          note: null,
        }
      })
  })()
  const reconMismatches = failedChecks(recon, reconExtraChecks)
  const verificationChecks = [...(recon?.checks || []), ...reconExtraChecks].slice(0, 50)
  const advisoryVerificationStatus = reconMismatches.length > 0
    ? 'mismatch'
    : recon?.status === 'verified'
      && recon?.complete === true
      && verificationChecks.length > 0
      && verificationChecks.every((check) => check.ok === true)
      ? 'verified'
      : 'unavailable'
  const cashVerificationMismatch = cashCountStatus === 'counted'
    && cashCountEntered
    && Math.abs(variance) > 0.009
  const verificationMismatchCount = reconMismatches.length + (cashVerificationMismatch ? 1 : 0)
  const computedVerificationStatus = cashCountStatus !== 'counted' || !cashCountEntered
    ? 'unavailable'
    : cashVerificationMismatch || advisoryVerificationStatus === 'mismatch'
      ? 'mismatch'
      : advisoryVerificationStatus
  const verificationStatus = verificationExceptionStatus || computedVerificationStatus

  const handleConflict = (nextError) => {
    const detail = nextError?.detail
    if (detail && typeof detail === 'object') {
      if (detail.totals) setPreview(detail.totals)
      if (detail.code === 'open_checks') {
        setModal('open-checks')
        return
      }
      if (detail.code === 'employees_clocked_in') {
        setModal('employees')
        return
      }
      if (detail.code === 'invalid_verification_claim') {
        // The report reconciliation is advisory. If the canonical POS close
        // cannot independently attest the cash/card/total checks, require an
        // explicit exception instead of retrying the same verified claim.
        setVerificationExceptionStatus('unavailable')
        setVerificationReason('')
        setModal('verification')
        return
      }
      if (detail.message) {
        setError(detail.message)
        return
      }
    }
    setError(nextError instanceof Error ? nextError.message : 'Could not close the business day.')
  }

  const submitClose = async (confirmAutoClockOut) => {
    if (!preview) return
    if (cashCountStatus === 'counted' && !cashCountEntered) {
      setError('Count the physical cash in the drawer before closing the day.')
      setModal(null)
      return
    }
    if (cashCountStatus === 'not_counted' && uncountedCashReason.trim().length < 5) {
      setError('Explain why the drawer could not be physically counted.')
      setModal(null)
      return
    }
    if (variance != null && Math.abs(variance) > threshold && !cash.variance_reason.trim()) {
      setError(`Explain the ${money(variance)} cash variance before closing.`)
      setModal(null)
      return
    }
    setClosing(true)
    setError('')
    try {
      const closed = await posCloseDayApi.close(restaurantId, {
        business_date: preview.business_date,
        close_attempt_id: attemptId.current,
        confirm_auto_clock_out: confirmAutoClockOut,
        clock_out_mode: !preview.closeout_settings?.show_clockout_options_at_close
          ? 'all'
          : openEmployees.length === 0 || clockOutEntryIds.length === openEmployees.length
            ? 'all'
            : clockOutEntryIds.length === 0 ? 'none' : 'selected',
        clock_out_entry_ids: clockOutEntryIds,
        confirm_recent_activity: recentActivityConfirmed,
        opening_bank: effectiveOpeningBank,
        cash_count_status: cashCountStatus,
        counted_cash: cashCountStatus === 'counted' ? numberValue(cash.counted_cash) : null,
        confirm_uncounted_cash: cashCountStatus === 'not_counted',
        uncounted_cash_reason: cashCountStatus === 'not_counted' ? uncountedCashReason.trim() : undefined,
        retained_bank: cashCountStatus === 'counted' ? numberValue(cash.retained_bank) : 0,
        deposit_amount: cashCountStatus === 'counted' ? numberValue(cash.deposit_amount) : 0,
        variance_reason: cashCountStatus === 'counted' ? cash.variance_reason.trim() || undefined : undefined,
        verification_status: verificationStatus,
        // A verified claim is recomputed entirely by POS from its own cash and
        // batch evidence. Report-service checks are retained only as context
        // for an explicitly confirmed mismatch/unavailable close.
        verification_checks: verificationStatus === 'verified' ? [] : verificationChecks,
        confirm_verification_exception: verificationStatus !== 'verified',
        verification_reason: verificationStatus !== 'verified' ? verificationReason.trim() : undefined,
      })
      setResult(closed)
      setPreview({
        ...closed.totals,
        business_date: closed.business_date,
        active_business_date: closed.active_business_date,
        open_timeclock_entries: [],
        business_day: {
          ...closed.totals.business_day,
          status: 'closed',
          closed_at: closed.closed_at,
        },
      })
      setModal('success')
      if (reconMismatches.length > 0) {
        acknowledgeReconciliation(restaurantId, {
          context: 'close_day',
          start_date: preview.business_date,
          end_date: preview.business_date,
          mismatches: reconMismatches.slice(0, 20),
        }).catch(() => {})
      }
      try {
        setPreview(await posCloseDayApi.preview(restaurantId, closed.business_date))
      } catch {
        // The close already succeeded; keep the normalized closed response if
        // the follow-up read is temporarily unavailable.
      }
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.some((part) => part === restaurantId),
      })
    } catch (nextError) {
      handleConflict(nextError)
    } finally {
      setClosing(false)
    }
  }

  const beginClose = (verificationReviewed = false) => {
    setError('')
    if (Number(preview?.open_checks || 0) > 0) {
      setModal('open-checks')
      return
    }
    if (blockingExceptions > 0) {
      setError('Resolve the blocking close-day payment and check exceptions before closing remotely.')
      return
    }
    if (pendingPrintJobs > 0) {
      setError('Resolve pending print work on the POS before closing remotely.')
      return
    }
    if (reconLoading) {
      setError('Wait for independent financial verification to finish before closing.')
      return
    }
    if (verificationStatus !== 'verified' && !verificationReviewed) {
      setModal('verification')
      return
    }
    if (preview?.close_period?.recent_activity && !recentActivityConfirmed) {
      setModal('recent-activity')
      return
    }
    setModal(openEmployees.length ? 'employees' : 'confirm')
  }

  if (loading && !preview) {
    return <div className="flex min-h-[55vh] items-center justify-center text-sm text-dash-secondary">Loading close-day readiness...</div>
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-mono">Operations</p>
          <h1 className="mt-1 text-3xl font-semibold text-dash-cream">Close Day</h1>
          <p className="mt-2 max-w-2xl text-sm text-dash-secondary">
            Finalize {restaurantName || 'this restaurant'} remotely using the same audited close used by the POS.
          </p>
        </div>
        <button type="button" onClick={() => void loadPreview()} disabled={loading || closing} className="flex min-h-[40px] items-center gap-2 border border-dash-border px-4 text-sm font-semibold text-dash-secondary hover:text-dash-cream disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-3 border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {access.viewVisible('close_day.readiness') && <>
        {overdueCloseAlerts.length > 0 && (
          <section className="border border-amber-400/40 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3"><AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" /><div className="min-w-0 flex-1"><h2 className="font-semibold text-amber-100">Close Day overdue</h2><p className="mt-1 text-sm text-amber-100/75">The backend watchdog found business activity that crossed the restaurant’s day boundary without a completed close.</p><div className="mt-3 flex flex-wrap gap-2">{overdueCloseAlerts.map((alert) => <button type="button" key={alert.id} onClick={() => void loadPreview(alert.business_date)} className="border border-amber-300/35 px-3 py-2 text-xs font-semibold text-amber-100">Review {alert.business_date}</button>)}</div></div></div>
          </section>
        )}

        <section className="border-y border-dash-border sm:grid sm:grid-cols-4">
          <Metric icon={CalendarCheck} label={`Business date · Close ${preview?.close_period?.sequence || 1}`} value={preview?.business_date || '—'} />
          <Metric icon={ReceiptText} label="Open checks" value={preview?.open_checks || 0} tone={preview?.open_checks ? 'danger' : 'default'} />
          <Metric icon={Users} label="Clocked in" value={openEmployees.length} tone={openEmployees.length ? 'warning' : 'default'} />
          <Metric icon={Banknote} label="Collected" value={money(preview?.total_collected)} />
        </section>
      </>}

      {!isClosed && recon && (
        <ReconciliationBanner
          recon={recon}
          extraChecks={reconExtraChecks}
          filename={`close-day-verification-${preview?.business_date || 'today'}.csv`}
        />
      )}

      {isClosed ? (
        <section className="flex items-start gap-4 border border-emerald-400/35 bg-emerald-500/10 p-5">
          <CheckCircle2 size={24} className="shrink-0 text-emerald-300" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-emerald-100">Business day closed</h2>
            <p className="mt-1 text-sm text-emerald-100/75">
              Closed {preview?.business_day?.closed_at ? new Date(preview.business_day.closed_at).toLocaleString() : 'successfully'}{preview?.business_day?.closed_by_name ? ` by ${preview.business_day.closed_by_name}` : ''}.
            </p>
            {preview?.financial_verification?.status && preview.financial_verification.status !== 'verified' && (
              <p className="mt-2 text-sm font-semibold text-amber-200">Financial verification exception recorded: {preview.financial_verification.status.replaceAll('_', ' ')}.</p>
            )}
          </div>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
          {access.viewVisible('close_day.cash') && <section className="border border-dash-border bg-[var(--glass-bg)] p-5">
            <div className="flex items-center gap-2">
              <Banknote size={17} className="text-dash-tertiary" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-dash-cream">Cash reconciliation</h2>
            </div>
            <p className="mt-1 text-sm text-dash-secondary">Enter the actual drawer values. These become the finalized close record.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setCashCountStatus('counted')} className={`min-h-[38px] border px-3 text-xs font-semibold ${cashCountStatus === 'counted' ? 'border-dash-cream bg-dash-cream text-dash-base' : 'border-dash-border text-dash-secondary'}`}>Drawer counted</button>
              <button type="button" onClick={() => setCashCountStatus('not_counted')} className={`min-h-[38px] border px-3 text-xs font-semibold ${cashCountStatus === 'not_counted' ? 'border-amber-300 bg-amber-300 text-black' : 'border-dash-border text-dash-secondary'}`}>Not physically counted</button>
            </div>
            {openingBankPolicy?.warning && (
              <div className="mt-4 flex items-start gap-3 border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p>{openingBankPolicy.warning.message}</p>
              </div>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {showFloat && (
                <div>
                  <p className="label-mono">Starting float</p>
                  <p className="mt-1.5 flex min-h-[42px] items-center border border-dash-border bg-[var(--glass-bg)] px-3 font-semibold text-dash-cream">{money(effectiveOpeningBank)}</p>
                  <p className="mt-1 text-xs text-dash-tertiary">
                    {openingBankPolicy?.source === 'previous_retained'
                      ? openingBankPolicy?.source_business_date
                        ? `Carried from ${openingBankPolicy.source_business_date}`
                        : 'Configured fallback'
                      : 'Set by restaurant policy'}
                  </p>
                </div>
              )}
              {cashCountStatus === 'counted' && <CashInput label="Counted cash" value={cash.counted_cash} onChange={(value) => updateCash('counted_cash', value)} />}
              {cashCountStatus === 'counted' && showRetainedBank && (
                <CashInput label="Float left in drawer" value={cash.retained_bank} onChange={(value) => updateCash('retained_bank', value)} />
              )}
              {cashCountStatus === 'counted' && trackDeposit && (
                <>
                  <CashInput label="Deposit amount" value={cash.deposit_amount} onChange={(value) => updateCash('deposit_amount', value)} />
                </>
              )}
            </div>
            {cashCountStatus === 'not_counted' && (
              <label className="mt-4 block border border-amber-400/35 bg-amber-500/10 p-4">
                <span className="label-mono text-amber-100">Why was the drawer not counted?</span>
                <textarea value={uncountedCashReason} onChange={(event) => setUncountedCashReason(event.target.value)} rows={3} placeholder="Required. This close will not claim a $0 count or calculate a variance." className="mt-2 w-full resize-none border border-amber-300/30 bg-transparent px-3 py-2 text-sm text-amber-50 outline-none" />
              </label>
            )}
            <div className="mt-5 grid gap-3 border-y border-dash-border py-4 sm:grid-cols-3 xl:grid-cols-5">
              <div><p className="label-mono">Cash sales</p><p className="mt-1 font-semibold text-dash-cream">{money(preview?.cash_reconciliation?.cash_sales ?? preview?.cash_collected)}</p></div>
              <div><p className="label-mono">Paid in</p><p className="mt-1 font-semibold text-dash-cream">{money(preview?.cash_reconciliation?.paid_in)}</p></div>
              <div><p className="label-mono">Paid out</p><p className="mt-1 font-semibold text-dash-cream">{money(preview?.cash_reconciliation?.paid_out)}</p></div>
              <div><p className="label-mono">Cash drops</p><p className="mt-1 font-semibold text-dash-cream">{money(preview?.cash_reconciliation?.cash_drop)}</p></div>
              <div><p className="label-mono">Cash refunds</p><p className="mt-1 font-semibold text-dash-cream">{money(preview?.cash_reconciliation?.cash_refunds)}</p></div>
            </div>
            <div className="grid gap-3 border-b border-dash-border py-4 sm:grid-cols-2">
              <div><p className="label-mono">Expected cash</p><p className="mt-1 font-semibold text-dash-cream">{revealExpected ? money(expectedCash) : 'Hidden until count is entered'}</p></div>
              <div><p className="label-mono">Variance</p><p className={`mt-1 font-semibold ${variance != null && revealExpected && Math.abs(variance) > threshold ? 'text-amber-300' : 'text-dash-cream'}`}>{cashCountStatus === 'not_counted' ? 'Not available — drawer uncounted' : revealExpected ? money(variance) : 'Hidden until count is entered'}</p></div>
            </div>
            {cashCountStatus === 'counted' && <label className="mt-4 block">
              <span className="label-mono">Variance reason</span>
              <textarea value={cash.variance_reason} onChange={(event) => updateCash('variance_reason', event.target.value)} rows={3} placeholder="Required when variance exceeds the configured threshold" className="mt-1.5 w-full resize-none border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none focus:border-shell-accent/70" />
            </label>}
          </section>}

          {access.viewVisible('close_day.readiness') && <section className="border border-dash-border bg-[var(--glass-bg)] p-5">
            <h2 className="text-lg font-semibold text-dash-cream">Readiness</h2>
            <div className="mt-4 space-y-4">
              <ReadinessRow ready={!preview?.open_checks} label="Checks" detail={preview?.open_checks ? `${preview.open_checks} must be closed on POS` : 'All checks are closed'} />
              <ReadinessRow ready={!blockingExceptions} label="Exceptions" detail={blockingExceptions ? `${blockingExceptions} block close (${unresolvedExceptions} total for review)` : unresolvedExceptions ? `${unresolvedExceptions} audit item(s), none blocking` : 'No payment or check exceptions'} />
              <ReadinessRow ready={verificationStatus === 'verified'} warning={verificationStatus !== 'mismatch'} label="Financial verification" detail={reconLoading ? 'Independent recompute still running' : verificationStatus === 'verified' ? 'Totals match raw transactions' : verificationStatus === 'mismatch' ? `${verificationMismatchCount} mismatch(es) require an override reason` : 'Independent verifier unavailable; close will be marked unverified'} />
              <ReadinessRow ready={!pendingPrintJobs} label="Print work" detail={pendingPrintJobs ? `${pendingPrintJobs} jobs still pending` : 'No pending print work'} />
              <ReadinessRow ready={!openEmployees.length} warning={Boolean(openEmployees.length)} label="Employees" detail={openEmployees.length ? `${openEmployees.length} will require confirmation` : 'Everyone is clocked out'} />
            </div>
            {openEmployees.length > 0 && (
              <div className="mt-5 border-t border-dash-border pt-4">
                {openEmployees.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-semibold text-dash-cream">{entry.staff_name}</span>
                    <span className="shrink-0 text-dash-tertiary">{durationLabel(entry.worked_minutes)}</span>
                  </div>
                ))}
              </div>
            )}
            {access.viewVisible('close_day.finalize') && <button type="button" onClick={beginClose} disabled={closing || !preview} className="mt-6 flex min-h-[44px] w-full items-center justify-center gap-2 bg-dash-cream px-4 text-sm font-bold text-dash-base transition hover:opacity-90 disabled:opacity-50">
              <CalendarCheck size={17} aria-hidden="true" />
              {closing ? 'Closing day...' : 'Close business day'}
            </button>}
          </section>}
        </div>
      )}

      {access.can('settings.edit') && access.viewMode('close_day.cash') === 'full' && <CashCloseDaySettings restaurantId={restaurantId} />}

      {modal === 'open-checks' && (
        <ActionModal
          title="Open checks block close day"
          onClose={() => setModal(null)}
          footer={<><button type="button" onClick={() => setModal(null)} className="min-h-[40px] border border-dash-border px-4 text-sm font-semibold text-dash-secondary">Dismiss</button><button type="button" onClick={() => navigate('../checks', { relative: 'path' })} className="min-h-[40px] bg-dash-cream px-4 text-sm font-bold text-dash-base">Open check ledger</button></>}
        >
          <div className="flex gap-3">
            <AlertTriangle size={22} className="shrink-0 text-red-300" aria-hidden="true" />
            <div><p className="font-semibold text-dash-cream">Close all checks before closing the day.</p><p className="mt-2 text-sm text-dash-secondary">There is no override. The POS must finish or void all {preview?.open_checks || 0} open check{preview?.open_checks === 1 ? '' : 's'} first.</p></div>
          </div>
        </ActionModal>
      )}

      {modal === 'verification' && (
        <ActionModal
          title={verificationStatus === 'mismatch' ? 'Financial totals do not match' : 'Independent verification unavailable'}
          onClose={() => setModal(null)}
          footer={<><button type="button" onClick={() => setModal(null)} className="min-h-[40px] border border-dash-border px-4 text-sm font-semibold text-dash-secondary">Cancel</button><button type="button" onClick={() => { if (verificationReason.trim().length < 5) { setError('Record a reason for the financial verification exception.'); return } beginClose(true) }} className="min-h-[40px] bg-amber-300 px-4 text-sm font-bold text-black">Record exception & continue</button></>}
        >
          <div className="flex gap-3">
            <AlertTriangle size={22} className="shrink-0 text-amber-300" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-dash-cream">This close will be marked unverified.</p>
              <p className="mt-2 text-sm text-dash-secondary">{verificationStatus === 'mismatch' ? `${verificationMismatchCount} independent check${verificationMismatchCount === 1 ? '' : 's'} disagree with the Close Day totals. Review the deltas before continuing.` : 'The independent transaction recompute could not complete. Continuing records that limitation; it does not claim the totals matched.'}</p>
              <label className="mt-4 block"><span className="label-mono">Manager reason</span><textarea value={verificationReason} onChange={(event) => setVerificationReason(event.target.value)} rows={3} placeholder="What was reviewed, and why is closing still appropriate?" className="mt-1.5 w-full resize-none border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none focus:border-shell-accent/70" /></label>
            </div>
          </div>
        </ActionModal>
      )}

      {modal === 'employees' && (
        <ActionModal
          title="Employees are still clocked in"
          onClose={() => setModal(null)}
          footer={<><button type="button" onClick={() => setModal(null)} disabled={closing} className="min-h-[40px] border border-dash-border px-4 text-sm font-semibold text-dash-secondary">Cancel</button><button type="button" onClick={() => void submitClose(true)} disabled={closing} className="min-h-[40px] bg-amber-300 px-4 text-sm font-bold text-black disabled:opacity-50">{closing ? 'Closing...' : 'Clock out employees & close'}</button></>}
        >
          <p className="text-sm text-dash-secondary">Everyone is selected by default. This choice affects payroll only; it does not change the saved financial close.</p>
          {preview?.closeout_settings?.show_clockout_options_at_close && <div className="mt-3 flex gap-2"><button type="button" onClick={() => setClockOutEntryIds(openEmployees.map((entry) => entry.id))} className="border border-dash-border px-3 py-2 text-xs font-semibold text-dash-cream">Everyone</button><button type="button" onClick={() => setClockOutEntryIds([])} className="border border-dash-border px-3 py-2 text-xs font-semibold text-dash-secondary">Nobody</button></div>}
          <div className="mt-4 divide-y divide-dash-border border-y border-dash-border">
            {openEmployees.map((entry) => (
              <button type="button" key={entry.id} disabled={!preview?.closeout_settings?.show_clockout_options_at_close} onClick={() => setClockOutEntryIds((current) => current.includes(entry.id) ? current.filter((id) => id !== entry.id) : [...current, entry.id])} className="flex w-full items-center justify-between gap-4 py-3 text-left disabled:cursor-default">
                <div><p className="font-semibold text-dash-cream">{clockOutEntryIds.includes(entry.id) ? '✓ ' : '○ '}{entry.staff_name}</p><p className="mt-0.5 text-xs text-dash-tertiary">Clocked in {clockLabel(entry.clock_in_at)}{entry.last_activity_at ? ` · last POS activity ${clockLabel(entry.last_activity_at)}` : ''}</p></div>
                <span className="text-sm font-semibold text-amber-200">{durationLabel(entry.worked_minutes)}</span>
              </button>
            ))}
          </div>
        </ActionModal>
      )}

      {modal === 'confirm' && (
        <ActionModal
          title="Close business day?"
          onClose={() => setModal(null)}
          footer={<><button type="button" onClick={() => setModal(null)} disabled={closing} className="min-h-[40px] border border-dash-border px-4 text-sm font-semibold text-dash-secondary">Cancel</button><button type="button" onClick={() => void submitClose(false)} disabled={closing} className="min-h-[40px] bg-dash-cream px-4 text-sm font-bold text-dash-base disabled:opacity-50">{closing ? 'Closing...' : 'Close day now'}</button></>}
        >
          <p className="text-sm text-dash-secondary">This saves Close {preview?.close_period?.sequence || 1} for {preview?.business_date}. Same-date activity starts another numbered close; it does not advance the calendar.</p>
        </ActionModal>
      )}

      {modal === 'recent-activity' && (
        <ActionModal title="Restaurant activity is still recent" onClose={() => setModal(null)} footer={<><button type="button" onClick={() => setModal(null)} className="min-h-[40px] border border-dash-border px-4 text-sm font-semibold text-dash-secondary">Cancel</button><button type="button" onClick={() => { setRecentActivityConfirmed(true); setModal(openEmployees.length ? 'employees' : 'confirm') }} className="min-h-[40px] bg-amber-300 px-4 text-sm font-bold text-black">Review complete — continue</button></>}>
          <p className="text-sm text-dash-secondary">An order, payment, or cash action occurred within the last {preview?.close_period?.quiet_minutes || 10} minutes. Confirm the floor is ready before closing.</p>
        </ActionModal>
      )}

      {modal === 'success' && result && (
        <ActionModal title="Day closed" onClose={() => setModal(null)} footer={<button type="button" onClick={() => setModal(null)} className="min-h-[40px] bg-dash-cream px-4 text-sm font-bold text-dash-base">Done</button>}>
          <div className="flex gap-3"><CheckCircle2 size={24} className="shrink-0 text-emerald-300" aria-hidden="true" /><div><p className="font-semibold text-dash-cream">{result.business_date} is finalized.</p><p className="mt-2 text-sm text-dash-secondary">{result.auto_clocked_out?.length ? `${result.auto_clocked_out.length} employee${result.auto_clocked_out.length === 1 ? '' : 's'} were clocked out and audited.` : 'No employee clock-outs were required.'}</p>{result.totals?.financial_verification?.status !== 'verified' && <p className="mt-2 text-sm font-semibold text-amber-200">Saved with an explicit financial verification exception.</p>}</div></div>
        </ActionModal>
      )}
    </div>
  )
}

function ReadinessRow({ ready, warning = false, label, detail }) {
  const Icon = ready ? CheckCircle2 : warning ? Clock3 : AlertTriangle
  const color = ready ? 'text-emerald-300' : warning ? 'text-amber-300' : 'text-red-300'
  return (
    <div className="flex items-start gap-3">
      <Icon size={17} className={`mt-0.5 shrink-0 ${color}`} aria-hidden="true" />
      <div><p className="text-sm font-semibold text-dash-cream">{label}</p><p className="mt-0.5 text-xs text-dash-tertiary">{detail}</p></div>
    </div>
  )
}

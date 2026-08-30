import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, LockKeyhole, RefreshCw, TriangleAlert } from 'lucide-react'
import { posCloseDayApi } from '../../shared/api/posClient'

const money = (value) =>
  Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const numberValue = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function Summary({ label, value, warning = false }) {
  return (
    <div className={`rounded-xl border p-3 ${warning ? 'border-red-400/20 bg-red-400/10' : 'border-white/10 bg-white/[0.03]'}`}>
      <p className="label-mono !text-[9px]">{label}</p>
      <p className={`mt-1 font-mono text-lg tabular-nums ${warning ? 'text-red-200' : 'text-dash-cream'}`}>{value}</p>
    </div>
  )
}

function MoneyInput({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="label-mono !text-[9px]">{label}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-transparent px-3 font-mono text-sm text-dash-cream focus:border-shell-accent focus:outline-none"
      />
    </label>
  )
}

export default function CloseDayReview({ restaurantId, onBack }) {
  const [countedCash, setCountedCash] = useState('')
  const [retainedBank, setRetainedBank] = useState('')
  const [depositAmount, setDepositAmount] = useState('0')
  const [varianceReason, setVarianceReason] = useState('')
  const [notes, setNotes] = useState('')
  const [discardPrintJobs, setDiscardPrintJobs] = useState(false)
  const [unverifiedConfirmed, setUnverifiedConfirmed] = useState(false)
  const [confirmedClockOutSignature, setConfirmedClockOutSignature] = useState(null)
  const [closeAttemptId] = useState(() => crypto.randomUUID())

  const previewQuery = useQuery({
    queryKey: ['close-day-preview', restaurantId],
    queryFn: ({ signal }) => posCloseDayApi.preview(restaurantId, undefined, signal),
    enabled: Boolean(restaurantId),
    staleTime: 5000,
    refetchInterval: 15000,
  })
  const preview = previewQuery.data
  const cash = preview?.cash_reconciliation || {}
  const openingBankPolicy = cash.opening_bank_policy
  const expectedCash = numberValue(cash.expected_cash)
  const cashCountEntered = String(countedCash).trim() !== ''
  const cashLeftEntered = String(retainedBank).trim() !== ''
    && Number.isFinite(Number(retainedBank))
    && Number(retainedBank) >= 0
  const revealExpected = !preview?.closeout_settings?.blind_drawer_close || cashCountEntered
  const trackDeposit = Boolean(preview?.closeout_settings?.track_deposit_at_close)
  const variance = numberValue(countedCash) - expectedCash
  const openingBank = numberValue(cash.opening_bank)
  const actualDrawerChange = cashCountEntered ? numberValue(countedCash) - openingBank : null
  const expectedDrawerChange = expectedCash - openingBank
  const threshold = numberValue(preview?.closeout_settings?.cash_variance_threshold)
  const needsVarianceReason = cashCountEntered && Math.abs(variance) > threshold
  const blockingExceptionCount = numberValue(preview?.blocking_exception_count)
  const blockingExceptions = (preview?.exceptions || []).filter((exception) => exception.close_day_blocking !== false)
  const pendingPrintJobs = numberValue(preview?.pending_print_jobs)
  const openChecks = numberValue(preview?.open_checks)
  const openClockEntries = preview?.open_timeclock_entries || []
  const openClockEntrySignature = openClockEntries
    .map((entry, index) => entry.id || `${entry.staff_id || entry.staff_name || 'staff'}:${index}`)
    .sort()
    .join('|')
  const requiresClockOutConfirmation = openClockEntries.length > 0
  const clockOutConfirmed = requiresClockOutConfirmation
    && confirmedClockOutSignature === openClockEntrySignature
  const alreadyClosed = preview?.business_day?.status === 'closed'
  const hasBlockingWork = openChecks > 0
    || blockingExceptionCount > 0
    || (pendingPrintJobs > 0 && !discardPrintJobs)
    || (pendingPrintJobs > 0 && discardPrintJobs && !preview?.print_queue_revision)
    || (requiresClockOutConfirmation && !clockOutConfirmed)
    || !cashCountEntered
    || !cashLeftEntered
    || (needsVarianceReason && !varianceReason.trim())
    || !unverifiedConfirmed
    || alreadyClosed

  const finalizeMutation = useMutation({
    mutationFn: () => posCloseDayApi.finalize(restaurantId, {
      business_date: preview.business_date,
      close_attempt_id: closeAttemptId,
      notes: notes.trim() || undefined,
      discard_print_jobs: discardPrintJobs,
      expected_print_queue_revision: discardPrintJobs ? preview.print_queue_revision : undefined,
      confirm_auto_clock_out: clockOutConfirmed,
      opening_bank: numberValue(cash.opening_bank),
      paid_in: numberValue(cash.paid_in),
      paid_out: numberValue(cash.paid_out),
      cash_refunds: numberValue(cash.cash_refunds),
      counted_cash: numberValue(countedCash),
      retained_bank: numberValue(retainedBank),
      deposit_amount: numberValue(depositAmount),
      variance_reason: varianceReason.trim() || undefined,
      verification_status: 'not_performed',
      confirm_verification_exception: true,
      verification_reason: 'Close Day Exception Hub does not run the independent transaction reconciliation service.',
      decisions: [
        {
          type: 'back_office_close_day_review',
          discarded_print_jobs: discardPrintJobs,
          employee_clock_out_confirmed: clockOutConfirmed,
        },
      ],
    }),
    onSuccess: () => previewQuery.refetch(),
  })

  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-mono">Close Day Exception Hub</p>
          <h2 className="mt-1 text-2xl font-semibold text-dash-cream">
            {preview?.business_date || 'Active business day'}
          </h2>
          <p className="mt-1 text-sm text-dash-secondary">
            Review exceptions first. Final close remains locked until every blocker has an explicit resolution.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => previewQuery.refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-dash-secondary hover:text-dash-cream"
          >
            <RefreshCw size={13} aria-hidden="true" /> Refresh
          </button>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-dash-secondary hover:text-dash-cream"
          >
            <ArrowLeft size={13} aria-hidden="true" /> Back to analytics
          </button>
        </div>
      </div>

      {previewQuery.isPending && <p className="mt-5 text-sm text-dash-tertiary">Loading close-day state…</p>}
      {previewQuery.isError && (
        <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {previewQuery.error instanceof Error ? previewQuery.error.message : 'Could not load close-day state.'}
        </p>
      )}

      {preview && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Summary label="Open checks" value={openChecks} warning={openChecks > 0} />
            <Summary label="Blocking exceptions" value={blockingExceptionCount} warning={blockingExceptionCount > 0} />
            <Summary label="Pending print work" value={pendingPrintJobs} warning={pendingPrintJobs > 0} />
            <Summary label="Open clock entries" value={openClockEntries.length} warning={requiresClockOutConfirmation} />
            <Summary label="Card collected" value={money(preview.card_collected)} />
          </div>

          {blockingExceptions.length > 0 && (
            <div className="mt-5">
              <p className="label-mono">Blocking exceptions</p>
              <ul className="mt-2 space-y-2">
                {blockingExceptions.map((exception, index) => (
                  <li key={exception.id || `${exception.type}-${index}`} className="flex gap-2 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">
                    <TriangleAlert className="mt-0.5 shrink-0" size={15} aria-hidden="true" />
                    <span>
                      <span className="font-semibold">{exception.label || exception.type || exception.exception_type || 'Check exception'}</span>
                      {exception.order_number ? ` · Check #${exception.order_number}` : ''}
                      {exception.message || exception.reason ? <span className="mt-0.5 block text-xs text-red-200">{exception.message || exception.reason}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
            <div>
              <p className="label-mono">Cash reconciliation</p>
              {openingBankPolicy?.warning && (
                <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">{openingBankPolicy.warning.message}</p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Summary label="Opening bank" value={money(cash.opening_bank)} />
                <Summary label="Cash sales" value={money(cash.cash_sales)} />
                <Summary label="Paid in" value={money(cash.paid_in)} />
                <Summary label="Paid out" value={money(cash.paid_out)} />
                <Summary label="Cash refunds" value={money(cash.cash_refunds)} />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MoneyInput label="Counted cash" value={countedCash} onChange={setCountedCash} />
                <MoneyInput label="Cash left in drawer" value={retainedBank} onChange={setRetainedBank} />
                {trackDeposit && <MoneyInput label="Deposit amount" value={depositAmount} onChange={setDepositAmount} />}
              </div>
              <p className="mt-2 text-xs leading-5 text-dash-tertiary">
                {openingBankPolicy?.source === 'previous_retained'
                  ? 'Cash left in drawer becomes the next business day’s starting cash.'
                  : 'Cash left in drawer is recorded with this close. Tomorrow still follows the restaurant’s configured starting-cash policy.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="rounded-lg bg-white/[0.04] px-3 py-2 text-dash-secondary">Expected {revealExpected ? money(expectedCash) : 'hidden until counted'}</span>
                <span className={`rounded-lg px-3 py-2 ${needsVarianceReason ? 'bg-red-400/10 text-red-200' : 'bg-emerald-400/10 text-emerald-200'}`}>
                  Variance {revealExpected ? money(variance) : 'hidden until counted'}
                </span>
                <span className="rounded-lg bg-white/[0.04] px-3 py-2 text-dash-secondary">Actual drawer change {actualDrawerChange == null ? 'after counting' : money(actualDrawerChange)}</span>
                <span className="rounded-lg bg-white/[0.04] px-3 py-2 text-dash-secondary">Software-expected change {revealExpected ? money(expectedDrawerChange) : 'hidden until counted'}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-dash-tertiary">Drawer change is counted cash minus opening cash. It is not gross sales because payouts, paid in/out, drops, refunds, and tips also move drawer cash.</p>
              {needsVarianceReason && (
                <label className="mt-3 block">
                  <span className="label-mono !text-[9px]">Variance explanation required</span>
                  <input
                    value={varianceReason}
                    onChange={(event) => setVarianceReason(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-red-400/30 bg-transparent px-3 text-sm text-dash-cream focus:outline-none"
                  />
                </label>
              )}
            </div>

            <div>
              <p className="label-mono">Final decisions</p>
              <label className="mt-3 flex gap-2 rounded-xl border border-white/10 p-3 text-sm text-dash-secondary">
                <input
                  type="checkbox"
                  checked={discardPrintJobs}
                  onChange={(event) => setDiscardPrintJobs(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Explicitly discard {pendingPrintJobs} pending print job{pendingPrintJobs === 1 ? '' : 's'}
                  <span className="mt-0.5 block text-xs text-dash-tertiary">Use only after retry/reroute decisions are exhausted.</span>
                </span>
              </label>
              {requiresClockOutConfirmation && (
                <label className="mt-3 flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-3 text-sm text-amber-100">
                  <input
                    type="checkbox"
                    checked={clockOutConfirmed}
                    onChange={(event) => setConfirmedClockOutSignature(
                      event.target.checked ? openClockEntrySignature : null,
                    )}
                    className="mt-0.5"
                  />
                  <span>
                    Clock out {openClockEntries.length} employee{openClockEntries.length === 1 ? '' : 's'} when this day closes
                    <span className="mt-0.5 block text-xs text-amber-200/80">
                      This is a manager-confirmed adjustment and remains in the time-clock audit trail.
                    </span>
                  </span>
                </label>
              )}
              <label className="mt-3 flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-3 text-sm text-amber-100">
                <input type="checkbox" checked={unverifiedConfirmed} onChange={(event) => setUnverifiedConfirmed(event.target.checked)} className="mt-0.5" />
                <span>
                  Close with independent financial verification not performed
                  <span className="mt-0.5 block text-xs text-amber-200/80">This screen records an unverified close and never claims the totals matched raw transactions.</span>
                </span>
              </label>
              <label className="mt-3 block">
                <span className="label-mono !text-[9px]">Manager notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-transparent p-3 text-sm text-dash-cream focus:border-shell-accent focus:outline-none"
                />
              </label>
              <button
                type="button"
                disabled={hasBlockingWork || finalizeMutation.isPending}
                onClick={() => finalizeMutation.mutate()}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                {hasBlockingWork ? <LockKeyhole size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
                {alreadyClosed ? 'Business day already closed' : hasBlockingWork ? 'Resolve blockers to close' : finalizeMutation.isPending ? 'Closing day…' : 'Close business day'}
              </button>
              {finalizeMutation.isError && (
                <p className="mt-2 text-xs text-red-300">
                  {finalizeMutation.error instanceof Error ? finalizeMutation.error.message : 'Close Day failed.'}
                </p>
              )}
              {finalizeMutation.isSuccess && (
                <p className="mt-2 text-xs text-emerald-300">Business day closed and audited.</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

import { AlertTriangle, CheckCircle2, Printer, RefreshCw } from 'lucide-react'

export default function CloseDayPrintDecisionCard({
  totalJobs,
  receiptJobs,
  kitchenJobs,
  discardSelected,
  onWait,
  onDiscard,
  onRefresh,
  busy,
}) {
  const total = Math.max(0, Number(totalJobs || 0))
  const receipts = Math.max(0, Number(receiptJobs || 0))
  const kitchen = Math.max(0, Number(kitchenJobs || 0))
  const hasJobs = total > 0

  const iconTone = !hasJobs
    ? 'bg-emerald-400/10 text-emerald-200'
    : discardSelected
      ? 'bg-red-400/10 text-red-200'
      : 'bg-amber-400/10 text-amber-200'
  const statusTone = !hasJobs
    ? 'bg-emerald-400/10 text-emerald-100'
    : discardSelected
      ? 'bg-red-400/10 text-red-100'
      : 'bg-amber-400/10 text-amber-100'

  return (
    <div className="mt-5 border border-dash-border bg-dash-base/45 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center ${iconTone}`}>
            <Printer size={18} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-dash-cream">Print work</h3>
            <p className="mt-0.5 text-xs leading-5 text-dash-tertiary">
              {!hasJobs
                ? 'The server print queue is clear.'
                : discardSelected
                  ? `${total} queued print job${total === 1 ? '' : 's'} will be discarded only if this Close Day succeeds.`
                  : `${total} queued print job${total === 1 ? '' : 's'} still need a wait-or-discard decision.`}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1.5 text-xs font-semibold ${statusTone}`}>
          {!hasJobs ? 'Clear' : discardSelected ? 'Discard on close' : 'Waiting'}
        </span>
      </div>

      {hasJobs ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-dash-secondary">
            <span className="border border-dash-border bg-[var(--glass-bg)] px-2.5 py-1.5">
              {receipts} receipt job{receipts === 1 ? '' : 's'}
            </span>
            <span className="border border-dash-border bg-[var(--glass-bg)] px-2.5 py-1.5">
              {kitchen} kitchen job{kitchen === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Pending print work decision">
            <button
              type="button"
              role="radio"
              aria-checked={!discardSelected}
              onClick={onWait}
              className={`flex min-h-[82px] items-start gap-3 border p-3 text-left ${!discardSelected ? 'border-amber-300/55 bg-amber-300/[0.07]' : 'border-dash-border bg-[var(--glass-bg)]'}`}
            >
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${!discardSelected ? 'border-amber-300' : 'border-dash-border'}`} aria-hidden="true">
                {!discardSelected && <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />}
              </span>
              <span>
                <span className={`block text-sm font-semibold ${!discardSelected ? 'text-amber-100' : 'text-dash-cream'}`}>Wait and review on POS</span>
                <span className="mt-1 block text-xs leading-5 text-dash-tertiary">Leave the queue intact. Retry or reroute in POS Tasks, then refresh this status.</span>
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={discardSelected}
              onClick={onDiscard}
              className={`flex min-h-[82px] items-start gap-3 border p-3 text-left ${discardSelected ? 'border-red-300/55 bg-red-400/[0.07]' : 'border-dash-border bg-[var(--glass-bg)]'}`}
            >
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${discardSelected ? 'border-red-300' : 'border-dash-border'}`} aria-hidden="true">
                {discardSelected && <span className="h-2.5 w-2.5 rounded-full bg-red-300" />}
              </span>
              <span>
                <span className={`block text-sm font-semibold ${discardSelected ? 'text-red-100' : 'text-dash-cream'}`}>Discard during Close Day</span>
                <span className="mt-1 block text-xs leading-5 text-dash-tertiary">Expire the server queue records only if this Close Day succeeds.</span>
              </span>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-dash-border pt-3">
            <div className="flex max-w-3xl items-start gap-2 text-xs leading-5 text-dash-tertiary">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
              <p>Paper already sent to or printed by a printer cannot be recalled. POS-local held or dead-letter work is not included and still requires separate review on the POS.</p>
            </div>
            <button type="button" onClick={onRefresh} disabled={busy} className="flex min-h-[36px] shrink-0 items-center gap-2 border border-dash-border px-3 text-xs font-semibold text-dash-secondary hover:text-dash-cream disabled:opacity-50">
              <RefreshCw size={13} className={busy ? 'animate-spin' : ''} aria-hidden="true" />
              Refresh print status
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4 flex items-center gap-2 border-t border-dash-border pt-3 text-xs font-semibold text-emerald-200">
          <CheckCircle2 size={15} aria-hidden="true" />
          No print decision is required.
        </div>
      )}
    </div>
  )
}

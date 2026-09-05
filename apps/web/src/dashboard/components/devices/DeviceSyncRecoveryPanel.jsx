import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../shared/Card'
import { Badge } from '../shared/Badge'
import { Button } from '../shared/Button'
import { Modal, ModalFooter } from '../shared/Modal'
import { deviceSyncApi } from '../../data/deviceSync'
import { createRecoveryController, isRecoveryActive, recoverySelection, referenceDeviceBlocker } from './deviceSyncRecoveryState'

const STATE_LABELS = {
  inspecting: 'Inspecting', preparing: 'Preparing', applying: 'Refreshing checks',
  completed: 'Recovery completed', partial: 'Partially recovered', blocked: 'Needs attention',
  cancelled: 'Cancelled', expired: 'Expired', failed: 'Recovery failed',
  pending: 'Waiting for device', ready: 'Ready', unsupported: 'App update required',
  offline: 'Offline', prepared: 'Prepared', applied: 'Verified',
}
const label = (state) => STATE_LABELS[state] || state || 'Unknown'
const variant = (state) => ['completed', 'applied', 'ready'].includes(state) ? 'success'
  : ['blocked', 'failed'].includes(state) ? 'danger'
    : ['partial', 'offline', 'expired', 'unsupported'].includes(state) ? 'warning' : 'neutral'
const timeLabel = (value) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString() : 'Not reported'
const issueLabel = (value) => typeof value === 'string'
  ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Needs attention'

function TargetTable({ run }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-dash-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-dash-cream/5 text-xs text-dash-secondary">
          <tr><th scope="col" className="px-3 py-2">Device</th><th scope="col" className="px-3 py-2">Recovery status</th><th scope="col" className="px-3 py-2">Details</th></tr>
        </thead>
        <tbody className="divide-y divide-dash-border">
          {(run.targets || []).map((target) => (
            <tr key={target.device_id}>
              <td className="px-3 py-3 font-medium text-dash-cream">
                {target.device_name || 'Unnamed device'}
                {target.device_id === run.reference_device_id && <span className="mt-1 block text-xs font-normal text-dash-tertiary">Reference device</span>}
              </td>
              <td className="px-3 py-3"><Badge variant={variant(target.state)}>{label(target.state)}</Badge></td>
              <td className="px-3 py-3 text-xs text-dash-secondary">
                {target.blockers?.length ? target.blockers.map(issueLabel).join(' · ')
                  : target.state === 'applied' ? 'Server check state verified'
                    : target.state === 'ready' ? 'Inspection passed; safety is checked again before recovery'
                      : 'Waiting for the next device report'}
                {target.reported_at && <span className="mt-1 block text-dash-tertiary">Reported {timeLabel(target.reported_at)}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DeviceSyncRecoveryPanel({ restaurantId, userId, canRecover, summary = false }) {
  const controllerRef = useRef(null)
  const [state, setState] = useState({ loading: true, overview: null, run: null, busy: null, error: null, readError: null, pending: null })
  const [referenceId, setReferenceId] = useState('')
  const [dialog, setDialog] = useState(null)
  const [reason, setReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    let storage
    try { storage = window.sessionStorage } catch { /* Server history still restores accepted runs. */ }
    const controller = createRecoveryController({ restaurantId, userId, api: deviceSyncApi, storage })
    controllerRef.current = controller
    setState(controller.getSnapshot())
    setReferenceId('')
    setDialog(null)
    setReason('')
    setAcknowledged(false)
    const unsubscribe = controller.subscribe(() => setState(controller.getSnapshot()))
    void controller.load()
    return () => {
      unsubscribe()
      controller.dispose()
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [restaurantId, userId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      setNow(Date.now())
      void controllerRef.current?.load()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const active = isRecoveryActive(state.run)
  useEffect(() => {
    if (!active) return undefined
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      setNow(Date.now())
      void controllerRef.current?.refreshRun()
    }
    const timer = window.setInterval(refresh, 3000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [active, state.run?.id])

  const selection = useMemo(() => recoverySelection(state.run), [state.run])
  const devices = state.overview?.devices || []
  const selectedReference = devices.find((device) => device.id === referenceId)
  const referenceIssue = selectedReference ? referenceDeviceBlocker(selectedReference, now) : null
  const editable = canRecover && !summary
  const enabled = state.overview?.enabled === true
  const busy = Boolean(state.busy)
  const hasPending = Boolean(state.pending)
  const openDialog = (kind) => {
    setReason('')
    setAcknowledged(false)
    setDialog({ kind, runId: state.run.id, previewToken: state.run.preview_token, targets: state.run.targets })
  }
  const dialogStale = dialog && (dialog.runId !== state.run?.id
    || (dialog.kind === 'confirm' && dialog.previewToken !== state.run?.preview_token))
  const closeDialog = () => { if (!busy) setDialog(null) }
  const submitDialog = async () => {
    if (!editable || dialogStale || !acknowledged || reason.trim().length < 3 || reason.trim().length > 500) return
    const controller = controllerRef.current
    if (!controller) return
    if (dialog.kind === 'confirm') await controller.confirm(dialog.previewToken, reason)
    else await controller.cancel(reason)
    // Keep rejected/stale details visible; close only after a successful response.
    if (controllerRef.current === controller && !controller.getSnapshot().error) setDialog(null)
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={17} className="text-shell-accent" aria-hidden="true" />
          <h2 className="text-base font-semibold text-dash-cream">Device sync recovery</h2>
        </div>
        <Button type="button" variant="ghost" size="sm" disabled={busy || state.refreshing}
          onClick={() => void controllerRef.current?.load()} icon={<RefreshCw size={14} aria-hidden="true" />}>
          Refresh status
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-dash-secondary">
          Bring terminals back to the restaurant’s confirmed check state. Choose a reference device to compare;
          each device keeps its pending work, and the server remains the source for checks and balances.
        </p>
        {state.loading && <p className="text-sm text-dash-secondary">Loading recovery status…</p>}
        {(state.error || state.readError) && <div role="alert" className="rounded-lg border border-dash-danger/30 bg-dash-danger/10 p-3 text-sm text-dash-danger">
          {state.error || state.readError}
        </div>}
        {hasPending && <div className="rounded-lg border border-dash-warning/30 bg-dash-warning/10 p-3 text-sm text-dash-secondary">
          <p>A recovery request is awaiting confirmation. Checking its result safely repeats the same request.</p>
          {editable && <Button type="button" className="mt-2" variant="secondary" size="sm" disabled={busy}
            onClick={() => void controllerRef.current?.retryPending()}>Check request result</Button>}
        </div>}
        {state.overview && !enabled && <p className="rounded-lg border border-dash-border p-3 text-sm text-dash-secondary">
          Sync recovery is temporarily unavailable. Existing run status remains available.
        </p>}
        {summary && <p className="text-xs text-dash-tertiary">To start recovery, change this section’s view to Standard or Full.</p>}
        {!canRecover && <p className="text-xs text-dash-tertiary">Starting recovery requires the Recover device sync permission.</p>}

        {editable && !state.loading && !active && !hasPending && (
          <div className="space-y-3 rounded-lg border border-dash-border p-4">
            <label className="block text-sm font-medium text-dash-cream">
              Reference device
              <select value={referenceId} onChange={(event) => setReferenceId(event.target.value)} disabled={busy || !enabled || Boolean(state.readError)}
                className="mt-2 block min-h-[40px] w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-cream disabled:opacity-50">
                <option value="">Choose a recently connected terminal</option>
                {devices.map((device) => {
                  const issue = referenceDeviceBlocker(device, now)
                  return <option key={device.id} value={device.id} disabled={Boolean(issue)}>{device.name || 'Unnamed device'}{issue ? ` — ${issue}` : ''}</option>
                })}
              </select>
            </label>
            {referenceIssue && <p className="text-xs text-dash-warning">{referenceIssue}. Refresh status before inspecting.</p>}
            <p className="text-xs leading-5 text-dash-tertiary">Inspection asks each terminal for a fresh safety report. Staff can keep working during inspection.</p>
            <Button type="button" disabled={busy || !enabled || !selectedReference || Boolean(referenceIssue) || Boolean(state.readError)}
              onClick={() => void controllerRef.current?.inspect(referenceId)}>
              {state.run ? 'Start a fresh inspection' : 'Inspect devices'}
            </Button>
          </div>
        )}

        {state.run && <div className="space-y-3" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant={variant(state.run.status)}>{label(state.run.status)}</Badge>
            <span className="text-xs text-dash-tertiary">Started {timeLabel(state.run.created_at)}</span>
          </div>
          {state.run.status === 'inspecting' && <p className="text-sm text-dash-secondary">
            Keep terminals online with the POS app open. Inspection expires {timeLabel(state.run.expires_at)}.
          </p>}
          {['preparing', 'applying'].includes(state.run.status) && <p className="text-sm text-dash-secondary">
            Participating terminals pause new check edits at a safe point while their checks refresh. Device status updates as each terminal responds.
          </p>}
          {state.run.status === 'completed' && <p className="text-sm text-dash-secondary">All participating devices verified the server check state for this recovery.</p>}
          {state.run.status === 'partial' && <p className="text-sm text-dash-warning">Only the devices marked Verified completed recovery. Review the remaining devices before starting a fresh inspection.</p>}
          {state.run.blocker_code && <p className="text-sm text-dash-warning">{issueLabel(state.run.blocker_code)}</p>}
          {state.run.reason && <p className="text-xs text-dash-secondary">Reason: {state.run.reason}</p>}
          <TargetTable run={state.run} />
          {editable && active && !hasPending && <div className="flex flex-wrap gap-2">
            {state.run.status === 'inspecting' && <Button type="button"
              disabled={busy || !enabled || !selection.canConfirm || Boolean(state.readError)}
              onClick={() => openDialog('confirm')}>Review recovery{selection.ready.length ? ` for ${selection.ready.length} devices` : ''}</Button>}
            <Button type="button" variant="secondary" disabled={busy} onClick={() => openDialog('cancel')}>Cancel recovery</Button>
          </div>}
          {state.run.status === 'inspecting' && !selection.canConfirm && <p className="text-xs text-dash-tertiary">
            The reference device and at least one other terminal must provide fresh Ready reports before recovery can start.
          </p>}
        </div>}

        {(state.overview?.recent_runs || []).length > 0 && <details className="rounded-lg border border-dash-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-dash-cream">Recent recovery runs</summary>
          <ul className="mt-3 space-y-2">
            {state.overview.recent_runs.map((run) => <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-dash-secondary">
              <span>{timeLabel(run.created_at)} · {label(run.status)}</span>
              <Button type="button" variant="ghost" size="sm" disabled={busy || active || hasPending}
                onClick={() => void controllerRef.current?.refreshRun(run.id)}>View run</Button>
            </li>)}
          </ul>
        </details>}
      </CardContent>

      <Modal isOpen={Boolean(dialog)} onClose={closeDialog} title={dialog?.kind === 'cancel' ? 'Cancel this recovery?' : 'Review device sync recovery'}>
        {dialog && <div className="space-y-4">
          {dialog.kind === 'confirm' ? <>
            <p className="text-sm leading-6 text-dash-secondary">These devices will briefly pause new check edits at a safe point, preserve pending work, and refresh their confirmed checks from the server. The reference device does not overwrite another terminal’s transactions.</p>
            <div><p className="text-sm font-semibold text-dash-cream">Devices to recover</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-dash-secondary">
              {(dialog.targets || []).filter((target) => target.state === 'ready').map((target) => <li key={target.device_id}>{target.device_name || 'Unnamed device'}</li>)}
            </ul></div>
            {(dialog.targets || []).some((target) => target.state !== 'ready') && <div className="rounded-lg border border-dash-warning/30 bg-dash-warning/10 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-dash-warning"><AlertTriangle size={15} aria-hidden="true" />This will recover part of the fleet</p>
              <p className="mt-1 text-xs text-dash-secondary">These devices will remain unchanged and need a later inspection:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-dash-secondary">{(dialog.targets || []).filter((target) => target.state !== 'ready').map((target) => <li key={target.device_id}>{target.device_name || 'Unnamed device'} — {label(target.state)}</li>)}</ul>
            </div>}
          </> : <p className="text-sm leading-6 text-dash-secondary">Stop remaining recovery work. Devices that already refreshed keep their verified state. Cancellation does not undo checks or payments.</p>}
          <label className="block text-sm font-medium text-dash-cream">Reason
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={500} rows={3} disabled={busy}
              className="mt-2 block w-full rounded-lg border border-dash-border bg-dash-base p-3 text-sm text-dash-cream"
              placeholder="Describe the sync issue or why recovery should stop" />
          </label>
          <label className="flex items-start gap-2 text-sm text-dash-secondary">
            <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={busy} className="mt-1" />
            {dialog.kind === 'confirm' ? 'I have reviewed the participating and excluded devices and am ready for the brief pause.' : 'I understand that completed device recoveries will be kept.'}
          </label>
          {dialogStale && <p role="alert" className="text-sm text-dash-warning">Device readiness changed. Close this review and review the latest inspection before confirming.</p>}
          {state.error && <p role="alert" className="text-sm text-dash-danger">{state.error}</p>}
          <ModalFooter>
            <Button type="button" variant="secondary" disabled={busy} onClick={closeDialog}>Back</Button>
            <Button type="button" disabled={!editable || busy || hasPending || Boolean(dialogStale) || (dialog.kind === 'confirm' && Boolean(state.readError)) || !acknowledged || reason.trim().length < 3}
              onClick={() => void submitDialog()}>{busy ? 'Sending…' : dialog.kind === 'cancel' ? 'Cancel recovery' : 'Start recovery'}</Button>
          </ModalFooter>
        </div>}
      </Modal>
    </Card>
  )
}

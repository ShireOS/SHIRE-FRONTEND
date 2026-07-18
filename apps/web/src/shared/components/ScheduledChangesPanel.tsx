import { CalendarClock, Play, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  cancelScheduledChange,
  listScheduledChanges,
  publishScheduledChangeNow,
  type ScheduledChange,
} from '../api/scheduledChanges'

const OPEN_STATUSES = new Set(['pending', 'processing', 'failed'])

export function ScheduledChangesPanel() {
  const [changes, setChanges] = useState<ScheduledChange[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setChanges((await listScheduledChanges()).filter((change) => OPEN_STATUSES.has(change.status)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load scheduled changes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const act = async (id: string, action: 'publish' | 'cancel') => {
    setBusyId(id)
    setError('')
    try {
      if (action === 'publish') await publishScheduledChangeNow(id)
      else await cancelScheduledChange(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update scheduled change.')
    } finally {
      setBusyId('')
    }
  }

  if (!loading && changes.length === 0 && !error) return null

  return <section className="rounded-lg border border-dash-border bg-[var(--glass-bg)] p-4">
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2"><CalendarClock size={17} /><h2 className="text-sm font-semibold">Scheduled changes</h2></div>
      <button type="button" title="Refresh scheduled changes" aria-label="Refresh scheduled changes" disabled={loading} onClick={() => void load()} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
    </header>
    {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    <div className="mt-3 space-y-2">
      {changes.map((change) => <div key={change.id} className="flex flex-col gap-3 border-t border-dash-border pt-3 first:border-0 first:pt-0 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{change.label}</p><p className="mt-1 text-xs text-dash-tertiary">{new Date(change.scheduled_for).toLocaleString()} · {change.status}</p></div>
        <div className="flex gap-2">
          <button type="button" title="Publish now" aria-label={`Publish ${change.label} now`} disabled={busyId === change.id || change.status === 'processing'} onClick={() => void act(change.id, 'publish')} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border disabled:opacity-40"><Play size={14} /></button>
          <button type="button" title="Cancel" aria-label={`Cancel ${change.label}`} disabled={busyId === change.id || change.status === 'processing'} onClick={() => void act(change.id, 'cancel')} className="grid h-9 w-9 place-items-center rounded-md border border-red-500/30 text-red-500 disabled:opacity-40"><X size={15} /></button>
        </div>
      </div>)}
    </div>
  </section>
}

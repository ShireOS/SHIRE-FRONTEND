import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, CalendarClock, Check, Clock3, RefreshCw, X } from 'lucide-react'

import { useAuth } from '../../auth'
import {
  backOfficeApi,
  type ManagerInboxItem,
} from '../../shared/api/backOfficeApi'
import { useBackOfficeAccess } from '../../shared/hooks/useBackOfficeAccess'
import { SmartDateTimeInput } from '../../shared/components/SmartDateTimeInput'
import { queryClient, queryKeys } from '../../shared/query'

type Props = {
  restaurantId: string
}

function displayType(item: ManagerInboxItem) {
  if (item.type === 'missed_clock_out') return 'Time clock'
  if (item.type === 'shift_transfer') return 'Shift transfer'
  return item.type.replace(/_/g, ' ')
}

function formatDate(value?: string | null) {
  if (!value) return 'Not specified'
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? String(value) : parsed.toLocaleString()
}

function defaultCustomValue(item: ManagerInboxItem | null) {
  const value = item?.expected_at ? new Date(item.expected_at) : new Date()
  if (Number.isNaN(value.valueOf())) return ''
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export default function ManagerActionInboxPage({ restaurantId }: Props) {
  const auth = useAuth()
  const access = useBackOfficeAccess(auth, restaurantId)
  const [scope, setScope] = useState<'open' | 'all'>('open')
  const [items, setItems] = useState<ManagerInboxItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [customTime, setCustomTime] = useState('')
  const [note, setNote] = useState('')

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  )
  const canAdjustTimeclock = access.can('team.adjust_timeclock')
  const canEditEmployees = access.can('team.edit_employees')
  const canActOnSelected = selected?.source === 'operational' ? canAdjustTimeclock : canEditEmployees

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await backOfficeApi.managerInbox(restaurantId, scope)
      setItems(response.items)
      queryClient.setQueryData(queryKeys.managerInboxCount(restaurantId), {
        open_count: response.open_count,
      })
      setSelectedId((current) => response.items.some((item) => item.id === current) ? current : response.items[0]?.id ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load alerts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [restaurantId, scope])

  useEffect(() => {
    setCustomTime(defaultCustomValue(selected))
    setNote('')
  }, [selected?.id])

  const act = async (action: string) => {
    if (!selected) return
    if (!canActOnSelected) {
      setError(selected.source === 'operational'
        ? 'Time clock adjustment permission is required for this action.'
        : 'Employee editing permission is required for this action.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await backOfficeApi.actOnManagerInboxItem(restaurantId, selected, {
        action,
        ...(action === 'custom_time' && customTime
          ? { custom_clock_out_at: new Date(customTime).toISOString() }
          : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not complete that action.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-dash-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-mono">Manager actions</p>
          <h1 className="mt-2 text-3xl font-semibold">Alerts</h1>
          <p className="mt-2 text-sm text-dash-secondary">Resolve schedule approvals and operational exceptions from one queue.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-dash-border p-1">
            {(['open', 'all'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setScope(option)}
                className={`min-h-9 rounded-md px-3 text-xs font-semibold capitalize ${scope === option ? 'bg-dash-cream text-dash-base' : 'text-dash-secondary'}`}
              >
                {option}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh alerts"
            title="Refresh alerts"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-dash-border text-dash-secondary hover:text-dash-cream"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="border-l-2 border-red-400 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      <div className="grid min-h-[520px] overflow-hidden border border-dash-border lg:grid-cols-[minmax(280px,0.38fr)_minmax(0,0.62fr)]">
        <div className="border-b border-dash-border lg:border-b-0 lg:border-r">
          {loading && items.length === 0 ? (
            <p className="p-5 text-sm text-dash-secondary">Loading alerts...</p>
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <Check size={24} className="mx-auto text-emerald-400" />
              <p className="mt-3 font-semibold">Nothing needs action</p>
              <p className="mt-1 text-sm text-dash-secondary">New schedule requests and clock exceptions will appear here.</p>
            </div>
          ) : items.map((item) => (
            <button
              key={`${item.source}:${item.id}`}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={`flex w-full items-start gap-3 border-b border-dash-border px-4 py-4 text-left transition ${selected?.id === item.id ? 'bg-[var(--glass-bg-hover)]' : 'hover:bg-[var(--glass-bg)]'}`}
            >
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.severity === 'critical' ? 'bg-red-400/15 text-red-300' : item.severity === 'warning' ? 'bg-amber-300/15 text-amber-200' : 'bg-sky-300/10 text-sky-200'}`}>
                {item.source === 'operational' ? <AlertTriangle size={15} /> : <CalendarClock size={15} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-dash-cream">{item.title}</span>
                <span className="mt-1 block text-xs capitalize text-dash-tertiary">{displayType(item)} · {formatDate(item.occurred_at)}</span>
              </span>
              <ArrowRight size={14} className="mt-2 shrink-0 text-dash-tertiary" />
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-7">
          {!selected ? null : (
            <div className="mx-auto max-w-2xl space-y-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="label-mono">{displayType(selected)}</span>
                  <span className="rounded-md border border-dash-border px-2 py-1 text-[10px] font-semibold uppercase text-dash-secondary">{selected.status}</span>
                </div>
                <h2 className="mt-3 text-2xl font-semibold">{selected.title}</h2>
                <p className="mt-2 text-sm leading-6 text-dash-secondary">{selected.message}</p>
              </div>

              <dl className="grid gap-px overflow-hidden border border-dash-border bg-dash-border sm:grid-cols-2">
                <div className="bg-dash-base p-4">
                  <dt className="label-mono">Employee</dt>
                  <dd className="mt-2 text-sm font-semibold">{selected.employee_name || 'Not specified'}</dd>
                </div>
                <div className="bg-dash-base p-4">
                  <dt className="label-mono">Expected time</dt>
                  <dd className="mt-2 text-sm font-semibold">{formatDate(selected.expected_at)}</dd>
                </div>
              </dl>

              {selected.available_actions.length > 0 && !canActOnSelected && (
                <div className="border-t border-dash-border pt-5 text-sm text-dash-secondary">
                  You can view this alert, but you do not have permission to resolve it.
                </div>
              )}

              {selected.available_actions.length > 0 && selected.source === 'operational' && canAdjustTimeclock && (
                <div className="space-y-4 border-t border-dash-border pt-5">
                  <div>
                    <p className="label-mono">Custom clock-out</p>
                    <SmartDateTimeInput
                      ariaLabel="Custom clock-out"
                      minuteStep={1}
                      value={customTime}
                      onChange={setCustomTime}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <label className="label-mono" htmlFor="alert-note">Manager note</label>
                    <input
                      id="alert-note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Optional audit note"
                      className="mt-2 min-h-11 w-full rounded-lg border border-dash-border bg-dash-base px-3 text-sm outline-none placeholder:text-dash-tertiary focus:border-shell-accent"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" disabled={saving} onClick={() => void act('scheduled_time')} className="min-h-11 rounded-lg bg-dash-cream px-4 text-sm font-semibold text-dash-base disabled:opacity-50">Use scheduled time</button>
                    <button type="button" disabled={saving || !customTime} onClick={() => void act('custom_time')} className="min-h-11 rounded-lg border border-dash-border px-4 text-sm font-semibold disabled:opacity-50">Use custom time</button>
                    <button type="button" disabled={saving} onClick={() => void act('clock_out_now')} className="min-h-11 rounded-lg border border-dash-border px-4 text-sm font-semibold disabled:opacity-50"><Clock3 size={14} className="mr-2 inline" />Clock out now</button>
                    <button type="button" disabled={saving} onClick={() => void act('dismiss')} className="min-h-11 rounded-lg border border-dash-border px-4 text-sm font-semibold text-dash-secondary disabled:opacity-50"><X size={14} className="mr-2 inline" />Still working / dismiss</button>
                  </div>
                </div>
              )}

              {selected.available_actions.length > 0 && selected.source !== 'operational' && canEditEmployees && (
                <div className="flex flex-col gap-2 border-t border-dash-border pt-5 sm:flex-row sm:justify-end">
                  <button type="button" disabled={saving} onClick={() => void act('deny')} className="min-h-11 rounded-lg border border-red-400/40 px-5 text-sm font-semibold text-red-200 disabled:opacity-50">Deny</button>
                  <button type="button" disabled={saving} onClick={() => void act('approve')} className="min-h-11 rounded-lg bg-dash-cream px-5 text-sm font-semibold text-dash-base disabled:opacity-50">Approve</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

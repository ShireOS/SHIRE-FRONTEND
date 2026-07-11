import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  X,
} from 'lucide-react'
import { fetchCached, fetchWithSupabaseAuth, queryKeys } from '../../shared/query'
import { posTimeClockApi } from '../../shared/api/posClient'
import { Badge } from '../components/shared/Badge'
import { Button } from '../components/shared/Button'
import { Modal, ModalFooter } from '../components/shared/Modal'
import TimeEventModal from '../components/timeclock/TimeEventModal'

// ---------- date helpers (everything displayed in the browser's local tz) ----------

const pad = (n) => String(n).padStart(2, '0')
const dateKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseKey = (key) => new Date(`${key}T00:00:00`)
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
// Monday-start weeks (matches Linga's labor week)
const startOfWeek = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const fmtDay = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const timeInputValue = (iso) => {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
// Keep the base timestamp's local date, swap in a new HH:MM.
const combineIsoTime = (baseIso, hhmm) => {
  const d = new Date(baseIso)
  const [h, m] = hhmm.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
const money = (value) =>
  `$${Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const hoursOf = (minutes) => (Number(minutes || 0) / 60).toFixed(2)

const unpaidBreakMinutes = (entry) =>
  (entry.breaks || []).reduce((sum, b) => {
    if (b.break_type !== 'unpaid' || !b.break_in_at || !b.break_out_at) return sum
    return sum + Math.max(0, Math.round((new Date(b.break_out_at) - new Date(b.break_in_at)) / 60000))
  }, 0)

// Same convention as TipPoolingPage: a pay run covers [window_start, window_end].
const runLabel = (run) => {
  const start = new Date(run.window_start)
  const end = new Date(run.window_end)
  const fmt = { month: 'short', day: 'numeric' }
  if (end - start <= 26 * 60 * 60 * 1000) return start.toLocaleDateString('en-US', { ...fmt, year: 'numeric' })
  return `${start.toLocaleDateString('en-US', fmt)} – ${end.toLocaleDateString('en-US', { ...fmt, year: 'numeric' })}`
}

const selectCls =
  'rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2.5 py-1.5 text-sm text-dash-cream outline-none focus:border-dash-gold/60'

// ---------- small pieces ----------

function RoleChip({ role }) {
  return (
    <span className="rounded-full border border-dash-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em] text-dash-secondary">
      {role}
    </span>
  )
}

function AdjustedBadge({ entry }) {
  if (!entry.edited_by_manager_name) return null
  return (
    <span
      title={`by ${entry.edited_by_manager_name} — ${entry.edit_reason || 'no reason recorded'}`}
      className="cursor-help"
    >
      <Badge variant="gold" className="!px-1.5 !py-0.5 !text-[10px]">Adjusted</Badge>
    </span>
  )
}

/**
 * Click-to-edit time cell. Enter/blur stages the change, then a tiny popover
 * asks for a reason (default "time correction") before committing. Escape cancels.
 */
function InlineTimeCell({ iso, baseIso, disabled, onCommit }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [pendingIso, setPendingIso] = useState(null)
  const [reason, setReason] = useState('time correction')
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setEditing(false)
    setPendingIso(null)
    setReason('time correction')
  }
  const begin = () => {
    if (disabled) return
    setValue(iso ? timeInputValue(iso) : '')
    setEditing(true)
  }
  const stage = () => {
    setEditing(false)
    if (!value || (iso && value === timeInputValue(iso))) return reset()
    setPendingIso(combineIsoTime(iso || baseIso, value))
  }
  const save = async () => {
    setSaving(true)
    await onCommit(pendingIso, reason.trim() || 'time correction')
    setSaving(false)
    reset()
  }

  return (
    <div className="relative inline-block">
      {editing ? (
        <input
          type="time"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={stage}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              e.preventDefault()
              reset()
            }
          }}
          className="w-24 rounded-lg border border-dash-gold/60 bg-[var(--glass-bg)] px-2 py-0.5 font-mono text-xs text-dash-cream outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={begin}
          disabled={disabled}
          title={disabled ? undefined : 'Click to edit'}
          className="rounded px-1 py-0.5 font-mono text-xs tabular-nums text-dash-cream hover:bg-dash-cream/10 disabled:cursor-default disabled:hover:bg-transparent"
        >
          {iso ? fmtTime(iso) : '—'}
        </button>
      )}
      {pendingIso ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-60 rounded-xl border border-dash-border bg-dash-surface p-2.5 shadow-xl">
          <p className="mb-1.5 text-[11px] text-dash-tertiary">
            New time <span className="font-mono text-dash-cream">{fmtTime(pendingIso)}</span> — reason?
          </p>
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !saving) void save()
              if (e.key === 'Escape') reset()
            }}
            className="w-full rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2 py-1 text-xs text-dash-cream outline-none focus:border-dash-gold/60"
          />
          <div className="mt-2 flex justify-end gap-1.5">
            <button type="button" onClick={reset} className="rounded-lg px-2 py-1 text-xs text-dash-secondary hover:text-dash-cream">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-lg border border-dash-gold bg-dash-gold/10 px-2 py-1 text-xs font-medium text-dash-gold hover:bg-dash-gold/20 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EstPayCell({ laborCost }) {
  if (laborCost == null) {
    return (
      <span className="text-dash-tertiary">
        — <span className="text-[10px]">no rate</span>
      </span>
    )
  }
  return <span className="tabular-nums text-dash-cream">{money(laborCost)}</span>
}

function PermissionNotice() {
  return (
    <div className="glass-card rounded-2xl p-8 text-center">
      <Ban size={22} className="mx-auto text-dash-tertiary" />
      <p className="mt-3 text-base font-semibold text-dash-cream">You don't have permission to adjust the time clock</p>
      <p className="mt-1.5 text-sm text-dash-secondary">
        Ask the restaurant owner to grant your account manager access to time-clock adjustments.
      </p>
    </div>
  )
}

function PosBackendNotice({ message }) {
  return (
    <div className="rounded-2xl border border-amber-400/40 bg-amber-400/[0.06] p-5 text-sm text-amber-100/90">
      <p className="font-semibold text-amber-200">POS backend not reachable</p>
      <p className="mt-2 max-w-2xl leading-relaxed text-amber-100/80">
        Time-clock data lives in the POS API. Check that the POS backend is running and that{' '}
        <span className="font-mono">VITE_POS_API_BASE_URL</span> points at it (dev default{' '}
        <span className="font-mono">http://localhost:8005/api/v1/dev-v2</span>).
        {message ? <span className="mt-1 block font-mono text-[11px] text-amber-100/60">{message}</span> : null}
      </p>
    </div>
  )
}

// ---------- page ----------

export default function TimeClockPage({ restaurantId }) {
  const navigate = useNavigate()

  const [anchorKey, setAnchorKey] = useState(() => dateKeyOf(new Date()))
  const [view, setView] = useState('week') // 'day' | 'week'
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // all | open | edited | missing

  const [report, setReport] = useState(null)
  const [waiters, setWaiters] = useState([])
  const [runs, setRuns] = useState(null) // null → runs unavailable/unprovisioned, skip pay-run check
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState('')
  const [payRunWarning, setPayRunWarning] = useState(null)

  const [expanded, setExpanded] = useState(() => new Set())
  const [modal, setModal] = useState(null) // { mode:'create', staffId?, dateKey? } | { mode:'edit', entry }
  const [voidTarget, setVoidTarget] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  const anchorDate = useMemo(() => parseKey(anchorKey), [anchorKey])
  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate])
  const weekStartKey = dateKeyOf(weekStart)
  const weekEndKey = dateKeyOf(addDays(weekStart, 6))
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStartKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- loads ----------

  const loadReport = async (force = false) => {
    try {
      setLoadError(null)
      const data = await fetchCached(
        queryKeys.timeClockRange(restaurantId, weekStartKey, weekEndKey),
        () => posTimeClockApi.rangeReport(restaurantId, weekStartKey, weekEndKey),
        force ? 0 : 60 * 1000,
      )
      setReport(data)
    } catch (err) {
      setReport(null)
      setLoadError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    void loadReport()
  }, [restaurantId, weekStartKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    fetchCached(
      queryKeys.waiters(restaurantId),
      () => fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=false`),
    )
      .then((rows) => {
        if (!cancelled) setWaiters(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setWaiters([])
      })
    // Pay runs power the "edit inside a finalized run" warning. A 404 (or any
    // failure) means unprovisioned/unreachable — silently skip the check.
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/tip-pools/runs`)
      .then((rows) => {
        if (!cancelled) setRuns(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setRuns(null)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  // ---------- mutations ----------

  const finalizedRunFor = (iso) => {
    if (!runs?.length || !iso) return null
    const t = new Date(iso).getTime()
    return (
      runs.find(
        (r) =>
          r.status === 'finalized' &&
          new Date(r.window_start).getTime() <= t &&
          t <= new Date(r.window_end).getTime(),
      ) || null
    )
  }

  const afterMutation = async (affectedIso) => {
    await loadReport(true)
    const run = finalizedRunFor(affectedIso)
    if (run) setPayRunWarning({ label: runLabel(run) })
  }

  const commitTimeEdit = async (entry, patch, reason) => {
    setActionError('')
    try {
      // The PATCH body requires both timestamps — send existing values for the
      // untouched side (clock_out may legitimately be null → open entry).
      await posTimeClockApi.updateEntry(restaurantId, entry.id, {
        clock_in_at: patch.clock_in_at ?? entry.clock_in_at,
        clock_out_at: 'clock_out_at' in patch ? patch.clock_out_at : entry.clock_out_at ?? null,
        reason,
      })
      await afterMutation(patch.clock_in_at || entry.clock_in_at)
    } catch (err) {
      setActionError(err?.message || 'Could not update the entry')
    }
  }

  const confirmVoid = async () => {
    if (!voidTarget || !voidReason.trim()) return
    setVoiding(true)
    setActionError('')
    try {
      await posTimeClockApi.voidEntry(restaurantId, voidTarget.id, voidReason.trim())
      const affected = voidTarget.clock_in_at
      setVoidTarget(null)
      setVoidReason('')
      await afterMutation(affected)
    } catch (err) {
      setActionError(err?.message || 'Could not void the entry')
    } finally {
      setVoiding(false)
    }
  }

  const handleModalSaved = async (clockInIso) => {
    setModal(null)
    await afterMutation(clockInIso)
  }

  const openCreate = (staffId, dateKey) => setModal({ mode: 'create', staffId, dateKey })
  const openEdit = (entry) => setModal({ mode: 'edit', entry })

  // ---------- derived view data ----------

  const roleOptions = useMemo(() => {
    const roles = new Set()
    waiters.forEach((w) => {
      const list = (w.roles || []).filter(Boolean)
      ;(list.length ? list : [w.role]).filter(Boolean).forEach((r) => roles.add(r))
    })
    ;(report?.entries || []).forEach((e) => e.role && roles.add(e.role))
    return [...roles].sort()
  }, [waiters, report])

  const entryMatches = (e) => {
    if (roleFilter !== 'all' && e.role !== roleFilter) return false
    if (statusFilter === 'open' && e.status !== 'open') return false
    if (statusFilter === 'edited' && !e.edited_by_manager_name) return false
    return true
  }

  const cards = useMemo(() => {
    const waitersById = new Map(waiters.map((w) => [w.id, w]))
    const byStaff = new Map()
    for (const s of report?.staff || []) byStaff.set(s.staff_id, { staff: s, entries: [] })
    // Let the manager pick an employee with zero punches and see 7 "add" rows.
    if (employeeFilter !== 'all' && !byStaff.has(employeeFilter)) {
      const w = waitersById.get(employeeFilter)
      if (w) {
        byStaff.set(w.id, {
          staff: {
            staff_id: w.id,
            staff_name: w.name,
            role: w.role,
            worked_minutes: 0,
            labor_cost: 0,
            has_missing_labor_rate: false,
            entries: 0,
            open: false,
          },
          entries: [],
        })
      }
    }
    for (const e of report?.entries || []) {
      const slot = byStaff.get(e.staff_id)
      if (slot) slot.entries.push(e)
    }

    let list = [...byStaff.values()]
    if (employeeFilter !== 'all') list = list.filter((c) => c.staff.staff_id === employeeFilter)

    list = list.map((c) => {
      const filtered = c.entries
        .filter(entryMatches)
        .sort((a, b) => new Date(a.clock_in_at) - new Date(b.clock_in_at))
      const byDay = new Map()
      for (const e of filtered) {
        const k = dateKeyOf(new Date(e.clock_in_at))
        if (!byDay.has(k)) byDay.set(k, [])
        byDay.get(k).push(e)
      }
      const waiter = waitersById.get(c.staff.staff_id)
      const allowedRoles = (waiter?.roles || []).filter(Boolean)
      return {
        ...c,
        filtered,
        byDay,
        waiter,
        allowedRoles: allowedRoles.length ? allowedRoles : [waiter?.role || c.staff.role].filter(Boolean),
      }
    })

    if (statusFilter === 'missing') {
      list = list.filter((c) => weekDays.some((d) => !c.byDay.has(dateKeyOf(d))))
    } else if (statusFilter !== 'all' || roleFilter !== 'all') {
      list = list.filter((c) => c.filtered.length > 0)
    }
    return list.sort((a, b) => a.staff.staff_name.localeCompare(b.staff.staff_name))
    // entryMatches is derived from the same filter state below
  }, [report, waiters, employeeFilter, roleFilter, statusFilter, weekDays]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayedEntries = useMemo(() => {
    if (statusFilter === 'missing') return []
    return cards.flatMap((c) => (view === 'day' ? c.byDay.get(anchorKey) || [] : c.filtered))
  }, [cards, view, anchorKey, statusFilter])

  const totals = useMemo(() => {
    let minutes = 0
    let cost = 0
    let missingRate = false
    for (const e of displayedEntries) {
      minutes += Number(e.worked_minutes || 0)
      if (e.labor_cost == null) missingRate = true
      else cost += Number(e.labor_cost)
    }
    return { minutes, cost, missingRate }
  }, [displayedEntries])

  const showNoPunchRows = statusFilter === 'all' || statusFilter === 'missing'
  const hideEntries = statusFilter === 'missing'

  const step = (dir) => setAnchorKey(dateKeyOf(addDays(anchorDate, dir * (view === 'week' ? 7 : 1))))
  const rangeLabel =
    view === 'week'
      ? `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${addDays(weekStart, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : anchorDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  const toggleExpanded = (staffId) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(staffId)) next.delete(staffId)
      else next.add(staffId)
      return next
    })

  // ---------- row renderers ----------

  const entryCells = (e) => {
    const breakMins = unpaidBreakMinutes(e)
    return (
      <>
        <td className="py-2 pr-3">
          <InlineTimeCell
            iso={e.clock_in_at}
            baseIso={e.clock_in_at}
            onCommit={(iso, reason) => commitTimeEdit(e, { clock_in_at: iso }, reason)}
          />
        </td>
        <td className="py-2 pr-3">
          <div className="flex items-center gap-2">
            <InlineTimeCell
              iso={e.clock_out_at}
              baseIso={e.clock_out_at || e.clock_in_at}
              onCommit={(iso, reason) => commitTimeEdit(e, { clock_out_at: iso }, reason)}
            />
            {e.status === 'open' ? (
              <Badge variant="warning" dot className="!px-1.5 !py-0.5 !text-[10px]">still clocked in</Badge>
            ) : null}
          </div>
        </td>
        <td className="py-2 pr-3">
          <button
            type="button"
            onClick={() => openEdit(e)}
            title="Edit breaks"
            className="rounded px-1 py-0.5 font-mono text-xs tabular-nums text-dash-secondary hover:bg-dash-cream/10 hover:text-dash-cream"
          >
            {breakMins > 0 ? `${breakMins}m` : '—'}
          </button>
        </td>
        <td className="py-2 pr-3"><RoleChip role={e.role} /></td>
        <td className="py-2 pr-3 text-right font-mono text-xs tabular-nums text-dash-cream">{hoursOf(e.worked_minutes)}</td>
        <td className="py-2 pr-3 text-right text-xs"><EstPayCell laborCost={e.labor_cost} /></td>
        <td className="py-2 text-right">
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => openEdit(e)}
              title="Edit entry"
              className="rounded-lg p-1.5 text-dash-tertiary hover:bg-dash-cream/10 hover:text-dash-cream"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                setVoidTarget(e)
                setVoidReason('')
              }}
              title="Void entry"
              className="rounded-lg p-1.5 text-dash-tertiary hover:bg-dash-danger/10 hover:text-dash-danger"
            >
              <Ban size={13} />
            </button>
          </div>
        </td>
      </>
    )
  }

  const noPunchRow = (key, leading, staffId, dateKey, columns) => (
    <tr key={key} className="border-b border-dash-border/30">
      {leading}
      <td colSpan={columns} className="py-1.5 pr-3">
        <button
          type="button"
          onClick={() => openCreate(staffId, dateKey)}
          className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-xs text-dash-tertiary hover:text-dash-gold"
        >
          no punch · <Plus size={11} /> add
        </button>
      </td>
    </tr>
  )

  const tableHead = (firstColumn) => (
    <thead>
      <tr className="border-b border-dash-border text-left font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">
        <th className="py-2 pr-3">{firstColumn}</th>
        <th className="py-2 pr-3">In</th>
        <th className="py-2 pr-3">Out</th>
        <th className="py-2 pr-3">Break</th>
        <th className="py-2 pr-3">Role</th>
        <th className="py-2 pr-3 text-right">Hours</th>
        <th className="py-2 pr-3 text-right">Est. pay</th>
        <th className="py-2 text-right">Actions</th>
      </tr>
    </thead>
  )

  // ---------- render ----------

  if (!restaurantId) return null

  const permissionDenied = loadError?.status === 403

  return (
    <div className="space-y-5">
      {/* finalized pay-run warning */}
      {payRunWarning ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/[0.08] px-4 py-3 text-sm text-amber-100/90">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={16} className="shrink-0 text-amber-300" />
            <span>
              This change falls inside finalized pay run <b>{payRunWarning.label}</b>. Re-run payroll to reflect it.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/restaurants/${restaurantId}/tip-pooling`)}
              className="rounded-lg border border-amber-300/50 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-400/10"
            >
              Open Payroll &amp; Tips
            </button>
            <button
              type="button"
              onClick={() => setPayRunWarning(null)}
              title="Dismiss"
              className="rounded-lg p-1 text-amber-200/70 hover:text-amber-100"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}

      {/* header */}
      <section className="glass-card rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock size={15} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
              <p className="label-mono">Labor</p>
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-dash-cream">Time Clock</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-dash-secondary">
              Fix missed punches, force clock-ins and clock-outs, and keep an audit trail. Times shown in your local timezone.
            </p>
          </div>
          <Button icon={<Plus size={15} />} onClick={() => openCreate(undefined, anchorKey)}>
            Time Event
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {/* navigator */}
          <div className="flex items-center gap-1 rounded-lg border border-dash-border px-1 py-0.5">
            <button type="button" onClick={() => step(-1)} title="Previous" className="rounded p-1 text-dash-secondary hover:text-dash-cream">
              <ChevronLeft size={15} />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm font-medium tabular-nums text-dash-cream">{rangeLabel}</span>
            <button type="button" onClick={() => step(1)} title="Next" className="rounded p-1 text-dash-secondary hover:text-dash-cream">
              <ChevronRight size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setAnchorKey(dateKeyOf(new Date()))}
            className="rounded-lg border border-dash-border px-2.5 py-1.5 text-xs text-dash-secondary hover:border-dash-gold/50 hover:text-dash-cream"
          >
            Today
          </button>

          {/* day/week toggle */}
          <div className="flex overflow-hidden rounded-lg border border-dash-border">
            {['day', 'week'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition ${
                  view === v ? 'bg-dash-gold/15 text-dash-gold' : 'text-dash-secondary hover:text-dash-cream'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <span className="mx-1 hidden h-5 w-px bg-dash-border sm:block" />

          {/* filters */}
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={selectCls} aria-label="Employee filter">
            <option value="all">All employees</option>
            {waiters.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectCls} aria-label="Role filter">
            <option value="all">All roles</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls} aria-label="Status filter">
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="edited">Edited</option>
            <option value="missing">Missing punch</option>
          </select>
        </div>
      </section>

      {actionError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{actionError}</div>
      ) : null}

      {/* body */}
      {permissionDenied ? (
        <PermissionNotice />
      ) : loadError ? (
        <PosBackendNotice message={loadError?.message} />
      ) : loading ? (
        <div className="glass-card rounded-2xl p-5 text-sm text-dash-secondary">Loading time clock…</div>
      ) : !cards.length ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <p className="text-sm text-dash-secondary">
            {statusFilter !== 'all' || roleFilter !== 'all' || employeeFilter !== 'all'
              ? 'Nothing matches these filters.'
              : `No punches ${view === 'week' ? 'this week' : 'on this day'}.`}
          </p>
          <Button className="mt-4" variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => openCreate(undefined, anchorKey)}>
            Add a time event
          </Button>
        </div>
      ) : view === 'day' ? (
        /* ---------- DAY VIEW: flat list ---------- */
        <section className="glass-card rounded-2xl p-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              {tableHead('Employee')}
              <tbody>
                {cards.map((card) => {
                  const dayEntries = card.byDay.get(anchorKey) || []
                  const staffCell = (extra) => (
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-dash-cream">{card.staff.staff_name}</span>
                        {extra}
                      </div>
                    </td>
                  )
                  if (!dayEntries.length) {
                    if (!showNoPunchRows) return null
                    return noPunchRow(`${card.staff.staff_id}-none`, staffCell(null), card.staff.staff_id, anchorKey, 7)
                  }
                  if (hideEntries) return null // "missing punch" filter: they punched this day
                  return dayEntries.map((e, i) => (
                    <tr key={e.id} className="border-b border-dash-border/40">
                      {i === 0 ? staffCell(<AdjustedBadge entry={e} />) : (
                        <td className="py-2 pr-3">
                          <span className="pl-1 text-xs text-dash-tertiary">↳</span> <AdjustedBadge entry={e} />
                        </td>
                      )}
                      {entryCells(e)}
                    </tr>
                  ))
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        /* ---------- WEEK VIEW: card per employee ---------- */
        <div className="space-y-3">
          {cards.map((card) => {
            const isOpen = expanded.has(card.staff.staff_id) || cards.length === 1
            const staffMinutes = card.filtered.reduce((s, e) => s + Number(e.worked_minutes || 0), 0)
            const staffCost = card.filtered.reduce((s, e) => s + (e.labor_cost != null ? Number(e.labor_cost) : 0), 0)
            const missingRate = card.filtered.some((e) => e.labor_cost == null)
            return (
              <section key={card.staff.staff_id} className="glass-card rounded-2xl">
                <button
                  type="button"
                  onClick={() => toggleExpanded(card.staff.staff_id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl px-5 py-3.5 text-left transition hover:bg-dash-cream/[0.03]"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <ChevronDown
                      size={15}
                      className={`text-dash-tertiary transition-transform ${isOpen ? '' : '-rotate-90'}`}
                    />
                    <span className="text-sm font-semibold text-dash-cream">{card.staff.staff_name}</span>
                    <span className="flex flex-wrap gap-1">
                      {card.allowedRoles.map((r) => <RoleChip key={r} role={r} />)}
                    </span>
                    {card.filtered.some((e) => e.status === 'open') ? (
                      <Badge variant="warning" dot className="!px-1.5 !py-0.5 !text-[10px]">still clocked in</Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-dash-secondary">
                    <span>{card.filtered.length} {card.filtered.length === 1 ? 'entry' : 'entries'}</span>
                    <span className="font-mono tabular-nums text-dash-cream">{hoursOf(staffMinutes)} hrs</span>
                    <span className="font-mono tabular-nums text-dash-cream">
                      {money(staffCost)}
                      {missingRate ? <span className="ml-1 text-[10px] text-dash-tertiary">(partial — no rate)</span> : null}
                    </span>
                  </div>
                </button>
                {isOpen ? (
                  <div className="overflow-x-auto border-t border-dash-border px-5 pb-4 pt-1">
                    <table className="w-full min-w-[840px] text-sm">
                      {tableHead('Day')}
                      <tbody>
                        {weekDays.map((day) => {
                          const k = dateKeyOf(day)
                          const dayEntries = card.byDay.get(k) || []
                          const dayCell = (extra) => (
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2 whitespace-nowrap text-xs text-dash-secondary">
                                <span>{fmtDay(day)}</span>
                                {extra}
                              </div>
                            </td>
                          )
                          if (!dayEntries.length) {
                            if (!showNoPunchRows) return null
                            return noPunchRow(k, dayCell(null), card.staff.staff_id, k, 7)
                          }
                          if (hideEntries) return null // "missing punch" filter: this day has a punch
                          return dayEntries.map((e, i) => (
                            <tr key={e.id} className="border-b border-dash-border/40">
                              {dayCell(i === 0 ? <AdjustedBadge entry={e} /> : <><span className="text-dash-tertiary">↳</span><AdjustedBadge entry={e} /></>)}
                              {entryCells(e)}
                            </tr>
                          ))
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      )}

      {/* totals footer */}
      {!loading && !loadError && cards.length ? (
        <section className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3.5">
          <p className="label-mono">{view === 'week' ? 'Week totals' : 'Day totals'}</p>
          <div className="flex items-center gap-5 text-sm">
            <span className="text-dash-secondary">
              <span className="font-mono font-semibold tabular-nums text-dash-cream">{hoursOf(totals.minutes)}</span> hrs
            </span>
            <span className="text-dash-secondary">
              <span className="font-mono font-semibold tabular-nums text-dash-cream">{money(totals.cost)}</span> est. pay
              {totals.missingRate ? <span className="ml-1.5 text-[11px] text-dash-tertiary">some staff have no pay rate</span> : null}
            </span>
          </div>
        </section>
      ) : null}

      {/* create / edit modal */}
      {modal ? (
        <TimeEventModal
          restaurantId={restaurantId}
          mode={modal.mode}
          entry={modal.entry}
          waiters={waiters}
          prefill={{ staffId: modal.staffId, dateKey: modal.dateKey }}
          onClose={() => setModal(null)}
          onSaved={handleModalSaved}
        />
      ) : null}

      {/* void confirm */}
      {voidTarget ? (
        <Modal isOpen onClose={() => setVoidTarget(null)} title="Void time entry" size="sm">
          <p className="text-sm text-dash-secondary">
            Void <span className="font-medium text-dash-cream">{voidTarget.staff_name}</span> ·{' '}
            {fmtDay(new Date(voidTarget.clock_in_at))} · {fmtTime(voidTarget.clock_in_at)} –{' '}
            {voidTarget.clock_out_at ? fmtTime(voidTarget.clock_out_at) : 'open'}? The entry is removed from labor
            reports but stays in the audit trail.
          </p>
          <label className="mt-4 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">Reason (required)</span>
            <input
              autoFocus
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && voidReason.trim() && !voiding) void confirmVoid()
              }}
              placeholder="e.g. duplicate punch"
              className="w-full rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2.5 py-1.5 text-sm text-dash-cream outline-none focus:border-dash-gold/60"
            />
          </label>
          <ModalFooter className="mt-5">
            <Button variant="ghost" onClick={() => setVoidTarget(null)} disabled={voiding}>Cancel</Button>
            <Button variant="danger" onClick={() => void confirmVoid()} disabled={voiding || !voidReason.trim()}>
              {voiding ? 'Voiding…' : 'Void entry'}
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </div>
  )
}

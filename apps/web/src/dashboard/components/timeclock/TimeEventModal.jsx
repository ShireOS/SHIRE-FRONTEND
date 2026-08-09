import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal, ModalFooter } from '../shared/Modal'
import { Button } from '../shared/Button'
import { posTimeClockApi } from '../../../shared/api/posClient'
import { SmartTimeInput } from '../../../shared/components/SmartTimeInput'

const pad = (n) => String(n).padStart(2, '0')
const isoToDateInput = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const isoToTimeInput = (iso) => {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
// Combine a date input + time input (both local) into a UTC ISO string.
const partsToIso = (date, time) => {
  if (!date || !time) return null
  const d = new Date(`${date}T${time}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

let breakSeq = 0
const newBreakRow = (date) => ({
  rowKey: `new-${breakSeq++}`,
  id: null,
  break_name: 'Break',
  break_type: 'unpaid',
  inDate: date,
  inTime: '',
  outDate: date,
  outTime: '',
})

const inputCls =
  'w-full rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2.5 py-1.5 text-sm text-dash-cream outline-none focus:border-dash-gold/60'

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">{label}</span>
      {children}
    </label>
  )
}

/**
 * Create / edit a manager time-clock entry (forced punch).
 * mode: 'create' | 'edit'. For create, `prefill` may carry { staffId, dateKey }.
 * onSaved(clockInIso) fires after the API call succeeds.
 */
export default function TimeEventModal({ restaurantId, mode, entry, waiters, prefill, onClose, onSaved }) {
  const isEdit = mode === 'edit'

  const [form, setForm] = useState(() => {
    if (isEdit && entry) {
      return {
        staffId: entry.staff_id,
        role: entry.role || 'server',
        businessDate: isoToDateInput(entry.clock_in_at),
        inDate: isoToDateInput(entry.clock_in_at),
        inTime: isoToTimeInput(entry.clock_in_at),
        outDate: entry.clock_out_at ? isoToDateInput(entry.clock_out_at) : isoToDateInput(entry.clock_in_at),
        outTime: entry.clock_out_at ? isoToTimeInput(entry.clock_out_at) : '',
        breaks: (entry.breaks || []).map((b) => ({
          rowKey: b.id || `new-${breakSeq++}`,
          id: b.id || null,
          break_name: b.break_name || 'Break',
          break_type: b.break_type === 'paid' ? 'paid' : 'unpaid',
          inDate: b.break_in_at ? isoToDateInput(b.break_in_at) : isoToDateInput(entry.clock_in_at),
          inTime: b.break_in_at ? isoToTimeInput(b.break_in_at) : '',
          outDate: b.break_out_at
            ? isoToDateInput(b.break_out_at)
            : b.break_in_at
              ? isoToDateInput(b.break_in_at)
              : isoToDateInput(entry.clock_in_at),
          outTime: b.break_out_at ? isoToTimeInput(b.break_out_at) : '',
        })),
        reason: '',
      }
    }
    const dateKey = prefill?.dateKey || isoToDateInput(new Date().toISOString())
    const staffId = prefill?.staffId || waiters?.[0]?.id || ''
    const waiter = (waiters || []).find((w) => w.id === staffId)
    return {
      staffId,
      role: waiter?.role || waiter?.roles?.[0] || 'server',
      businessDate: dateKey,
      inDate: dateKey,
      inTime: '09:00',
      outDate: dateKey,
      outTime: '',
      breaks: [],
      reason: '',
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedWaiter = (waiters || []).find((w) => w.id === form.staffId)
  const allowedRoles = useMemo(() => {
    const multi = (selectedWaiter?.roles || []).filter(Boolean)
    const base = multi.length ? multi : [selectedWaiter?.role].filter(Boolean)
    const roles = base.length ? base : ['server']
    // Keep a legacy role selectable when editing an old entry.
    if (isEdit && entry?.role && !roles.includes(entry.role)) return [entry.role, ...roles]
    if (form.role && !roles.includes(form.role)) return [form.role, ...roles]
    return roles
  }, [selectedWaiter, isEdit, entry, form.role])

  const patch = (updates) => {
    setError('')
    setForm((f) => ({ ...f, ...updates }))
  }

  const setStaff = (id) => {
    const w = (waiters || []).find((x) => x.id === id)
    patch({ staffId: id, role: w?.role || w?.roles?.[0] || 'server' })
  }

  // Business date drives the default day for check-in/out and breaks; changing
  // it shifts every date field that still matched the old business date.
  const setBusinessDate = (next) => {
    setError('')
    setForm((f) => ({
      ...f,
      businessDate: next,
      inDate: f.inDate === f.businessDate ? next : f.inDate,
      outDate: f.outDate === f.businessDate ? next : f.outDate,
      breaks: f.breaks.map((b) => ({
        ...b,
        inDate: b.inDate === f.businessDate ? next : b.inDate,
        outDate: b.outDate === f.businessDate ? next : b.outDate,
      })),
    }))
  }

  const patchBreak = (rowKey, updates) => {
    setError('')
    setForm((f) => ({
      ...f,
      breaks: f.breaks.map((b) => (b.rowKey === rowKey ? { ...b, ...updates } : b)),
    }))
  }
  const removeBreak = (rowKey) => {
    setForm((f) => ({ ...f, breaks: f.breaks.filter((b) => b.rowKey !== rowKey) }))
  }

  const inIso = partsToIso(form.inDate, form.inTime)
  const outIso = form.outTime ? partsToIso(form.outDate || form.inDate, form.outTime) : null
  const breakIsos = form.breaks.map((b) => ({
    ...b,
    inIso: partsToIso(b.inDate, b.inTime),
    outIso: b.outTime ? partsToIso(b.outDate || b.inDate, b.outTime) : null,
  }))

  const problems = useMemo(() => {
    const list = []
    if (!isEdit && !form.staffId) list.push('Pick an employee')
    if (!inIso) list.push('Check-in date and time are required')
    if (form.outTime && !outIso) list.push('Check-out date/time is incomplete')
    if (inIso && outIso && new Date(outIso) < new Date(inIso)) list.push('Check-out must be at or after check-in')
    breakIsos.forEach((b, i) => {
      const n = i + 1
      if (!b.break_name.trim()) list.push(`Break ${n}: name is required`)
      if (!b.inIso) list.push(`Break ${n}: start date/time is required`)
      if (b.outTime && !b.outIso) list.push(`Break ${n}: end date/time is incomplete`)
      if (b.inIso && b.outIso && new Date(b.outIso) < new Date(b.inIso)) list.push(`Break ${n}: end must be after start`)
      if (b.inIso && inIso && new Date(b.inIso) < new Date(inIso)) list.push(`Break ${n}: starts before check-in`)
      if (outIso) {
        if (b.inIso && new Date(b.inIso) > new Date(outIso)) list.push(`Break ${n}: starts after check-out`)
        if (b.outIso && new Date(b.outIso) > new Date(outIso)) list.push(`Break ${n}: ends after check-out`)
      }
    })
    if (!form.reason.trim()) list.push('A reason is required')
    return list
    // breakIsos/inIso/outIso are derived from form each render
  }, [form, isEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live preview: hours = out − in − closed unpaid breaks. Est. pay only when
  // we already know the entry's snapshot rate (edit mode); on create the rate
  // is resolved server-side from the role's job code.
  const previewHours = useMemo(() => {
    if (!inIso || !outIso) return null
    let mins = (new Date(outIso) - new Date(inIso)) / 60000
    breakIsos.forEach((b) => {
      if (b.break_type === 'unpaid' && b.inIso && b.outIso) {
        mins -= (new Date(b.outIso) - new Date(b.inIso)) / 60000
      }
    })
    return Math.max(0, mins) / 60
    // derived from form each render
  }, [form]) // eslint-disable-line react-hooks/exhaustive-deps
  const rate = isEdit && entry?.hourly_rate != null ? Number(entry.hourly_rate) : null
  const previewPay = previewHours != null && rate != null && Number.isFinite(rate) ? previewHours * rate : null

  const save = async () => {
    if (problems.length) {
      setError(problems[0])
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      clock_in_at: inIso,
      clock_out_at: outIso, // null leaves the entry open (still clocked in)
      role: form.role || null,
      reason: form.reason.trim(),
      breaks: breakIsos
        .filter((b) => b.inIso)
        .map((b) => ({
          ...(b.id ? { id: b.id } : {}),
          break_name: b.break_name.trim() || 'Break',
          break_type: b.break_type,
          break_in_at: b.inIso,
          break_out_at: b.outIso,
        })),
    }
    try {
      if (isEdit) {
        await posTimeClockApi.updateEntry(restaurantId, entry.id, payload)
      } else {
        await posTimeClockApi.createEntry(restaurantId, { staff_id: form.staffId, ...payload })
      }
      onSaved(inIso)
    } catch (err) {
      setError(err?.message || 'Could not save time event')
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? `Edit time event — ${entry?.staff_name || ''}` : 'New time event'} size="lg">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {isEdit ? (
            <Field label="Employee">
              <div className={`${inputCls} cursor-default opacity-80`}>{entry?.staff_name || '—'}</div>
            </Field>
          ) : (
            <Field label="Employee">
              <select value={form.staffId} onChange={(e) => setStaff(e.target.value)} className={inputCls}>
                {(waiters || []).map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Role">
            <select value={form.role} onChange={(e) => patch({ role: e.target.value })} className={inputCls}>
              {allowedRoles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </Field>
          <Field label="Business date">
            <input type="date" value={form.businessDate} onChange={(e) => setBusinessDate(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-dash-border p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">Check-in</p>
            <div className="flex gap-2">
              <input type="date" value={form.inDate} onChange={(e) => patch({ inDate: e.target.value })} className={inputCls} />
              <SmartTimeInput minuteStep={1} ariaLabel="Check-in time" value={form.inTime} onChange={(value) => patch({ inTime: value })} inputClassName="!rounded-lg !py-1.5 !pr-2.5" />
            </div>
          </div>
          <div className="rounded-xl border border-dash-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">Check-out</p>
              {form.outTime ? (
                <button
                  type="button"
                  onClick={() => patch({ outTime: '' })}
                  className="text-[11px] text-dash-tertiary underline hover:text-dash-secondary"
                >
                  clear — leave clocked in
                </button>
              ) : (
                <span className="text-[11px] text-dash-tertiary">optional — blank leaves the shift open</span>
              )}
            </div>
            <div className="flex gap-2">
              <input type="date" value={form.outDate} onChange={(e) => patch({ outDate: e.target.value })} className={inputCls} />
              <SmartTimeInput minuteStep={1} ariaLabel="Check-out time" value={form.outTime} onChange={(value) => patch({ outTime: value })} inputClassName="!rounded-lg !py-1.5 !pr-2.5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-dash-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">Breaks</p>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, breaks: [...f.breaks, newBreakRow(f.businessDate)] }))}
              className="inline-flex items-center gap-1 rounded-lg border border-dash-border px-2 py-1 text-xs text-dash-secondary hover:border-dash-gold/50 hover:text-dash-cream"
            >
              <Plus size={12} /> Add break
            </button>
          </div>
          {form.breaks.length === 0 ? (
            <p className="text-xs text-dash-tertiary">No breaks on this entry. Unpaid breaks reduce worked hours.</p>
          ) : (
            <div className="space-y-2">
              {form.breaks.map((b) => (
                <div key={b.rowKey} className="grid items-center gap-2 rounded-lg border border-dash-border/60 p-2 sm:grid-cols-[1fr_92px_1fr_1fr_auto]">
                  <input
                    value={b.break_name}
                    onChange={(e) => patchBreak(b.rowKey, { break_name: e.target.value })}
                    placeholder="Break name"
                    className={inputCls}
                  />
                  <select value={b.break_type} onChange={(e) => patchBreak(b.rowKey, { break_type: e.target.value })} className={inputCls}>
                    <option value="unpaid">unpaid</option>
                    <option value="paid">paid</option>
                  </select>
                  <div className="flex gap-1.5">
                    <input type="date" value={b.inDate} onChange={(e) => patchBreak(b.rowKey, { inDate: e.target.value })} className={inputCls} />
                    <SmartTimeInput minuteStep={1} ariaLabel={`${b.break_name} start time`} value={b.inTime} onChange={(value) => patchBreak(b.rowKey, { inTime: value })} inputClassName="!rounded-lg !py-1.5 !pr-2.5" />
                  </div>
                  <div className="flex gap-1.5">
                    <input type="date" value={b.outDate} onChange={(e) => patchBreak(b.rowKey, { outDate: e.target.value })} className={inputCls} />
                    <SmartTimeInput minuteStep={1} ariaLabel={`${b.break_name} end time`} value={b.outTime} onChange={(value) => patchBreak(b.rowKey, { outTime: value })} inputClassName="!rounded-lg !py-1.5 !pr-2.5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBreak(b.rowKey)}
                    title="Remove break"
                    className="justify-self-end rounded-lg p-1.5 text-dash-tertiary hover:bg-dash-danger/10 hover:text-dash-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Field label="Reason (required — kept in the audit trail)">
          <input
            value={form.reason}
            onChange={(e) => patch({ reason: e.target.value })}
            placeholder={isEdit ? 'e.g. forgot to clock out' : 'e.g. forgot to clock in'}
            className={inputCls}
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dash-border bg-white/[0.025] px-3 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">Preview</span>
          <span className="text-sm font-semibold tabular-nums text-dash-cream">
            {previewHours != null
              ? `${previewHours.toFixed(2)} hrs${previewPay != null ? ` · est. $${previewPay.toFixed(2)}` : ''}`
              : inIso && !form.outTime
                ? 'Open shift — no check-out yet'
                : '—'}
          </span>
        </div>

        {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

        <ModalFooter>
          {problems.length && !error ? (
            <span className="mr-auto text-xs text-dash-tertiary">{problems[0]}</span>
          ) : null}
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || problems.length > 0}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create entry'}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

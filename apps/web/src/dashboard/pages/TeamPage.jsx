import { useEffect, useMemo, useState } from 'react'
import { BadgeDollarSign, Check, Copy, Eye, EyeOff, KeyRound, Plus, RefreshCw, Settings2, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { useAuth } from '../../auth'
import { fetchWithSupabaseAuth, queryClient, queryKeys } from '../../shared/query'
import { useBackOfficeAccess } from '../../shared/hooks/useBackOfficeAccess'
import { backOfficeApi } from '../../shared/api/backOfficeApi'
import { mergePermissions } from '../../shared/permissions'
import { fetchCashDrawerPolicy, fetchRolePermissions } from '../data/permissions'
import {
  assignedStaffRoles,
  canManageJobCode,
  canManageStaffMember,
  normalizeRoleCode,
  normalizeStaffRoleOptions,
  primaryStaffRole,
  roleCodeFromJobCode,
} from '../utils/staffRoles'
import {
  effectiveStaffPayRate,
  newStaffPayDrafts,
  staffPayDrafts,
  staffPayPayload,
  validateStaffPayDrafts,
} from '../utils/staffPay'
import { Badge } from '../components/shared/Badge'
import { Modal, ModalFooter } from '../components/shared/Modal'
import RolePermissionsPanel from '../components/team/RolePermissionsPanel'
import PermissionEditor, { diffOverrides } from '../components/team/PermissionEditor'
import { normalizeJobCodes, PERMISSION_TIER_OPTIONS } from '@shire/settings'
import { cashDrawerRoleSummary } from '../utils/cashDrawerPermissions'

const money = (value) =>
  value === null || value === undefined || value === ''
    ? '—'
    : `$${Number(value).toFixed(2)}/hr`

const roleLabel = (key) =>
  String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

function CopyButton({ text, label = 'Copy link' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        } catch {
          window.prompt('Copy this link:', text)
        }
      }}
      className="flex items-center gap-1 rounded-lg border border-dash-border px-2 py-1 text-[11px] font-semibold text-dash-tertiary transition hover:border-shell-accent/50 hover:text-dash-secondary"
    >
      {copied ? <Check size={12} strokeWidth={2} aria-hidden="true" /> : <Copy size={12} strokeWidth={1.75} aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

function Pane({ icon: Icon, eyebrow, title, children, aside }) {
  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={15} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
          <p className="label-mono">{eyebrow}</p>
        </div>
        {aside}
      </div>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-dash-cream">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function RateInput({ value, onCommit, placeholder, disabled = false }) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  return (
    <input
      type="number"
      min="0"
      step="0.25"
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (String(draft) !== String(value ?? '')) onCommit(draft)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      className="w-24 rounded-xl border border-dash-border bg-[var(--glass-bg)] px-2.5 py-1.5 font-mono text-xs tabular-nums text-dash-cream outline-none focus:border-shell-accent/60"
    />
  )
}

const randomPin = () => {
  const digits = new Uint32Array(1)
  crypto.getRandomValues(digits)
  return String(digits[0] % 10000).padStart(4, '0')
}

// Per-employee 4-digit POS clock-in PIN. Commits set the backend `pin`, which writes
// both `pos_passcode` (plaintext, read by the POS) and the hashed `pin_hash`.
function PinInput({ value, onCommit, disabled = false }) {
  const [draft, setDraft] = useState(value ?? '')
  const [reveal, setReveal] = useState(false)
  useEffect(() => setDraft(value ?? ''), [value])

  const valid = /^\d{4}$/.test(draft)
  const commit = (next = draft) => {
    if (next === (value ?? '')) return
    if (!/^\d{4}$/.test(next)) {
      setDraft(value ?? '')
      return
    }
    onCommit(next)
  }

  return (
    <span className="flex items-center gap-1">
      <input
        type={reveal ? 'text' : 'password'}
        inputMode="numeric"
        autoComplete="off"
        value={draft}
        disabled={disabled}
        maxLength={4}
        placeholder="1111"
        aria-label="POS clock-in PIN (4 digits)"
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, '').slice(0, 4))}
        onBlur={() => commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        className={[
          'w-[4.5rem] rounded-xl border bg-[var(--glass-bg)] px-2 py-1.5 text-center font-mono text-xs tabular-nums tracking-[0.35em] text-dash-cream outline-none focus:border-shell-accent/60',
          draft.length > 0 && !valid ? 'border-dash-danger/60' : 'border-dash-border',
        ].join(' ')}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setReveal((prev) => !prev)}
        title={reveal ? 'Hide PIN' : 'Show PIN'}
        aria-label={reveal ? 'Hide PIN' : 'Show PIN'}
        className="text-dash-tertiary transition hover:text-dash-secondary"
      >
        {reveal ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const next = randomPin()
          setReveal(true)
          setDraft(next)
          commit(next)
        }}
        title="Generate a random PIN"
        aria-label="Generate a random PIN"
        className="text-dash-tertiary transition hover:text-dash-secondary"
      >
        <RefreshCw size={14} strokeWidth={1.75} />
      </button>
    </span>
  )
}

function JobAssignmentsFields({ rows, onChange, disabled = false }) {
  const selectedCount = rows.filter(row => row.selected).length

  const updateRow = (index, patch) => {
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  const togglePosition = (index) => {
    const target = rows[index]
    if (target.selected && selectedCount === 1) return
    const selecting = !target.selected
    let next = rows.map((row, rowIndex) => rowIndex === index
      ? { ...row, selected: selecting, is_primary: selecting ? row.is_primary : false }
      : row)
    const selected = next.filter(row => row.selected)
    if (selected.length > 0 && !selected.some(row => row.is_primary)) {
      const nextPrimary = selected[0].job_code_id
      next = next.map(row => ({ ...row, is_primary: row.job_code_id === nextPrimary }))
    }
    onChange(next)
  }

  const makePrimary = (index) => {
    onChange(rows.map((row, rowIndex) => ({
      ...row,
      selected: rowIndex === index ? true : row.selected,
      is_primary: rowIndex === index,
    })))
  }

  return (
    <div className="divide-y divide-dash-border border-y border-dash-border">
      {rows.map((row, index) => {
        const effectiveRate = effectiveStaffPayRate(row)
        const unavailable = row.is_active === false || !row.job_code_id
        return (
          <div key={row.job_code_id || row.code} className="grid gap-3 py-3 sm:grid-cols-[minmax(150px,1fr)_110px_minmax(190px,1.25fr)] sm:items-center">
            <label className="flex min-w-0 items-center gap-3">
              <input
                type="checkbox"
                checked={row.selected}
                disabled={disabled || (unavailable && !row.selected) || (row.selected && selectedCount === 1)}
                onChange={() => togglePosition(index)}
                className="h-4 w-4 accent-shell-accent"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-dash-cream">{row.label}</span>
                <span className="block text-[11px] text-dash-tertiary">
                  Default {money(row.default_hourly_rate)}
                  {row.is_active === false ? ' · archived' : !row.job_code_id ? ' · position setup required' : ''}
                </span>
              </span>
            </label>

            <label className={`flex items-center gap-2 text-xs font-semibold ${row.selected ? 'text-dash-secondary' : 'text-dash-tertiary'}`}>
              <input
                type="radio"
                name="primary-position"
                checked={row.selected && row.is_primary}
                disabled={disabled || !row.selected}
                onChange={() => makePrimary(index)}
                className="h-4 w-4 accent-shell-accent"
              />
              Primary
            </label>

            <div className={`flex min-w-0 flex-wrap items-center gap-2 ${row.selected ? '' : 'opacity-45'}`}>
              <label className="flex items-center gap-2 text-xs font-semibold text-dash-secondary">
                <input
                  type="checkbox"
                  checked={row.use_custom_rate}
                  disabled={disabled || !row.selected}
                  onChange={(event) => updateRow(index, {
                    use_custom_rate: event.target.checked,
                    hourly_rate_override: event.target.checked ? row.hourly_rate_override : '',
                  })}
                  className="h-4 w-4 accent-shell-accent"
                />
                Custom rate
              </label>
              {row.use_custom_rate ? (
                <span className="flex items-center gap-1">
                  <span className="text-xs text-dash-tertiary">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.hourly_rate_override}
                    disabled={disabled || !row.selected}
                    onChange={(event) => updateRow(index, { hourly_rate_override: event.target.value })}
                    aria-label={`${row.label} custom hourly rate`}
                    className="w-24 rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2 py-1.5 font-mono text-xs tabular-nums text-dash-cream outline-none focus:border-shell-accent/60"
                  />
                  <span className="text-xs text-dash-tertiary">/hr</span>
                </span>
              ) : (
                <span className="text-xs text-dash-tertiary">
                  Pays {effectiveRate === null ? 'no configured rate' : money(effectiveRate)}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmployeeJobsPayModal({ waiter, jobCodes, rolePerms, cashDrawerPolicy, onClose, onSave }) {
  const isCreating = !waiter
  const [name, setName] = useState(waiter?.name || '')
  const [pin, setPin] = useState('')
  const [rows, setRows] = useState(() => isCreating
    ? newStaffPayDrafts(jobCodes)
    : staffPayDrafts(waiter, jobCodes))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const primaryRole = normalizeRoleCode(rows.find(row => row.selected && row.is_primary)?.code)
  const primaryPermissions = rolePerms.find(item => normalizeRoleCode(item.role_key) === primaryRole) || {}
  const cashSummary = cashDrawerRoleSummary(primaryPermissions, cashDrawerPolicy || {})

  const save = async () => {
    const validationError = validateStaffPayDrafts(rows)
    if (isCreating && !name.trim()) {
      setError('Employee name is required.')
      return
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      setError('POS PIN must be exactly 4 digits.')
      return
    }
    if (validationError) {
      setError(validationError)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave({
        ...(isCreating ? { name: name.trim(), pin: pin || '1111' } : {}),
        job_assignments: staffPayPayload(rows),
      })
      onClose()
    } catch (saveError) {
      setError(saveError?.message || 'Could not save jobs and pay.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={busy ? () => {} : onClose}
      title={isCreating ? 'Add employee' : `Jobs & pay — ${waiter.name}`}
      size="lg"
    >
      <div className="max-h-[72vh] overflow-y-auto">
        <p className="label-mono">{isCreating ? 'New employee' : waiter.name}</p>
        <p className="mt-1 text-sm text-dash-tertiary">Select every position this employee may clock in as. Custom rates apply only to that position.</p>

        {isCreating && (
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_150px]">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-dash-secondary">Employee name</span>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                className="w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none focus:border-shell-accent/60"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-dash-secondary">POS PIN</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                maxLength={4}
                placeholder="1111"
                onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 font-mono text-sm tabular-nums tracking-[0.2em] text-dash-cream outline-none placeholder:tracking-normal focus:border-shell-accent/60"
              />
            </label>
          </div>
        )}

        <div className="mt-5">
          <JobAssignmentsFields rows={rows} onChange={setRows} disabled={busy} />
        </div>

        {isCreating && (
          <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] text-dash-tertiary">
            <span className="font-semibold text-dash-secondary">Primary-role cash access:</span>
            {cashSummary.map(item => (
              <span key={item.key} className="rounded-full border border-dash-border px-2 py-0.5">
                {item.label}: {item.value}
              </span>
            ))}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-dash-danger">{error}</p>}
        <ModalFooter>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-dash-border px-4 py-2 text-sm font-semibold text-dash-secondary">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={busy} className="rounded-xl bg-shell-cta px-4 py-2 text-sm font-semibold text-shell-cta-text disabled:opacity-50">
            {busy ? 'Saving…' : isCreating ? 'Add employee' : 'Save jobs & pay'}
          </button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

// Invite drawer: email + optional staff link + full permission editor. The
// invite payload always carries the FULL effective permission map.
function InviteModal({ restaurantId, waiters, roleDefaultsFor, grantCap, initialWaiterId, onClose, onInvited }) {
  const [email, setEmail] = useState('')
  const [waiterId, setWaiterId] = useState(initialWaiterId || '')
  const [perms, setPerms] = useState(() => mergePermissions(roleDefaultsFor(initialWaiterId || ''), null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const roleDefaults = roleDefaultsFor(waiterId)
  const linkedWaiter = waiters.find((waiter) => waiter.id === waiterId) || null

  const pickWaiter = (id) => {
    setWaiterId(id)
    setPerms(mergePermissions(roleDefaultsFor(id), null))
  }

  const send = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError('Enter a valid email address.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await backOfficeApi.invite(restaurantId, {
        email: trimmed,
        name: linkedWaiter?.name || undefined,
        waiter_id: waiterId || null,
        permissions: perms,
      })
      setResult({ ...response, email: trimmed })
      onInvited(response)
    } catch (inviteError) {
      setError(inviteError?.message || 'Could not send the invite.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Grant back-office access" size="lg">
      {result ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-dash-success/30 bg-dash-success/10 px-3 py-2 text-sm text-dash-success">
            Invite sent to {result.email}
          </p>
          {!result.email_sent && (
            <p className="rounded-xl border border-dash-warning/30 bg-dash-warning/10 px-3 py-2 text-sm text-dash-warning">
              The email could not be sent — share this link with them instead.
            </p>
          )}
          {result.accept_url && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-dash-secondary" title={result.accept_url}>
                {result.accept_url}
              </span>
              <CopyButton text={result.accept_url} />
            </div>
          )}
          <ModalFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-shell-cta px-4 py-2 text-sm font-semibold text-shell-cta-text transition hover:opacity-90"
            >
              Done
            </button>
          </ModalFooter>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <label className="min-w-[220px] flex-1">
              <span className="label-mono !text-[9px]">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="them@example.com"
                autoFocus
                className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-shell-accent/60"
              />
            </label>
            <label className="min-w-[200px]">
              <span className="label-mono !text-[9px]">Link to staff (optional)</span>
              <select
                value={waiterId}
                onChange={(event) => pickWaiter(event.target.value)}
                className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-2.5 py-2 text-sm font-semibold text-dash-secondary outline-none focus:border-shell-accent/60"
              >
                <option value="">No linked employee</option>
                {waiters.map((waiter) => (
                  <option key={waiter.id} value={waiter.id}>{waiter.name}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs leading-5 text-dash-tertiary">
            {waiterId
              ? 'Permissions start from the linked employee’s role defaults — tweak anything below before sending.'
              : 'Pick a preset or toggle exactly what they should be able to do.'}
          </p>
          <PermissionEditor
            value={perms}
            roleDefaults={roleDefaults}
            onChange={setPerms}
            grantCap={grantCap}
            showPreview
            disabled={busy}
          />
          {error && <p className="text-xs text-dash-danger">{error}</p>}
          <ModalFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-dash-border px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:text-dash-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void send()}
              className="rounded-xl bg-shell-cta px-4 py-2 text-sm font-semibold text-shell-cta-text transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Save & send invite'}
            </button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  )
}

// Per-member permission drawer. Edits the FULL effective map; only the keys
// that differ from the role defaults are persisted as permission_overrides.
function MemberPermissionsModal({ restaurantId, member, roleDefaults, grantCap, onClose, onSaved }) {
  const [perms, setPerms] = useState(() => mergePermissions(roleDefaults, member.permission_overrides))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const updated = await backOfficeApi.updateMember(restaurantId, member.id, {
        permission_overrides: diffOverrides(perms, roleDefaults),
      })
      onSaved(updated)
      onClose()
    } catch (saveError) {
      setError(saveError?.message || 'Could not save permissions.')
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Permissions — ${member.display_name || member.email}`} size="lg">
      <div className="space-y-4">
        <PermissionEditor
          value={perms}
          roleDefaults={roleDefaults}
          onChange={setPerms}
          grantCap={grantCap}
          showPreview
          disabled={busy}
        />
        {error && <p className="text-xs text-dash-danger">{error}</p>}
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-dash-border px-4 py-2 text-sm font-semibold text-dash-secondary transition hover:text-dash-cream"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-xl bg-shell-cta px-4 py-2 text-sm font-semibold text-shell-cta-text transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save permissions'}
          </button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

export default function TeamPage({ restaurantId }) {
  const auth = useAuth()
  const access = useBackOfficeAccess(auth, restaurantId)
  const [waiters, setWaiters] = useState([])
  const [jobCodes, setJobCodes] = useState([])
  const [roleLoadError, setRoleLoadError] = useState(false)
  const [rolePerms, setRolePerms] = useState([])
  const [cashDrawerPolicy, setCashDrawerPolicy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [employeeEditor, setEmployeeEditor] = useState(null)
  const [newGroup, setNewGroup] = useState({ label: '', rate: '', permission_tier: 'normal' })

  // Back-office members & invites (ML backend). `unavailable` carries a soft
  // note when the endpoints aren't deployed yet — never a crash.
  const [boMembers, setBoMembers] = useState([])
  const [boInvites, setBoInvites] = useState([])
  const [boLoading, setBoLoading] = useState(true)
  const [boUnavailable, setBoUnavailable] = useState(false)
  const [inviteState, setInviteState] = useState(null) // { waiterId: string|null } | null
  const [editingMember, setEditingMember] = useState(null)

  const canViewMembers = access.can('team.view')
  const canManageMembers = access.can('team.edit_employees')

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=true`),
      fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes`)
        .then((rows) => ({ rows, failed: false }))
        .catch(() => ({ rows: [], failed: true })),
      fetchRolePermissions(restaurantId).catch(() => []),
      fetchCashDrawerPolicy(restaurantId).catch(() => null),
    ])
      .then(([waiterRows, jobCodeResult, roleRows, drawerPolicy]) => {
        if (cancelled) return
        setWaiters(Array.isArray(waiterRows) ? waiterRows : [])
        setJobCodes(normalizeJobCodes(jobCodeResult.rows))
        setRoleLoadError(jobCodeResult.failed)
        setRolePerms(Array.isArray(roleRows) ? roleRows : [])
        setCashDrawerPolicy(drawerPolicy)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError?.message || 'Could not load team data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  const loadBackOffice = async () => {
    try {
      const data = await backOfficeApi.listMembers(restaurantId)
      setBoMembers(Array.isArray(data?.members) ? data.members : [])
      setBoInvites(Array.isArray(data?.invitations) ? data.invitations : [])
      setBoUnavailable(false)
    } catch {
      setBoUnavailable(true)
    } finally {
      setBoLoading(false)
    }
  }

  useEffect(() => {
    if (!restaurantId || access.loading || !canViewMembers) return
    setBoLoading(true)
    void loadBackOffice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, access.loading, canViewMembers])

  const refreshBackOffice = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.backOfficeMembers(restaurantId) })
    return loadBackOffice()
  }

  // Job codes + any assigned legacy POS roles that do not have a catalog row.
  // Pseudo entries remain visible for authority and assignment-count checks,
  // but the Jobs & Pay editor cannot persist them without a real job-code ID.
  const roleOptions = useMemo(() => {
    const known = new Set(jobCodes.map(roleCodeFromJobCode).filter(Boolean))
    const assigned = new Set(waiters.flatMap((waiter) => assignedStaffRoles(waiter, [])))
    const extras = rolePerms
      .map((row) => normalizeRoleCode(row.role_key))
      .filter((code) => code && !known.has(code) && assigned.has(code))
      .map((code) => ({ id: null, code, label: roleLabel(code) }))
    return normalizeStaffRoleOptions([...jobCodes, ...extras])
  }, [jobCodes, rolePerms, waiters])

  const manageableRoleOptions = useMemo(
    () => roleOptions.filter((role) => canManageJobCode(access.authorityLevel, role)),
    [access.authorityLevel, roleOptions],
  )
  const assignablePermissionTiers = useMemo(
    () => PERMISSION_TIER_OPTIONS.filter((tier) =>
      canManageJobCode(access.authorityLevel, { code: tier.value, permission_tier: tier.value })),
    [access.authorityLevel],
  )
  const positionAssignmentCounts = useMemo(() => {
    const counts = new Map()
    waiters.forEach((waiter) => {
      assignedStaffRoles(waiter, []).forEach((role) => {
        counts.set(role, (counts.get(role) || 0) + 1)
      })
    })
    jobCodes.forEach((jobCode) => {
      const role = roleCodeFromJobCode(jobCode)
      const databaseCount = Number(jobCode.assigned_count || 0)
      counts.set(role, Math.max(counts.get(role) || 0, databaseCount))
    })
    return counts
  }, [jobCodes, waiters])

  // Role-default back-office permissions for a waiter (by id) via their
  // primary working role's pos_role_permissions.back_office_permissions.
  const roleDefaultsForWaiter = (waiterId) => {
    const waiter = waiters.find((item) => item.id === waiterId)
    if (!waiter) return null
    const primary = primaryStaffRole(waiter, roleOptions)
    const row = rolePerms.find((item) => String(item.role_key || '').trim().toLowerCase() === primary)
      || rolePerms.find((item) => normalizeRoleCode(item.role_key) === primary)
    return row?.back_office_permissions || null
  }

  const grantCap = access.isOwner ? null : access.permissions

  const act = async (fn) => {
    setError(null)
    try {
      await fn()
    } catch (actionError) {
      setError(actionError?.message || 'That didn’t save — try again.')
    }
  }

  const patchWaiter = (waiterId, updates) =>
    act(async () => {
      const updated = await fetchWithSupabaseAuth(`/waiters/${waiterId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      setWaiters((prev) => prev.map((waiter) => (waiter.id === waiterId ? updated : waiter)))
    })

  const saveEmployeeJobsPay = async (waiter, payload) => {
    if (waiter) {
      const updated = await fetchWithSupabaseAuth(`/waiters/${waiter.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setWaiters(prev => prev.map(item => item.id === waiter.id ? updated : item))
      return
    }
    const created = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setWaiters(prev => [...prev, created])
  }

  const addGroup = () =>
    act(async () => {
      if (!newGroup.label.trim()) throw new Error('Group name is required.')
      const slug = newGroup.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      if (!slug) throw new Error('Enter a role name with at least one letter or number.')
      const code = (/^[a-z]/.test(slug) ? slug : `role_${slug}`).slice(0, 80)
      const canonicalCode = normalizeRoleCode(code)
      if (roleOptions.some((role) => roleCodeFromJobCode(role) === canonicalCode)) {
        throw new Error(canonicalCode === 'server'
          ? 'Server already exists — Waiter and Server are the same role.'
          : 'That role already exists.')
      }
      const created = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes`, {
        method: 'POST',
        body: JSON.stringify({
          code,
          label: newGroup.label.trim(),
          permission_tier: newGroup.permission_tier,
          default_hourly_rate: newGroup.rate === '' ? 0 : Number(newGroup.rate),
          is_tipped: false,
          tipout_role: null,
          sort_order: jobCodes.length,
          is_active: true,
        }),
      })
      setJobCodes((prev) => normalizeJobCodes([...prev, created]))
      const refreshedPermissions = await fetchRolePermissions(restaurantId)
      setRolePerms(Array.isArray(refreshedPermissions) ? refreshedPermissions : [])
      setNewGroup({ label: '', rate: '', permission_tier: 'normal' })
    })

  const patchGroupRate = (jobCode, rate) =>
    act(async () => {
      const parsed = Number(rate)
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Enter a valid hourly rate.')
      const saved = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes/${jobCode.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ default_hourly_rate: parsed.toFixed(2) }),
      })
      setJobCodes((prev) => normalizeJobCodes(prev.map((code) => (
        code.id === saved.id ? { ...code, ...saved } : code
      ))))
    })

  const removeGroup = (jobCode) =>
    act(async () => {
      if (!jobCode?.id) throw new Error('This role cannot be removed until it has been saved.')
      const assignedCount = positionAssignmentCounts.get(roleCodeFromJobCode(jobCode)) || 0
      if (assignedCount > 0) {
        throw new Error(`Reassign ${assignedCount} employee${assignedCount === 1 ? '' : 's'} before removing this position.`)
      }
      if (!window.confirm(`Remove ${jobCode.label || jobCode.code} from POS position choices? Historical shifts and payroll will be preserved.`)) return
      await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes/${jobCode.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      })
      setJobCodes((prev) => prev.filter((code) => code.id !== jobCode.id))
      setRolePerms((prev) => prev.filter((role) => normalizeRoleCode(role.role_key) !== roleCodeFromJobCode(jobCode)))
    })

  const patchBoMember = (member, patch) =>
    act(async () => {
      const updated = await backOfficeApi.updateMember(restaurantId, member.id, patch)
      setBoMembers((prev) => prev.map((item) => (item.id === member.id ? { ...item, ...updated } : item)))
      queryClient.invalidateQueries({ queryKey: queryKeys.backOfficeMembers(restaurantId) })
    })

  const removeBoMember = (member) =>
    act(async () => {
      if (!window.confirm(`Remove dashboard access for ${member.display_name || member.email}?`)) return
      await backOfficeApi.removeMember(restaurantId, member.id)
      setBoMembers((prev) => prev.filter((item) => item.id !== member.id))
      queryClient.invalidateQueries({ queryKey: queryKeys.backOfficeMembers(restaurantId) })
    })

  const revokeBoInvite = (invitation) =>
    act(async () => {
      await backOfficeApi.revokeInvite(restaurantId, invitation.id)
      setBoInvites((prev) => prev.filter((item) => item.id !== invitation.id))
      queryClient.invalidateQueries({ queryKey: queryKeys.backOfficeMembers(restaurantId) })
    })

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-dash-border border-t-shell-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-xl border border-dash-danger/30 bg-dash-danger/10 px-3 py-2 text-sm text-dash-danger">
          {error}
        </p>
      )}
      {roleLoadError && (
        <p className="rounded-xl border border-dash-warning/30 bg-dash-warning/10 px-3 py-2 text-sm text-dash-warning">
          Roles failed to load, so employee role choices are unavailable. Refresh the page or reopen Team after the API recovers.
        </p>
      )}

      <Pane icon={BadgeDollarSign} eyebrow="POS positions" title="Roles and default pay">
        <div className="space-y-2">
          {normalizeStaffRoleOptions(jobCodes).map((code) => {
            const assignedCount = positionAssignmentCounts.get(roleCodeFromJobCode(code)) || 0
            const mayManage = canManageMembers && canManageJobCode(access.authorityLevel, code)
            const mayRemove = mayManage && assignedCount === 0
            return (
              <div key={code.id} className="flex flex-wrap items-center gap-3">
                <span className="min-w-[120px] text-sm font-semibold text-dash-cream">{code.label || code.code}</span>
                <span className="label-mono !text-[9px]">{code.is_tipped ? 'tipped' : 'untipped'}</span>
                <span className="label-mono !text-[9px] normal-nums">{assignedCount} assigned</span>
                <span className="ml-auto flex items-center gap-2">
                  <RateInput
                    value={code.default_hourly_rate ?? ''}
                    disabled={!mayManage}
                    onCommit={(rate) => void patchGroupRate(code, rate)}
                    placeholder="0.00"
                  />
                  <span className="text-xs text-dash-tertiary">/hr</span>
                  <button
                    type="button"
                    disabled={!mayRemove}
                    onClick={() => void removeGroup(code)}
                    title={assignedCount > 0 ? 'Reassign employees before removing this position' : mayManage ? 'Remove position' : 'You cannot manage a position above your authority'}
                    aria-label={`Remove ${code.label || code.code}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-dash-border text-dash-tertiary transition hover:border-dash-danger/50 hover:text-dash-danger"
                  >
                    <Trash2 size={13} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </span>
              </div>
            )
          })}
          {jobCodes.length === 0 && (
            <p className="text-sm text-dash-tertiary">No POS positions yet.</p>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-dash-border pt-3">
            <input
              value={newGroup.label}
              disabled={!canManageMembers}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, label: event.target.value }))}
              placeholder="New position — e.g. Expo"
              className="min-w-[160px] flex-1 rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-shell-accent/60"
            />
            <select
              value={newGroup.permission_tier}
              disabled={!canManageMembers}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, permission_tier: event.target.value }))}
              className="rounded-xl border border-dash-border bg-[var(--glass-bg)] px-2.5 py-2 text-xs font-semibold text-dash-secondary outline-none"
              aria-label="Position authority"
            >
              {assignablePermissionTiers.map((tier) => (
                <option key={tier.value} value={tier.value}>{tier.label}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.25"
              value={newGroup.rate}
              disabled={!canManageMembers}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, rate: event.target.value }))}
              placeholder="Rate"
              className="w-24 rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 font-mono text-sm tabular-nums text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-shell-accent/60"
            />
            <button
              type="button"
              disabled={!canManageMembers}
              onClick={() => void addGroup()}
              className="flex min-h-[38px] items-center gap-1 rounded-xl bg-shell-cta px-3 text-sm font-semibold text-shell-cta-text transition hover:opacity-90"
            >
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              Add position
            </button>
          </div>
        </div>
      </Pane>

      <Pane icon={Users} eyebrow="Employees" title="Roles, pay & POS PIN">
        <div className="space-y-2">
          {waiters.map((waiter) => {
            const payRows = staffPayDrafts(waiter, roleOptions).filter(row => row.selected)
            const linkedMember = boMembers.find((member) => member.waiter_id === waiter.id)
            const mayManageWaiter = canManageMembers
              && canManageStaffMember(access.authorityLevel, waiter, roleOptions)
            return (
              <div key={waiter.id} className="flex flex-wrap items-center gap-3 border-b border-dash-border py-2 last:border-b-0">
                <span className="min-w-[150px]">
                  <span className={`block text-sm font-semibold ${waiter.is_active === false ? 'text-dash-tertiary line-through' : 'text-dash-cream'}`}>
                    {waiter.name}
                  </span>
                  <span className="block text-[11px] text-dash-tertiary">
                    {payRows.length > 0
                      ? payRows.map(row => `${row.label} ${money(effectiveStaffPayRate(row))}`).join(' · ')
                      : 'No assigned positions'}
                  </span>
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="flex items-center gap-1.5" title="POS clock-in PIN">
                    <KeyRound size={13} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
                    <PinInput
                      value={waiter.pos_passcode ?? ''}
                      disabled={!mayManageWaiter}
                      onCommit={(pin) => void patchWaiter(waiter.id, { pin })}
                    />
                  </span>
                  <button
                    type="button"
                    disabled={!mayManageWaiter}
                    onClick={() => setEmployeeEditor({ waiter })}
                    title={mayManageWaiter ? 'Edit positions and hourly pay' : 'You cannot manage this employee’s positions'}
                    className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-dash-border px-2.5 text-xs font-semibold text-dash-secondary transition hover:border-shell-accent/50 hover:text-dash-cream disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Settings2 size={13} strokeWidth={1.75} aria-hidden="true" />
                    Jobs &amp; pay
                  </button>
                  {canManageMembers && !boUnavailable && (
                    linkedMember ? (
                      <span
                        title={`Has back-office access (${linkedMember.email})`}
                        className="flex items-center gap-1 rounded-full border border-dash-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-eyebrow text-dash-tertiary"
                      >
                        <ShieldCheck size={11} strokeWidth={1.75} aria-hidden="true" />
                        portal
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setInviteState({ waiterId: waiter.id })}
                        title="Invite this employee to the back-office dashboard"
                        className="text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary"
                      >
                        Grant access
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    disabled={!mayManageWaiter}
                    onClick={() => void patchWaiter(waiter.id, { is_active: waiter.is_active === false })}
                    className="text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary"
                  >
                    {waiter.is_active === false ? 'Reactivate' : 'Deactivate'}
                  </button>
                </span>
              </div>
            )
          })}
          {waiters.length === 0 && <p className="text-sm text-dash-tertiary">No employees yet.</p>}
          <div className="flex justify-end border-t border-dash-border pt-3">
            <button
              type="button"
              disabled={!canManageMembers || manageableRoleOptions.length === 0 || roleLoadError}
              onClick={() => setEmployeeEditor({ waiter: null })}
              className="flex min-h-[38px] items-center gap-1 rounded-xl bg-shell-cta px-3 text-sm font-semibold text-shell-cta-text transition hover:opacity-90"
            >
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              Add employee
            </button>
          </div>
        </div>
      </Pane>

      <Pane
        icon={ShieldCheck}
        eyebrow="Back-office access"
        title="Who can open this dashboard"
        aside={
          canManageMembers && !boUnavailable ? (
            <button
              type="button"
              onClick={() => setInviteState({ waiterId: null })}
              className="flex min-h-[32px] items-center gap-1 rounded-xl bg-shell-cta px-3 text-xs font-semibold text-shell-cta-text transition hover:opacity-90"
            >
              <UserPlus size={13} strokeWidth={2} aria-hidden="true" />
              Invite member
            </button>
          ) : null
        }
      >
        {!canViewMembers ? (
          <p className="text-sm text-dash-tertiary">
            You don&rsquo;t have permission to view members. Ask the owner for &ldquo;View members &amp; schedule&rdquo; access.
          </p>
        ) : boUnavailable ? (
          <p className="rounded-xl border border-dash-warning/30 bg-dash-warning/10 px-3 py-2 text-sm text-dash-warning">
            Member invites aren&rsquo;t available yet — the back-office access backend hasn&rsquo;t shipped for this
            environment. Everything else on this page still works.
          </p>
        ) : boLoading ? (
          <p className="text-sm text-dash-tertiary">Loading members…</p>
        ) : (
          <div className="space-y-2">
            {boMembers.map((member) => {
              const linkedWaiter = waiters.find((waiter) => waiter.id === member.waiter_id)
              const suspended = member.status === 'suspended'
              return (
                <div key={member.id} className="flex flex-wrap items-center gap-3">
                  <span className="min-w-[160px]">
                    <span className={`block text-sm font-semibold ${suspended ? 'text-dash-tertiary' : 'text-dash-cream'}`}>
                      {member.display_name || member.email}
                      {member.user_id === auth.user?.id && (
                        <span className="ml-1.5 font-mono text-[9px] uppercase tracking-eyebrow text-dash-tertiary">you</span>
                      )}
                    </span>
                    <span className="block text-xs text-dash-tertiary">
                      {[
                        member.display_name ? member.email : null,
                        linkedWaiter ? `Linked to ${linkedWaiter.name}` : 'Not linked to staff',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="ml-auto flex flex-wrap items-center gap-2">
                    <Badge variant={suspended ? 'warning' : 'success'} dot>
                      {suspended ? 'suspended' : 'active'}
                    </Badge>
                    {canManageMembers && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingMember(member)}
                          className="rounded-lg border border-dash-border px-2 py-1 text-[11px] font-semibold text-dash-secondary transition hover:border-shell-accent/50 hover:text-dash-cream"
                        >
                          Permissions
                        </button>
                        <button
                          type="button"
                          onClick={() => void patchBoMember(member, { status: suspended ? 'active' : 'suspended' })}
                          className="text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary"
                        >
                          {suspended ? 'Reactivate' : 'Suspend'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeBoMember(member)}
                          className="text-xs font-semibold text-dash-danger/80 transition hover:text-dash-danger"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </span>
                </div>
              )
            })}

            {boInvites.map((invitation) => (
              <div key={invitation.id} className="flex flex-wrap items-center gap-3">
                <span className="min-w-[160px]">
                  <span className="block text-sm font-semibold text-dash-cream">{invitation.name || invitation.email}</span>
                  {invitation.name && <span className="block text-xs text-dash-tertiary">{invitation.email}</span>}
                </span>
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  <Badge variant="gold" dot>invited (pending)</Badge>
                  {invitation.accept_url && <CopyButton text={invitation.accept_url} label="Copy invite link" />}
                  {canManageMembers && (
                    <button
                      type="button"
                      onClick={() => void revokeBoInvite(invitation)}
                      className="text-xs font-semibold text-dash-danger/80 transition hover:text-dash-danger"
                    >
                      Revoke
                    </button>
                  )}
                </span>
              </div>
            ))}

            {boMembers.length === 0 && boInvites.length === 0 && (
              <p className="text-sm text-dash-tertiary">
                No additional members — only the owner can open this dashboard today.
                {canManageMembers ? ' Use “Invite member” (or “Grant access” next to an employee) to add someone.' : ''}
              </p>
            )}
          </div>
        )}
      </Pane>

      <RolePermissionsPanel
        restaurantId={restaurantId}
        cashDrawerPolicy={cashDrawerPolicy}
        onRolesChange={setRolePerms}
        authorityLevel={access.authorityLevel}
        jobCodes={jobCodes}
      />

      {employeeEditor && (
        <EmployeeJobsPayModal
          waiter={employeeEditor.waiter}
          jobCodes={employeeEditor.waiter
            ? manageableRoleOptions
            : jobCodes.filter(role => canManageJobCode(access.authorityLevel, role))}
          rolePerms={rolePerms}
          cashDrawerPolicy={cashDrawerPolicy}
          onClose={() => setEmployeeEditor(null)}
          onSave={(payload) => saveEmployeeJobsPay(employeeEditor.waiter, payload)}
        />
      )}

      {inviteState && (
        <InviteModal
          restaurantId={restaurantId}
          waiters={waiters.filter((waiter) => waiter.is_active !== false)}
          roleDefaultsFor={roleDefaultsForWaiter}
          grantCap={grantCap}
          initialWaiterId={inviteState.waiterId}
          onClose={() => setInviteState(null)}
          onInvited={() => void refreshBackOffice()}
        />
      )}

      {editingMember && (
        <MemberPermissionsModal
          restaurantId={restaurantId}
          member={editingMember}
          roleDefaults={editingMember.waiter_id ? roleDefaultsForWaiter(editingMember.waiter_id) : null}
          grantCap={grantCap}
          onClose={() => setEditingMember(null)}
          onSaved={(updated) => {
            setBoMembers((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
            queryClient.invalidateQueries({ queryKey: queryKeys.backOfficeMembers(restaurantId) })
          }}
        />
      )}
    </div>
  )
}

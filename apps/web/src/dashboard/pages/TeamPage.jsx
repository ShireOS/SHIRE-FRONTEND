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
  manageableTeamAccountTypes,
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
import BackOfficeViewEditor from '../components/team/BackOfficeViewEditor'
import { defaultViewPolicy, normalizeViewPolicy } from '../../shared/backOfficeView'
import { normalizeJobCodes, PERMISSION_TIER_OPTIONS } from '@shire/settings'
import { cashDrawerRoleSummary } from '../utils/cashDrawerPermissions'
import {
  applyDrawerOverrides,
  noSaleOverrideState,
  withNoSaleOverride,
} from '../utils/employeePosPermissionOverrides'
import {
  DEFAULT_RESELLER_PERMISSIONS,
  RESELLER_TOGGLEABLE_TABS,
  inviteReseller,
  updateResellerPermissions,
} from '../data/resellerAccess'
import { employeeNameConfirmationMatches } from '../utils/employeeForget'

const RESELLER_PERMISSION_LABELS = {
  devices: 'Devices & peripherals',
  setup: 'Setup',
  team: 'Team & pay',
  scheduling: 'Scheduling',
  messaging: 'Messaging',
  payments: 'Payments / Plan',
  close_day: 'Close Day',
}

const money = (value) =>
  value === null || value === undefined || value === ''
    ? '—'
    : `$${Number(value).toFixed(2)}/hr`

const roleLabel = (key) =>
  String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

const permissionTierLabel = (value) => (
  PERMISSION_TIER_OPTIONS.find(option => option.value === value)?.label || roleLabel(value)
)

const POS_AUTHORITY_OPTIONS = [
  { value: 'normal', label: 'Clock-in only' },
  { value: 'waiter', label: 'Service staff' },
  { value: 'manager', label: 'Manager' },
]

const POS_AUTHORITY_RANK = { normal: 0, waiter: 1, manager: 2 }

const posAuthorityForTier = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (['owner', 'manager', 'admin'].includes(normalized)) return 'manager'
  if (['waiter', 'server'].includes(normalized)) return 'waiter'
  return 'normal'
}

const highestPosAuthority = (...values) => values
  .flat()
  .map(posAuthorityForTier)
  .reduce((highest, value) => (
    POS_AUTHORITY_RANK[value] > POS_AUTHORITY_RANK[highest] ? value : highest
  ), 'normal')

const accountMinimumPosAuthority = (role) => (
  ['manager', 'owner'].includes(role) ? 'manager' : 'normal'
)

const posAuthorityLabel = (value) => (
  POS_AUTHORITY_OPTIONS.find(option => option.value === posAuthorityForTier(value))?.label || 'Clock-in only'
)

const memberTypeLabel = (role) => (
  role === 'owner' ? 'Owner' : role === 'manager' ? 'Manager' : 'Employee'
)

const invitationTypeLabel = (invitation) => (
  invitation.kind === 'reseller_connection' ? 'Reseller' : memberTypeLabel(invitation.role)
)

const connectedResellerName = (assignment) => (
  assignment.organization_name
  || [assignment.first_name, assignment.last_name].filter(Boolean).join(' ')
  || 'Reseller'
)

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

function EmployeeJobsPayModal({ waiter, accountRole, jobCodes, onClose, onSave }) {
  const [rows, setRows] = useState(() => staffPayDrafts(waiter, jobCodes))
  const [posAuthority, setPosAuthority] = useState(() => posAuthorityForTier(waiter.pos_role))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const minimumPosAuthority = highestPosAuthority(
    accountMinimumPosAuthority(accountRole),
    rows.filter(row => row.selected).map(row => row.permission_tier),
  )
  const effectivePosAuthority = highestPosAuthority(posAuthority, minimumPosAuthority)

  const save = async () => {
    const validationError = validateStaffPayDrafts(rows)
    if (validationError) {
      setError(validationError)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave({
        job_assignments: staffPayPayload(rows),
        pos_authority: effectivePosAuthority,
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
      title={`POS access, jobs & pay — ${waiter.name}`}
      size="lg"
    >
      <div className="max-h-[72vh] overflow-y-auto">
        <label className="block max-w-sm">
          <span className="label-mono !text-[9px]">POS authority</span>
          <select
            value={effectivePosAuthority}
            disabled={busy}
            onChange={(event) => setPosAuthority(event.target.value)}
            className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm font-semibold text-dash-secondary outline-none focus:border-shell-accent/60"
          >
            {POS_AUTHORITY_OPTIONS.map(option => (
              <option
                key={option.value}
                value={option.value}
                disabled={POS_AUTHORITY_RANK[option.value] < POS_AUTHORITY_RANK[minimumPosAuthority]}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-1 text-sm text-dash-tertiary">
          Authority stays with this person in every position. Positions control clock-in work, pay, and tips.
        </p>
        <div className="mt-5">
          <JobAssignmentsFields rows={rows} onChange={setRows} disabled={busy} />
        </div>

        {error && <p className="mt-4 text-sm text-dash-danger">{error}</p>}
        <ModalFooter>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-dash-border px-4 py-2 text-sm font-semibold text-dash-secondary">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={busy} className="rounded-xl bg-shell-cta px-4 py-2 text-sm font-semibold text-shell-cta-text disabled:opacity-50">
            {busy ? 'Saving…' : 'Save POS setup'}
          </button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

const invitationRoleForWaiter = (waiter) => {
  return posAuthorityForTier(waiter?.pos_role) === 'manager' ? 'manager' : 'server'
}

function AddTeamMemberModal({ restaurantId, waiters, jobCodes, roleDefaultsForRole, grantCap, accountTypeOptions, cloneResellerAccess, templates, onCreateTemplate, initialWaiterId, initialRole, onClose, onAdded }) {
  const initialWaiter = waiters.find((waiter) => waiter.id === initialWaiterId)
  const initialAccountRole = initialRole || invitationRoleForWaiter(initialWaiter)
  const initialRows = newStaffPayDrafts(jobCodes)
  const [email, setEmail] = useState('')
  const [name, setName] = useState(initialWaiter?.name || '')
  const [waiterId, setWaiterId] = useState(initialWaiterId || '')
  const [role, setRole] = useState(initialAccountRole)
  const [posMode, setPosMode] = useState(initialWaiterId ? 'existing' : initialAccountRole === 'reseller' ? 'none' : 'new')
  const [pin, setPin] = useState(() => randomPin())
  const [rows, setRows] = useState(initialRows)
  const [posAuthority, setPosAuthority] = useState(() => highestPosAuthority(
    initialWaiter?.pos_role,
    accountMinimumPosAuthority(initialAccountRole),
    initialRows.filter(row => row.selected).map(row => row.permission_tier),
  ))
  const [perms, setPerms] = useState(() => mergePermissions(
    roleDefaultsForRole(initialAccountRole),
    null,
  ))
  const [resellerPerms, setResellerPerms] = useState(DEFAULT_RESELLER_PERMISSIONS)
  const [viewPolicy, setViewPolicy] = useState(() => defaultViewPolicy(initialAccountRole === 'owner' ? 'simple' : 'medium'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const roleDefaults = roleDefaultsForRole(role)
  const linkedWaiter = waiters.find((waiter) => waiter.id === waiterId) || null
  const minimumPosAuthority = highestPosAuthority(
    accountMinimumPosAuthority(role),
    posMode === 'new' ? rows.filter(row => row.selected).map(row => row.permission_tier) : [],
    posMode === 'existing'
      ? (linkedWaiter?.job_assignments || []).map(assignment => assignment.permission_tier)
      : [],
  )
  const effectivePosAuthority = highestPosAuthority(
    posAuthority,
    minimumPosAuthority,
  )

  const pickAccountType = (accountType) => {
    const nextRole = accountType === 'employee' ? 'server' : accountType
    setRole(nextRole)
    setWaiterId('')
    setPosMode(nextRole === 'reseller' ? 'none' : 'new')
    setPosAuthority(highestPosAuthority(
      accountMinimumPosAuthority(nextRole),
      rows.filter(row => row.selected).map(row => row.permission_tier),
    ))
    setPerms(mergePermissions(roleDefaultsForRole(nextRole), null))
    setViewPolicy(defaultViewPolicy(nextRole === 'owner' ? 'simple' : 'medium'))
  }

  const send = async () => {
    const trimmed = email.trim().toLowerCase()
    const requiresEmail = ['manager', 'owner', 'reseller'].includes(role)
    if ((requiresEmail || trimmed) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError('Enter a valid email address.')
      return
    }
    if (role === 'server' && !trimmed && posMode !== 'new') {
      setError('Add an email to invite this employee, or create a new POS profile.')
      return
    }
    if (posMode === 'existing' && !waiterId) {
      setError('Choose an existing POS employee.')
      return
    }
    if (posMode === 'new') {
      if (!name.trim()) {
        setError('Name is required for a POS employee.')
        return
      }
      if (!/^\d{4}$/.test(pin)) {
        setError('POS PIN must be exactly 4 digits.')
        return
      }
      const validationError = validateStaffPayDrafts(rows)
      if (validationError) {
        setError(validationError)
        return
      }
    }
    setBusy(true)
    setError(null)
    try {
      const response = role === 'reseller'
        ? await inviteReseller(restaurantId, trimmed, resellerPerms)
        : await backOfficeApi.createTeamMember(restaurantId, {
          account_type: role === 'server' ? 'employee' : role,
          email: trimmed || null,
          name: name.trim() || linkedWaiter?.name || null,
          waiter_id: posMode === 'existing' ? waiterId : null,
          pos_authority: posMode === 'existing' ? effectivePosAuthority : null,
          pos_profile: posMode === 'new' ? {
            name: name.trim(),
            pin,
            pos_authority: effectivePosAuthority,
            job_assignments: staffPayPayload(rows),
          } : null,
          permissions: role === 'owner' ? {} : perms,
          view_policy: viewPolicy,
        })
      const invitationResult = role === 'reseller' ? response : response.invitation_result
      setResult({
        ...(invitationResult || {}),
        email: trimmed || null,
        waiter: role === 'reseller' ? null : response.waiter,
      })
      onAdded(response)
    } catch (inviteError) {
      setError(inviteError?.message || 'Could not add the team member.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={busy ? () => {} : onClose} title="Add team member" size="lg">
      {result ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-dash-success/30 bg-dash-success/10 px-3 py-2 text-sm text-dash-success">
            {result.email ? `Invite sent to ${result.email}` : `${result.waiter?.name || name} was added to the POS.`}
          </p>
          {result.email && !result.email_sent && (
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
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label-mono !text-[9px]">Account type</span>
              <select
                value={role === 'server' ? 'employee' : role}
                disabled={busy}
                onChange={(event) => pickAccountType(event.target.value)}
                className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm font-semibold text-dash-secondary outline-none focus:border-shell-accent/60"
              >
                {accountTypeOptions.map(type => (
                  <option key={type} value={type}>{roleLabel(type)}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="label-mono !text-[9px]">Email {role === 'server' ? '(optional for POS only)' : ''}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="them@example.com"
                autoFocus
                className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-shell-accent/60"
              />
            </label>
          </div>

          {role !== 'reseller' && (
            <div className="space-y-3 border-y border-dash-border py-4">
              <label className="block max-w-sm">
                <span className="label-mono !text-[9px]">POS profile</span>
                <select
                  value={posMode}
                  disabled={busy}
                  onChange={(event) => {
                    setPosMode(event.target.value)
                    if (event.target.value !== 'existing') setWaiterId('')
                  }}
                  className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm font-semibold text-dash-secondary outline-none focus:border-shell-accent/60"
                >
                  <option value="none">No POS access</option>
                  <option value="new">Create a POS profile</option>
                  <option value="existing">Link an existing POS employee</option>
                </select>
              </label>

              {posMode === 'existing' && (
                <label className="block max-w-sm">
                  <span className="label-mono !text-[9px]">POS employee</span>
                  <select
                    value={waiterId}
                    disabled={busy}
                    onChange={(event) => {
                      setWaiterId(event.target.value)
                      const waiter = waiters.find(item => item.id === event.target.value)
                      if (waiter) {
                        setName(waiter.name)
                        setPosAuthority(posAuthorityForTier(waiter.pos_role))
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm font-semibold text-dash-secondary outline-none focus:border-shell-accent/60"
                  >
                    <option value="">Choose employee</option>
                    {waiters.map((waiter) => (
                      <option key={waiter.id} value={waiter.id}>{waiter.name}</option>
                    ))}
                  </select>
                </label>
              )}

              {posMode === 'new' && (
                <>
                  <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                    <label>
                      <span className="label-mono !text-[9px]">Name</span>
                      <input
                        value={name}
                        disabled={busy}
                        onChange={(event) => setName(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none focus:border-shell-accent/60"
                      />
                    </label>
                    <label>
                      <span className="label-mono !text-[9px]">POS PIN</span>
                      <input
                        inputMode="numeric"
                        autoComplete="off"
                        value={pin}
                        maxLength={4}
                        placeholder="4 digits"
                        disabled={busy}
                        onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 font-mono text-sm tabular-nums text-dash-cream outline-none placeholder:font-sans placeholder:text-dash-tertiary focus:border-shell-accent/60"
                      />
                    </label>
                  </div>
                  <div>
                    <p className="label-mono !text-[9px]">Positions &amp; pay</p>
                    <p className="mt-1 text-xs text-dash-tertiary">
                      Select every position they can clock in as and choose one default.
                    </p>
                    <div className="mt-2">
                      <JobAssignmentsFields rows={rows} onChange={setRows} disabled={busy} />
                    </div>
                  </div>
                </>
              )}

              {posMode !== 'none' && (
                <label className="block max-w-sm">
                  <span className="label-mono !text-[9px]">POS authority</span>
                  <select
                    value={effectivePosAuthority}
                    disabled={busy}
                    onChange={(event) => setPosAuthority(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm font-semibold text-dash-secondary outline-none focus:border-shell-accent/60"
                  >
                    {POS_AUTHORITY_OPTIONS.map(option => (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={POS_AUTHORITY_RANK[option.value] < POS_AUTHORITY_RANK[minimumPosAuthority]}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-dash-tertiary">
                    Applies in every position; pay, tips, and shift duties still follow the clocked-in position.
                  </span>
                </label>
              )}
            </div>
          )}

          {role !== 'reseller' && email.trim() ? (
            <div className="space-y-3 border-t border-dash-border pt-4">
              <div>
                <p className="text-sm font-semibold text-dash-cream">Back Office view</p>
                <p className="mt-1 text-xs leading-5 text-dash-tertiary">
                  This controls how much detail they see. Their permissions still decide what they are allowed to do.
                </p>
              </div>
              <BackOfficeViewEditor
                value={viewPolicy}
                onChange={setViewPolicy}
                templates={templates}
                onSaveTemplate={onCreateTemplate}
                disabled={busy}
              />
            </div>
          ) : null}

          {role === 'reseller' && cloneResellerAccess ? (
            <p className="text-xs leading-5 text-dash-tertiary">
              This reseller will receive the same restaurant access currently assigned to your reseller account.
            </p>
          ) : role === 'reseller' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {RESELLER_TOGGLEABLE_TABS.map((key) => {
                  const enabled = Boolean(resellerPerms[key])
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={enabled}
                      onClick={() => setResellerPerms((current) => ({ ...current, [key]: !current[key] }))}
                      className={`flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${enabled ? 'border-shell-accent/60 bg-shell-accent/10 text-shell-accent' : 'border-dash-border text-dash-tertiary hover:text-dash-secondary'}`}
                    >
                      {enabled && <Check size={11} strokeWidth={3} aria-hidden="true" />}
                      {RESELLER_PERMISSION_LABELS[key]}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : role === 'owner' ? (
            <p className="text-xs leading-5 text-dash-tertiary">
              Owners receive full restaurant access. Accepting this invite transfers primary ownership when the restaurant is currently reseller-owned.
            </p>
          ) : email.trim() ? (
            <PermissionEditor
              value={perms}
              roleDefaults={roleDefaults}
              onChange={setPerms}
              grantCap={grantCap}
              showPreview
              disabled={busy}
            />
          ) : null}
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
              {busy ? 'Adding…' : email.trim() ? 'Add & send invite' : 'Add team member'}
            </button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  )
}

// Per-member permission drawer. Edits the FULL effective map; only the keys
// that differ from the role defaults are persisted as permission_overrides.
function MemberPermissionsModal({ restaurantId, member, waiters, roleDefaultsForRole, accountTypeOptions, grantCap, templates, onCreateTemplate, onClose, onSaved }) {
  const [role, setRole] = useState(member.role)
  const [waiterId, setWaiterId] = useState(member.waiter_id || '')
  const linkedWaiter = waiters.find(waiter => waiter.id === waiterId) || null
  const [posAuthority, setPosAuthority] = useState(() => posAuthorityForTier(linkedWaiter?.pos_role))
  const roleDefaults = roleDefaultsForRole(role)
  const minimumPosAuthority = highestPosAuthority(
    accountMinimumPosAuthority(role),
    (linkedWaiter?.job_assignments || []).map(assignment => assignment.permission_tier),
  )
  const effectivePosAuthority = highestPosAuthority(
    posAuthority,
    minimumPosAuthority,
  )
  const [perms, setPerms] = useState(() => mergePermissions(roleDefaults, member.permission_overrides))
  const [viewPolicy, setViewPolicy] = useState(() => normalizeViewPolicy(member.view_assignment?.policy))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const updated = member.is_primary_owner
        ? member
        : await backOfficeApi.updateMember(restaurantId, member.id, {
          permission_overrides: diffOverrides(perms, roleDefaults),
          role,
          waiter_id: waiterId || null,
          ...(waiterId ? { pos_authority: effectivePosAuthority } : {}),
        })
      const viewAssignment = await backOfficeApi.updateMemberViewPolicy(
        restaurantId,
        member.user_id,
        viewPolicy,
      )
      onSaved({ ...updated, view_assignment: viewAssignment })
      onClose()
    } catch (saveError) {
      setError(saveError?.message || 'Could not save permissions.')
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Access & view — ${member.display_name || member.email}`} size="xl">
      <div className="space-y-4">
        {!member.is_primary_owner ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label-mono !text-[9px]">Account type</span>
                <select
                  value={role === 'server' ? 'employee' : role}
                  disabled={busy}
                  onChange={(event) => setRole(event.target.value === 'employee' ? 'server' : event.target.value)}
                  className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm font-semibold text-dash-secondary outline-none focus:border-shell-accent/60"
                >
                  {accountTypeOptions.filter(type => type !== 'reseller').map(type => (
                    <option key={type} value={type}>{roleLabel(type)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label-mono !text-[9px]">POS profile</span>
                <select
                  value={waiterId}
                  disabled={busy}
                  onChange={(event) => {
                    setWaiterId(event.target.value)
                    const waiter = waiters.find(item => item.id === event.target.value)
                    if (waiter) setPosAuthority(posAuthorityForTier(waiter.pos_role))
                  }}
                  className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm font-semibold text-dash-secondary outline-none focus:border-shell-accent/60"
                >
                  <option value="">No POS profile</option>
                  {waiters.map(waiter => <option key={waiter.id} value={waiter.id}>{waiter.name}</option>)}
                </select>
              </label>
            </div>
            {waiterId && (
              <label className="mt-3 block max-w-sm">
                <span className="label-mono !text-[9px]">POS authority</span>
                <select
                  value={effectivePosAuthority}
                  disabled={busy}
                  onChange={(event) => setPosAuthority(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm font-semibold text-dash-secondary outline-none focus:border-shell-accent/60"
                >
                  {POS_AUTHORITY_OPTIONS.map(option => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={POS_AUTHORITY_RANK[option.value] < POS_AUTHORITY_RANK[minimumPosAuthority]}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="mt-4 border-t border-dash-border pt-4">
              <p className="mb-3 text-sm font-semibold text-dash-cream">Permissions</p>
            <PermissionEditor
              value={perms}
              roleDefaults={roleDefaults}
              onChange={setPerms}
              grantCap={grantCap}
              showPreview
              disabled={busy}
            />
            </div>
          </>
        ) : (
          <p className="rounded-lg border border-dash-border px-3 py-2 text-xs leading-5 text-dash-tertiary">
            Primary owners always keep full authority. You can simplify how their Back Office is presented below.
          </p>
        )}
        <div className="border-t border-dash-border pt-4">
          <p className="text-sm font-semibold text-dash-cream">Back Office view</p>
          <p className="mb-3 mt-1 text-xs leading-5 text-dash-tertiary">
            Choose a preset or customize individual tabs and control groups. This never grants access.
          </p>
          <BackOfficeViewEditor
            value={viewPolicy}
            onChange={setViewPolicy}
            templates={templates}
            onSaveTemplate={onCreateTemplate}
            disabled={busy}
          />
        </div>
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
            {busy ? 'Saving…' : 'Save access & view'}
          </button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

function ForgetEmployeeModal({ waiter, member, onClose, onForgotten }) {
  const [confirmationName, setConfirmationName] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const nameMatches = employeeNameConfirmationMatches(confirmationName, waiter.name)
  const canSubmit = nameMatches && reason.trim().length >= 3

  const forget = async () => {
    if (!canSubmit || busy) return
    setBusy(true)
    setError(null)
    try {
      await onForgotten({ confirmationName, reason: reason.trim() })
      onClose()
    } catch (forgetError) {
      setError(forgetError?.message || 'Could not permanently delete this employee.')
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={busy ? undefined : onClose} title={`Delete ${waiter.name} permanently?`} size="md">
      <div className="space-y-4">
        <p className="text-sm leading-6 text-dash-secondary">
          This cannot be undone. Their personal details, PIN, login, pay setup, and Team profile will be erased.
          {member ? ' Their linked Back Office access will also be revoked.' : ''}
          {' '}Past checks, timecards, payroll, and audit records remain under an anonymous former-employee identity.
        </p>
        <label className="block">
          <span className="label-mono !text-[9px]">Type {waiter.name} to confirm</span>
          <input
            value={confirmationName}
            disabled={busy}
            onChange={(event) => setConfirmationName(event.target.value)}
            autoComplete="off"
            className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none focus:border-dash-danger/60"
          />
          {confirmationName && !nameMatches && (
            <span className="mt-1 block text-xs text-dash-danger">
              Enter the employee&rsquo;s full name. Capitalization does not matter.
            </span>
          )}
        </label>
        <label className="block">
          <span className="label-mono !text-[9px]">Manager reason</span>
          <textarea
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Why is this employee being permanently removed?"
            className="mt-1 w-full resize-none rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none focus:border-dash-danger/60"
          />
        </label>
        {error && <p className="text-xs text-dash-danger">{error}</p>}
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-dash-border px-4 py-2 text-sm font-semibold text-dash-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void forget()}
            disabled={!canSubmit || busy}
            className="rounded-xl bg-dash-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? 'Deleting…' : 'Delete permanently'}
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
  const [boResellers, setBoResellers] = useState([])
  const [boInvites, setBoInvites] = useState([])
  const [boLoading, setBoLoading] = useState(true)
  const [boUnavailable, setBoUnavailable] = useState(false)
  const [boBootstrapped, setBoBootstrapped] = useState(null)
  const [addMemberState, setAddMemberState] = useState(null) // { waiterId: string|null, role?: string } | null
  const [editingMember, setEditingMember] = useState(null)
  const [forgettingEmployee, setForgettingEmployee] = useState(null)
  const [viewTemplates, setViewTemplates] = useState([])

  const canViewMembers = access.can('team.view')
  const canManageMembers = access.can('team.edit_employees')
  const canConfigureMemberViews = canManageMembers && (!access.isDirectReseller || access.can('settings.edit'))
  const accountTypeOptions = manageableTeamAccountTypes(access.authorityLevel, {
    isDirectReseller: access.isDirectReseller,
    canManageMembers,
  })

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setBoLoading(true)
    setBoBootstrapped(null)
    backOfficeApi.teamWorkspace(restaurantId)
      .then((workspace) => {
        if (cancelled) return
        setWaiters(Array.isArray(workspace?.waiters) ? workspace.waiters : [])
        setJobCodes(normalizeJobCodes(workspace?.job_codes))
        setRoleLoadError(false)
        setRolePerms(Array.isArray(workspace?.role_permissions) ? workspace.role_permissions : [])
        setCashDrawerPolicy(workspace?.cash_drawer_policy || null)
        setBoMembers(Array.isArray(workspace?.members) ? workspace.members : [])
        setBoResellers(Array.isArray(workspace?.resellers) ? workspace.resellers : [])
        setBoInvites(Array.isArray(workspace?.invitations) ? workspace.invitations : [])
        setBoUnavailable(false)
        setBoLoading(false)
        setBoBootstrapped(true)
      })
      .catch(async () => {
        try {
          const [waiterRows, jobCodeResult, roleRows, drawerPolicy] = await Promise.all([
            fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=true`),
            fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes`)
              .then((rows) => ({ rows, failed: false }))
              .catch(() => ({ rows: [], failed: true })),
            fetchRolePermissions(restaurantId).catch(() => []),
            fetchCashDrawerPolicy(restaurantId).catch(() => null),
          ])
          if (cancelled) return
          setWaiters(Array.isArray(waiterRows) ? waiterRows : [])
          setJobCodes(normalizeJobCodes(jobCodeResult.rows))
          setRoleLoadError(jobCodeResult.failed)
          setRolePerms(Array.isArray(roleRows) ? roleRows : [])
          setCashDrawerPolicy(drawerPolicy)
        } catch (loadError) {
          if (!cancelled) setError(loadError?.message || 'Could not load team data.')
        } finally {
          if (!cancelled) setBoBootstrapped(false)
        }
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
      setBoResellers(Array.isArray(data?.resellers) ? data.resellers : [])
      setBoInvites(Array.isArray(data?.invitations) ? data.invitations : [])
      setBoUnavailable(false)
    } catch {
      setBoUnavailable(true)
    } finally {
      setBoLoading(false)
    }
  }

  useEffect(() => {
    if (!restaurantId || access.loading || !canViewMembers || boBootstrapped !== false) return
    setBoLoading(true)
    void loadBackOffice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, access.loading, canViewMembers, boBootstrapped])

  useEffect(() => {
    if (!restaurantId || access.loading || !canViewMembers) return
    backOfficeApi.listViewTemplates(restaurantId)
      .then((templates) => setViewTemplates(Array.isArray(templates) ? templates : []))
      .catch(() => setViewTemplates([]))
  }, [restaurantId, access.loading, canViewMembers])

  const createViewTemplate = async (name, policy) => {
    const created = await backOfficeApi.createViewTemplate(restaurantId, {
      name,
      policy,
      reusable: true,
    })
    setViewTemplates((current) => [...current.filter((item) => item.id !== created.id), created])
  }

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

  const roleDefaultsForInviteRole = (role) => {
    const canonical = normalizeRoleCode(role)
    const row = rolePerms.find((item) => normalizeRoleCode(item.role_key) === canonical)
      || (canonical === 'server'
        ? rolePerms.find((item) => ['server', 'waiter'].includes(String(item.role_key || '').trim().toLowerCase()))
        : null)
    return row?.back_office_permissions || null
  }

  const grantCap = access.isOwner ? null : access.permissions

  const teamPeople = useMemo(() => {
    const people = waiters.map((waiter) => ({
      key: `waiter:${waiter.id}`,
      waiter,
      member: boMembers.find(member => member.waiter_id === waiter.id) || null,
      invitation: boInvites.find(invitation => (
        invitation.kind === 'restaurant_member' && invitation.waiter_id === waiter.id
      )) || null,
    }))
    boMembers
      .filter(member => !member.waiter_id)
      .forEach(member => people.push({
        key: `member:${member.id}`,
        waiter: null,
        member,
        invitation: null,
      }))
    boInvites
      .filter(invitation => invitation.kind === 'restaurant_member' && !invitation.waiter_id)
      .forEach(invitation => people.push({
        key: `invitation:${invitation.id}`,
        waiter: null,
        member: null,
        invitation,
      }))
    return people
  }, [boInvites, boMembers, waiters])
  const duplicateActivePins = useMemo(() => {
    const counts = new Map()
    waiters
      .filter(waiter => waiter.is_active !== false && waiter.pos_passcode)
      .forEach(waiter => counts.set(
        String(waiter.pos_passcode),
        (counts.get(String(waiter.pos_passcode)) || 0) + 1,
      ))
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([pin]) => pin))
  }, [waiters])
  const hasPinConflicts = duplicateActivePins.size > 0
    || waiters.some(waiter => waiter.is_active !== false && waiter.pin_conflict)

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

  const forgetEmployee = async (waiter, { confirmationName, reason }) => {
    await fetchWithSupabaseAuth(`/waiters/${waiter.id}/forget`, {
      method: 'POST',
      body: JSON.stringify({ confirmation_name: confirmationName, reason }),
    })
    setWaiters((current) => current.filter((item) => item.id !== waiter.id))
    setBoMembers((current) => current.filter((member) => member.waiter_id !== waiter.id))
    setBoInvites((current) => current.filter((invitation) => invitation.waiter_id !== waiter.id))
    queryClient.invalidateQueries({ queryKey: queryKeys.waiters(restaurantId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.backOfficeMembers(restaurantId) })
  }

  const saveEmployeeJobsPay = async (waiter, payload) => {
    const updated = await fetchWithSupabaseAuth(`/waiters/${waiter.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    setWaiters(prev => prev.map(item => item.id === waiter.id ? updated : item))
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

  const revokeBoInvite = (invitation) =>
    act(async () => {
      if (invitation.kind === 'reseller_connection') {
        await backOfficeApi.revokeAccessInvite(invitation.id)
      } else {
        await backOfficeApi.revokeInvite(restaurantId, invitation.id)
      }
      setBoInvites((prev) => prev.filter((item) => item.id !== invitation.id))
      queryClient.invalidateQueries({ queryKey: queryKeys.backOfficeMembers(restaurantId) })
    })

  const toggleResellerPermission = (assignment, key) =>
    act(async () => {
      const currentPermissions = {
        ...DEFAULT_RESELLER_PERMISSIONS,
        ...(assignment.permissions || {}),
      }
      const permissions = { ...currentPermissions, [key]: !Boolean(currentPermissions[key]) }
      await updateResellerPermissions(restaurantId, assignment.id, permissions)
      setBoResellers((current) => current.map((item) => (
        item.id === assignment.id ? { ...item, permissions } : item
      )))
    })

  const resendBoInvite = (invitation) =>
    act(async () => {
      const response = await backOfficeApi.resendInvite(invitation.id)
      setBoInvites((prev) => prev.map((item) => (item.id === invitation.id ? { ...item, ...response.invitation } : item)))
      if (!response.email_sent && response.accept_url) {
        try {
          await navigator.clipboard.writeText(response.accept_url)
        } catch {
          window.prompt('Email is not configured. Copy this invitation link:', response.accept_url)
        }
      }
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

      {access.viewVisible('team.employees') && <Pane icon={Users} eyebrow="Team" title="People, access & positions">
        <div className="divide-y divide-dash-border">
          {canManageMembers && !boUnavailable && (
            <button
              type="button"
              onClick={() => setAddMemberState({ waiterId: null })}
              className="flex w-full items-center gap-3 py-3 text-left transition hover:text-dash-cream"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-shell-cta text-shell-cta-text">
                <UserPlus size={16} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-dash-cream">Add team member</span>
                <span className="block text-xs text-dash-tertiary">Account access, one POS PIN, and every position they can work</span>
              </span>
              <Plus size={16} strokeWidth={2} className="text-dash-tertiary" aria-hidden="true" />
            </button>
          )}

          {hasPinConflicts && (
            <p className="py-3 text-sm text-dash-warning">
              Some active POS identities share a PIN. Update every row marked below before those employees sign in.
            </p>
          )}

          {teamPeople.map(({ key, waiter, member, invitation }) => {
            const payRows = waiter ? staffPayDrafts(waiter, roleOptions).filter(row => row.selected) : []
            const primaryRole = waiter ? primaryStaffRole(waiter, roleOptions) : null
            const rolePermission = waiter ? rolePerms.find(
              item => normalizeRoleCode(item.role_key) === primaryRole,
            ) || {} : {}
            const noSaleOverride = waiter ? noSaleOverrideState(waiter.pos_permissions_override) : 'inherit'
            const effectiveNoSale = waiter ? cashDrawerRoleSummary(
              applyDrawerOverrides(rolePermission, waiter.pos_permissions_override),
              cashDrawerPolicy || {},
            ).find(item => item.key === 'no_sale')?.value : null
            const mayManageWaiter = Boolean(waiter && canManageMembers
              && canManageStaffMember(access.authorityLevel, waiter, roleOptions))
            const suspended = member?.status === 'suspended'
            const displayName = waiter?.name || member?.display_name || invitation?.name || member?.email || invitation?.email
            const accountRole = member?.role || invitation?.role || null
            const hasDuplicatePin = Boolean(
              waiter?.is_active !== false
              && (
                waiter?.pin_conflict
                || duplicateActivePins.has(String(waiter?.pos_passcode || ''))
              ),
            )
            return (
              <div key={key} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-[190px] flex-1">
                  <span className={`block text-sm font-semibold ${suspended || waiter?.is_active === false ? 'text-dash-tertiary' : 'text-dash-cream'}`}>
                    {displayName}
                    {member?.user_id === auth.user?.id && (
                      <span className="ml-1.5 font-mono text-[9px] uppercase tracking-eyebrow text-dash-tertiary">you</span>
                    )}
                  </span>
                  <span className="block text-[11px] text-dash-tertiary">
                    {waiter
                      ? (payRows.length > 0
                        ? payRows.map(row => `${row.label} ${money(effectiveStaffPayRate(row))}`).join(' · ')
                        : 'No assigned positions')
                      : (member?.email || invitation?.email || 'No POS profile')}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="neutral">{accountRole ? memberTypeLabel(accountRole) : 'POS only'}</Badge>
                    {waiter && <Badge variant="neutral">{posAuthorityLabel(waiter.pos_role)} POS</Badge>}
                    {hasDuplicatePin && <Badge variant="warning" dot>duplicate PIN</Badge>}
                    {invitation && <Badge variant="gold" dot>invite pending</Badge>}
                    {suspended && <Badge variant="warning" dot>suspended</Badge>}
                    {waiter?.is_active === false && <Badge variant="neutral">deactivated</Badge>}
                  </span>
                </span>

                <span className="ml-auto flex flex-wrap items-center gap-2">
                  {waiter && (
                    <span className="flex items-center gap-1.5" title="POS clock-in PIN">
                      <KeyRound size={13} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
                      <PinInput
                        value={waiter.pos_passcode ?? ''}
                        disabled={!mayManageWaiter}
                        onCommit={(nextPin) => void patchWaiter(waiter.id, { pin: nextPin })}
                      />
                    </span>
                  )}
                  {waiter && (
                    <button
                      type="button"
                      disabled={!mayManageWaiter}
                      onClick={() => setEmployeeEditor({ waiter, member })}
                      title={mayManageWaiter ? 'Edit POS authority, positions, and hourly pay' : 'You cannot manage this employee'}
                      className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-dash-border px-2.5 text-xs font-semibold text-dash-secondary transition hover:border-shell-accent/50 hover:text-dash-cream disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Settings2 size={13} strokeWidth={1.75} aria-hidden="true" />
                      POS setup
                    </button>
                  )}
                  {waiter && (
                    <select
                      value={noSaleOverride}
                      disabled={!mayManageWaiter}
                      aria-label={`${waiter.name} No Sale permission`}
                      title={`No Sale: ${effectiveNoSale || 'manager only'}. A drawer assigned to this terminal is always required.`}
                      onChange={(event) => void patchWaiter(waiter.id, {
                        pos_permissions_override: withNoSaleOverride(
                          waiter.pos_permissions_override,
                          event.target.value,
                        ),
                      })}
                      className="rounded-xl border border-dash-border bg-[var(--glass-bg)] px-2 py-1.5 text-[11px] font-semibold text-dash-secondary outline-none focus:border-shell-accent/60"
                    >
                      <option value="inherit">No Sale: role</option>
                      <option value="allow">No Sale: allow</option>
                      <option value="deny">No Sale: deny</option>
                    </select>
                  )}
                  {member && canConfigureMemberViews && (
                    <button
                      type="button"
                      onClick={() => setEditingMember(member)}
                      className="rounded-lg border border-dash-border px-2 py-1 text-[11px] font-semibold text-dash-secondary transition hover:border-shell-accent/50 hover:text-dash-cream"
                    >
                      Account &amp; view
                    </button>
                  )}
                  {waiter && !member && !invitation && mayManageWaiter && !boUnavailable && (
                    <button
                      type="button"
                      onClick={() => setAddMemberState({ waiterId: waiter.id })}
                      className="text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary"
                    >
                      Add account
                    </button>
                  )}
                  {invitation?.accept_url && <CopyButton text={invitation.accept_url} label="Copy invite" />}
                  {invitation && canManageMembers && (
                    <>
                      <button type="button" onClick={() => void resendBoInvite(invitation)} className="text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary">Resend</button>
                      <button type="button" onClick={() => void revokeBoInvite(invitation)} className="text-xs font-semibold text-dash-danger/80 transition hover:text-dash-danger">Revoke</button>
                    </>
                  )}
                  {waiter && (
                    <button
                      type="button"
                      disabled={!mayManageWaiter}
                      onClick={() => void patchWaiter(waiter.id, { is_active: waiter.is_active === false })}
                      className="text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary disabled:opacity-50"
                    >
                      {waiter.is_active === false ? 'Reactivate' : 'Deactivate'}
                    </button>
                  )}
                  {waiter?.is_active === false && mayManageWaiter && !member?.is_primary_owner && (
                    <button
                      type="button"
                      onClick={() => setForgettingEmployee({ waiter, member })}
                      className="text-xs font-semibold text-dash-danger/80 transition hover:text-dash-danger"
                    >
                      Delete permanently
                    </button>
                  )}
                </span>
              </div>
            )
          })}
          {teamPeople.length === 0 && <p className="py-4 text-sm text-dash-tertiary">No team members yet.</p>}
        </div>
      </Pane>}

      {access.viewVisible('team.positions') && <Pane icon={BadgeDollarSign} eyebrow="POS positions" title="Roles and default pay">
        <div className="space-y-2">
          {normalizeStaffRoleOptions(jobCodes).map((code) => {
            const assignedCount = positionAssignmentCounts.get(roleCodeFromJobCode(code)) || 0
            const mayManage = canManageMembers && canManageJobCode(access.authorityLevel, code)
            const mayRemove = mayManage && assignedCount === 0
            return (
              <div key={code.id} className="flex flex-wrap items-center gap-3">
                <span className="min-w-[120px] text-sm font-semibold text-dash-cream">{code.label || code.code}</span>
                <span className="label-mono !text-[9px]">Minimum access: {permissionTierLabel(code.permission_tier)}</span>
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
              aria-label="Minimum POS access for this position"
              title="Minimum POS access granted when this position is assigned"
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
      </Pane>}

      {access.viewVisible('team.access') && <Pane
        icon={ShieldCheck}
        eyebrow="External access"
        title="Reseller connections"
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
            {boResellers.map((assignment) => {
              const permissions = { ...DEFAULT_RESELLER_PERMISSIONS, ...(assignment.permissions || {}) }
              return (
                <div key={assignment.id} className="border-t border-dash-border pt-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-[160px] text-sm font-semibold text-dash-cream">
                      {connectedResellerName(assignment)}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <Badge variant="success" dot>connected</Badge>
                      <Badge variant="neutral">Reseller</Badge>
                    </span>
                  </div>
                  {['owner', 'platform_admin'].includes(access.authorityLevel) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {RESELLER_TOGGLEABLE_TABS.map((key) => {
                        const enabled = Boolean(permissions[key])
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={enabled}
                            onClick={() => void toggleResellerPermission(assignment, key)}
                            className={`flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition ${enabled ? 'border-shell-accent/60 bg-shell-accent/10 text-shell-accent' : 'border-dash-border text-dash-tertiary hover:text-dash-secondary'}`}
                          >
                            {enabled && <Check size={10} strokeWidth={3} aria-hidden="true" />}
                            {RESELLER_PERMISSION_LABELS[key]}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {boInvites.filter(invitation => invitation.kind === 'reseller_connection').map((invitation) => (
              <div key={invitation.id} className="flex flex-wrap items-center gap-3">
                <span className="min-w-[160px]">
                  <span className="block text-sm font-semibold text-dash-cream">{invitation.name || invitation.email}</span>
                  {invitation.name && <span className="block text-xs text-dash-tertiary">{invitation.email}</span>}
                </span>
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  <Badge variant="gold" dot>invited (pending)</Badge>
                  <Badge variant="neutral">{invitationTypeLabel(invitation)}</Badge>
                  {invitation.accept_url && <CopyButton text={invitation.accept_url} label="Copy invite link" />}
                  {canManageMembers && (
                    invitation.kind !== 'reseller_connection'
                    || ['owner', 'platform_admin'].includes(access.authorityLevel)
                    || (access.isDirectReseller && invitation.invited_by_user_id === auth.user?.id)
                  ) && (
                    <>
                      <button type="button" onClick={() => void resendBoInvite(invitation)} className="text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary">
                        Resend
                      </button>
                      <button type="button" onClick={() => void revokeBoInvite(invitation)} className="text-xs font-semibold text-dash-danger/80 transition hover:text-dash-danger">
                        Revoke
                      </button>
                    </>
                  )}
                </span>
              </div>
            ))}

            {boResellers.length === 0 && !boInvites.some(invitation => invitation.kind === 'reseller_connection') && (
              <p className="text-sm text-dash-tertiary">No reseller connections yet.</p>
            )}
          </div>
        )}
      </Pane>}

      {access.viewVisible('team.permissions') && <RolePermissionsPanel
        restaurantId={restaurantId}
        cashDrawerPolicy={cashDrawerPolicy}
        onRolesChange={setRolePerms}
        authorityLevel={access.authorityLevel}
        jobCodes={jobCodes}
      />}

      {employeeEditor && (
        <EmployeeJobsPayModal
          waiter={employeeEditor.waiter}
          accountRole={employeeEditor.member?.role}
          jobCodes={manageableRoleOptions}
          onClose={() => setEmployeeEditor(null)}
          onSave={(payload) => saveEmployeeJobsPay(employeeEditor.waiter, payload)}
        />
      )}

      {addMemberState && (
        <AddTeamMemberModal
          restaurantId={restaurantId}
          waiters={waiters.filter((waiter) => (
            waiter.is_active !== false
            && (waiter.id === addMemberState.waiterId
              || canManageStaffMember(access.authorityLevel, waiter, roleOptions))
            && (!boMembers.some(member => member.waiter_id === waiter.id) || waiter.id === addMemberState.waiterId)
            && (!boInvites.some(invitation => invitation.waiter_id === waiter.id) || waiter.id === addMemberState.waiterId)
          ))}
          jobCodes={jobCodes.filter(role => canManageJobCode(access.authorityLevel, role))}
          roleDefaultsForRole={roleDefaultsForInviteRole}
          grantCap={grantCap}
          accountTypeOptions={accountTypeOptions}
          cloneResellerAccess={access.isDirectReseller && !access.isOwner}
          templates={viewTemplates}
          onCreateTemplate={access.can('settings.edit') ? createViewTemplate : undefined}
          initialWaiterId={addMemberState.waiterId}
          initialRole={addMemberState.role}
          onClose={() => setAddMemberState(null)}
          onAdded={(response) => {
            if (response?.waiter) setWaiters(prev => [...prev, response.waiter])
            void refreshBackOffice()
          }}
        />
      )}

      {editingMember && (
        <MemberPermissionsModal
          restaurantId={restaurantId}
          member={editingMember}
          waiters={waiters.filter(waiter => (
            waiter.is_active !== false
            && (waiter.id === editingMember.waiter_id
              || canManageStaffMember(access.authorityLevel, waiter, roleOptions))
            && (!boMembers.some(member => member.waiter_id === waiter.id) || waiter.id === editingMember.waiter_id)
          ))}
          roleDefaultsForRole={roleDefaultsForInviteRole}
          accountTypeOptions={accountTypeOptions}
          grantCap={grantCap}
          templates={viewTemplates}
          onCreateTemplate={access.can('settings.edit') ? createViewTemplate : undefined}
          onClose={() => setEditingMember(null)}
          onSaved={(updated) => {
            setBoMembers((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
            queryClient.invalidateQueries({ queryKey: queryKeys.backOfficeMembers(restaurantId) })
          }}
        />
      )}

      {forgettingEmployee && (
        <ForgetEmployeeModal
          waiter={forgettingEmployee.waiter}
          member={forgettingEmployee.member}
          onClose={() => setForgettingEmployee(null)}
          onForgotten={(payload) => forgetEmployee(forgettingEmployee.waiter, payload)}
        />
      )}
    </div>
  )
}

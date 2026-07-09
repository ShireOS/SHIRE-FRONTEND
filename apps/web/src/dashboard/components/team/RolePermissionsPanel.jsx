import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../shared/Card'
import { PERMISSION_TOGGLES, fetchRolePermissions, updateRolePermission } from '../../data/permissions'
import { PERMISSION_KEYS, mergePermissions } from '../../../shared/permissions'
import PermissionEditor from './PermissionEditor'

const roleLabel = (key) =>
  String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

const inputCls =
  'min-h-[32px] w-24 rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2.5 text-xs font-medium text-dash-cream outline-none transition placeholder:text-dash-tertiary focus:border-shell-accent/60 disabled:opacity-50'

function Toggle({ active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
        active
          ? 'border-shell-accent/60 bg-shell-accent/15 text-dash-cream'
          : 'border-dash-border text-dash-tertiary hover:text-dash-cream'
      }`}
    >
      {children}
    </button>
  )
}

function RoleCard({ role, busy, onPatch }) {
  const [backOfficeOpen, setBackOfficeOpen] = useState(false)
  const backOffice = role.back_office_permissions || {}
  const grantedCount = PERMISSION_KEYS.filter((key) => backOffice[key]).length

  return (
    <div className="rounded-xl border border-dash-border bg-[var(--glass-bg)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-dash-cream">{roleLabel(role.role_key)}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PERMISSION_TOGGLES.map((t) => (
          <Toggle
            key={t.key}
            active={Boolean(role[t.key])}
            disabled={busy}
            onClick={() => onPatch(role, { [t.key]: !role[t.key] })}
          >
            {t.label}
          </Toggle>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="label-mono !text-[9px]">Discount limit %</span>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="none"
            defaultValue={role.discount_limit_percent ?? ''}
            disabled={busy}
            className={inputCls}
            onBlur={(e) => {
              const raw = e.target.value.trim()
              const next = raw === '' ? null : Number(raw)
              if (next !== (role.discount_limit_percent ?? null)) onPatch(role, { discount_limit_percent: next })
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-mono !text-[9px]">Refund limit $</span>
          <input
            type="number"
            min="0"
            placeholder="none"
            defaultValue={role.refund_limit ?? ''}
            disabled={busy}
            className={inputCls}
            onBlur={(e) => {
              const raw = e.target.value.trim()
              const next = raw === '' ? null : Number(raw)
              if (next !== (role.refund_limit ?? null)) onPatch(role, { refund_limit: next })
            }}
          />
        </label>
        <Toggle
          active={Boolean(role.require_manager_pin_for_approval)}
          disabled={busy}
          onClick={() => onPatch(role, { require_manager_pin_for_approval: !role.require_manager_pin_for_approval })}
        >
          Requires manager PIN
        </Toggle>
      </div>

      {/* Default back-office (dashboard) permissions for members clocked in under
          this role. Saved verbatim as pos_role_permissions.back_office_permissions;
          per-member overrides layer on top (see TeamPage → Back-office access). */}
      <div className="mt-4 border-t border-dash-border pt-3">
        <button
          type="button"
          onClick={() => setBackOfficeOpen((open) => !open)}
          aria-expanded={backOfficeOpen}
          className="flex items-center gap-1.5 text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary"
        >
          <ChevronDown
            size={13}
            strokeWidth={1.75}
            className={`transition-transform ${backOfficeOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
          Back office (dashboard)
          <span className="font-mono text-[10px] text-dash-tertiary">
            {grantedCount}/{PERMISSION_KEYS.length} granted
          </span>
        </button>
        {backOfficeOpen && (
          <div className="mt-3">
            <PermissionEditor
              value={mergePermissions(backOffice, null)}
              roleDefaults={null}
              grantCap={null}
              showPreview={false}
              disabled={busy}
              onChange={(next) => onPatch(role, { back_office_permissions: next })}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function RolePermissionsPanel({ restaurantId }) {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!restaurantId) return
    try {
      setRoles(await fetchRolePermissions(restaurantId))
      setError(null)
    } catch (err) {
      setError(err.message || 'Could not load role permissions')
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  // Optimistic: apply locally, persist, roll back on error.
  const patch = useCallback(async (role, changes) => {
    setBusy(true)
    setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, ...changes } : r)))
    try {
      await updateRolePermission(role.id, changes)
    } catch (err) {
      setError(err.message || 'Change failed')
      await load()
    } finally {
      setBusy(false)
    }
  }, [load])

  const sorted = useMemo(() => [...roles].sort((a, b) => a.role_key.localeCompare(b.role_key)), [roles])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck size={17} strokeWidth={1.75} className="text-shell-accent" aria-hidden="true" />
          <h2 className="text-base font-semibold text-dash-cream">POS role permissions</h2>
        </div>
        <p className="mt-1 text-xs text-dash-tertiary">
          What each role can do on the POS, and their discount / refund caps. Staff inherit these from the
          role they clock in under; a manager PIN is still required to approve anything a role can&rsquo;t do itself.
          Each role also carries default back-office (dashboard) permissions that invited members inherit.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {error ? <p className="text-xs text-dash-danger">{error}</p> : null}
        {loading ? (
          <p className="text-xs text-dash-tertiary">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-xs text-dash-tertiary">No POS roles configured for this store yet.</p>
        ) : (
          sorted.map((role) => <RoleCard key={role.id} role={role} busy={busy} onPatch={patch} />)
        )}
      </CardContent>
    </Card>
  )
}

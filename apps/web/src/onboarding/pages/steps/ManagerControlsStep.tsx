import { useEffect, useMemo, useState } from 'react'
import { fetchPosApi } from '../../../shared/api/posClient'
import type { JobCodeData, RolePermissionData, UseOnboardingReturn } from '../../hooks/useOnboarding'
import { defaultRolePermission as defaultPermissionForRole, sanitizeMoneyInput, sanitizeNumber, sanitizePercentInput, slugRoleCode } from '@shire/settings'
import { cashDrawerRoleSummary } from '../../../dashboard/utils/cashDrawerPermissions'

interface ManagerControlsStepProps {
  onboarding: UseOnboardingReturn
}

const PERMISSIONS: Array<{ key: keyof RolePermissionData; label: string }> = [
  { key: 'can_refund', label: 'Refunds' },
  { key: 'can_void', label: 'Voids' },
  { key: 'can_comp', label: 'Comps' },
  { key: 'can_discount', label: 'Discounts' },
  { key: 'can_open_cash_drawer', label: 'Open drawer' },
  { key: 'can_no_sale', label: 'No-sale' },
  { key: 'can_paid_in_out', label: 'Paid in/out' },
  { key: 'can_adjust_tips', label: 'Tip edits' },
  { key: 'can_adjust_gratuity', label: 'Adjust gratuity' },
  { key: 'can_edit_menu', label: 'Menu edits' },
  { key: 'can_edit_employees', label: 'Employee edits' },
  { key: 'can_edit_schedules', label: 'Schedule edits' },
  { key: 'can_view_reports', label: 'Reports' },
  { key: 'can_close_drawer', label: 'Close drawer' },
  { key: 'can_close_day', label: 'Close day' },
  { key: 'can_reopen_business_day', label: 'Reopen business day' },
  { key: 'can_change_payment_settings', label: 'Payment settings' },
  { key: 'can_edit_sent_items_within_window', label: 'Sent corrections in window' },
  { key: 'can_edit_sent_items_after_window', label: 'Sent corrections after window' },
  { key: 'can_unsend_sent_items', label: 'Unsend kitchen items' },
  { key: 'can_edit_paid_check_items', label: 'Edit paid-check items' },
]

const inputClass = 'w-full min-w-0 px-3 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-sm text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]'
const displayRate = (value: unknown) => {
  const text = String(value ?? '').trim()
  return text === '0' || text === '0.0' || text === '0.00' ? '' : text
}
function Toggle({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'min-h-[36px] rounded-lg border px-3 py-2 text-xs font-semibold transition',
        active
          ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.1)] text-[rgb(var(--text-primary))]'
          : 'border-[rgba(255,255,255,0.1)] text-[rgb(var(--text-tertiary))] hover:border-[rgba(255,255,255,0.22)] hover:text-[rgb(var(--text-primary))]',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function TipParticipationControl({
  isTipped,
  onChange,
}: {
  isTipped: boolean
  onChange: (isTipped: boolean) => void
}) {
  return (
    <fieldset className="min-w-0 space-y-1">
      <legend className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--text-tertiary))]">
        Tip participation
      </legend>
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.14)] p-1">
        {[
          { value: false, label: 'Not tipped' },
          { value: true, label: 'Tipped' },
        ].map(option => {
          const selected = isTipped === option.value
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={[
                'min-h-[34px] rounded-md px-2 py-1.5 text-xs font-semibold transition',
                selected
                  ? 'bg-[#d4a854] text-[#111111] shadow-sm'
                  : 'text-[rgb(var(--text-tertiary))] hover:bg-white/5 hover:text-[rgb(var(--text-primary))]',
              ].join(' ')}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function ManagerControlsStep({ onboarding }: ManagerControlsStepProps) {
  const { restaurantId, data, updateData, saveManagerControls, nextStep, isLoading, error } = onboarding
  const [roleDrafts, setRoleDrafts] = useState<JobCodeData[]>(data.job_codes)
  const [rolePermissions, setRolePermissions] = useState<RolePermissionData[]>(data.role_permissions)
  const [newRoleLabel, setNewRoleLabel] = useState('')
  const [newRoleRate, setNewRoleRate] = useState('')
  const [newRoleIsTipped, setNewRoleIsTipped] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [isSavingRoles, setIsSavingRoles] = useState(false)

  useEffect(() => {
    setRoleDrafts(data.job_codes)
    setRolePermissions(data.role_permissions)
  }, [data.job_codes, data.role_permissions])

  const activeRoles = useMemo(
    () => roleDrafts.filter(role => role.is_active !== false),
    [roleDrafts]
  )

  const visiblePermissions = useMemo(() => {
    const byRole = new Map(rolePermissions.map(role => [role.role_key, role]))
    return activeRoles.map(role => {
      const roleKey = slugRoleCode(role.code || role.label)
      return byRole.get(roleKey) || defaultPermissionForRole(roleKey)
    })
  }, [activeRoles, rolePermissions])

  const updateRoleDraft = (index: number, patch: Partial<JobCodeData>) => {
    setRoleDrafts(current => current.map((role, currentIndex) =>
      currentIndex === index ? { ...role, ...patch } : role
    ))
  }

  const addRoleDraft = () => {
    const label = newRoleLabel.trim()
    if (!label) return
    const code = slugRoleCode(label)
    if (activeRoles.some(role => slugRoleCode(role.code || role.label) === code)) {
      setRoleError('A role with that name already exists.')
      return
    }
    const sortOrder = Math.max(0, ...roleDrafts.map(role => Number(role.sort_order) || 0)) + 10
    setRoleDrafts(current => [
      ...current,
      {
        code,
        label,
        permission_tier: 'normal',
        default_hourly_rate: newRoleRate,
        is_tipped: newRoleIsTipped,
        tipout_role: newRoleIsTipped ? code : '',
        sort_order: sortOrder,
        is_active: true,
      },
    ])
    setRolePermissions(current => [...current, defaultPermissionForRole(code)])
    setNewRoleLabel('')
    setNewRoleRate('')
    setNewRoleIsTipped(false)
    setRoleError(null)
  }

  const removeRoleDraft = (index: number) => {
    if (activeRoles.length <= 1) {
      setRoleError('Keep at least one active role.')
      return
    }
    const removed = roleDrafts[index]
    const removedKey = slugRoleCode(removed?.code || removed?.label || '')
    setRoleDrafts(current => removed?.id
      ? current.map((role, currentIndex) => currentIndex === index ? { ...role, is_active: false } : role)
      : current.filter((_, currentIndex) => currentIndex !== index)
    )
    setRolePermissions(current => current.filter(role => role.role_key !== removedKey))
    setRoleError(null)
  }

  const updateRolePermission = (roleKey: string, patch: Partial<RolePermissionData>) => {
    setRolePermissions(current => {
      const existing = current.find(role => role.role_key === roleKey) || defaultPermissionForRole(roleKey)
      const next = { ...existing, ...patch, role_key: roleKey }
      const found = current.some(role => role.role_key === roleKey)
      return found
        ? current.map(role => role.role_key === roleKey ? next : role)
        : [...current, next]
    })
  }

  const saveRoles = async () => {
    if (!restaurantId) return activeRoles
    setIsSavingRoles(true)
    setRoleError(null)
    try {
      const saved: JobCodeData[] = []
      for (const draft of roleDrafts) {
        const code = draft.id ? slugRoleCode(draft.code || draft.label) : slugRoleCode(draft.label || draft.code)
        const payload = {
          code,
          label: draft.label.trim() || code,
          permission_tier: draft.permission_tier,
          default_hourly_rate: draft.default_hourly_rate === '' ? 0 : Number(draft.default_hourly_rate),
          is_tipped: draft.is_tipped,
          tipout_role: draft.tipout_role || null,
          sort_order: draft.sort_order,
          is_active: draft.is_active !== false,
        }
        saved.push(await fetchPosApi<JobCodeData>(
          restaurantId,
          draft.id
            ? `/restaurants/${restaurantId}/job-codes/${draft.id}`
            : `/restaurants/${restaurantId}/job-codes`,
          {
            method: draft.id ? 'PATCH' : 'POST',
            body: JSON.stringify(payload),
          },
        ))
      }

      const normalized = saved.map((role, index) => ({
        ...role,
        default_hourly_rate: String(role.default_hourly_rate ?? ''),
        tipout_role: role.tipout_role || '',
        sort_order: Number(role.sort_order ?? index * 10),
      }))
      const active = normalized.filter(role => role.is_active !== false)
      setRoleDrafts(normalized)
      updateData({ job_codes: active })
      return active
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Could not save roles.')
      throw err
    } finally {
      setIsSavingRoles(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const savedRoles = await saveRoles()
      const activeRoleKeys = savedRoles.map(role => slugRoleCode(role.code || role.label))
      const nextPermissions = activeRoleKeys.map(roleKey =>
        rolePermissions.find(role => role.role_key === roleKey) || defaultPermissionForRole(roleKey)
      )
      updateData({ job_codes: savedRoles, role_permissions: nextPermissions })
      await saveManagerControls({ job_codes: savedRoles, role_permissions: nextPermissions })
      nextStep()
    } catch {
      // Hook owns visible error.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      )}
      {roleError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-300">
          {roleError}
        </div>
      )}

      <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="text-sm leading-6 text-[rgb(var(--text-secondary))]">
          Choose the roles this restaurant actually uses. Set each role's permission tier, base hourly wage, and whether it participates in tipped payroll; detailed tip pooling and tipout rules come later.
        </p>
      </div>

      <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-[rgb(var(--text-primary))]">Restaurant roles</h3>
          <p className="mt-1 text-xs leading-5 text-[rgb(var(--text-tertiary))]">
            Each role sets a starting wage, POS authority tier, and whether it participates in tipped payroll.
          </p>
        </div>
        <div className="space-y-3">
          {roleDrafts.map((role, index) => role.is_active === false ? null : (
            <div key={role.id || `${role.code}-${index}`} className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] p-3">
              <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(var(--text-tertiary))]">
                  {role.label.trim() || `Role ${index + 1}`}
                </p>
                <button
                  type="button"
                  onClick={() => removeRoleDraft(index)}
                  className="shrink-0 rounded-md border border-red-400/25 px-2.5 py-1.5 text-xs font-semibold text-red-200 transition hover:border-red-300/60 hover:bg-red-500/10 disabled:opacity-40"
                  disabled={activeRoles.length <= 1 || isSavingRoles}
                >
                  Remove
                </button>
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="min-w-0 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--text-tertiary))]">Role name</span>
                  <input
                    value={role.label}
                    onChange={(event) => updateRoleDraft(index, { label: event.target.value })}
                    className={inputClass}
                    placeholder="Role name"
                  />
                </label>
                <label className="min-w-0 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--text-tertiary))]">POS authority tier</span>
                  <select
                    value={role.permission_tier}
                    onChange={(event) => updateRoleDraft(index, { permission_tier: event.target.value as JobCodeData['permission_tier'] })}
                    className={inputClass}
                  >
                    <option value="owner" className="bg-[#1a1a1a]">Owner</option>
                    <option value="manager" className="bg-[#1a1a1a]">Manager</option>
                    <option value="waiter" className="bg-[#1a1a1a]">Server</option>
                    <option value="normal" className="bg-[#1a1a1a]">Standard</option>
                    <option value="limited" className="bg-[#1a1a1a]">Limited</option>
                  </select>
                </label>
                <label className="min-w-0 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--text-tertiary))]">Base hourly wage</span>
                  <input
                    value={displayRate(role.default_hourly_rate)}
                    onChange={(event) => updateRoleDraft(index, { default_hourly_rate: sanitizeNumber(event.target.value) })}
                    className={inputClass}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </label>
                <TipParticipationControl
                  isTipped={role.is_tipped}
                  onChange={(isTipped) => updateRoleDraft(index, {
                    is_tipped: isTipped,
                    tipout_role: isTipped ? slugRoleCode(role.code || role.label) : '',
                  })}
                />
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-dashed border-[rgba(255,255,255,0.14)] p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(var(--text-tertiary))]">Add another role</p>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <label className="min-w-0 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--text-tertiary))]">Role name</span>
                <input
                  value={newRoleLabel}
                  onChange={(event) => setNewRoleLabel(event.target.value)}
                  className={inputClass}
                  placeholder="New role"
                />
              </label>
              <label className="min-w-0 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--text-tertiary))]">POS authority tier</span>
                <select
                  value="normal"
                  disabled
                  className={`${inputClass} disabled:text-[rgb(var(--text-secondary))] disabled:opacity-80`}
                >
                  <option value="normal" className="bg-[#1a1a1a]">Standard</option>
                </select>
              </label>
              <label className="min-w-0 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--text-tertiary))]">Base hourly wage</span>
                <input
                  value={newRoleRate}
                  onChange={(event) => setNewRoleRate(sanitizeNumber(event.target.value))}
                  className={inputClass}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </label>
              <TipParticipationControl
                isTipped={newRoleIsTipped}
                onChange={setNewRoleIsTipped}
              />
              <button
                type="button"
                onClick={addRoleDraft}
                disabled={!newRoleLabel.trim() || isSavingRoles}
                className="min-h-[40px] rounded-lg border border-[#d4a854] bg-[#d4a854] px-3 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:border-[rgba(255,255,255,0.18)] disabled:bg-[rgba(255,255,255,0.08)] disabled:text-[rgb(var(--text-secondary))] sm:col-span-2"
              >
                Add role
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {visiblePermissions.map((role) => {
          const roleDraft = activeRoles.find(item => slugRoleCode(item.code || item.label) === role.role_key)
          const label = roleDraft?.label || role.role_key.replace('_', ' ')
          return (
          <div key={role.role_key} className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[rgb(var(--text-primary))]">{label}</h3>
                <p className="text-xs text-[rgb(var(--text-tertiary))]">Permissions and approval thresholds</p>
              </div>
              <Toggle
                active={role.require_manager_pin_for_approval}
                label="Approval PIN"
                onClick={() => updateRolePermission(role.role_key, { require_manager_pin_for_approval: !role.require_manager_pin_for_approval })}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {PERMISSIONS.map(permission => (
                <Toggle
                  key={permission.key}
                  active={Boolean(role[permission.key])}
                  label={permission.label}
                  onClick={() => updateRolePermission(role.role_key, { [permission.key]: !role[permission.key] } as Partial<RolePermissionData>)}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[rgb(var(--text-tertiary))]">
              {cashDrawerRoleSummary(role, data.closeout_settings).map(item => (
                <span key={item.key} className="rounded-full border border-[rgba(255,255,255,0.12)] px-2 py-0.5">
                  {item.label}: {item.value}
                </span>
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={role.refund_limit}
                onChange={(event) => updateRolePermission(role.role_key, { refund_limit: sanitizeMoneyInput(event.target.value) })}
                className={inputClass}
                inputMode="decimal"
                placeholder="Refund limit, blank for unlimited"
              />
              <input
                value={role.discount_limit_percent}
                onChange={(event) => updateRolePermission(role.role_key, { discount_limit_percent: sanitizePercentInput(event.target.value) })}
                className={inputClass}
                inputMode="decimal"
                placeholder="Discount % limit, blank for unlimited"
              />
            </div>
          </div>
        )})}
      </div>

      <button
        type="submit"
        disabled={isLoading || isSavingRoles || activeRoles.length === 0}
        className="flex w-full items-center justify-center rounded-lg bg-white px-6 py-4 font-medium text-black transition-colors hover:bg-gray-100 disabled:opacity-50"
      >
        {isLoading || isSavingRoles ? 'Saving...' : 'Continue'}
      </button>
    </form>
  )
}

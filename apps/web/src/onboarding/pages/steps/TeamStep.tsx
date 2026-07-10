import { useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import { API_CONFIG } from '../../../shared/api/config'
import type { JobCodeData, RolePermissionData, UseOnboardingReturn } from '../../hooks/useOnboarding'

interface TeamStepProps {
  onboarding: UseOnboardingReturn
}

interface StaffMember {
  id: string
  name: string
  email?: string | null
  role: string
  job_code_id?: string | null
  hourly_rate?: number | string | null
  pos_passcode: string
  employee_login_id?: string | null
  suggested_weekly_hours?: number | null
}

export function TeamStep({ onboarding }: TeamStepProps) {
  const { restaurantId, data, updateData, completeOnboarding, isLoading, error, completionIssues } = onboarding
  const completionError = completionIssues[0]?.message ?? null
  const cannotComplete = completionIssues.length > 0

  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [employeeLoginId, setEmployeeLoginId] = useState('')
  const [role, setRole] = useState('server')
  const [passcode, setPasscode] = useState('1111')
  const [suggestedWeeklyHours, setSuggestedWeeklyHours] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [roleDrafts, setRoleDrafts] = useState<JobCodeData[]>(data.job_codes)
  const [isSavingRoles, setIsSavingRoles] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const jobCodes = roleDrafts.length > 0 ? roleDrafts : data.job_codes

  const resetForm = () => {
    setName('')
    setEmail('')
    setEmployeeLoginId('')
    setRole('server')
    setPasscode('1111')
    setSuggestedWeeklyHours('')
    setHourlyRate('')
    setFormError(null)
  }

  const defaultEmployeeId = (value: string) =>
    value.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9_]+/g, '') || ''

  const roleCode = (value: string) =>
    value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'role'

  const defaultPermissionForRole = (code: JobCodeData): RolePermissionData => {
    const roleKey = roleCode(code.code || code.label)
    const elevated = code.permission_tier === 'owner' || code.permission_tier === 'manager' || roleKey === 'owner' || roleKey === 'manager'
    const cashier = roleKey === 'cashier'
    const service = roleKey === 'server' || roleKey === 'bartender' || roleKey === 'cashier'
    return {
      role_key: roleKey,
      can_refund: elevated || cashier,
      refund_limit: elevated ? '' : cashier ? '25' : '',
      can_void: elevated,
      can_comp: elevated,
      can_discount: elevated || service,
      discount_limit_percent: elevated ? '' : service ? '20' : '',
      can_open_cash_drawer: elevated || cashier || roleKey === 'bartender',
      can_no_sale: elevated || cashier,
      can_paid_in_out: elevated || cashier,
      can_adjust_tips: elevated,
      can_edit_menu: elevated,
      can_edit_employees: elevated,
      can_edit_schedules: elevated,
      can_view_reports: elevated,
      can_close_drawer: elevated || cashier,
      can_close_day: elevated,
      can_change_payment_settings: roleKey === 'owner',
      can_edit_sent_items_within_window: elevated || service,
      can_edit_sent_items_after_window: elevated,
      can_unsend_sent_items: elevated || service,
      can_edit_paid_check_items: elevated,
      require_manager_pin_for_approval: !elevated,
    }
  }

  const selectedJobCode = jobCodes.find(code => code.code === role)

  const updateRoleDraft = (index: number, patch: Partial<JobCodeData>) => {
    setRoleDrafts(current => current.map((row, currentIndex) => currentIndex === index ? { ...row, ...patch } : row))
  }

  const addRoleDraft = () => {
    const sortOrder = Math.max(0, ...jobCodes.map(code => Number(code.sort_order) || 0)) + 10
    setRoleDrafts(current => [
      ...current,
      {
        code: `role_${current.length + 1}`,
        label: 'New Role',
        permission_tier: 'normal',
        default_hourly_rate: '',
        is_tipped: false,
        tipout_role: '',
        sort_order: sortOrder,
        is_active: true,
      },
    ])
  }

  const saveRoles = async () => {
    if (!restaurantId) return
    setIsSavingRoles(true)
    setFormError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Not authenticated')
      const saved: JobCodeData[] = []
      for (const draft of roleDrafts) {
        const payload = {
          code: roleCode(draft.code || draft.label),
          label: draft.label.trim() || draft.code,
          permission_tier: draft.permission_tier,
          default_hourly_rate: draft.default_hourly_rate === '' ? 0 : Number(draft.default_hourly_rate),
          is_tipped: draft.is_tipped,
          tipout_role: draft.tipout_role || null,
          sort_order: draft.sort_order,
          is_active: draft.is_active !== false,
        }
        const url = draft.id
          ? `${API_CONFIG.baseUrl}/manager/job-codes/${draft.id}`
          : `${API_CONFIG.baseUrl}/restaurants/${restaurantId}/job-codes`
        const response = await fetch(url, {
          method: draft.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error((err as { detail?: string; message?: string }).detail || (err as { detail?: string; message?: string }).message || `Error ${response.status}`)
        }
        saved.push(await response.json() as JobCodeData)
      }
      const normalized = saved.map((item, index) => ({
        ...item,
        default_hourly_rate: String(item.default_hourly_rate ?? ''),
        tipout_role: item.tipout_role || '',
        sort_order: Number(item.sort_order ?? index * 10),
      }))
      setRoleDrafts(normalized)
      updateData({
        job_codes: normalized,
        role_permissions: normalized.map(code => {
          const roleKey = roleCode(code.code || code.label)
          return data.role_permissions.find(row => row.role_key === roleKey) || defaultPermissionForRole(code)
        }),
        tip_payroll_settings: {
          ...data.tip_payroll_settings,
          role_tip_rules: normalized.map(code => {
            const existing = data.tip_payroll_settings.role_tip_rules.find(rule => rule.role_key === code.code)
            return existing || {
              role_key: code.code,
              tip_eligible: code.is_tipped,
              contributes_to_pool: code.is_tipped,
              receives_from_pool: code.is_tipped,
              pool_points: code.is_tipped ? '1' : '',
              pool_contribution_percent: '100',
              tipout_split_basis: 'hours',
              tipouts: [],
              tipout_percent: '',
              tipout_target_role: '',
              notes: '',
            }
          }),
        },
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save roles')
    } finally {
      setIsSavingRoles(false)
    }
  }

  const handleAddEmployee = async () => {
    if (!name.trim()) {
      setFormError('Name is required')
      return
    }
    if (!/^\d{4}$/.test(passcode)) {
      setFormError('POS passcode must be exactly 4 digits')
      return
    }

    setFormError(null)
    setIsAdding(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token || !restaurantId) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(
        `${API_CONFIG.baseUrl}/restaurants/${restaurantId}/waiters`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim() || null,
            role,
            job_code_id: selectedJobCode?.id || null,
            hourly_rate: hourlyRate === '' ? null : Number(hourlyRate),
            pos_passcode: passcode,
            employee_login_id: employeeLoginId.trim() || defaultEmployeeId(name),
            suggested_weekly_hours: suggestedWeeklyHours === '' ? null : Number(suggestedWeeklyHours),
          }),
        }
      )

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error((err as { detail?: string; message?: string }).detail || (err as { detail?: string; message?: string }).message || `Error ${response.status}`)
      }

      const created = await response.json() as {
        id?: string
        name?: string
        email?: string | null
        role?: string
        job_code_id?: string | null
        hourly_rate?: number | string | null
        pos_passcode?: string
        employee_login_id?: string | null
        suggested_weekly_hours?: number | null
      }

      setStaffList(prev => [
        ...prev,
        {
          id: created.id || String(Date.now()),
          name: created.name || name.trim(),
          email: created.email || email.trim() || null,
          role: created.role || role,
          job_code_id: created.job_code_id || selectedJobCode?.id || null,
          hourly_rate: created.hourly_rate ?? (hourlyRate === '' ? null : Number(hourlyRate)),
          pos_passcode: created.pos_passcode || passcode,
          employee_login_id: created.employee_login_id || employeeLoginId.trim() || defaultEmployeeId(name),
          suggested_weekly_hours: created.suggested_weekly_hours ?? (suggestedWeeklyHours === '' ? null : Number(suggestedWeeklyHours)),
        },
      ])

      resetForm()
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add employee')
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemove = (id: string) => {
    setStaffList(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {completionError && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
          {completionError}
        </div>
      )}

      {/* Staff list */}
      <div className="space-y-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Roles & wages</p>
          <p className="mt-1 text-xs text-[rgb(var(--text-tertiary))]">Add roles here, then assign each employee to one below.</p>
        </div>
        {jobCodes.map((code, index) => (
          <div key={code.id || `${code.code}:${index}`} className="grid gap-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3 md:grid-cols-[1fr_110px_110px_auto]">
            <input
              value={code.label}
              onChange={event => {
                const label = event.target.value
                updateRoleDraft(index, { label, code: code.id ? code.code : roleCode(label) })
              }}
              placeholder="Role name"
              className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-[rgb(var(--text-primary))]"
            />
            <input
              value={code.default_hourly_rate}
              onChange={event => updateRoleDraft(index, { default_hourly_rate: event.target.value.replace(/[^\d.]/g, '').slice(0, 8) })}
              inputMode="decimal"
              placeholder="$/hr"
              className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-[rgb(var(--text-primary))]"
            />
            <select
              value={code.permission_tier}
              onChange={event => updateRoleDraft(index, { permission_tier: event.target.value as JobCodeData['permission_tier'] })}
              className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-[rgb(var(--text-primary))]"
            >
              <option value="normal" className="bg-[#1a1a1a]">Normal</option>
              <option value="manager" className="bg-[#1a1a1a]">Manager</option>
              <option value="limited" className="bg-[#1a1a1a]">Limited</option>
              <option value="owner" className="bg-[#1a1a1a]">Owner</option>
            </select>
            <button
              type="button"
              onClick={() => updateRoleDraft(index, { is_tipped: !code.is_tipped })}
              className={[
                'rounded-lg border px-3 py-2 text-sm',
                code.is_tipped
                  ? 'border-[rgba(212,168,84,0.45)] bg-[rgba(212,168,84,0.14)] text-[rgb(var(--gold))]'
                  : 'border-[rgba(255,255,255,0.1)] text-[rgb(var(--text-secondary))]',
              ].join(' ')}
            >
              {code.is_tipped ? 'Tipped' : 'Hourly'}
            </button>
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={addRoleDraft} className="rounded-lg border border-dashed border-[rgba(255,255,255,0.2)] px-4 py-2 text-sm text-[rgb(var(--text-tertiary))]">Add role</button>
          <button type="button" onClick={() => void saveRoles()} disabled={isSavingRoles} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
            {isSavingRoles ? 'Saving roles...' : 'Save roles'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {staffList.length === 0 && !showForm && (
          <div className="py-8 rounded-lg border border-dashed border-[rgba(255,255,255,0.1)] text-center">
            <p className="text-[rgb(var(--text-tertiary))] text-sm">
              No staff added yet. Add employees so they can log into the POS.
            </p>
          </div>
        )}

        {staffList.map(staff => (
          <div
            key={staff.id}
            className="flex items-center justify-between p-4 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]"
          >
            <div>
              <p className="text-[rgb(var(--text-primary))] font-medium text-sm">{staff.name}</p>
              <p className="text-xs text-[rgb(var(--text-tertiary))] mt-0.5 capitalize">
                {staff.role} · ID:{' '}
                <span className="font-mono normal-case">{staff.employee_login_id || 'auto'}</span>
                {' '}· PIN: <span className="font-mono">{staff.pos_passcode}</span>
                {staff.hourly_rate ? <span> · ${staff.hourly_rate}/hr</span> : null}
                {staff.suggested_weekly_hours ? <span> · {staff.suggested_weekly_hours} hrs/week</span> : null}
                {staff.email ? <span className="normal-case"> · {staff.email}</span> : null}
              </p>
            </div>
            <button
              onClick={() => handleRemove(staff.id)}
              className="p-1.5 text-[rgb(var(--text-tertiary))] hover:text-red-400 transition-colors"
              aria-label="Remove employee"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Inline add form */}
      {showForm ? (
        <div className="p-4 rounded-lg border border-[rgba(201,169,98,0.3)] bg-[rgba(201,169,98,0.04)] space-y-4">
          {formError && (
            <p className="text-sm text-red-400">{formError}</p>
          )}

          <div>
            <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value)
                if (!employeeLoginId.trim()) {
                  setEmployeeLoginId(defaultEmployeeId(e.target.value))
                }
              }}
              onKeyDown={e => e.key === 'Enter' && void handleAddEmployee()}
              placeholder="Alice"
              className="w-full px-3 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] text-sm"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
                Email <span className="text-[rgb(var(--text-tertiary))] font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="alice@restaurant.com"
                className="w-full px-3 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
                Employee ID <span className="text-[rgb(var(--text-tertiary))] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={employeeLoginId}
                onChange={e => setEmployeeLoginId(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, ''))}
                placeholder={defaultEmployeeId(name) || 'alice'}
                className="w-full px-3 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
                Role
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] text-sm"
              >
                {jobCodes.map(r => (
                  <option key={r.code} value={r.code} className="bg-[#1a1a1a] capitalize">
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
                POS Passcode{' '}
                <span className="text-[rgb(var(--text-tertiary))] font-normal">(4 digits)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={passcode}
                onChange={e => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1111"
                maxLength={4}
                className="w-full px-3 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
                Suggested hours/week
              </label>
              <input
                type="number"
                min={0}
                max={60}
                step={1}
                value={suggestedWeeklyHours}
                onChange={e => setSuggestedWeeklyHours(e.target.value)}
                placeholder="28"
                className="w-full px-3 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
              Hourly override <span className="text-[rgb(var(--text-tertiary))] font-normal">(optional)</span>
            </label>
            <input
              inputMode="decimal"
              value={hourlyRate}
              onChange={e => setHourlyRate(e.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
              placeholder={selectedJobCode?.default_hourly_rate || 'Role rate'}
              className="w-full px-3 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] text-sm"
            />
          </div>

          <p className="text-xs text-amber-400/70">
            Employees can sign in with email + PIN or employee ID + PIN after selecting the restaurant.
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => void handleAddEmployee()}
              disabled={isAdding}
              className="flex-1 py-2.5 px-4 bg-white text-black hover:bg-gray-100 disabled:opacity-50 font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              {isAdding ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-600" />
                  Adding...
                </>
              ) : (
                'Add Employee'
              )}
            </button>
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="px-4 py-2.5 text-sm text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-primary))] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 px-4 border border-dashed border-[rgba(255,255,255,0.2)] hover:border-[rgba(201,169,98,0.4)] rounded-lg text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--gold))] transition-all text-sm flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Employee
        </button>
      )}

      {/* Complete / Skip */}
      <div className="space-y-3 pt-2">
        <button
          onClick={() => void completeOnboarding()}
          disabled={isLoading || cannotComplete}
          className="w-full py-4 px-6 bg-white text-black hover:bg-gray-100 disabled:opacity-50 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#d4a854]" />
              Finishing setup...
            </>
          ) : (
            <>
              Complete Setup
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </>
          )}
        </button>

        <button
          onClick={() => void completeOnboarding()}
          disabled={isLoading || cannotComplete}
          className="w-full py-2 text-sm text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-primary))] transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import { API_CONFIG } from '../../../shared/api/config'
import type { UseOnboardingReturn } from '../../hooks/useOnboarding'

interface TeamStepProps {
  onboarding: UseOnboardingReturn
}

const ROLES = ['server', 'bartender', 'host'] as const
type StaffRole = typeof ROLES[number]

interface StaffMember {
  id: string
  name: string
  email?: string | null
  role: StaffRole
  pos_passcode: string
  employee_login_id?: string | null
}

export function TeamStep({ onboarding }: TeamStepProps) {
  const { restaurantId, completeOnboarding, isLoading, error, completionIssues } = onboarding
  const completionError = completionIssues[0]?.message ?? null
  const cannotComplete = completionIssues.length > 0

  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [employeeLoginId, setEmployeeLoginId] = useState('')
  const [role, setRole] = useState<StaffRole>('server')
  const [passcode, setPasscode] = useState('1111')
  const [isAdding, setIsAdding] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setEmail('')
    setEmployeeLoginId('')
    setRole('server')
    setPasscode('1111')
    setFormError(null)
  }

  const defaultEmployeeId = (value: string) =>
    value.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9_]+/g, '') || ''

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
            pos_passcode: passcode,
            employee_login_id: employeeLoginId.trim() || defaultEmployeeId(name),
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
        pos_passcode?: string
        employee_login_id?: string | null
      }

      setStaffList(prev => [
        ...prev,
        {
          id: created.id || String(Date.now()),
          name: created.name || name.trim(),
          email: created.email || email.trim() || null,
          role: (created.role as StaffRole) || role,
          pos_passcode: created.pos_passcode || passcode,
          employee_login_id: created.employee_login_id || employeeLoginId.trim() || defaultEmployeeId(name),
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
                Role
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as StaffRole)}
                className="w-full px-3 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] text-sm"
              >
                {ROLES.map(r => (
                  <option key={r} value={r} className="bg-[#1a1a1a] capitalize">
                    {r.charAt(0).toUpperCase() + r.slice(1)}
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

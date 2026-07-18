import type { RolePermissionData, UseOnboardingReturn } from '../../hooks/useOnboarding'

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
const sanitizeNumber = (value: string) => value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 10)

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

export function ManagerControlsStep({ onboarding }: ManagerControlsStepProps) {
  const { data, updateData, saveManagerControls, nextStep, isLoading, error } = onboarding

  const updateRole = (index: number, patch: Partial<RolePermissionData>) => {
    updateData({
      role_permissions: data.role_permissions.map((role, currentIndex) =>
        currentIndex === index ? { ...role, ...patch } : role
      ),
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await saveManagerControls()
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

      <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="text-sm leading-6 text-[rgb(var(--text-secondary))]">
          Set what each POS role can do during service. Employee roles are assigned in staff setup; this controls the manager-level actions each role can use.
        </p>
      </div>

      <div className="space-y-4">
        {data.role_permissions.map((role, index) => (
          <div key={role.role_key} className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold capitalize text-[rgb(var(--text-primary))]">{role.role_key.replace('_', ' ')}</h3>
                <p className="text-xs text-[rgb(var(--text-tertiary))]">Permissions and approval thresholds</p>
              </div>
              <Toggle
                active={role.require_manager_pin_for_approval}
                label="Approval PIN"
                onClick={() => updateRole(index, { require_manager_pin_for_approval: !role.require_manager_pin_for_approval })}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {PERMISSIONS.map(permission => (
                <Toggle
                  key={permission.key}
                  active={Boolean(role[permission.key])}
                  label={permission.label}
                  onClick={() => updateRole(index, { [permission.key]: !role[permission.key] } as Partial<RolePermissionData>)}
                />
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={role.refund_limit}
                onChange={(event) => updateRole(index, { refund_limit: sanitizeNumber(event.target.value) })}
                className={inputClass}
                inputMode="decimal"
                placeholder="Refund limit, blank for unlimited"
              />
              <input
                value={role.discount_limit_percent}
                onChange={(event) => updateRole(index, { discount_limit_percent: sanitizeNumber(event.target.value) })}
                className={inputClass}
                inputMode="decimal"
                placeholder="Discount % limit, blank for unlimited"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center rounded-lg bg-white px-6 py-4 font-medium text-black transition-colors hover:bg-gray-100 disabled:opacity-50"
      >
        {isLoading ? 'Saving...' : 'Continue'}
      </button>
    </form>
  )
}

import { useState } from 'react'
import type { UseOnboardingReturn, TeamInvite } from '../../hooks/useOnboarding'

interface TeamStepProps {
  onboarding: UseOnboardingReturn
}

const ROLES = [
  { value: 'manager', label: 'Manager', description: 'Can manage schedules, staff, and most settings' },
  { value: 'server', label: 'Server', description: 'Can view their shifts and floor plan' },
  { value: 'host', label: 'Host', description: 'Can manage waitlist and reservations' },
  { value: 'kitchen', label: 'Kitchen', description: 'Can view orders and menu availability' },
] as const

export function TeamStep({ onboarding }: TeamStepProps) {
  const { data, updateData, completeOnboarding, isLoading, error } = onboarding
  const [selectedMethod, setSelectedMethod] = useState<'invite' | 'sevenshifts' | 'skip'>(
    data.team_setup_method === 'skip' ? 'skip' : data.team_setup_method === 'sevenshifts' ? 'sevenshifts' : 'invite'
  )
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamInvite['role']>('server')

  const handleAddInvite = () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) return

    const newInvite: TeamInvite = {
      email: inviteEmail.trim(),
      role: inviteRole,
    }

    updateData({
      invites: [...data.invites, newInvite],
      team_setup_method: 'invite',
    })

    setInviteEmail('')
  }

  const handleRemoveInvite = (email: string) => {
    updateData({
      invites: data.invites.filter(i => i.email !== email),
    })
  }

  const handleConnect7shifts = () => {
    alert('7shifts OAuth integration would open here.\n\nThis will be implemented with the backend.')
    setSelectedMethod('sevenshifts')
    updateData({ team_setup_method: 'sevenshifts' })
  }

  const handleComplete = async () => {
    updateData({ team_setup_method: selectedMethod as any })
    await completeOnboarding()
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {/* Method selection */}
      <div className="grid grid-cols-1 gap-4">
        {/* 7shifts option */}
        <button
          onClick={() => setSelectedMethod('sevenshifts')}
          className={`p-4 rounded-lg border text-left transition-all ${
            selectedMethod === 'sevenshifts'
              ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.08)]'
              : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)]'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              selectedMethod === 'sevenshifts' ? 'bg-[rgba(201,169,98,0.15)]' : 'bg-[rgba(255,255,255,0.05)]'
            }`}>
              <span className="text-2xl">📅</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[rgb(var(--text-primary))] font-medium text-sm">Connect 7shifts</h3>
                <span className="px-2 py-0.5 bg-[rgba(201,169,98,0.15)] text-[rgb(var(--gold))] text-xs font-medium rounded-full">
                  Recommended
                </span>
              </div>
              <p className="text-sm text-[rgb(var(--text-tertiary))] mt-1">
                Import your employees, schedules, and availability automatically
              </p>
            </div>
          </div>

          {selectedMethod === 'sevenshifts' && (
            <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)]">
              <button
                onClick={handleConnect7shifts}
                className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Connect to 7shifts
              </button>
              <p className="text-xs text-[rgb(var(--text-tertiary))] mt-2 text-center">
                You'll be redirected to 7shifts to authorize the connection
              </p>
            </div>
          )}
        </button>

        {/* Invite option */}
        <button
          onClick={() => setSelectedMethod('invite')}
          className={`p-4 rounded-lg border text-left transition-all ${
            selectedMethod === 'invite'
              ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.08)]'
              : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)]'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              selectedMethod === 'invite' ? 'bg-[rgba(201,169,98,0.15)]' : 'bg-[rgba(255,255,255,0.05)]'
            }`}>
              <svg className="w-6 h-6 text-[rgb(var(--text-tertiary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-[rgb(var(--text-primary))] font-medium text-sm">Invite by Email</h3>
              <p className="text-sm text-[rgb(var(--text-tertiary))] mt-1">
                Send email invitations to your team members
              </p>
            </div>
          </div>

          {selectedMethod === 'invite' && (
            <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)] space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInvite())}
                  placeholder="team@example.com"
                  className="flex-1 px-3 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as TeamInvite['role'])}
                  className="px-3 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
                >
                  {ROLES.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddInvite}
                  className="px-4 py-2 bg-white text-black hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm"
                >
                  Add
                </button>
              </div>

              {data.invites.length > 0 && (
                <div className="space-y-2">
                  {data.invites.map((invite) => (
                    <div
                      key={invite.email}
                      className="flex items-center justify-between p-2 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center">
                          <span className="text-xs font-medium text-[rgb(var(--text-secondary))]">
                            {invite.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-[rgb(var(--text-primary))]">{invite.email}</p>
                          <p className="text-xs text-[rgb(var(--text-tertiary))] capitalize">{invite.role}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveInvite(invite.email)}
                        className="p-1 text-[rgb(var(--text-tertiary))] hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </button>

        {/* Skip option */}
        <button
          onClick={() => setSelectedMethod('skip')}
          className={`p-4 rounded-lg border text-left transition-all ${
            selectedMethod === 'skip'
              ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.08)]'
              : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)]'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              selectedMethod === 'skip' ? 'bg-[rgba(201,169,98,0.15)]' : 'bg-[rgba(255,255,255,0.05)]'
            }`}>
              <svg className="w-6 h-6 text-[rgb(var(--text-tertiary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-[rgb(var(--text-primary))] font-medium text-sm">I'll manage solo for now</h3>
              <p className="text-sm text-[rgb(var(--text-tertiary))] mt-1">
                You can always invite team members later from settings
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Complete button */}
      <button
        onClick={handleComplete}
        disabled={isLoading}
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
    </div>
  )
}

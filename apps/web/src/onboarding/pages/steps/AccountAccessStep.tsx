import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../auth'
import {
  backOfficeApi,
  type BackOfficeInvitation,
  type BackOfficeMember,
  type BackOfficeViewTemplate,
  type ConnectedReseller,
} from '../../../shared/api/backOfficeApi'
import type { BackOfficeViewPolicy } from '../../../shared/backOfficeView'
import { useBackOfficeAccess } from '../../../shared/hooks/useBackOfficeAccess'
import { normalizeJobCodes } from '@shire/settings'
import {
  canManageJobCode,
  canManageStaffMember,
  manageableTeamAccountTypes,
  normalizeRoleCode,
} from '../../../dashboard/utils/staffRoles'
import type { JobCodeData, UseOnboardingReturn } from '../../hooks/useOnboarding'

const AddTeamMemberModal = lazy(() => import('../../../dashboard/pages/TeamPage')
  .then(module => ({ default: module.AddTeamMemberModal })))
const MemberPermissionsModal = lazy(() => import('../../../dashboard/pages/TeamPage')
  .then(module => ({ default: module.MemberPermissionsModal })))

interface AccountAccessStepProps {
  onboarding: UseOnboardingReturn
}

interface StaffRow {
  id: string
  name?: string | null
  email?: string | null
  pos_role?: string | null
  is_active?: boolean
}

type InvitationWithLink = BackOfficeInvitation & { accept_url?: string | null }

const accountLabel = (role?: string | null) => {
  if (role === 'owner') return 'Owner'
  if (role === 'manager') return 'Manager'
  return 'Employee'
}

export function AccountAccessStep({ onboarding }: AccountAccessStepProps) {
  const { restaurantId, completeOnboarding, completionIssues, isLoading, error: onboardingError } = onboarding
  const auth = useAuth()
  const access = useBackOfficeAccess(auth, restaurantId || '')
  const [waiters, setWaiters] = useState<StaffRow[]>([])
  const [jobCodes, setJobCodes] = useState<JobCodeData[]>([])
  const [rolePermissions, setRolePermissions] = useState<Record<string, unknown>[]>([])
  const [members, setMembers] = useState<BackOfficeMember[]>([])
  const [resellers, setResellers] = useState<ConnectedReseller[]>([])
  const [invitations, setInvitations] = useState<InvitationWithLink[]>([])
  const [templates, setTemplates] = useState<BackOfficeViewTemplate[]>([])
  const [addMember, setAddMember] = useState<{ waiterId?: string; role?: string } | null>(null)
  const [editingMember, setEditingMember] = useState<BackOfficeMember | null>(null)
  const [loadingWorkspace, setLoadingWorkspace] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!restaurantId) return
    setLoadingWorkspace(true)
    setLoadError(null)
    try {
      const [workspace, savedTemplates] = await Promise.all([
        backOfficeApi.teamWorkspace(restaurantId),
        backOfficeApi.listViewTemplates(restaurantId).catch(() => []),
      ])
      setWaiters((Array.isArray(workspace.waiters) ? workspace.waiters : []) as unknown as StaffRow[])
      setJobCodes(normalizeJobCodes(workspace.job_codes))
      setRolePermissions(Array.isArray(workspace.role_permissions) ? workspace.role_permissions : [])
      setMembers(Array.isArray(workspace.members) ? workspace.members : [])
      setResellers(Array.isArray(workspace.resellers) ? workspace.resellers : [])
      setInvitations((Array.isArray(workspace.invitations) ? workspace.invitations : []) as InvitationWithLink[])
      setTemplates(Array.isArray(savedTemplates) ? savedTemplates : [])
    } catch (workspaceError) {
      setLoadError(workspaceError instanceof Error ? workspaceError.message : 'Could not load account access')
    } finally {
      setLoadingWorkspace(false)
    }
  }, [restaurantId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const roleDefaultsForRole = useCallback((role: string) => {
    const canonical = normalizeRoleCode(role)
    const row = rolePermissions.find(item => normalizeRoleCode(item.role_key) === canonical)
      || (canonical === 'server'
        ? rolePermissions.find(item => ['server', 'waiter'].includes(String(item.role_key || '').trim().toLowerCase()))
        : null)
    const defaults = row?.back_office_permissions
    return defaults && typeof defaults === 'object' ? defaults : null
  }, [rolePermissions])

  const accountTypeOptions = useMemo(() => manageableTeamAccountTypes(access.authorityLevel, {
    isDirectReseller: access.isDirectReseller,
    canManageMembers: access.can('team.edit_employees'),
  }), [access])

  const createTemplate = async (name: string, policy: BackOfficeViewPolicy) => {
    if (!restaurantId) return
    const created = await backOfficeApi.createViewTemplate(restaurantId, {
      name,
      policy,
      reusable: true,
    })
    setTemplates(current => [...current.filter(item => item.id !== created.id), created])
  }

  const resend = async (invitation: InvitationWithLink) => {
    setActionId(invitation.id)
    setMessage(null)
    try {
      const result = await backOfficeApi.resendInvite(invitation.id)
      setInvitations(current => current.map(item => item.id === invitation.id
        ? { ...item, ...result.invitation, accept_url: result.accept_url }
        : item))
      setMessage(result.email_sent ? `Invite resent to ${invitation.email}.` : 'Email delivery failed. Copy the invite link instead.')
    } catch (resendError) {
      setLoadError(resendError instanceof Error ? resendError.message : 'Could not resend invitation')
    } finally {
      setActionId(null)
    }
  }

  const revoke = async (invitation: InvitationWithLink) => {
    setActionId(invitation.id)
    setMessage(null)
    try {
      await backOfficeApi.revokeAccessInvite(invitation.id)
      setInvitations(current => current.filter(item => item.id !== invitation.id))
      setMessage(`Revoked the invite for ${invitation.email}.`)
    } catch (revokeError) {
      setLoadError(revokeError instanceof Error ? revokeError.message : 'Could not revoke invitation')
    } finally {
      setActionId(null)
    }
  }

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setMessage('Invite link copied.')
    } catch {
      window.prompt('Copy this invite link:', link)
    }
  }

  const activeWaiters = waiters.filter(waiter => waiter.is_active !== false)
  const completionError = completionIssues[0]?.message || null
  const cannotComplete = completionIssues.length > 0
  const canManage = !access.loading && access.can('team.edit_employees')
  const canConfigureMemberViews = canManage && (!access.isDirectReseller || access.can('settings.edit'))
  const manageableWaiters = activeWaiters.filter(waiter => (
    canManageStaffMember(access.authorityLevel, waiter, jobCodes)
  ))
  const manageableJobCodes = jobCodes.filter(jobCode => (
    canManageJobCode(access.authorityLevel, jobCode)
  ))
  const waitersAvailableForNewAccess = manageableWaiters.filter(waiter => (
    !members.some(member => member.waiter_id === waiter.id)
    && !invitations.some(invitation => invitation.kind === 'restaurant_member' && invitation.waiter_id === waiter.id)
  ))

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-[rgb(var(--text-primary))]">POS access and account access are separate</h3>
        <div className="mt-3 grid gap-3 text-xs leading-5 text-[rgb(var(--text-tertiary))] sm:grid-cols-3">
          <p><strong className="block text-[rgb(var(--text-secondary))]">POS profile</strong>PIN, positions, pay, tips, and in-store authority.</p>
          <p><strong className="block text-[rgb(var(--text-secondary))]">Permissions</strong>What they are actually allowed to view or change.</p>
          <p><strong className="block text-[rgb(var(--text-secondary))]">Back Office view</strong>How much detail the dashboard presents; it never grants authority.</p>
        </div>
      </section>

      {(loadError || onboardingError) && (
        <p className="rounded-lg border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-300">{loadError || onboardingError}</p>
      )}
      {message && (
        <p className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>
      )}

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[rgb(var(--text-primary))]">Staff accounts</h3>
            <p className="mt-1 text-xs leading-5 text-[rgb(var(--text-tertiary))]">Link a saved POS employee to an email account, then choose their permissions and dashboard view.</p>
          </div>
          <button
            type="button"
            onClick={() => setAddMember({})}
            disabled={!canManage || loadingWorkspace}
            className="rounded-lg border border-[rgba(212,168,84,0.45)] px-3 py-2 text-xs font-semibold text-[rgb(var(--gold))] disabled:opacity-40"
          >
            Add owner, manager, employee, or reseller
          </button>
        </div>

        {loadingWorkspace ? (
          <p className="py-4 text-center text-sm text-[rgb(var(--text-tertiary))]">Loading saved access…</p>
        ) : activeWaiters.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-[rgb(var(--text-tertiary))]">No POS employees were added. You can still invite an account-only owner or manager.</p>
        ) : activeWaiters.map(waiter => {
          const member = members.find(item => item.waiter_id === waiter.id)
          const invitation = invitations.find(item => item.kind === 'restaurant_member' && item.waiter_id === waiter.id)
          return (
            <div key={waiter.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[rgb(var(--text-primary))]">{waiter.name || 'Unnamed employee'}</span>
                <span className="block text-xs text-[rgb(var(--text-tertiary))]">{waiter.email || 'No account email yet'} · {waiter.pos_role || 'normal'} POS</span>
              </span>
              {member ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">{accountLabel(member.role)} connected</span>
                  {canConfigureMemberViews && (
                    <button type="button" onClick={() => setEditingMember(member)} className="text-xs font-semibold text-[rgb(var(--gold))]">Review access &amp; view</button>
                  )}
                </span>
              ) : invitation ? (
                <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200">Invite pending</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddMember({ waiterId: waiter.id })}
                  disabled={!canManage}
                  className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
                >
                  Add account access
                </button>
              )}
            </div>
          )
        })}
      </section>

      {(members.some(member => !member.waiter_id) || resellers.length > 0) && (
        <section className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="text-sm font-semibold text-[rgb(var(--text-primary))]">Other connected accounts</h3>
          {members.filter(member => !member.waiter_id).map(member => (
            <div key={member.id} className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-sm text-[rgb(var(--text-secondary))]">{member.display_name || member.email} · {accountLabel(member.role)}</p>
              {canConfigureMemberViews && (
                <button type="button" onClick={() => setEditingMember(member)} className="text-xs font-semibold text-[rgb(var(--gold))]">Review access &amp; view</button>
              )}
            </div>
          ))}
          {resellers.map(reseller => (
            <p key={reseller.id} className="text-sm text-[rgb(var(--text-secondary))]">{reseller.organization_name || [reseller.first_name, reseller.last_name].filter(Boolean).join(' ') || 'Reseller'} · Reseller</p>
          ))}
        </section>
      )}

      {invitations.length > 0 && (
        <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="text-sm font-semibold text-[rgb(var(--text-primary))]">Pending invitations</h3>
          {invitations.map(invitation => (
            <div key={invitation.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 p-3">
              <span className="min-w-0 flex-1 text-sm text-[rgb(var(--text-secondary))]">{invitation.email} · {invitation.kind === 'reseller_connection' ? 'Reseller' : accountLabel(invitation.role)}</span>
              {invitation.accept_url && (
                <button type="button" onClick={() => void copyLink(invitation.accept_url!)} className="text-xs font-semibold text-[rgb(var(--gold))]">Copy link</button>
              )}
              <button type="button" disabled={!canManage || actionId === invitation.id} onClick={() => void resend(invitation)} className="text-xs font-semibold text-[rgb(var(--text-tertiary))] disabled:opacity-40">Resend</button>
              <button type="button" disabled={!canManage || actionId === invitation.id} onClick={() => void revoke(invitation)} className="text-xs font-semibold text-red-300 disabled:opacity-40">Revoke</button>
            </div>
          ))}
        </section>
      )}

      {completionError && (
        <p className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-200">{completionError}</p>
      )}

      <div className="space-y-3 pt-2">
        <button
          data-onboarding-save
          type="button"
          onClick={() => void completeOnboarding()}
          disabled={isLoading || cannotComplete}
          className="w-full rounded-lg bg-white px-6 py-4 font-medium text-black disabled:opacity-50"
        >
          {isLoading ? 'Finishing setup…' : 'Complete Setup'}
        </button>
        <button
          data-onboarding-save
          type="button"
          onClick={() => void completeOnboarding()}
          disabled={isLoading || cannotComplete}
          className="w-full py-2 text-sm text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-primary))] disabled:opacity-50"
        >
          Finish without inviting accounts
        </button>
      </div>

      {addMember && restaurantId && (
        <Suspense fallback={<p className="text-sm text-[rgb(var(--text-tertiary))]">Opening account setup…</p>}>
          <AddTeamMemberModal
            restaurantId={restaurantId}
            waiters={addMember.waiterId
              ? manageableWaiters.filter(waiter => waiter.id === addMember.waiterId)
              : waitersAvailableForNewAccess}
            jobCodes={manageableJobCodes}
            roleDefaultsForRole={roleDefaultsForRole}
            grantCap={access.isOwner ? null : access.permissions}
            accountTypeOptions={accountTypeOptions}
            cloneResellerAccess={Boolean(access.isDirectReseller && !access.isOwner)}
            templates={templates}
            onCreateTemplate={access.can('settings.edit') ? createTemplate : undefined}
            initialWaiterId={addMember.waiterId}
            initialRole={addMember.role}
            onClose={() => setAddMember(null)}
            onAdded={() => { void refresh() }}
          />
        </Suspense>
      )}

      {editingMember && restaurantId && (
        <Suspense fallback={<p className="text-sm text-[rgb(var(--text-tertiary))]">Opening access settings…</p>}>
          <MemberPermissionsModal
            restaurantId={restaurantId}
            member={editingMember}
            waiters={manageableWaiters.filter(waiter => (
              waiter.id === editingMember.waiter_id
              || !members.some(member => member.waiter_id === waiter.id)
            ))}
            roleDefaultsForRole={roleDefaultsForRole}
            accountTypeOptions={accountTypeOptions}
            grantCap={access.isOwner ? null : access.permissions}
            templates={templates}
            onCreateTemplate={access.can('settings.edit') ? createTemplate : undefined}
            onClose={() => setEditingMember(null)}
            onSaved={(updated: BackOfficeMember) => {
              setMembers(current => current.map(member => member.id === updated.id ? { ...member, ...updated } : member))
            }}
          />
        </Suspense>
      )}
    </div>
  )
}

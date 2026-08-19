import { fetchWithSupabaseAuth } from '../query/fetchWithSupabaseAuth'
import type { PermissionMap } from '../permissions'

// Back-office access management (ML backend): who may open the dashboard for a
// restaurant and what they can do there. See src/shared/permissions.ts for the
// permission model and key registry.

export interface BackOfficeAccess {
  is_owner: boolean
  is_admin?: boolean
  is_reseller?: boolean
  is_direct_reseller?: boolean
  authority_level: 'staff' | 'manager' | 'owner' | 'platform_admin'
  permissions: PermissionMap
  member_id: string | null
  waiter_id: string | null
  status: string | null
}

export interface BackOfficeMember {
  id: string
  user_id: string
  email: string
  display_name: string | null
  waiter_id: string | null
  role: 'server' | 'manager' | 'owner'
  status: 'active' | 'suspended'
  permission_overrides: PermissionMap
  created_at: string
}

export interface ConnectedReseller {
  id: string
  reseller_id: string
  restaurant_id: string
  status: 'active'
  permissions: Record<string, boolean>
  organization_name: string | null
  first_name: string | null
  last_name: string | null
}

export interface BackOfficeInvitation {
  id: string
  email: string
  name: string | null
  waiter_id: string | null
  permissions: PermissionMap
  status: string
  created_at: string
  expires_at: string
  role?: 'server' | 'manager' | 'owner'
  kind?: string
}

export interface AccessInvitationPreview {
  id: string
  kind: 'restaurant_member' | 'reseller_connection' | 'reseller_employee' | 'platform_account'
  email: string
  name: string | null
  role: string | null
  account_type: string | null
  status: string
  expires_at: string
  restaurant_name: string | null
  reseller_name: string | null
}

export interface InvitationCreateResult {
  invitation: BackOfficeInvitation
  email_sent: boolean
  accept_url: string
}

export interface TeamWorkspaceResponse {
  waiters: Record<string, unknown>[]
  job_codes: Record<string, unknown>[]
  role_permissions: Record<string, unknown>[]
  cash_drawer_policy: Record<string, unknown>
  members: BackOfficeMember[]
  resellers: ConnectedReseller[]
  invitations: BackOfficeInvitation[]
}

export interface TeamMemberCreateResult {
  waiter: Record<string, unknown> | null
  invitation_result: InvitationCreateResult | null
}

export type ManagerInboxSource = 'operational' | 'employee_request' | 'shift_trade'

export interface ManagerInboxItem {
  id: string
  source: ManagerInboxSource
  type: string
  status: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  employee_id: string | null
  employee_name: string | null
  occurred_at: string
  expected_at: string | null
  details: Record<string, unknown>
  available_actions: string[]
}

export interface ManagerInboxResponse {
  items: ManagerInboxItem[]
  open_count: number
}

export const backOfficeApi = {
  updatePlatformAccountType: (
    profileId: string,
    accountType: 'owner' | 'reseller' | 'admin',
  ): Promise<{ id: string; account_type: string; is_superuser: boolean }> =>
    fetchWithSupabaseAuth(`/platform/users/${profileId}/account-type`, {
      method: 'PATCH',
      body: JSON.stringify({ account_type: accountType }),
    }),

  managerInbox: (restaurantId: string, status: 'open' | 'all' = 'open'): Promise<ManagerInboxResponse> =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/manager-action-inbox?status=${status}`),

  actOnManagerInboxItem: (
    restaurantId: string,
    item: Pick<ManagerInboxItem, 'id' | 'source'>,
    input: { action: string; custom_clock_out_at?: string; note?: string },
  ): Promise<unknown> =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/manager-action-inbox/${item.source}/${item.id}/actions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  myAccess: (restaurantId: string): Promise<BackOfficeAccess> =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/back-office/my-access`),

  listMembers: (restaurantId: string): Promise<{ members: BackOfficeMember[]; resellers: ConnectedReseller[]; invitations: BackOfficeInvitation[] }> =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/back-office/members`),

  teamWorkspace: (restaurantId: string): Promise<TeamWorkspaceResponse> =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/team-workspace`),

  invite: (
    restaurantId: string,
    input: { email: string; name?: string; waiter_id?: string | null; role: 'server' | 'manager' | 'owner'; permissions: PermissionMap },
  ): Promise<{ invitation: BackOfficeInvitation; email_sent: boolean; accept_url: string }> =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/back-office/invites`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  createTeamMember: (
    restaurantId: string,
    input: {
      account_type: 'employee' | 'manager' | 'owner'
      email?: string | null
      name?: string | null
      waiter_id?: string | null
      pos_profile?: {
        name: string
        pin?: string | null
        job_assignments: Record<string, unknown>[]
      } | null
      permissions: PermissionMap
    },
  ): Promise<TeamMemberCreateResult> =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/team-members`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  previewInvite: (token: string): Promise<AccessInvitationPreview> =>
    fetchWithSupabaseAuth(`/access-invitations/preview?token=${encodeURIComponent(token)}`, { auth: false }),

  acceptInvite: (token: string): Promise<Record<string, unknown>> =>
    fetchWithSupabaseAuth('/access-invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  resendInvite: (invitationId: string): Promise<{ invitation: BackOfficeInvitation; email_sent: boolean; accept_url: string }> =>
    fetchWithSupabaseAuth(`/access-invitations/${invitationId}/resend`, { method: 'POST' }),

  revokeAccessInvite: (invitationId: string): Promise<{ id: string; status: string }> =>
    fetchWithSupabaseAuth(`/access-invitations/${invitationId}`, { method: 'DELETE' }),

  invitePlatformAccount: (
    input: { email: string; name?: string; account_type: 'owner' | 'reseller' | 'admin' },
  ): Promise<InvitationCreateResult> =>
    fetchWithSupabaseAuth('/platform/invites', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listPlatformInvites: (): Promise<BackOfficeInvitation[]> =>
    fetchWithSupabaseAuth('/platform/invites'),

  sendStoreInvite: (inviteId: string): Promise<{ email_sent: boolean }> =>
    fetchWithSupabaseAuth('/store-invites/send', {
      method: 'POST',
      body: JSON.stringify({ invite_id: inviteId }),
    }),

  updateMember: (
    restaurantId: string,
    memberId: string,
    patch: Partial<Pick<BackOfficeMember, 'permission_overrides' | 'status' | 'waiter_id' | 'display_name'>>,
  ): Promise<BackOfficeMember> =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/back-office/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  removeMember: (restaurantId: string, memberId: string): Promise<null> =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/back-office/members/${memberId}`, {
      method: 'DELETE',
    }),

  revokeInvite: (restaurantId: string, invitationId: string): Promise<null> =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/back-office/invites/${invitationId}`, {
      method: 'DELETE',
    }),
}

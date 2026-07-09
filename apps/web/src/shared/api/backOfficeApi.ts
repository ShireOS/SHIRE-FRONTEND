import { fetchWithSupabaseAuth } from '../query/fetchWithSupabaseAuth'
import type { PermissionMap } from '../permissions'

// Back-office access management (ML backend): who may open the dashboard for a
// restaurant and what they can do there. See src/shared/permissions.ts for the
// permission model and key registry.

export interface BackOfficeAccess {
  is_owner: boolean
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
  status: 'active' | 'suspended'
  permission_overrides: PermissionMap
  created_at: string
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
}

export const backOfficeApi = {
  myAccess: (restaurantId: string): Promise<BackOfficeAccess> =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/back-office/my-access`),

  listMembers: (restaurantId: string): Promise<{ members: BackOfficeMember[]; invitations: BackOfficeInvitation[] }> =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/back-office/members`),

  invite: (
    restaurantId: string,
    input: { email: string; name?: string; waiter_id?: string | null; permissions: PermissionMap },
  ): Promise<{ invitation: BackOfficeInvitation; email_sent: boolean; accept_url: string }> =>
    fetchWithSupabaseAuth(`/restaurants/${restaurantId}/back-office/invites`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  acceptInvite: (token: string): Promise<{ member: BackOfficeMember; restaurant: { id: string; name: string } }> =>
    fetchWithSupabaseAuth('/back-office/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
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

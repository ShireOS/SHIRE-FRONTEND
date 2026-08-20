import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { backOfficeApi, type BackOfficeAccess } from '../api/backOfficeApi'
import { allPermissions, can as canCheck, type PermissionMap } from '../permissions'
import { defaultViewPolicy, viewMode, viewVisible } from '../backOfficeView'
import { queryKeys } from '../query/queryKeys'
import { STALE_TIMES } from '../query/queryClient'

interface AuthLike {
  user?: { id?: string } | null
  accountType?: string | null
  restaurant?: { restaurants?: { id: string; owner_id?: string | null }[] } | null
}

// Effective back-office access for the signed-in user at one restaurant.
// Permission bypasses can be derived locally, but everyone still fetches their
// restaurant-specific presentation policy.
export function useBackOfficeAccess(auth: AuthLike, restaurantId: string | null | undefined) {
  const ownsRestaurant = Boolean(
    restaurantId &&
    auth?.user?.id &&
    (auth.restaurant?.restaurants || []).some(
      (item) => item.id === restaurantId && item.owner_id === auth.user?.id
    )
  )
  const bypass = ownsRestaurant || auth?.accountType === 'admin'

  const query = useQuery<BackOfficeAccess>({
    queryKey: restaurantId ? queryKeys.backOfficeAccess(restaurantId) : ['back-office-access', 'none'],
    queryFn: () => backOfficeApi.myAccess(restaurantId as string),
    enabled: Boolean(restaurantId && auth?.user?.id),
    staleTime: STALE_TIMES.setup,
    retry: 1,
  })

  return useMemo(() => {
    const permissions: PermissionMap = bypass
      ? allPermissions(true)
      : query.data?.permissions || allPermissions(false)
    const isOwner = bypass || Boolean(query.data?.is_owner)
    const authorityLevel = ownsRestaurant
      ? 'owner'
      : auth?.accountType === 'admin'
        ? 'platform_admin'
        : query.data?.authority_level || 'staff'
    const viewAssignment = query.data?.view_assignment
    const viewPolicy = viewAssignment?.policy || defaultViewPolicy('advanced')
    return {
      isOwner,
      // Server guards remain authoritative while this restaurant-specific
      // access result is loading.
      loading: query.isLoading,
      permissions,
      can: (key: string) => isOwner || canCheck(permissions, key),
      memberId: query.data?.member_id ?? null,
      isDirectReseller: Boolean(
        query.data?.is_direct_reseller
        || (auth?.accountType === 'reseller' && canCheck(permissions, 'team.edit_employees'))
      ),
      authorityLevel,
      viewAssignment,
      viewPolicy,
      viewMode: (capabilityId: string) => viewMode(viewPolicy, capabilityId),
      viewVisible: (capabilityId: string) => viewVisible(viewPolicy, capabilityId),
    }
  }, [auth?.accountType, bypass, ownsRestaurant, query.data, query.isLoading])
}

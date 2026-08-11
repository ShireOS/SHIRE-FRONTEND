import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { backOfficeApi, type BackOfficeAccess } from '../api/backOfficeApi'
import { allPermissions, can as canCheck, type PermissionMap } from '../permissions'
import { queryKeys } from '../query/queryKeys'
import { STALE_TIMES } from '../query/queryClient'

interface AuthLike {
  user?: { id?: string } | null
  accountType?: string | null
  restaurant?: { restaurants?: { id: string; owner_id?: string | null }[] } | null
}

// Effective back-office access for the signed-in user at one restaurant.
// Owners / admins / resellers never hit the network (they are not members —
// resellers are separately capped by allowedStoreTabs). Members fetch
// my-access once and cache it.
export function useBackOfficeAccess(auth: AuthLike, restaurantId: string | null | undefined) {
  const ownsRestaurant = Boolean(
    restaurantId &&
    auth?.user?.id &&
    (auth.restaurant?.restaurants || []).some(
      (item) => item.id === restaurantId && item.owner_id === auth.user?.id
    )
  )
  const bypass = ownsRestaurant || auth?.accountType === 'admin' || auth?.accountType === 'reseller'

  const query = useQuery<BackOfficeAccess>({
    queryKey: restaurantId ? queryKeys.backOfficeAccess(restaurantId) : ['back-office-access', 'none'],
    queryFn: () => backOfficeApi.myAccess(restaurantId as string),
    enabled: Boolean(restaurantId) && !bypass,
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
        : auth?.accountType === 'reseller'
          ? 'manager'
          : query.data?.authority_level || 'staff'
    return {
      isOwner,
      // While the member's access is still loading, err open on visibility so
      // the shell doesn't flash-hide nav (server guards are the enforcement).
      loading: !bypass && query.isLoading,
      permissions,
      can: (key: string) => isOwner || canCheck(permissions, key),
      memberId: query.data?.member_id ?? null,
      authorityLevel,
    }
  }, [auth?.accountType, bypass, ownsRestaurant, query.data, query.isLoading])
}

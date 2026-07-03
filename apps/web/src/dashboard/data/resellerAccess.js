import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../../auth'

// Analytics (profit breakdowns by period), rates/payout data, and devices
// (resellers do the IT for their stores) are mandatory for resellers; owners
// toggle the remaining operational surfaces per store.
export const RESELLER_TOGGLEABLE_TABS = ['setup', 'menu', 'team', 'scheduling', 'messaging', 'payments']
export const DEFAULT_RESELLER_PERMISSIONS = {
  setup: true,
  menu: true,
  team: false,
  scheduling: false,
  messaging: false,
  payments: false,
}

const normalizePermissions = (permissions) => ({
  ...DEFAULT_RESELLER_PERMISSIONS,
  ...(permissions && typeof permissions === 'object' ? permissions : {}),
})

export async function fetchResellerAssignments(restaurantId) {
  const { data, error } = await supabase
    .from('reseller_restaurants')
    .select('*, reseller:profiles(id, first_name, last_name)')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'active')
  if (error) throw error
  return data || []
}

export async function updateResellerPermissions(assignmentId, permissions) {
  const { error } = await supabase
    .from('reseller_restaurants')
    .update({ permissions })
    .eq('id', assignmentId)
  if (error) throw error
}

/**
 * Which store tabs the current viewer may see for a restaurant.
 * Owners, members, and admins see everything; resellers see the mandatory
 * analytics tab plus whatever the owner enabled for them.
 */
export function useAllowedStoreTabs(restaurant) {
  const auth = useAuth()
  const [allowed, setAllowed] = useState(null) // null = everything

  const isReseller = auth.accountType === 'reseller'
  const isOwned = restaurant?.owner_id === auth.user?.id
  const restaurantId = restaurant?.id

  useEffect(() => {
    if (!isReseller || isOwned || !restaurantId || !auth.user?.id) {
      setAllowed(null)
      return
    }
    let cancelled = false
    supabase
      .from('reseller_restaurants')
      .select('permissions')
      .eq('restaurant_id', restaurantId)
      .eq('reseller_id', auth.user.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // Fail closed: mandatory analytics + devices only.
          setAllowed(['analytics', 'devices'])
          return
        }
        const permissions = normalizePermissions(data?.permissions)
        setAllowed([
          'analytics',
          'devices',
          ...RESELLER_TOGGLEABLE_TABS.filter((tab) => permissions[tab]),
        ])
      })
    return () => {
      cancelled = true
    }
  }, [isReseller, isOwned, restaurantId, auth.user?.id])

  return allowed
}

import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../../auth'
import {
  allowedTabsForResellerPermissions,
  normalizeResellerPermissions,
} from './resellerTabs'

export {
  DEFAULT_RESELLER_PERMISSIONS,
  RESELLER_TOGGLEABLE_TABS,
} from './resellerTabs'

// Analytics and rates/payout data remain mandatory. Device and peripheral
// management is explicitly grantable per store because it can operate live
// terminals, printers, and drawers.
const allowedTabsCache = new Map()

export async function fetchDeviceAccessibleRestaurantIds({ accountType, userId, restaurantIds, ownedRestaurantIds = [] }) {
  const ids = [...new Set((restaurantIds || []).filter(Boolean))]
  if (!['reseller', 'reseller_employee'].includes(accountType) || ids.length === 0) return ids

  const ownedIds = accountType === 'reseller'
    ? ids.filter((id) => ownedRestaurantIds.includes(id))
    : []
  const assignedCandidateIds = ids.filter((id) => !ownedIds.includes(id))
  if (assignedCandidateIds.length === 0) return ownedIds

  let resellerId = userId
  if (accountType === 'reseller_employee') {
    const { data: employee, error: employeeError } = await supabase
      .from('reseller_employees')
      .select('reseller_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    if (employeeError) throw employeeError
    resellerId = employee?.reseller_id
  }
  if (!resellerId) return []

  const { data, error } = await supabase
    .from('reseller_restaurants')
    .select('restaurant_id, permissions')
    .eq('reseller_id', resellerId)
    .eq('status', 'active')
    .in('restaurant_id', assignedCandidateIds)
  if (error) throw error

  return [...ownedIds, ...(data || [])
    .filter((assignment) => normalizeResellerPermissions(assignment.permissions).devices)
    .map((assignment) => assignment.restaurant_id)]
}

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
  const isReseller = ['reseller', 'reseller_employee'].includes(auth.accountType)
  const isOwned = restaurant?.owner_id === auth.user?.id
  const restaurantId = restaurant?.id
  const cacheKey = isReseller && !isOwned && restaurantId && auth.user?.id
    ? `${auth.user.id}:${restaurantId}`
    : null
  const [allowed, setAllowed] = useState(() => (
    cacheKey
      ? allowedTabsCache.get(cacheKey) || allowedTabsForResellerPermissions(null)
      : null
  )) // null = everything for owners, members, and admins

  useEffect(() => {
    if (!isReseller || isOwned || !restaurantId || !auth.user?.id) {
      setAllowed(null)
      return
    }
    const nextCacheKey = `${auth.user.id}:${restaurantId}`
    setAllowed(allowedTabsCache.get(nextCacheKey) || allowedTabsForResellerPermissions(null))
    let cancelled = false
    const load = async () => {
      let resellerId = auth.user.id
      let employeePermissions = null
      if (auth.accountType === 'reseller_employee') {
        const { data: employee, error: employeeError } = await supabase
          .from('reseller_employees')
          .select('reseller_id, permissions')
          .eq('user_id', auth.user.id)
          .eq('status', 'active')
          .maybeSingle()
        if (employeeError) throw employeeError
        resellerId = employee?.reseller_id
        employeePermissions = employee?.permissions || {}
      }
      if (!resellerId) throw new Error('Active reseller account not found')

      const { data, error } = await supabase
        .from('reseller_restaurants')
        .select('permissions')
        .eq('restaurant_id', restaurantId)
        .eq('reseller_id', resellerId)
        .eq('status', 'active')
        .maybeSingle()
      if (error) throw error
      return { assignment: data, employeePermissions }
    }

    load()
      .then(({ assignment, employeePermissions }) => {
        if (cancelled) return
        const tabs = allowedTabsForResellerPermissions(assignment?.permissions)
        const resolved = employeePermissions?.close_day === false
          ? tabs.filter((tab) => tab !== 'close-day')
          : tabs
        allowedTabsCache.set(nextCacheKey, resolved)
        setAllowed(resolved)
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = ['analytics', 'reports', 'checks', 'labor-cost', 'tip-pooling']
          allowedTabsCache.set(nextCacheKey, fallback)
          setAllowed(fallback)
        }
      })
    return () => {
      cancelled = true
    }
  }, [auth.accountType, isReseller, isOwned, restaurantId, auth.user?.id])

  return allowed
}

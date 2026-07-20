import { supabase } from '../../shared/lib/supabase'

export const UNGROUPED_ID = 'ungrouped'

export function colorForGroup(groupId, groups) {
  if (groupId === UNGROUPED_ID) return '#9CA3AF'
  return groups.find((group) => group.id === groupId)?.color || '#D4A854'
}

export function groupRestaurants(restaurants, groups, memberships) {
  const membershipByRestaurant = new Map(memberships.map((member) => [member.restaurant_id, member.group_id]))
  return restaurants.map((restaurant) => {
    const groupId = membershipByRestaurant.get(restaurant.id) || UNGROUPED_ID
    const group = groups.find((item) => item.id === groupId)
    return {
      ...restaurant,
      reseller_group_id: groupId,
      reseller_group_name: group?.name || 'Ungrouped',
      reseller_group_color: group?.color || '#9CA3AF',
    }
  })
}

export function buildGroupCards(restaurantsWithGroups, groups) {
  const cards = groups.map((group) => {
    const restaurants = restaurantsWithGroups.filter((restaurant) => restaurant.reseller_group_id === group.id)
    return { ...group, restaurants, restaurant_count: restaurants.length }
  })
  const ungrouped = restaurantsWithGroups.filter((restaurant) => restaurant.reseller_group_id === UNGROUPED_ID)
  return [
    ...cards,
    {
      id: UNGROUPED_ID,
      name: 'Ungrouped',
      color: '#9CA3AF',
      restaurants: ungrouped,
      restaurant_count: ungrouped.length,
      locked: true,
    },
  ]
}

export async function fetchResellerGroups(resellerId) {
  const { data: groups, error: groupsError } = await supabase
    .from('reseller_restaurant_groups')
    .select('*')
    .eq('reseller_id', resellerId)
    .order('name')
  if (groupsError) throw groupsError

  const { data: memberships, error: membersError } = await supabase
    .from('reseller_restaurant_group_members')
    .select('*')
    .eq('reseller_id', resellerId)
  if (membersError) throw membersError

  return { groups: groups || [], memberships: memberships || [] }
}

async function fetchAllResellerGroups() {
  const [{ data: groups, error: groupsError }, { data: memberships, error: membersError }] = await Promise.all([
    supabase.from('reseller_restaurant_groups').select('*').order('name'),
    supabase.from('reseller_restaurant_group_members').select('*'),
  ])
  if (groupsError) throw groupsError
  if (membersError) throw membersError
  return { groups: groups || [], memberships: memberships || [] }
}

export async function fetchResellerPortfolioForUser({ userId, accountType, restaurants }) {
  // Platform admins can open the reseller editor for any store, but their
  // profile ID is not itself a reseller ID. Query the admin-visible portfolio
  // rows without filtering by auth.uid(), otherwise every store is incorrectly
  // presented as "Ungrouped".
  if (accountType === 'admin') {
    const data = await fetchAllResellerGroups()
    return {
      resellerId: null,
      employee: null,
      groups: data.groups,
      memberships: data.memberships,
      restaurants: groupRestaurants(restaurants || [], data.groups, data.memberships),
    }
  }

  if (accountType !== 'reseller_employee') {
    const data = await fetchResellerGroups(userId)
    return {
      resellerId: userId,
      employee: null,
      groups: data.groups,
      memberships: data.memberships,
      restaurants: groupRestaurants(restaurants || [], data.groups, data.memberships),
    }
  }

  const { data: employee, error: employeeError } = await supabase
    .from('reseller_employees')
    .select('*, assignments:reseller_employee_restaurants(restaurant_id), group_assignments:reseller_employee_groups(group_id)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (employeeError) throw employeeError
  if (!employee) {
    return { resellerId: null, employee: null, groups: [], memberships: [], restaurants: [] }
  }

  const data = await fetchResellerGroups(employee.reseller_id)
  const allowedIds = new Set((employee.assignments || []).map((row) => row.restaurant_id))
  const allowedGroupIds = new Set((employee.group_assignments || []).map((row) => row.group_id))
  data.memberships.forEach((membership) => {
    if (allowedGroupIds.has(membership.group_id)) {
      allowedIds.add(membership.restaurant_id)
    }
  })
  const allowedRestaurants = (restaurants || []).filter((restaurant) => allowedIds.has(restaurant.id))
  return {
    resellerId: employee.reseller_id,
    employee: { ...employee, group_ids: [...allowedGroupIds] },
    groups: data.groups,
    memberships: data.memberships,
    restaurants: groupRestaurants(allowedRestaurants, data.groups, data.memberships),
  }
}

export async function createResellerGroup(resellerId, { name, color }) {
  const { data, error } = await supabase
    .from('reseller_restaurant_groups')
    .insert({ reseller_id: resellerId, name: name.trim(), color })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function moveRestaurantsToGroup(resellerId, restaurantIds, groupId) {
  const ids = [...new Set(restaurantIds)].filter(Boolean)
  if (ids.length === 0) return

  if (groupId === UNGROUPED_ID) {
    const { error } = await supabase
      .from('reseller_restaurant_group_members')
      .delete()
      .eq('reseller_id', resellerId)
      .in('restaurant_id', ids)
    if (error) throw error
    return
  }

  const rows = ids.map((restaurantId) => ({ reseller_id: resellerId, restaurant_id: restaurantId, group_id: groupId }))
  const { error } = await supabase
    .from('reseller_restaurant_group_members')
    .upsert(rows, { onConflict: 'reseller_id,restaurant_id' })
  if (error) throw error
}

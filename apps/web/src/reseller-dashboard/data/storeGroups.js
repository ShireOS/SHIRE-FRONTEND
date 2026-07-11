import { supabase } from '../../shared/lib/supabase'

export async function fetchStoreGroups(userId) {
  const { data, error } = await supabase
    .from('store_groups')
    .select('*, members:store_group_members(restaurant_id)')
    .eq('owner_id', userId)
    .order('name')
  if (error) throw error
  return (data || []).map((group) => ({
    ...group,
    restaurantIds: new Set((group.members || []).map((m) => m.restaurant_id)),
  }))
}

export async function createStoreGroup(userId, name) {
  const { data, error } = await supabase
    .from('store_groups')
    .insert({ owner_id: userId, name })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteStoreGroup(groupId) {
  const { error } = await supabase.from('store_groups').delete().eq('id', groupId)
  if (error) throw error
}

export async function setGroupMembership(groupId, restaurantId, isMember) {
  if (isMember) {
    const { error } = await supabase
      .from('store_group_members')
      .upsert({ group_id: groupId, restaurant_id: restaurantId }, { onConflict: 'group_id,restaurant_id' })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('store_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('restaurant_id', restaurantId)
    if (error) throw error
  }
}

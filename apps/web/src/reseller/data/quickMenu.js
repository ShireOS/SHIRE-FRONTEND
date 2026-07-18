import { fetchWithSupabaseAuth } from '../../shared/query'

export function fetchPosQuickMenu(restaurantId) {
  return fetchWithSupabaseAuth(`/reseller/pos-quick-menu?restaurant_id=${encodeURIComponent(restaurantId)}`)
}

export function applyPosQuickMenu(restaurantId, mode, itemIds) {
  return fetchWithSupabaseAuth('/reseller/pos-quick-menu', {
    method: 'PUT',
    body: JSON.stringify({
      restaurant_id: restaurantId,
      mode,
      item_ids: mode === 'custom' ? itemIds : [],
    }),
  })
}

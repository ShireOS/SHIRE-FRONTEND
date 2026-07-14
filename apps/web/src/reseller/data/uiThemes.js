import { fetchWithSupabaseAuth } from '../../shared/query'

function themeQuery(restaurantIds) {
  const params = new URLSearchParams()
  restaurantIds.forEach((id) => params.append('restaurant_ids', id))
  return `/reseller/ui-themes?${params.toString()}`
}

export async function fetchUiThemes(restaurantIds) {
  return fetchWithSupabaseAuth(themeQuery(restaurantIds))
}

export async function applyUiTheme(service, restaurantIds, tokens, componentOverrides) {
  return fetchWithSupabaseAuth('/reseller/ui-themes', {
    method: 'PUT',
    body: JSON.stringify({
      service,
      restaurant_ids: restaurantIds,
      tokens,
      component_overrides: componentOverrides,
    }),
  })
}

export async function deleteUiThemeHistoryColor(color) {
  return fetchWithSupabaseAuth(`/reseller/ui-themes/color-history/${encodeURIComponent(color)}`, {
    method: 'DELETE',
  })
}

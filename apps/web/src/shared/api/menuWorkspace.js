import { fetchWithSupabaseAuth } from '../query'

const endpoint = (restaurantId) =>
  `/reseller/pos-menu-workspace?restaurant_id=${encodeURIComponent(restaurantId)}`

export function fetchPosMenuWorkspace(restaurantId) {
  return fetchWithSupabaseAuth(endpoint(restaurantId), {
    headers: { 'X-Restaurant-Id': restaurantId },
  })
}

export function applyPosMenuWorkspace(restaurantId, workspace, reason) {
  return fetchWithSupabaseAuth('/reseller/pos-menu-workspace', {
    method: 'PUT',
    headers: { 'X-Restaurant-Id': restaurantId },
    body: JSON.stringify({
      restaurant_id: restaurantId,
      version: workspace.version,
      departments: workspace.departments.map(({ id, name, display_order }) => ({
        id,
        name,
        display_order,
      })),
      profiles: {
        server: {
          shortcut_item_ids: workspace.profiles.server.shortcut_item_ids,
          default_open: workspace.profiles.server.default_open,
        },
        bartender: {
          shortcut_item_ids: workspace.profiles.bartender.shortcut_item_ids,
          browse_department_ids: workspace.departments.map((department) => department.id),
        },
      },
      restaurant_bartender_default_home: workspace.restaurant_bartender_default_home,
      staff_home_overrides: workspace.bartenders
        .map((bartender) => ({
          waiter_id: bartender.id,
          home_surface: bartender.home_surface,
        })),
      reason: reason.trim(),
    }),
  })
}

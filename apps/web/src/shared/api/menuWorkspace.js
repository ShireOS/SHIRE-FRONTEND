import { fetchPosApi } from './posClient'

// The POS menu workspace endpoints live on the POS backend
// (Shire_POS_backend menu_workspace router), on the plain /api/v1 integration
// mount rather than the consolidated /api/v1/dev-v2 POS surface.
export function fetchPosMenuWorkspace(restaurantId) {
  return fetchPosApi(
    restaurantId,
    `/reseller/pos-menu-workspace?restaurant_id=${encodeURIComponent(restaurantId)}`,
    { mount: 'integration' },
  )
}

export function applyPosMenuWorkspace(restaurantId, workspace, reason) {
  return fetchPosApi(restaurantId, '/reseller/pos-menu-workspace', {
    mount: 'integration',
    method: 'PUT',
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

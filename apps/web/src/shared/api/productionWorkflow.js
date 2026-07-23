import { fetchPosApi } from './posClient'

export function fetchProductionWorkflow(restaurantId) {
  return fetchPosApi(
    restaurantId,
    `/reseller/pos-production-workflow?restaurant_id=${encodeURIComponent(restaurantId)}`,
    { mount: 'integration', cache: 'no-store' },
  )
}

export function applyProductionWorkflow(restaurantId, workflow, reason) {
  return fetchPosApi(restaurantId, '/reseller/pos-production-workflow', {
    mount: 'integration',
    method: 'PUT',
    body: JSON.stringify({
      restaurant_id: restaurantId,
      version: workflow.version,
      beverage_mode: workflow.beverage_mode,
      beverage_roles: workflow.beverage_roles || ['bartender'],
      overrides: workflow.overrides.map(({ waiter_id, role_key, menu_item_id, category, station_id, device_id, behavior }) => ({
        waiter_id: waiter_id || null,
        role_key: role_key || null,
        menu_item_id: menu_item_id || null,
        category: category || null,
        station_id: station_id || null,
        device_id: device_id || null,
        behavior,
      })),
      device_access: (workflow.device_access || []).map(({ device_id, station_id, is_default }) => ({
        device_id,
        station_id,
        is_default: Boolean(is_default),
      })),
      reason: reason.trim(),
    }),
  })
}

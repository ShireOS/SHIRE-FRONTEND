import { supabase } from '../../shared/lib/supabase'
import { fetchPosApi } from '../../shared/api/posClient'

// Physical layer: which printer a terminal talks to, per role. One target per
// role per device — 'backup' is its own role rather than a priority scheme.
export const DEVICE_PRINTER_ROLES = [
  { id: 'receipt', label: 'Receipt printer' },
  { id: 'cash_drawer', label: 'Cash drawer trigger' },
  { id: 'label', label: 'Label printer' },
  { id: 'backup', label: 'Backup printer' },
]

export const DEVICE_TYPE_LABELS = {
  android_tablet: 'Android tablet',
  waiter_handheld: 'Waiter handheld',
  fixed_terminal: 'Fixed terminal',
  desktop: 'Desktop',
}

// Vocabulary of the consolidated registry (kitchen_output_targets): screens
// are target_type 'display'; USB/Bluetooth paths live on pos_printer_endpoints
// rather than the target's connection_type.
export const TARGET_TYPES = [
  { id: 'printer', label: 'Printer' },
  { id: 'display', label: 'KDS / Expo screen' },
]

export const CONNECTION_TYPES = [
  { id: 'network', label: 'Network (IP)' },
  { id: 'system', label: 'System queue' },
  { id: 'display_queue', label: 'Display queue' },
  { id: 'dummy', label: 'Dummy (testing)' },
]

export const PAIRING_CODE_TTL_MINUTES = 15

export const deviceTypeLabel = (type) =>
  DEVICE_TYPE_LABELS[type] || (type ? type.replace(/_/g, ' ') : 'Device')

// A device that hasn't checked in for 10 minutes reads as offline.
export const isDeviceOnline = (device) =>
  Boolean(device?.last_seen_at) && Date.now() - new Date(device.last_seen_at).getTime() < 10 * 60 * 1000

export const fetchPrinterFailover = restaurantId =>
  fetchPosApi(restaurantId, `/restaurants/${restaurantId}/printer-failover`, { cache: 'no-store' })

export const savePrinterFailover = (restaurantId, targetId, policy) =>
  fetchPosApi(restaurantId, `/restaurants/${restaurantId}/printer-failover/${targetId}`, {
    method: 'PUT',
    body: JSON.stringify(policy),
  })

export const saveDeviceHardwareConfig = (restaurantId, deviceId, hardwareConfig, reason) =>
  fetchPosApi(restaurantId, `/restaurants/${restaurantId}/devices/${deviceId}/hardware-config`, {
    method: 'PUT',
    body: JSON.stringify({ hardware_config: hardwareConfig, reason }),
  })

export const saveCashDrawerTargetConfig = (restaurantId, targetId, config, reason) =>
  fetchPosApi(restaurantId, `/restaurants/${restaurantId}/printer-targets/${targetId}/cash-drawer-config`, {
    method: 'PUT',
    body: JSON.stringify({ config, reason }),
  })

export const setDevicePrinter = (restaurantId, deviceId, role, targetId, reason) =>
  fetchPosApi(restaurantId, `/restaurants/${restaurantId}/devices/${deviceId}/printer-assignment`, {
    method: 'PUT',
    body: JSON.stringify({ role, target_id: targetId || null, reason }),
  })

export async function fetchPortfolioDevices(restaurantIds) {
  if (!restaurantIds || restaurantIds.length === 0) return []
  const { data, error } = await supabase
    .from('pos_devices')
    .select('id, restaurant_id, name, device_type, status, last_seen_at, created_at')
    .in('restaurant_id', restaurantIds)
    .order('name')
  if (error) throw error
  return data || []
}

// Everything the per-store panel needs in one load: devices with their printer
// assignments, the printer registry, print groups (kitchen_stations) with
// their subscribed targets, and menu categories with their group assignment.
export async function fetchStoreDeviceConfig(restaurantId) {
  const [devices, legacyShims, outputTargets, stations, categories, typePolicies, printerEndpoints, sections] = await Promise.all([
    supabase
      .from('pos_devices')
      .select('id, restaurant_id, name, device_type, status, last_seen_at, created_at, revenue_center_id, idle_lock_seconds, manager_idle_lock_seconds, idle_lock_seconds_open_check, absolute_ttl_seconds, lock_after_check_save, persist_manager_session, print_completion_action_override, observed_capabilities, hardware_config, capabilities_reported_at, printers:pos_device_printers(role, target_id)')
      .eq('restaurant_id', restaurantId)
      .order('name'),
    // Transitional, read-only: assignments written before the registry
    // consolidation store a legacy pos_routing_targets shim id whose
    // config.physical_target_id points at the kitchen_output_targets row.
    // Remove together with the deploy-gated remap migration.
    supabase
      .from('pos_routing_targets')
      .select('id, name, config')
      .eq('restaurant_id', restaurantId),
    supabase
      .from('kitchen_output_targets')
      .select('id, name, target_type, connection_type, config, is_active, usage, pos_device_id, archived_at, created_at')
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null)
      .order('name'),
    supabase
      .from('kitchen_stations')
      .select('id, name, is_active, kds_enabled, station_type, subscriptions:kitchen_station_targets(id, target_id, priority, is_active, archived_at)')
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null)
      .order('name'),
    supabase
      .from('menu_categories')
      .select('id, name, routing_station_id')
      .eq('restaurant_id', restaurantId)
      .order('name'),
    supabase
      .from('pos_device_type_policies')
      .select('id, device_type, idle_lock_seconds, manager_idle_lock_seconds, idle_lock_seconds_open_check, absolute_ttl_seconds, lock_after_check_save, persist_manager_session, print_completion_action_override')
      .eq('restaurant_id', restaurantId)
      .order('device_type'),
    supabase
      .from('pos_printer_endpoints')
      .select('id, target_id, agent_device_id, name, connection_type, priority, config, is_active, last_health_status, last_health_error, last_health_at')
      .eq('restaurant_id', restaurantId)
      .order('priority'),
    supabase
      .from('sections')
      .select('id, name, is_active')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('name'),
  ])
  const firstError = devices.error || legacyShims.error || outputTargets.error || stations.error || categories.error || typePolicies.error || printerEndpoints.error || sections.error
  if (firstError) throw firstError
  const kitchenTargets = outputTargets.data || []
  const kitchenIds = new Set(kitchenTargets.map((target) => target.id))
  const shims = new Map((legacyShims.data || []).map((target) => [target.id, target]))
  return {
    devices: (devices.data || []).map((device) => ({
      ...device,
      printers: (device.printers || []).map((assignment) => ({
        ...assignment,
        // New assignments store the kitchen target id directly; legacy rows
        // resolve through the shim's physical_target_id.
        physical_target_id: kitchenIds.has(assignment.target_id)
          ? assignment.target_id
          : shims.get(assignment.target_id)?.config?.physical_target_id || null,
        legacy_target_name: shims.get(assignment.target_id)?.name || null,
      })),
    })),
    targets: kitchenTargets,
    outputTargets: kitchenTargets,
    stations: (stations.data || []).map((station) => ({
      ...station,
      subscriptions: (station.subscriptions || []).filter((link) => !link.archived_at),
    })),
    categories: categories.data || [],
    typePolicies: typePolicies.data || [],
    printerEndpoints: printerEndpoints.data || [],
    sections: sections.data || [],
  }
}

// Session policy mutations use the audited POS-backend device boundary.
export const saveDeviceTypePolicy = (restaurantId, deviceType, policy, reason) =>
  fetchPosApi(restaurantId, `/restaurants/${restaurantId}/device-session-policies/${encodeURIComponent(deviceType)}`, {
    method: 'PUT',
    body: JSON.stringify({ ...policy, reason }),
  })

export const saveDeviceSessionPolicyOverride = (restaurantId, deviceId, policy, reason) =>
  fetchPosApi(restaurantId, `/restaurants/${restaurantId}/devices/${deviceId}/session-policy`, {
    method: 'PUT',
    body: JSON.stringify({ ...policy, reason }),
  })

export async function updateDevice(deviceId, patch) {
  const { error } = await supabase
    .from('pos_devices')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', deviceId)
  if (error) throw error
}

// Printer/screen registry writes go through the POS kitchen-routing API — the
// single owner of kitchen_output_targets / kitchen_station_targets /
// kitchen_routing_rules — so ticket printing sees every change.
export function createPrinterTarget(restaurantId, { name, target_type, connection_type, host, port, usage }) {
  const config = {}
  if (host) config.host = host
  if (port) config.port = Number(port) || port
  return fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing/targets`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      target_type: target_type || 'printer',
      connection_type: connection_type || (host ? 'network' : 'dummy'),
      config,
      is_active: true,
      // Panel-created printers are usable for both kitchen tickets and
      // receipts, matching how the pre-consolidation registry behaved.
      usage: usage || 'both',
    }),
  })
}

export function updatePrinterTarget(restaurantId, target, patch) {
  return fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing/targets/${target.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: target.name,
      target_type: target.target_type || 'printer',
      connection_type: target.connection_type || 'network',
      config: target.config || {},
      usage: target.usage || 'kitchen',
      pos_device_id: target.pos_device_id || null,
      is_active: target.is_active,
      ...patch,
    }),
  })
}

export function createPrintGroup(restaurantId, name) {
  return fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing/stations`, {
    method: 'POST',
    body: JSON.stringify({ name, is_active: true }),
  })
}

export function setGroupPrinter(restaurantId, stationId, targetId, subscribed) {
  return fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing/station-targets`, {
    method: 'POST',
    body: JSON.stringify({ station_id: stationId, target_id: targetId, priority: 0, is_active: subscribed }),
  })
}

// stationId null unassigns the category from any print group. Writes an
// authoritative routing rule (the old direct routing_station_id update was a
// projection ticket printing ignored).
export function setCategoryPrintGroup(restaurantId, categoryName, stationId) {
  return fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing/categories`, {
    method: 'PUT',
    body: JSON.stringify(stationId
      ? { category: categoryName, mode: 'stations', station_ids: [stationId] }
      : { category: categoryName, mode: 'inherit', station_ids: [] }),
  })
}

// The portal can't reach a LAN printer itself; it queues a request that an
// online POS device's print bridge claims and prints. Poll the row for the
// outcome.
export async function requestTestPrint(restaurantId, targetId) {
  const { data, error } = await supabase
    .from('pos_test_prints')
    .insert({ restaurant_id: restaurantId, target_id: targetId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchTestPrint(id) {
  const { data, error } = await supabase
    .from('pos_test_prints')
    .select('id, status, error, printed_at')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// Printers configured on the POS app's legacy printer-setup screen live as
// bare IPs on pos_restaurant_configs (id = restaurant id), not as
// pos_routing_targets rows, so they don't show up as targets until imported.
export async function fetchLegacyPrinterConfig(restaurantId) {
  const { data, error } = await supabase
    .from('pos_restaurant_configs')
    .select('id, receipt_printer_ip, kitchen_printer_ip, printer_profile')
    .eq('id', restaurantId)
    .maybeSingle()
  // Non-fatal: the column grant ships in a migration that may not be run yet.
  if (error) return null
  return data
}

export async function fetchActivePairingCodes(restaurantId) {
  const { data, error } = await supabase
    .from('pos_device_pairing_codes')
    .select('id, code, device_name, device_type, expires_at, redeemed_at, created_at')
    .eq('restaurant_id', restaurantId)
    .is('redeemed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Unambiguous alphabet (no 0/O/1/I) so codes survive being read out loud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generatePairingCode(length = 6) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

export async function createPairingCode(restaurantId, { deviceName, deviceType } = {}) {
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MINUTES * 60 * 1000).toISOString()
  // Retry on the (unlikely) unique-code collision.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from('pos_device_pairing_codes')
      .insert({
        restaurant_id: restaurantId,
        code: generatePairingCode(),
        device_name: deviceName || null,
        device_type: deviceType || null,
        expires_at: expiresAt,
      })
      .select()
      .single()
    if (!error) return data
    if (error.code !== '23505') throw error
  }
  throw new Error('Could not generate a unique pairing code')
}

export async function revokePairingCode(codeId) {
  const { error } = await supabase
    .from('pos_device_pairing_codes')
    .delete()
    .eq('id', codeId)
  if (error) throw error
}

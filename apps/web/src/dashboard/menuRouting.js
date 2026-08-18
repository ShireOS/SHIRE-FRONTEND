export const ROUTE_INHERIT_VALUE = ''
export const ROUTE_NO_PRODUCTION_VALUE = '__no_production_route__'
export const ROUTE_MULTI_VALUE = '__multiple_production_routes__'

const normalizeCategory = (value) => String(value || 'Other').trim().toLowerCase()

export function productionRouteSelectionPayload(routeValue) {
  if (routeValue === ROUTE_MULTI_VALUE) throw new Error('Choose one prep station before replacing a multi-station route.')
  return {
    mode: routeValue === ROUTE_NO_PRODUCTION_VALUE ? 'no_production' : routeValue ? 'stations' : 'inherit',
    station_ids: routeValue && routeValue !== ROUTE_NO_PRODUCTION_VALUE ? [routeValue] : [],
  }
}

export function explicitProductionRouteValue({
  sourceType,
  sourceId = '',
  category = '',
  rules = [],
  exclusions = [],
  projectedStationId = '',
}) {
  const matchesSource = row => {
    if (row?.source_type !== sourceType || row?.is_active === false || row?.archived_at) return false
    if (sourceType === 'category') return normalizeCategory(row.category) === normalizeCategory(category)
    return String(row.source_id || '') === String(sourceId || '')
  }
  const matchingExclusions = exclusions.filter(matchesSource)
  if (matchingExclusions.length) return ROUTE_NO_PRODUCTION_VALUE
  const matchingRules = rules.filter(matchesSource)
  if (matchingRules.length > 1) return ROUTE_MULTI_VALUE
  if (matchingRules.length === 1) return String(matchingRules[0].station_id || '')
  return sourceType === 'category' ? String(projectedStationId || '') : ROUTE_INHERIT_VALUE
}

function stationName(rule, stationsById) {
  return rule.station_name || stationsById[String(rule.station_id)]?.name || 'Unknown station'
}

function stationResult(kind, sourceLabel, rules, stationsById, routableStationIds) {
  const stationIds = [...new Set(rules.map(rule => String(rule.station_id)).filter(Boolean))]
  const names = [...new Set(rules.map(rule => stationName(rule, stationsById)))]
  const missingOutput = stationIds.some(id => !routableStationIds.has(id))
  return {
    kind,
    sourceLabel,
    label: names.join(' + ') || 'Unknown station',
    description: `${sourceLabel} sends this item to ${names.join(' + ') || 'an unknown station'}.`,
    stationIds,
    valid: !missingOutput,
    error: missingOutput ? `${sourceLabel} points to a station without an active kitchen printer or display.` : '',
  }
}

export function resolveDraftProductionRoute({
  routing = ROUTE_INHERIT_VALUE,
  category = 'Other',
  categoryRules = [],
  categoryExcluded = false,
  sourceItemRules = [],
  stations = [],
  routableStationIds = [],
  fallback = null,
}) {
  const stationsById = Object.fromEntries(stations.map(station => [String(station.id), station]))
  const routable = new Set([...routableStationIds].map(String))

  if (routing === ROUTE_NO_PRODUCTION_VALUE) {
    return {
      kind: 'no_production',
      sourceLabel: 'Item exception',
      label: 'No kitchen ticket',
      description: 'This item stays on checks and reports but does not send a kitchen or bar ticket.',
      stationIds: [],
      valid: true,
      error: '',
    }
  }
  if (routing === ROUTE_MULTI_VALUE) {
    if (!sourceItemRules.length) {
      return {
        kind: 'missing', sourceLabel: 'Copied item route', label: 'Route unavailable',
        description: 'The source item no longer has a production route to copy.', stationIds: [],
        valid: false, error: 'The source item no longer has a production route to copy.',
      }
    }
    return stationResult('item_override', 'Copied item override', sourceItemRules, stationsById, routable)
  }
  if (routing) {
    return stationResult(
      'item_override',
      'Item override',
      [{ station_id: routing, station_name: stationsById[String(routing)]?.name }],
      stationsById,
      routable,
    )
  }
  if (categoryExcluded) {
    return {
      kind: 'no_production',
      sourceLabel: `${category || 'Other'} category default`,
      label: 'No kitchen ticket',
      description: `The ${category || 'Other'} category does not send kitchen or bar tickets.`,
      stationIds: [],
      valid: true,
      error: '',
    }
  }
  if (categoryRules.length) {
    return stationResult('category', `${category || 'Other'} category default`, categoryRules, stationsById, routable)
  }
  if (fallback?.ok && fallback.station?.id) {
    return stationResult(
      'fallback',
      'Restaurant fallback',
      [{ station_id: fallback.station.id, station_name: fallback.station.name }],
      stationsById,
      routable,
    )
  }
  const reason = fallback?.reason || `The ${category || 'Other'} category has no route and the restaurant has no working fallback.`
  return {
    kind: 'missing', sourceLabel: 'Automatic routing', label: 'No working route',
    description: reason, stationIds: [], valid: false, error: reason,
  }
}

export function hasItemProductionOverride(item, rules = [], exclusions = []) {
  const id = String(item?.id || item?.menu_item_id || '')
  return rules.some(rule => rule.source_type === 'menu_item' && String(rule.source_id || '') === id)
    || exclusions.some(rule => rule.source_type === 'menu_item' && String(rule.source_id || '') === id)
}

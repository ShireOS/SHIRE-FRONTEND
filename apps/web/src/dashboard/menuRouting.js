export const ROUTE_INHERIT_VALUE = ''
export const ROUTE_NO_PRODUCTION_VALUE = '__no_production_route__'
export const ROUTE_MULTI_VALUE = '__multiple_production_routes__'

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
      label: 'No production ticket',
      description: 'This item is intentionally marked as requiring no kitchen or bar production.',
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
      label: 'No production ticket',
      description: `The ${category || 'Other'} category is intentionally marked as requiring no production.`,
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

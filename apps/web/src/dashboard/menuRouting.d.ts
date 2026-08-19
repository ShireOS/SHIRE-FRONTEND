export const ROUTE_INHERIT_VALUE: ''
export const ROUTE_NO_PRODUCTION_VALUE: '__no_production_route__'
export const ROUTE_MULTI_VALUE: '__multiple_production_routes__'

export type ProductionRoutingRow = {
  source_type?: string
  source_id?: string | null
  category?: string | null
  station_id?: string | null
  station_name?: string | null
  is_active?: boolean
  archived_at?: string | null
}

export function productionRouteSelectionPayload(routeValue: string): {
  mode: 'inherit' | 'stations' | 'no_production'
  station_ids: string[]
}

export function explicitProductionRouteValue(options: {
  sourceType: 'category' | 'menu_item' | 'modifier'
  sourceId?: string | null
  category?: string | null
  rules?: ProductionRoutingRow[]
  exclusions?: ProductionRoutingRow[]
  projectedStationId?: string | null
}): string

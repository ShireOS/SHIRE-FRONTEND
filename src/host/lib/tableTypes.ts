export type TableZone = 'outdoor' | 'bar' | 'indoor'

const OUTDOOR_TABLES = new Set([1, 2, 3, 50])
const BAR_TABLES = new Set([31, 33, 35, 37])

export function getTableZone(tableNumber: number): TableZone {
  if (OUTDOOR_TABLES.has(tableNumber)) return 'outdoor'
  if (BAR_TABLES.has(tableNumber)) return 'bar'
  return 'indoor'
}

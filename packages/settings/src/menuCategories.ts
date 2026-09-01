import { asNullableString, asString, isRecord } from './helpers'
import type { MenuCategoryData } from './types'

// Course types + prep times are real API columns (the mobile editor sets
// them); they ride through normalize/payload so a save from any surface
// no longer wipes them.
export function defaultMenuCategories(): MenuCategoryData[] {
  return [
    { name: 'Appetizers', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Kitchen', default_course_type: 'appetizer', default_fire_mode: 'by_course', prep_time_minutes: null, kds_display_group: 'Apps', is_active: true },
    { name: 'Entrees', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Kitchen', default_course_type: 'entree', default_fire_mode: 'by_course', prep_time_minutes: null, kds_display_group: 'Entrees', is_active: true },
    { name: 'Desserts', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Kitchen', default_course_type: 'dessert', default_fire_mode: 'by_course', prep_time_minutes: null, kds_display_group: 'Desserts', is_active: true },
    { name: 'Sides', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Kitchen', default_course_type: 'side', default_fire_mode: 'inherit', prep_time_minutes: null, kds_display_group: 'Sides', is_active: true },
    { name: 'Drinks', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Bar', default_course_type: 'drink', default_fire_mode: 'immediate', prep_time_minutes: null, kds_display_group: 'Drinks', is_active: true },
    { name: 'Cocktails', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Bar', default_course_type: 'drink', default_fire_mode: 'immediate', prep_time_minutes: null, kds_display_group: 'Bar', is_active: true },
    { name: 'Beer & Wine', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Bar', default_course_type: 'drink', default_fire_mode: 'immediate', prep_time_minutes: null, kds_display_group: 'Bar', is_active: true },
    { name: 'Specials', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Kitchen', default_course_type: 'other', default_fire_mode: 'inherit', prep_time_minutes: null, kds_display_group: 'Specials', is_active: true },
    { name: 'Other', tax_rate_id: '', routing_station_id: '', routing_station_name: 'Expo', default_course_type: 'none', default_fire_mode: 'inherit', prep_time_minutes: null, kds_display_group: 'Other', is_active: true },
  ]
}

export function normalizeMenuCategories(value: unknown): MenuCategoryData[] {
  const rows = Array.isArray(value) ? value : []
  const normalized = rows
    .filter(isRecord)
    .map(row => ({
      id: asNullableString(row.id),
      name: asString(row.name).trim(),
      tax_rate_id: asString(row.tax_rate_id),
      routing_station_id: asString(row.routing_station_id),
      routing_station_name: asString(row.routing_station_name),
      default_course_type: (row.default_course_type || null) as MenuCategoryData['default_course_type'],
      default_fire_mode: asString(row.default_fire_mode) as MenuCategoryData['default_fire_mode'],
      prep_time_minutes: row.prep_time_minutes == null || row.prep_time_minutes === '' ? null : String(row.prep_time_minutes),
      kds_display_group: asString(row.kds_display_group),
      is_active: typeof row.is_active === 'boolean' ? row.is_active : true,
    }))
    .filter(row => row.is_active !== false)

  return normalized.length > 0 ? normalized : defaultMenuCategories()
}

/** PUT /restaurants/:id/menu/categories body. */
export function menuCategoriesPayload(categories: unknown) {
  return {
    categories: normalizeMenuCategories(categories).map(row => ({
      id: row.id || undefined,
      name: row.name,
      routing_station_id: row.routing_station_id || null,
      routing_station_name: row.routing_station_name || null,
      default_course_type: row.default_course_type || null,
      default_fire_mode: row.default_fire_mode || null,
      prep_time_minutes: row.prep_time_minutes == null || row.prep_time_minutes === '' ? null : Number(row.prep_time_minutes),
      kds_display_group: row.kds_display_group || null,
      is_active: true,
    })),
  }
}

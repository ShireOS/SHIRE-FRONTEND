import { supabase } from '../../shared/lib/supabase'
import { fetchWithSupabaseAuth, queryClient } from '../../shared/query'

// Areas that round-trip as whole settings payloads (GET source → PUT target).
// One-time copy: targets stay independently editable afterward.
export const APPLY_AREAS = [
  { id: 'taxes-charges', label: 'Taxes & charges' },
  { id: 'discount-rules', label: 'Discounts' },
  { id: 'manager-controls', label: 'Manager controls' },
  { id: 'tips-payroll-settings', label: 'Tips & payroll' },
  { id: 'check-workflow-settings', label: 'Check workflow' },
  { id: 'closeout-settings', label: 'Cash & closeout' },
  { id: 'hours', label: 'Operating hours' },
]

// Strip source-restaurant identifiers so payloads re-home cleanly.
const sanitize = (value) => {
  if (Array.isArray(value)) return value.map(sanitize)
  if (value && typeof value === 'object') {
    const next = {}
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'restaurant_id' || key === 'created_at' || key === 'updated_at') continue
      next[key] = sanitize(entry)
    }
    return next
  }
  return value
}

async function copyHours(sourceId, targetId) {
  const { data: rows, error } = await supabase
    .from('operating_hours')
    .select('day_of_week, open_time, close_time, is_closed')
    .eq('restaurant_id', sourceId)
  if (error) throw error
  if (!rows?.length) return
  const { error: upsertError } = await supabase
    .from('operating_hours')
    .upsert(
      rows.map((row) => ({ ...row, restaurant_id: targetId })),
      { onConflict: 'restaurant_id,day_of_week' }
    )
  if (upsertError) throw upsertError
}

async function copyEndpointArea(area, sourceId, targetId, sourceCache) {
  if (!(area in sourceCache)) {
    sourceCache[area] = await fetchWithSupabaseAuth(`/restaurants/${sourceId}/${area}`)
  }
  const payload = sanitize(sourceCache[area])
  await fetchWithSupabaseAuth(`/restaurants/${targetId}/${area}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

/**
 * Push selected setting areas from one store to many.
 * Returns [{targetId, area, ok, error}] — partial failures don't abort the rest.
 */
export async function applyToStores({ sourceId, targetIds, areaIds }) {
  const results = []
  const sourceCache = {}
  for (const targetId of targetIds) {
    for (const area of areaIds) {
      try {
        if (area === 'hours') {
          await copyHours(sourceId, targetId)
        } else {
          await copyEndpointArea(area, sourceId, targetId, sourceCache)
        }
        results.push({ targetId, area, ok: true })
      } catch (error) {
        results.push({ targetId, area, ok: false, error: error?.message || 'Failed' })
      }
    }
    // Copied settings invalidate whatever the target had cached.
    void queryClient.invalidateQueries({ queryKey: ['restaurant', targetId] })
  }
  return results
}

// Resolving a saved report-preference row against the sections the app knows about today.
//
// A row saved before a section shipped lists neither its order nor its visibility, and
// `PUT /reports/preferences` backfills only `section_order` -- `visible_sections` comes
// back as the literal list the client sent. So this must be the single answer used by BOTH
// the page render and the "Visible report sections" checkboxes. When they disagreed, a new
// section rendered on the page while its checkbox showed unchecked, and the next save --
// even one that toggled nothing -- posted the stale list back and hid the section for good.
export function effectivePreference(preference = {}, allSectionIds = []) {
  const saved = preference.section_order?.length ? preference.section_order : allSectionIds
  const order = [...saved, ...allSectionIds.filter((id) => !saved.includes(id))]
  // Only ids the saved row could not have known about are force-added; anything the user
  // actually unchecked stays unchecked.
  const added = order.filter((id) => !saved.includes(id))
  const chosen = preference.visible_sections ? [...preference.visible_sections, ...added] : order
  return { order, visible: order.filter((id) => chosen.includes(id)) }
}

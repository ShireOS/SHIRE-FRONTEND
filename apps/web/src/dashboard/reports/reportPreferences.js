// Resolving a saved report-preference row against the sections the app knows about today.
//
// `PUT /reports/preferences` backfills `section_order`, but an older client cannot add a
// section it does not know to `visible_sections`. Persisting the catalog version inside the
// existing section_settings JSON lets us distinguish that rolling-deploy omission from a
// section the user deliberately hid after learning about it.
export const REPORT_CATALOG_VERSION = 3
export const REPORT_CATALOG_VERSION_KEY = '__report_catalog_version'

const SECTION_INTRODUCED_IN = {
  tax_summary: 2,
  payroll_timecards: 3,
  tip_settlement: 3,
}

function savedCatalogVersion(preference) {
  const value = Number(preference?.section_settings?.[REPORT_CATALOG_VERSION_KEY])
  return Number.isInteger(value) && value >= 1 ? value : 1
}

export function effectivePreference(preference = {}, allSectionIds = []) {
  const rawSaved = preference.section_order?.length ? preference.section_order : allSectionIds
  const saved = [...new Set(rawSaved.flatMap((id) => id === 'payroll_support' ? ['payroll_timecards', 'tip_settlement'] : [id]))]
  const order = [...saved, ...allSectionIds.filter((id) => !saved.includes(id))]
  const catalogVersion = savedCatalogVersion(preference)
  const added = order.filter((id) => (
    !saved.includes(id) || (SECTION_INTRODUCED_IN[id] || 1) > catalogVersion
  ))
  const visible = preference.visible_sections
    ? [...new Set(preference.visible_sections.flatMap((id) => id === 'payroll_support' ? ['payroll_timecards', 'tip_settlement'] : [id]))]
    : undefined
  const chosen = visible ? [...visible, ...added] : order
  return {
    order,
    visible: order.filter((id) => chosen.includes(id)),
    sectionSettings: {
      ...(preference.section_settings || {}),
      [REPORT_CATALOG_VERSION_KEY]: REPORT_CATALOG_VERSION,
    },
  }
}

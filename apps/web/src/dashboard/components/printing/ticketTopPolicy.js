// The starter is the ticket the POS and backend print, written in the grammar
// the builder edits. The checked-in JSON is mirrored in all three runtimes so
// the dashboard's real preview cannot silently drift from paper output.
//
// It used to be a best-effort approximation, because the editable schema could
// not express the two-column heading the POS actually printed. Opening the
// builder therefore replaced a two-line ticket with six one-field-per-line rows:
// doing the thing the page invited you to do made your tickets worse. The `pair`
// row type closed that gap, so customizing now starts from exactly what was on
// paper and every edit from there is a real choice.
//
//                  DINE IN
// Kitchen · Marcus                    3:14 PM
// -------------------------------------------
//                  TABLE 12
// -------------------------------------------
export const TICKET_TOP_STARTER = {
  header: [
    { type: 'field', field: 'order_type', align: 'center', size: 'large', bold: true },
    {
      type: 'pair',
      left: { parts: [{ field: 'station_name' }, { field: 'server_name' }], join: ' · ' },
      right: { parts: [{ field: 'time_only' }] },
      right_width: 9,
    },
    { type: 'divider' },
    { type: 'field', field: 'location', align: 'center', size: 'large', bold: true },
    { type: 'divider' },
  ],
  info: [
    { type: 'field', field: 'check_memo', align: 'left', size: 'standard', bold: true, color: 'red', requires: 'check_memo' },
    { type: 'divider', requires: 'check_memo' },
    { type: 'field', field: 'course_banner', align: 'center', bold: true, requires: 'course_banner' },
    { type: 'divider', requires: 'course_banner' },
  ],
}

export function ticketTopEditorRows(header, info, configured) {
  if (!configured) return TICKET_TOP_STARTER
  return {
    header: Array.isArray(header) ? header : [],
    info: Array.isArray(info) ? info : [],
  }
}

export function stripTicketTopRowIds(rows) {
  return rows.map(({ id: _id, ...row }) => row)
}

export function ticketTopRowsMatch(zones, externalRows) {
  return JSON.stringify(stripTicketTopRowIds(zones.header)) === JSON.stringify(externalRows.header)
    && JSON.stringify(stripTicketTopRowIds(zones.info)) === JSON.stringify(externalRows.info)
}

// Find the presentation attached to a field without reimplementing the ticket
// grammar in the preview. Pair columns can override their parent row, so merge
// both just like the printer renderer does.
export function ticketTopFieldPresentation(rows, field) {
  for (const row of rows || []) {
    if (row?.type === 'field' && row.field === field) return { ...row, pair: false }
    if (row?.type !== 'pair') continue
    for (const side of [row.left, row.right]) {
      if (ticketTopSideParts(side).some(part => part?.field === field)) {
        return { ...row, ...(side || {}), pair: true }
      }
    }
  }
  return null
}

export function buildTicketTopPatch(zones, changedZones) {
  const patch = {}
  for (const zone of changedZones) {
    patch[zone] = stripTicketTopRowIds(zones[zone])
  }
  return patch
}

// A column resolves to one line of text. `first` takes the first part that
// resolves to anything; `join` concatenates every part that survives.
export function ticketTopSideParts(side) {
  if (!side) return []
  if (Array.isArray(side.parts)) return side.parts
  return side.field || side.text ? [side] : []
}

export function ticketTopSideLabel(side, fieldLabel) {
  const parts = ticketTopSideParts(side)
  if (!parts.length) return '—'
  const names = parts.map(part => (part.text ? `"${part.text}"` : fieldLabel(part.field)))
  return side.mode === 'first' ? names.join(' or ') : names.join(side.join ?? ' · ')
}

// The starter is the ticket the POS already prints, written in the grammar the
// builder edits — it mirrors DEFAULT_KITCHEN_TICKET_TOP in the backend's
// printing_policy.py.
//
// It used to be a best-effort approximation, because the editable schema could
// not express the two-column heading the POS actually printed. Opening the
// builder therefore replaced a two-line ticket with six one-field-per-line rows:
// doing the thing the page invited you to do made your tickets worse. The `pair`
// row type closed that gap, so customizing now starts from exactly what was on
// paper and every edit from there is a real choice.
//
//     CHK 418                  DINE IN
//     Table 12 · Marcus          3:14P
//     --------------------------------
export const TICKET_TOP_STARTER = {
  header: [
    {
      type: 'pair',
      // `first` is a fallback chain: an offline ticket has no check number yet
      // and falls back to the table rather than printing a blank column.
      left: {
        parts: [{ field: 'check_number' }, { field: 'location' }],
        mode: 'first',
        size: 'large',
        bold: true,
      },
      right: { parts: [{ field: 'order_type' }], size: 'large', bold: true },
      right_width: 10,
    },
  ],
  info: [
    {
      type: 'pair',
      // `hide_if_duplicate`: when the header already fell back to the table,
      // printing it again here would say Table 7 twice.
      left: {
        parts: [
          { field: 'location', hide_if_duplicate: true },
          { field: 'server_name' },
        ],
        join: ' · ',
      },
      right: { parts: [{ field: 'time_only' }] },
      right_width: 7,
    },
    { type: 'divider' },
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

// The editable schema cannot reproduce the legacy heading byte-for-byte: that
// one is a two-column row, and this schema renders one field per line. What
// the starter can do is preserve every operational field and put them in the
// same priority order, so a restaurant that opens the builder does not quietly
// lose the identification a cook works from.
//
// The check number leads. It is the one thing anyone says out loud, and in the
// legacy heading it is the first and largest thing on the ticket. It sits at
// 'large' rather than 'double' deliberately — 'double' is double *width*, which
// spaces the characters out ("C H K  4 1 8") and wraps a long number across
// lines; 'large' is double height at full width, which is what reads from
// across a kitchen.
//
// Materialized only when the user explicitly chooses to replace the legacy
// block with editable rows.
export const TICKET_TOP_STARTER = {
  header: [
    { type: 'field', field: 'check_number', size: 'large', bold: true },
    { type: 'field', field: 'order_type', size: 'large', bold: true },
    { type: 'field', field: 'course', size: 'large', bold: true },
  ],
  info: [
    { type: 'field', field: 'table' },
    { type: 'field', field: 'server' },
    { type: 'field', field: 'time' },
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

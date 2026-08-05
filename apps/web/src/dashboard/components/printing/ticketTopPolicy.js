// The editable schema cannot reproduce the legacy combined table/order/time
// row byte-for-byte. This starter preserves every piece of operational ticket
// information and is materialized only after the user explicitly chooses to
// replace the legacy block with editable rows.
export const TICKET_TOP_STARTER = {
  header: [
    { type: 'field', field: 'order_type', size: 'large', bold: true },
    { type: 'field', field: 'course', size: 'large', bold: true },
  ],
  info: [
    { type: 'field', field: 'table' },
    { type: 'field', field: 'check_number' },
    { type: 'field', field: 'time' },
    { type: 'field', field: 'server' },
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

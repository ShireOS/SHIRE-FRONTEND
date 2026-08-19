export function buildCheckLedgerQuery({
  tab,
  businessDate,
  dateFrom,
  dateTo,
  historyStatus,
  search,
  page,
}) {
  if (tab === 'history') {
    return {
      date_from: dateFrom,
      date_to: dateTo,
      status: historyStatus || undefined,
      search: search || undefined,
      page,
      page_size: 25,
    }
  }
  return {
    business_date: businessDate || undefined,
    metric: tab === 'active' ? 'active_checks' : tab === 'closed' ? 'sales' : undefined,
    search: search || undefined,
    page,
    page_size: 25,
  }
}

export function ledgerCheckCount(payload) {
  return Number(payload?.total ?? payload?.summary?.checks ?? payload?.items?.length ?? 0)
}

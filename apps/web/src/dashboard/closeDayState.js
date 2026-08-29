export function closeDayOperationKey(preview) {
  if (!preview?.business_date) return null
  return [
    preview.business_date,
    preview.close_period?.sequence || 0,
    preview.close_period?.previous_close_id || 'initial',
    preview.close_period?.opened_at || 'unopened',
  ].join(':')
}

export function closeDayPrintQueueSignature(preview) {
  const operationKey = closeDayOperationKey(preview)
  if (!operationKey) return null
  const count = (value) => Math.max(0, Number(value) || 0)
  return [
    operationKey,
    count(preview.pending_print_jobs),
    count(preview.pending_receipt_print_jobs),
    count(preview.pending_kitchen_print_jobs),
  ].join(':')
}

export function mergeCloseDaySettings(current, settings) {
  return current ? { ...current, closeout_settings: settings } : current
}

export function reconcileClockOutEntryIds(currentIds, openEntries, operationChanged, selectionCustomized = false) {
  const openIds = (openEntries || []).map((entry) => entry.id)
  if (operationChanged || !selectionCustomized) return openIds
  const selected = new Set(currentIds || [])
  return openIds.filter((id) => selected.has(id))
}

export function isAlternateCloseDayPreviewKey(queryKey, restaurantId, selectedBusinessDate) {
  return queryKey?.[0] === 'close-day-preview'
    && queryKey?.[1] === restaurantId
    && queryKey?.[2] !== (selectedBusinessDate || 'active')
}

const cashNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function closeDayCashAllocationError({
  cashCountStatus,
  countedCash,
  retainedBank,
  depositAmount,
  trackDeposit,
}) {
  if (cashCountStatus !== 'counted') return ''
  const currentCash = cashNumber(countedCash)
  const cashLeft = cashNumber(retainedBank)
  const deposit = cashNumber(depositAmount)
  if ([currentCash, cashLeft, deposit].some((value) => value < 0)) {
    return 'Cash amounts cannot be negative.'
  }
  if (cashLeft - currentCash > 0.009) {
    return 'Cash left in drawer cannot exceed current cash.'
  }
  if (trackDeposit && Math.abs((deposit + cashLeft) - currentCash) > 0.009) {
    return 'Deposit plus cash left in drawer must equal current cash.'
  }
  return ''
}

export function canNavigateCloseDayStep(stepIndex, furthestStepIndex) {
  return stepIndex >= 0 && stepIndex <= furthestStepIndex
}

export function normalizeCloseDayErrorMessage(message) {
  return String(message || '')
    .replace(/float left in the drawer/gi, 'cash left in drawer')
    .replace(/float left in drawer/gi, 'cash left in drawer')
    .replace(/counted cash/gi, 'current cash')
}

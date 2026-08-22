export function closeDayOperationKey(preview) {
  if (!preview?.business_date) return null
  return [
    preview.business_date,
    preview.close_period?.sequence || 0,
    preview.close_period?.previous_close_id || 'initial',
    preview.close_period?.opened_at || 'unopened',
  ].join(':')
}

export function mergeCloseDaySettings(current, settings) {
  return current ? { ...current, closeout_settings: settings } : current
}

export function isAlternateCloseDayPreviewKey(queryKey, restaurantId, selectedBusinessDate) {
  return queryKey?.[0] === 'close-day-preview'
    && queryKey?.[1] === restaurantId
    && queryKey?.[2] !== (selectedBusinessDate || 'active')
}

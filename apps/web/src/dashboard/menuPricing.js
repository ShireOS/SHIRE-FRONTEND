export const ITEM_PRICE_RULE_TYPES = [
  { value: 'percent_off', label: '% off' },
  { value: 'amount_off', label: '$ off' },
  { value: 'fixed', label: 'Set special price' },
]

export function calculateSpecialPrice(basePrice, adjustmentType, adjustmentValue) {
  if (adjustmentValue == null || String(adjustmentValue).trim() === '') return null
  const base = Number(basePrice)
  const adjustment = Number(adjustmentValue)
  if (!Number.isFinite(base) || !Number.isFinite(adjustment) || adjustment < 0) return null

  let result
  if (adjustmentType === 'percent_off') result = base * (1 - adjustment / 100)
  else if (adjustmentType === 'amount_off') result = base - adjustment
  else if (adjustmentType === 'percent_up') result = base * (1 + adjustment / 100)
  else if (adjustmentType === 'amount_up') result = base + adjustment
  else if (adjustmentType === 'fixed') result = adjustment
  else return null

  return Math.round((Math.max(result, 0) + Number.EPSILON) * 100) / 100
}

export function specialPricePreview(basePrice, adjustmentType, adjustmentValue) {
  const price = calculateSpecialPrice(basePrice, adjustmentType, adjustmentValue)
  return price == null ? '' : price.toFixed(2)
}

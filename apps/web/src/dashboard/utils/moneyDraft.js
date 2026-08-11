export function cleanMoneyDraft(value) {
  const source = String(value ?? '')
  let whole = ''
  let fraction = ''
  let hasDecimal = false

  for (const character of source) {
    if (/\d/.test(character)) {
      if (hasDecimal) {
        if (fraction.length < 2) fraction += character
      } else {
        whole += character
      }
    } else if (character === '.' && !hasDecimal) {
      hasDecimal = true
    }
  }

  return hasDecimal ? `${whole}.${fraction}` : whole
}

export function parseMoneyDraft(value) {
  const cleaned = cleanMoneyDraft(value)
  if (!cleaned || cleaned === '.') return null
  const amount = Number(cleaned)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

export function moneyValuesToDraft(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return {}
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, cleanMoneyDraft(value)]),
  )
}

export function moneyDraftMapToValues(values, activeKeys) {
  const result = {}
  for (const key of activeKeys || []) {
    const amount = parseMoneyDraft(values?.[key])
    if (amount !== null) result[key] = amount
  }
  return result
}

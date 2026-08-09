export function cashSettlementDisplay(value) {
  if (value == null) return null
  const signedAmount = Number(value)
  if (!Number.isFinite(signedAmount)) return null
  return {
    label: signedAmount < 0 ? 'Restaurant owes server' : 'Server owes restaurant',
    amount: Math.abs(signedAmount),
  }
}

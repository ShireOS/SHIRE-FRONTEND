export const POS_AUTHORITY_OPTIONS = [
  { value: 'normal', label: 'Clock-in only' },
  { value: 'waiter', label: 'Service staff' },
  { value: 'manager', label: 'Manager' },
]

export const POS_AUTHORITY_RANK = { normal: 0, waiter: 1, manager: 2 }

export const posAuthorityForTier = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (['owner', 'manager', 'admin'].includes(normalized)) return 'manager'
  if (['waiter', 'server'].includes(normalized)) return 'waiter'
  return 'normal'
}

export const highestPosAuthority = (...values) => values
  .flat()
  .map(posAuthorityForTier)
  .reduce((highest, value) => (
    POS_AUTHORITY_RANK[value] > POS_AUTHORITY_RANK[highest] ? value : highest
  ), 'normal')

export const accountMinimumPosAuthority = (role) => (
  ['manager', 'owner'].includes(role) ? 'manager' : 'normal'
)

export const posAuthorityLabel = (value) => (
  POS_AUTHORITY_OPTIONS.find(option => option.value === posAuthorityForTier(value))?.label || 'Clock-in only'
)

const RESELLER_PORTAL_ACCOUNT_TYPES = new Set(['reseller', 'reseller_employee', 'admin'])

export function inviteDestination(result, accountType) {
  if (result?.restaurant?.id) {
    const base = RESELLER_PORTAL_ACCOUNT_TYPES.has(String(accountType || '').trim().toLowerCase())
      ? '/reseller/restaurants'
      : '/restaurants'
    return `${base}/${result.restaurant.id}/analytics`
  }
  if (result?.kind === 'reseller_connection' || result?.kind === 'reseller_employee') return '/enterprise/stores'
  return '/'
}

export function clearStoredInviteToken(storage, token) {
  if (!storage || !token) return false
  if (storage.getItem('shire_pending_access_invite_token') !== token) return false
  storage.removeItem('shire_pending_access_invite_token')
  return true
}

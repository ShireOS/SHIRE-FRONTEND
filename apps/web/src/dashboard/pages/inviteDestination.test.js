import assert from 'node:assert/strict'
import test from 'node:test'

import { clearStoredInviteToken, inviteDestination } from './inviteDestination.js'

const acceptedRestaurantInvite = {
  kind: 'restaurant_member',
  restaurant: { id: 'restaurant-123' },
}

test('restaurant invitations open in the portal that owns the signed-in account type', () => {
  assert.equal(
    inviteDestination(acceptedRestaurantInvite, 'owner'),
    '/restaurants/restaurant-123/analytics',
  )
  assert.equal(
    inviteDestination(acceptedRestaurantInvite, 'employee'),
    '/restaurants/restaurant-123/analytics',
  )
  assert.equal(
    inviteDestination(acceptedRestaurantInvite, 'reseller'),
    '/reseller/restaurants/restaurant-123/analytics',
  )
  assert.equal(
    inviteDestination(acceptedRestaurantInvite, 'reseller_employee'),
    '/reseller/restaurants/restaurant-123/analytics',
  )
  assert.equal(
    inviteDestination(acceptedRestaurantInvite, 'admin'),
    '/reseller/restaurants/restaurant-123/analytics',
  )
})

test('non-restaurant invitations keep their existing destinations', () => {
  assert.equal(inviteDestination({ kind: 'reseller_connection' }, 'reseller'), '/enterprise/stores')
  assert.equal(inviteDestination({ kind: 'reseller_employee' }, 'reseller_employee'), '/enterprise/stores')
  assert.equal(inviteDestination({ kind: 'platform_account' }, 'owner'), '/')
})

test('terminal invite previews clear only the matching pending token', () => {
  const values = new Map([['shire_pending_access_invite_token', 'accepted-token']])
  const storage = {
    getItem: (key) => values.get(key) || null,
    removeItem: (key) => values.delete(key),
  }

  assert.equal(clearStoredInviteToken(storage, 'different-token'), false)
  assert.equal(values.get('shire_pending_access_invite_token'), 'accepted-token')
  assert.equal(clearStoredInviteToken(storage, 'accepted-token'), true)
  assert.equal(values.has('shire_pending_access_invite_token'), false)
})

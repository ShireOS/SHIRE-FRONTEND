import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('./VoiceReservationsPage.jsx', import.meta.url), 'utf8')

test('AI phone local state resets on every restaurant change', () => {
  const resetStart = page.indexOf("setSearchMode('zip')")
  const resetEffect = page.slice(
    resetStart,
    page.indexOf('}, [restaurantId])', resetStart) + '}, [restaurantId])'.length,
  )
  for (const reset of [
    "setSearchValue('')",
    'setNumbers([])',
    'setSearching(false)',
    'setBusyAction(null)',
    'setActionError(null)',
    "setNotice('')",
    "setForwardingMode('none')",
    "setForwardingFrom('')",
    "setTransferPhone('')",
    'setPurchaseOpen(false)',
    'setPurchaseConfirmed(false)',
    'setReleaseOpen(false)',
    "setReleaseConfirmation('')",
  ]) assert.match(resetEffect, new RegExp(reset.replace(/[()[\]]/g, '\\$&')))
})

test('AI phone async work is generation-fenced and uses its captured restaurant', () => {
  assert.match(page, /requestContextRef = useRef\(\{ restaurantId, generation: 0 \}\)/)
  assert.match(page, /request\.restaurantId === requestContextRef\.current\.restaurantId/)
  assert.match(page, /queryKeys\.voiceProvisioning\(request\.restaurantId\)/)
  assert.match(page, /if \(!requestIsCurrent\(request\)\) return/)
  assert.match(page, /if \(requestIsCurrent\(request\)\) setBusyAction\(null\)/)
  assert.match(page, /if \(requestIsCurrent\(request\)\) setSearching\(false\)/)
  assert.match(page, /navigator\.clipboard\.writeText\(phoneNumber\)[\s\S]*requestIsCurrent\(request\)/)
})

test('permanent number release is distinct from temporary deactivation', () => {
  assert.match(page, /method: 'DELETE',[\s\S]*confirmRelease: true,[\s\S]*phoneNumber: releaseConfirmation/)
  assert.match(page, /nationalPhoneDigits\(releaseConfirmation\) !== nationalPhoneDigits\(selectedNumber\)/)
  assert.match(page, /Release and stop renewals/)
  assert.match(page, /Twilio does not refund the current prepaid month/)
  assert.match(page, /runSetupAction\('activation',[\s\S]*enabled/)
})

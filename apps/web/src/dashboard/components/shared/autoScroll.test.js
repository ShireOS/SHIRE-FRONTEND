import assert from 'node:assert/strict'
import test from 'node:test'

import { autoScrollVelocity, findScrollableAncestor, AUTOSCROLL_MAX_SPEED } from './autoScroll.js'

test('dead zone in the middle produces no scroll', () => {
  assert.equal(autoScrollVelocity(500, 0, 1000), 0)
  assert.equal(autoScrollVelocity(400, 0, 1000), 0)
})

test('near the top scrolls up, faster at the very edge', () => {
  const nearEdge = autoScrollVelocity(5, 0, 1000)
  const nearZoneBoundary = autoScrollVelocity(105, 0, 1000)
  assert.ok(nearEdge < 0 && nearZoneBoundary < 0)
  assert.ok(nearEdge < nearZoneBoundary, `edge ${nearEdge} should be faster (more negative) than ${nearZoneBoundary}`)
  assert.ok(Math.abs(nearEdge) <= AUTOSCROLL_MAX_SPEED)
})

test('near the bottom scrolls down, faster at the very edge', () => {
  const nearEdge = autoScrollVelocity(995, 0, 1000)
  const nearZoneBoundary = autoScrollVelocity(895, 0, 1000)
  assert.ok(nearEdge > 0 && nearZoneBoundary > 0)
  assert.ok(nearEdge > nearZoneBoundary)
})

test('beyond the viewport still scrolls at capped speed (pointer above/below while held)', () => {
  assert.equal(autoScrollVelocity(-50, 0, 1000), -AUTOSCROLL_MAX_SPEED)
  assert.equal(autoScrollVelocity(1200, 0, 1000), AUTOSCROLL_MAX_SPEED)
})

test('tiny viewports shrink zones instead of overlapping', () => {
  // 120px viewport: zones must not cover the whole height
  assert.equal(autoScrollVelocity(60, 0, 120), 0)
  assert.ok(autoScrollVelocity(5, 0, 120) < 0)
  assert.ok(autoScrollVelocity(115, 0, 120) > 0)
})

test('non-finite pointer (drag started, no move yet) is inert', () => {
  assert.equal(autoScrollVelocity(NaN, 0, 1000), 0)
  assert.equal(autoScrollVelocity(undefined, 0, 1000), 0)
})

test('findScrollableAncestor walks to the nearest scrolling ancestor', () => {
  const page = { parentElement: null, scrollHeight: 4000, clientHeight: 800 }
  const wrapper = { parentElement: page, scrollHeight: 900, clientHeight: 900 }
  const node = { parentElement: wrapper }
  const styles = new Map([
    [page, { overflowY: 'auto' }],
    [wrapper, { overflowY: 'visible' }],
  ])
  assert.equal(findScrollableAncestor(node, el => styles.get(el)), page)
})

test('findScrollableAncestor skips overflow containers that do not overflow', () => {
  const short = { parentElement: null, scrollHeight: 500, clientHeight: 800 } // overflow-y: auto but fits
  const node = { parentElement: short }
  assert.equal(findScrollableAncestor(node, () => ({ overflowY: 'auto' })), null)
})

test('window-scrolled pages return null', () => {
  const plain = { parentElement: null }
  assert.equal(findScrollableAncestor({ parentElement: plain }, () => ({ overflowY: 'visible' })), null)
})

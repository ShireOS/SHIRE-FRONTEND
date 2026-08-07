// Drag auto-scroll math for SortableRows. dnd-kit's built-in scroller is
// disabled there (its heuristics interact badly with restrictToParentElement
// on long lists), so the list scrolls itself from the live pointer position:
// hold a row near the top/bottom edge and the page scrolls under it, faster
// the closer the pointer is to the edge.

export const AUTOSCROLL_EDGE_PX = 110
export const AUTOSCROLL_MAX_SPEED = 22

// Pixels to scroll this frame for a pointer at `pointerY` inside a scroll
// viewport spanning [top, bottom]. Negative = scroll up. 0 in the dead middle.
export function autoScrollVelocity(pointerY, top, bottom, edge = AUTOSCROLL_EDGE_PX, maxSpeed = AUTOSCROLL_MAX_SPEED) {
  if (!Number.isFinite(pointerY) || bottom <= top) return 0
  // Tiny viewports: shrink the trigger zones so they can't overlap.
  const zone = Math.min(edge, Math.max(16, Math.floor((bottom - top) / 4)))
  if (pointerY <= top + zone) {
    const intensity = Math.min(1, (top + zone - pointerY) / zone)
    return -Math.max(1, Math.round(intensity * maxSpeed))
  }
  if (pointerY >= bottom - zone) {
    const intensity = Math.min(1, (pointerY - (bottom - zone)) / zone)
    return Math.max(1, Math.round(intensity * maxSpeed))
  }
  return 0
}

// Nearest ancestor that actually scrolls vertically, or null when the page
// itself is the scroller. `getStyle` is injectable for tests.
export function findScrollableAncestor(node, getStyle) {
  const readStyle = getStyle || ((element) => window.getComputedStyle(element))
  let current = node?.parentElement || null
  while (current) {
    const overflowY = readStyle(current)?.overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
      return current
    }
    current = current.parentElement
  }
  return null
}

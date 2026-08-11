const ITEM_LINE = /^\d+(?:\.\d+)?\s{2}\S/
const MARKED_MODIFIER_LINE = /^\s*\+/
const DIVIDER_LINE = /^(?:-+|\.+)$/
const NOTE_LINE = /^(?:NOTE:|\*\* .* \*\*\s*$|\[.*\]\s*$|ORDER NOTE$)/
const OFF_PREMISE_LOCATION = /^(?:TO GO|DELIVERY|PHONE TO GO|PHONE DELIVERY|DRIVE THRU|BAR|ORDER)\s+—\s+\S/i

export const isKitchenPreviewItemLine = line => ITEM_LINE.test(line)

export const isKitchenPreviewLocationLine = line => {
  const text = String(line || '').trim()
  return /^(?:Table|Tab)\s+\S/i.test(text) || OFF_PREMISE_LOCATION.test(text)
}

export function isKitchenPreviewModifierLine(lines, index) {
  const line = String(lines[index] || '')
  if (MARKED_MODIFIER_LINE.test(line)) return true
  if (!line || line !== line.trimStart() || isKitchenPreviewItemLine(line)) return false

  const text = line.trim()
  if (!text || DIVIDER_LINE.test(text) || NOTE_LINE.test(text)) return false

  // Explicit side-role modifiers deliberately print flush left without the
  // legacy "+" ingredient marker. They still occur inside an item's detail
  // block, after an item line and before the next top-level item.
  let previousItemIndex = -1
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (isKitchenPreviewItemLine(lines[cursor])) {
      previousItemIndex = cursor
      break
    }
  }
  if (previousItemIndex < 0) return false
  for (let cursor = previousItemIndex + 1; cursor < index; cursor += 1) {
    if (DIVIDER_LINE.test(String(lines[cursor] || '').trim())) return false
  }
  return true
}

import assert from 'node:assert/strict'
import test from 'node:test'

import { printerPreviewDataUrl, printerPreviewGeometry, printerPreviewWidthPx } from './printerPreviewDataUrl.js'

test('printer preview preserves the physical paper-width proportions', () => {
  assert.equal(printerPreviewWidthPx(76), 304)
  assert.equal(printerPreviewWidthPx(80), 320)
  assert.equal(printerPreviewWidthPx(58), 232)
  assert.equal(printerPreviewWidthPx(undefined, 76), 304)
})

test('impact preview keeps the 40-column canvas inside the U220 printable area', () => {
  assert.deepEqual(printerPreviewGeometry(76, 'impact'), {
    paperWidthPx: 304,
    printableWidthPx: 254,
  })
  assert.deepEqual(printerPreviewGeometry(80, 'thermal'), {
    paperWidthPx: 320,
    printableWidthPx: 288,
  })
})

test('printer preview accepts ReceiptLine SVG through an image data URL', () => {
  const url = printerPreviewDataUrl('<svg xmlns="http://www.w3.org/2000/svg"><text>Kitchen</text></svg>')
  assert.match(url, /^data:image\/svg\+xml;charset=utf-8,/)
  assert.match(decodeURIComponent(url), /<text>Kitchen<\/text>/)
})

test('printer preview rejects non-SVG and strips active SVG content', () => {
  assert.equal(printerPreviewDataUrl('Kitchen ticket'), '')
  const decoded = decodeURIComponent(printerPreviewDataUrl(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><text onclick="bad()">Safe</text></svg>',
  ))
  assert.doesNotMatch(decoded, /script|onclick/i)
  assert.match(decoded, /<text>Safe<\/text>/)
})

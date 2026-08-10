import assert from 'node:assert/strict'
import test from 'node:test'

import { BUNDLED_PREVIEW_PATHS, resolvePreviewUrls } from './previewConfig.js'

test('bundled previews use same-origin deployment paths', () => {
  assert.deepEqual(BUNDLED_PREVIEW_PATHS, {
    pos: '/previews/pos/index.html',
    host: '/previews/host/index.html',
  })
  assert.deepEqual(resolvePreviewUrls('', [BUNDLED_PREVIEW_PATHS.pos]), ['/previews/pos/index.html'])
})

test('configured hosted preview wins in every environment', () => {
  assert.deepEqual(
    resolvePreviewUrls('https://preview.example.com/pos'),
    ['https://preview.example.com/pos'],
  )
})

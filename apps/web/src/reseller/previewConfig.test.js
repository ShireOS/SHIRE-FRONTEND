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

test('configured hosted preview is tried first with the bundled export as fallback', () => {
  assert.deepEqual(
    resolvePreviewUrls('https://preview.example.com/pos', [BUNDLED_PREVIEW_PATHS.pos]),
    ['https://preview.example.com/pos', '/previews/pos/index.html'],
  )
})

test('duplicate configured and fallback URLs are removed', () => {
  assert.deepEqual(
    resolvePreviewUrls(BUNDLED_PREVIEW_PATHS.pos, [BUNDLED_PREVIEW_PATHS.pos]),
    [BUNDLED_PREVIEW_PATHS.pos],
  )
})

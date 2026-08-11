import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { shouldShowTipoutExceptions } from './tipPoolingSectionPolicy.js'

const pageSource = await readFile(new URL('./TipPoolingPage.jsx', import.meta.url), 'utf8')

test('tip-out exceptions belong only to Pay Run', () => {
  assert.equal(shouldShowTipoutExceptions('run'), true)
  assert.equal(shouldShowTipoutExceptions('overview'), false)
  assert.equal(shouldShowTipoutExceptions('rules'), false)
  assert.equal(shouldShowTipoutExceptions('payroll'), false)
})

test('TipPoolingPage applies the Pay Run policy to loading and rendering', () => {
  assert.match(pageSource, /if \(!shouldShowTipoutExceptions\(activeSubTab\)\) return\s+void loadTipoutExceptions\(\)/)
  assert.match(pageSource, /shouldShowTipoutExceptions\(activeSubTab\) && tipoutExceptionData\?\.items\?\.length/)
})

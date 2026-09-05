import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithEsbuild } from 'vite'

// Render the production JSX with the same transform used by Vite. No browser
// session or operational API is needed to verify what the operator reviews.
const file = new URL('./RecoveryDifferencePreview.jsx', import.meta.url)
const { code } = await transformWithEsbuild(await readFile(file, 'utf8'), file.pathname, {
  loader: 'jsx', jsx: 'automatic', format: 'cjs',
})
const compiled = { exports: {} }
new Function('module', 'exports', 'require', code)(compiled, compiled.exports, createRequire(import.meta.url))
const Preview = compiled.exports.default
const render = (preview) => renderToStaticMarkup(React.createElement(Preview, { preview, referenceName: 'Bar terminal' }))

test('source comparison presents recover/update/preserve actions and readable before/after values', () => {
  const html = render({
    can_apply: true, summary: { recover_checks: 1, update_checks: 1, preserved_checks: 1, blocked_checks: 0 },
    checks: [
      { order_id: 'not-a-user-label', label: 'Check 101', action: 'recover', changes: [
        { field: 'items', before: [], after: [{ name: 'Burger', quantity: 2, total_cents: 2400 }] },
      ] },
      { order_id: 'changed', label: 'Check 102', action: 'update', changes: [
        { field: 'total_cents', label: 'Check total', before: 2400, after: 3600 },
      ] },
      { order_id: 'server-only', label: 'Check 103', action: 'preserve', changes: [] },
    ],
  })
  for (const label of ['Recover missing check', 'Update unpaid check', 'Keep server check', 'Check 101', 'Check 102', 'Check 103', 'Server now', 'From Bar terminal', 'Burger', '× 2', '$24.00', '$36.00']) {
    assert.ok(html.includes(label), `Review should show ${label}`)
  }
  assert.ok(!html.includes('not-a-user-label'), 'An opaque ID must not replace a readable check label')
  assert.ok(html.includes('This check stays on the server'))
  assert.ok(html.includes('Recorded payments are protected'))
  assert.ok(!html.includes('Recovery cannot proceed'))
})

test('blocked source differences are expanded and explain why the whole recovery is stopped', () => {
  const html = render({ can_apply: false, summary: { blocked_checks: 1 }, checks: [
    { label: 'Check 104', action: 'blocked', blockers: ['recorded_payment', { code: 'changed', message: 'A payment started after inspection.' }], changes: [] },
  ] })
  assert.match(html, /<details[^>]*open=""/)
  assert.ok(html.includes('Recovery cannot proceed'))
  assert.ok(html.includes('Recorded Payment'))
  assert.ok(html.includes('A payment started after inspection.'))
})

test('comparison loading does not imply server changes are already approved', () => {
  const html = render(null)
  assert.ok(html.includes('Waiting for the source device and server comparison'))
  assert.ok(!html.includes('Start recovery'))
})

test('untrusted check names are rendered as text in the operator review', () => {
  const html = render({ can_apply: true, checks: [{ label: '<script>bad()</script>', action: 'recover', changes: [
    { field: 'notes', before: '', after: '<img src=x onerror=bad()>' },
  ] }] })
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(html.includes('&lt;img'))
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('<img'))
})

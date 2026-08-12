import assert from 'node:assert/strict'
import test from 'node:test'

import { ApiTimeoutError, withRequestDeadline } from './requestDeadline.ts'

test('returns a completed request before its deadline', async () => {
  const result = await withRequestDeadline(async () => 'ready', { timeoutMs: 50 })
  assert.equal(result, 'ready')
})

test('turns a stalled request into a retryable timeout error', async () => {
  await assert.rejects(
    withRequestDeadline(
      (signal) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      }),
      { timeoutMs: 5 },
    ),
    (error) => error instanceof ApiTimeoutError && error.status === 408,
  )
})

test('preserves caller cancellation instead of reporting a timeout', async () => {
  const controller = new AbortController()
  const pending = withRequestDeadline(
    (signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }),
    { signal: controller.signal, timeoutMs: 100 },
  )
  controller.abort()

  await assert.rejects(pending, (error) => error.name === 'AbortError')
})

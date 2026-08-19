export const DEFAULT_API_TIMEOUT_MS = 15_000

export class ApiTimeoutError extends Error {
  status = 408
  code = 'request_timeout'

  constructor(message = 'The server took too long to respond. Try again.') {
    super(message)
    this.name = 'ApiTimeoutError'
  }
}

export async function withRequestDeadline<T>(
  request: (signal: AbortSignal) => Promise<T>,
  options: { signal?: AbortSignal | null; timeoutMs?: number; message?: string } = {},
): Promise<T> {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? DEFAULT_API_TIMEOUT_MS
  let timedOut = false

  const abortFromCaller = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) abortFromCaller()
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true })

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    return await request(controller.signal)
  } catch (error) {
    if (timedOut && !options.signal?.aborted) {
      throw new ApiTimeoutError(options.message)
    }
    throw error
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}

export function withOptionalRequestDeadline<T>(
  request: (signal?: AbortSignal | null) => Promise<T>,
  options: { signal?: AbortSignal | null; timeoutMs?: number; message?: string } = {},
): Promise<T> {
  if (options.timeoutMs === undefined) return request(options.signal)
  return withRequestDeadline(request, options)
}

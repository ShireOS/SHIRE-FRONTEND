import { requestWithPosSession } from './posSession.ts'
import { withOptionalRequestDeadline } from './requestDeadline.ts'

interface AuthClientLike {
  getSession: () => Promise<any>
  refreshSession: () => Promise<any>
}

export interface RestaurantReportRequestOptions extends RequestInit {
  auth: AuthClientLike
  baseUrl: string
  restaurantId: string
  endpoint: string
  timeoutMs?: number
  responseType?: 'json' | 'blob'
  fetchImpl?: typeof fetch
}

export interface RestaurantReportBlob {
  blob: Blob
  fileName: string
  mimeType: string
}

export class RestaurantReportError extends Error {
  status: number
  code: string | null
  detail: unknown

  constructor(message: string, status: number, code: string | null, detail: unknown) {
    super(message)
    this.name = 'RestaurantReportError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

function errorDetail(body: any): { message: string; code: string | null; detail: unknown } {
  const detail = body?.detail ?? body?.message
  if (typeof detail === 'string') return { message: detail, code: null, detail }
  if (detail && typeof detail === 'object') {
    return {
      message: String(detail.message || JSON.stringify(detail)),
      code: typeof detail.code === 'string' ? detail.code : null,
      detail,
    }
  }
  return { message: '', code: null, detail }
}

function responseFileName(response: Response): string {
  const explicit = response.headers.get('X-Report-Filename')
  if (explicit) return explicit
  const disposition = response.headers.get('Content-Disposition') || ''
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded)
    } catch {
      return encoded
    }
  }
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'pos-report'
}

export async function requestRestaurantReport<T = any>({
  auth,
  baseUrl,
  restaurantId,
  endpoint,
  timeoutMs,
  responseType = 'json',
  fetchImpl = fetch,
  ...init
}: RestaurantReportRequestOptions): Promise<T | RestaurantReportBlob> {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const response = await withOptionalRequestDeadline(
    requestSignal => requestWithPosSession({
      auth,
      signal: requestSignal,
      request: accessToken => {
        const headers = new Headers(init.headers || {})
        if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
        headers.set('Authorization', `Bearer ${accessToken}`)
        headers.set('X-Restaurant-Id', restaurantId)
        return fetchImpl(`${normalizedBase}${endpoint}`, {
          ...init,
          headers,
          signal: requestSignal,
        })
      },
    }),
    {
      signal: init.signal,
      timeoutMs,
      message: 'The restaurant reporting service took too long to respond. Try again.',
    },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const parsed = errorDetail(body)
    throw new RestaurantReportError(
      parsed.message || `Restaurant report request failed (${response.status})`,
      response.status,
      parsed.code,
      parsed.detail,
    )
  }
  if (responseType === 'blob') {
    const blob = await response.blob()
    return {
      blob,
      fileName: responseFileName(response),
      mimeType: response.headers.get('Content-Type') || blob.type || 'application/octet-stream',
    }
  }
  if (response.status === 204) return null as T
  return response.json() as Promise<T>
}

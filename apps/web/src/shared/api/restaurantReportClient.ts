import { supabase } from '../lib/supabase'
import { redirectForUnrecoverableSession } from '../auth/sessionRecovery'
import { API_CONFIG } from './config'
import { PosSessionError } from './posSession'
import {
  requestRestaurantReport,
  type RestaurantReportBlob,
} from './restaurantReportTransport'

export const DIRECT_POS_REPORTS_ENABLED =
  import.meta.env.VITE_DIRECT_POS_REPORTS_ENABLED === 'true'

const SNAPSHOT_TIMEOUT_MS = 15_000
const ARTIFACT_TIMEOUT_MS = 30_000

function reportPath(restaurantId: string): string {
  return `/restaurants/${encodeURIComponent(restaurantId)}/reports/pos-snapshots`
}

async function requestReport(options: Parameters<typeof requestRestaurantReport>[0]) {
  try {
    return await requestRestaurantReport(options)
  } catch (error) {
    if (error instanceof PosSessionError && error.unrecoverable) {
      await redirectForUnrecoverableSession()
    }
    throw error
  }
}

export const restaurantReportApi = {
  snapshot: (
    restaurantId: string,
    payload: Record<string, unknown>,
    signal?: AbortSignal,
  ) => requestReport({
    auth: supabase.auth,
    baseUrl: API_CONFIG.baseUrl,
    restaurantId,
    endpoint: reportPath(restaurantId),
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
    timeoutMs: SNAPSHOT_TIMEOUT_MS,
  }),

  artifact: (
    restaurantId: string,
    snapshotId: string,
    input: { format: 'pdf' | 'xlsx'; packet_name: string },
    signal?: AbortSignal,
  ) => requestReport({
    auth: supabase.auth,
    baseUrl: API_CONFIG.baseUrl,
    restaurantId,
    endpoint: `${reportPath(restaurantId)}/${encodeURIComponent(snapshotId)}/artifacts`,
    method: 'POST',
    body: JSON.stringify(input),
    signal,
    timeoutMs: ARTIFACT_TIMEOUT_MS,
    responseType: 'blob',
  }) as Promise<RestaurantReportBlob>,

  emailNow: (
    restaurantId: string,
    snapshotId: string,
    input: {
      formats: Array<'pdf' | 'xlsx'>
      recipients: string[]
      packet_name: string
      message?: string
    },
    signal?: AbortSignal,
  ) => requestReport({
    auth: supabase.auth,
    baseUrl: API_CONFIG.baseUrl,
    restaurantId,
    endpoint: `${reportPath(restaurantId)}/${encodeURIComponent(snapshotId)}/email-now`,
    method: 'POST',
    body: JSON.stringify(input),
    signal,
    timeoutMs: ARTIFACT_TIMEOUT_MS,
  }),
}

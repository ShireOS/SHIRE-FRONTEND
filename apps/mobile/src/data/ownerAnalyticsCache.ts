import { cachedApiGetData, makeEndpointCacheParts } from '@/data/cachedApi';
import type {
  AnalyticsPeriod,
  OwnerAnalyticsPayload,
  OwnerChecksPayload,
} from '@/api/ownerAnalytics';

const OWNER_ANALYTICS_CACHE_VERSION = 2;
const OWNER_CHECKS_CACHE_VERSION = 2;

const OWNER_ANALYTICS_TTL_MS = 60 * 1000;
const OWNER_CHECKS_TTL_MS = 30 * 1000;
const OWNER_MAX_STALE_MS = 24 * 60 * 60 * 1000;

type CacheFetchOptions<T> = {
  forceRefresh?: boolean;
  onRevalidate?: (data: T) => void;
  onError?: (error: unknown) => void;
};

export function fetchCachedOwnerAnalytics(
  restaurantId: string,
  period: AnalyticsPeriod,
  dateKey: string,
  options: CacheFetchOptions<OwnerAnalyticsPayload> = {},
) {
  const query = `period=${encodeURIComponent(period)}&date=${encodeURIComponent(dateKey)}`;
  const endpoint = `/restaurants/${restaurantId}/owner-analytics?${query}`;

  return cachedApiGetData<OwnerAnalyticsPayload>({
    namespace: 'owner-analytics',
    version: OWNER_ANALYTICS_CACHE_VERSION,
    parts: makeEndpointCacheParts(endpoint),
    endpoint,
    ttlMs: OWNER_ANALYTICS_TTL_MS,
    maxStaleMs: OWNER_MAX_STALE_MS,
    forceRefresh: options.forceRefresh,
    onRevalidate: options.onRevalidate,
    onError: options.onError,
  });
}

export function fetchCachedOwnerChecks(
  restaurantId: string,
  dateKey: string,
  options: CacheFetchOptions<OwnerChecksPayload> = {},
) {
  const endpoint = `/restaurants/${restaurantId}/owner-checks?date=${encodeURIComponent(dateKey)}`;

  return cachedApiGetData<OwnerChecksPayload>({
    namespace: 'owner-checks',
    version: OWNER_CHECKS_CACHE_VERSION,
    parts: makeEndpointCacheParts(endpoint),
    endpoint,
    ttlMs: OWNER_CHECKS_TTL_MS,
    maxStaleMs: OWNER_MAX_STALE_MS,
    forceRefresh: options.forceRefresh,
    onRevalidate: options.onRevalidate,
    onError: options.onError,
  });
}

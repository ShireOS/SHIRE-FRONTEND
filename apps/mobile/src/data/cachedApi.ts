import { apiGet } from '@/api/mobileApi';
import {
  staleWhileRevalidate,
  type CachedDataResult,
  type CacheKeyPart,
  type VersionedCacheKey,
} from '@/cache/staleWhileRevalidate';

export type CachedApiGetOptions<T = unknown> = VersionedCacheKey & {
  endpoint: string;
  ttlMs: number;
  maxStaleMs?: number;
  forceRefresh?: boolean;
  onRevalidate?: (data: T) => void;
  onError?: (error: unknown) => void;
};

export type CachedApiDataResult<T> = CachedDataResult<T>;

export function makeEndpointCacheParts(endpoint: string, extraParts: readonly CacheKeyPart[] = []) {
  return [endpoint, ...extraParts] as const;
}

export async function cachedApiGet<T>(options: CachedApiGetOptions<T>): Promise<CachedApiDataResult<T>> {
  return staleWhileRevalidate<T>({
    namespace: options.namespace,
    version: options.version,
    parts: options.parts,
    ttlMs: options.ttlMs,
    maxStaleMs: options.maxStaleMs,
    forceRefresh: options.forceRefresh,
    onRevalidate: options.onRevalidate,
    onError: options.onError,
    fetcher: () => apiGet<T>(options.endpoint),
  });
}

export async function cachedApiGetData<T>(options: CachedApiGetOptions<T>): Promise<T> {
  const result = await cachedApiGet<T>(options);
  return result.data;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'shire:mobile-cache';

export type CacheKeyPart = string | number | boolean | null | undefined;

export type VersionedCacheKey = {
  namespace: string;
  version: number;
  parts?: readonly CacheKeyPart[];
};

export type CacheFreshness = 'fresh' | 'stale' | 'miss';

export type CachedDataResult<T> = {
  data: T;
  freshness: CacheFreshness;
  storageKey: string;
  cachedAt: number;
  revalidation?: Promise<T | undefined>;
};

export type StaleWhileRevalidateOptions<T> = VersionedCacheKey & {
  ttlMs: number;
  fetcher: () => Promise<T>;
  forceRefresh?: boolean;
  maxStaleMs?: number;
  onRevalidate?: (data: T) => void;
  onError?: (error: unknown) => void;
  now?: () => number;
};

type CacheRecord<T> = {
  data: T;
  cachedAt: number;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheRecord<unknown>>();

function encodePart(part: CacheKeyPart) {
  if (part === undefined) return 'undefined';
  if (part === null) return 'null';
  return encodeURIComponent(String(part));
}

export function createVersionedCacheKey({ namespace, version, parts = [] }: VersionedCacheKey) {
  const suffix = parts.map(encodePart).join(':');
  return `${STORAGE_PREFIX}:${namespace}:v${version}${suffix ? `:${suffix}` : ''}`;
}

function isCacheRecord<T>(value: unknown): value is CacheRecord<T> {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<CacheRecord<T>>;
  return typeof record.cachedAt === 'number' && typeof record.expiresAt === 'number' && 'data' in record;
}

function isFresh(record: CacheRecord<unknown>, now: number) {
  return record.expiresAt > now;
}

function isUsable(record: CacheRecord<unknown>, now: number, maxStaleMs?: number) {
  if (maxStaleMs === undefined) return true;
  return now - record.cachedAt <= maxStaleMs;
}

async function readCacheRecord<T>(storageKey: string): Promise<CacheRecord<T> | null> {
  const memoryRecord = memoryCache.get(storageKey);
  if (memoryRecord) return memoryRecord as CacheRecord<T>;

  const persisted = await AsyncStorage.getItem(storageKey);
  if (!persisted) return null;

  try {
    const parsed = JSON.parse(persisted) as unknown;
    if (!isCacheRecord<T>(parsed)) return null;
    memoryCache.set(storageKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCacheRecord<T>(
  key: VersionedCacheKey,
  data: T,
  ttlMs: number,
  now = Date.now(),
) {
  const storageKey = createVersionedCacheKey(key);
  const record: CacheRecord<T> = {
    data,
    cachedAt: now,
    expiresAt: now + ttlMs,
  };

  memoryCache.set(storageKey, record);
  await AsyncStorage.setItem(storageKey, JSON.stringify(record));
  return { storageKey, record };
}

export async function removeCacheRecord(key: VersionedCacheKey) {
  const storageKey = createVersionedCacheKey(key);
  memoryCache.delete(storageKey);
  await AsyncStorage.removeItem(storageKey);
}

export function clearMemoryCache() {
  memoryCache.clear();
}

async function refreshCache<T>(
  options: StaleWhileRevalidateOptions<T>,
  storageKey: string,
  now: number,
) {
  const data = await options.fetcher();
  const record: CacheRecord<T> = {
    data,
    cachedAt: now,
    expiresAt: now + options.ttlMs,
  };

  memoryCache.set(storageKey, record);
  await AsyncStorage.setItem(storageKey, JSON.stringify(record));
  options.onRevalidate?.(data);
  return data;
}

export async function staleWhileRevalidate<T>(
  options: StaleWhileRevalidateOptions<T>,
): Promise<CachedDataResult<T>> {
  const now = options.now?.() ?? Date.now();
  const storageKey = createVersionedCacheKey(options);
  const cached = await readCacheRecord<T>(storageKey);
  const canUseCached = cached && isUsable(cached, now, options.maxStaleMs);

  if (canUseCached && !options.forceRefresh) {
    if (isFresh(cached, now)) {
      return {
        data: cached.data,
        freshness: 'fresh',
        storageKey,
        cachedAt: cached.cachedAt,
      };
    }

    const revalidation = refreshCache(options, storageKey, now).catch((error: unknown) => {
      options.onError?.(error);
      return undefined;
    });

    return {
      data: cached.data,
      freshness: 'stale',
      storageKey,
      cachedAt: cached.cachedAt,
      revalidation,
    };
  }

  try {
    const data = await refreshCache(options, storageKey, now);
    return {
      data,
      freshness: cached ? 'stale' : 'miss',
      storageKey,
      cachedAt: now,
    };
  } catch (error) {
    if (canUseCached) {
      options.onError?.(error);
      return {
        data: cached.data,
        freshness: 'stale',
        storageKey,
        cachedAt: cached.cachedAt,
      };
    }
    throw error;
  }
}

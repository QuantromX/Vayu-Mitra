import { APP_CONFIG, GEMINI_CONFIG } from '../src/lib/config.ts';

export interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export type BoundedCache<T> = Map<string, CacheEntry<T>>;

/**
 * Stores a value in a bounded TTL cache, evicting the oldest entry if full.
 */
export function setBoundedCache<T>(cache: BoundedCache<T>, key: string, value: T): void {
  if (cache.size >= GEMINI_CONFIG.cacheMaxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, {
    expiresAt: Date.now() + APP_CONFIG.cacheTtlMs,
    value,
  });
}

/**
 * Reads a non-expired value from a bounded TTL cache.
 */
export function getBoundedCache<T>(cache: BoundedCache<T>, key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

/**
 * Performs cache lookup, concurrent in-flight deduplication, conditional caching, and cleanup.
 */
export async function getOrCompute<T>(
  cache: BoundedCache<T>,
  inFlight: Map<string, Promise<T>>,
  key: string,
  producer: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true
): Promise<T> {
  const cached = getBoundedCache(cache, key);
  if (cached) return cached;

  const existingPromise = inFlight.get(key);
  if (existingPromise) return existingPromise;

  const job = (async (): Promise<T> => {
    try {
      const value = await producer();
      if (shouldCache(value)) {
        setBoundedCache(cache, key, value);
      }
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, job);
  return job;
}

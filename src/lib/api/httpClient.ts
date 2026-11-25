import { APP_CONFIG } from '../config.ts';
import { UpstreamApiError } from '../errors.ts';

export interface SwrCacheEntry<T> {
  expiresAt: number;
  staleUntil: number;
  value: T;
}

export interface RetryFetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function classifyAttemptError(params: {
  err: unknown;
  timedOut: boolean;
  isFinalAttempt: boolean;
  errorLabel: string;
  timeoutMs: number;
}): unknown {
  const { err, timedOut, isFinalAttempt, errorLabel, timeoutMs } = params;
  if (err instanceof UpstreamApiError && err.upstreamStatus !== undefined) {
    if (!isRetryableStatus(err.upstreamStatus) || isFinalAttempt) throw err;
    return err;
  }
  if (timedOut) {
    const timeoutErr = new UpstreamApiError(
      `${errorLabel} timed out after ${timeoutMs}ms`,
      {
        statusCode: 504,
        isTimeout: true,
        cause: err,
      }
    );
    if (isFinalAttempt) throw timeoutErr;
    return timeoutErr;
  }
  if (isFinalAttempt) {
    if (err instanceof UpstreamApiError) throw err;
    throw new UpstreamApiError(
      err instanceof Error ? err.message : `${errorLabel} failed`,
      {
        cause: err,
      }
    );
  }
  return err;
}

async function runSingleFetchAttempt<T>(
  url: string,
  errorLabel: string,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<{ data?: T; retryError?: unknown }> {
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, timeoutMs);
  const onExternalAbort = () => timeoutController.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const response = await fetch(url, { signal: timeoutController.signal });
    if (response.ok) return { data: (await response.json()) as T };
    throw new UpstreamApiError(`${errorLabel} (HTTP ${response.status})`, {
      upstreamStatus: response.status,
    });
  } catch (err) {
    if (externalSignal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    return { retryError: { err, timedOut } };
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

function resolveRetrySettings(options?: RetryFetchOptions) {
  return {
    timeoutMs: options?.timeoutMs ?? APP_CONFIG.upstreamTimeoutMs,
    maxRetries: options?.maxRetries ?? APP_CONFIG.maxRetries,
    baseDelayMs: options?.retryBaseDelayMs ?? APP_CONFIG.retryBaseDelayMs,
    signal: options?.signal,
  };
}

/**
 * Fetches JSON with AbortController timeouts and bounded exponential backoff retries.
 */
export async function fetchJsonWithTimeoutAndRetry<T>(
  url: string,
  errorLabel: string,
  options?: RetryFetchOptions
): Promise<T> {
  const { timeoutMs, maxRetries, baseDelayMs, signal } = resolveRetrySettings(options);
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    const outcome = await runSingleFetchAttempt<T>(url, errorLabel, timeoutMs, signal);
    if ('data' in outcome) return outcome.data as T;

    const info = outcome.retryError as { err: unknown; timedOut: boolean };
    lastError = classifyAttemptError({
      err: info.err,
      timedOut: info.timedOut,
      isFinalAttempt: attempt === maxRetries,
      errorLabel,
      timeoutMs,
    });
    await sleep(baseDelayMs * Math.pow(2, attempt), signal);
  }

  throw lastError instanceof Error
    ? lastError
    : new UpstreamApiError(`${errorLabel} failed`);
}

/**
 * Coordinates 10m TTL caching, stale-while-revalidate refresh, and in-flight deduplication.
 */
export function resolveWithSwrCache<T>(params: {
  cache: Map<string, SwrCacheEntry<T>>;
  inFlight: Map<string, Promise<T>>;
  key: string;
  forceRefresh: boolean;
  dedupeOnRefresh: boolean;
  fetcher: () => Promise<T>;
}): Promise<T> {
  const { cache, inFlight, key, forceRefresh, dedupeOnRefresh, fetcher } = params;
  const now = Date.now();
  const cached = cache.get(key);
  if (!forceRefresh && cached && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }

  const runFetch = async (): Promise<T> => {
    if (!forceRefresh || dedupeOnRefresh) {
      const pending = inFlight.get(key);
      if (pending) return pending;
    }
    const promise = (async () => {
      try {
        const value = await fetcher();
        const stamp = Date.now();
        cache.set(key, {
          expiresAt: stamp + APP_CONFIG.cacheTtlMs,
          staleUntil: stamp + APP_CONFIG.staleWhileRevalidateMs,
          value,
        });
        return value;
      } finally {
        inFlight.delete(key);
      }
    })();
    if (!forceRefresh || dedupeOnRefresh) inFlight.set(key, promise);
    return promise;
  };

  if (!forceRefresh && cached && cached.staleUntil > now) {
    void runFetch().catch(() => {
      // Stale-while-revalidate refresh failed silently; existing snapshot stays available.
    });
    return Promise.resolve(cached.value);
  }
  return runFetch();
}

import type { Request, Response } from 'express';
import { SERVER_RATE_LIMITS } from '../src/lib/config.ts';

export type RateRouteKey = 'advice' | 'ask' | 'photo-check';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export interface RateLimiter {
  check: (routeKey: RateRouteKey, clientIp: string) => RateLimitResult;
}

function pruneExpiredBuckets(rateBuckets: Map<string, number[]>, now: number): void {
  if (rateBuckets.size <= 2000) return;
  for (const [key, list] of rateBuckets.entries()) {
    const fresh = list.filter((ts) => now - ts < SERVER_RATE_LIMITS.windowMs);
    if (fresh.length === 0) rateBuckets.delete(key);
    else rateBuckets.set(key, fresh);
  }
}

/**
 * Creates a sliding-window per-IP, per-route rate limiter.
 */
export function createRateLimiter(limits: Record<RateRouteKey, number>): RateLimiter {
  const rateBuckets = new Map<string, number[]>();

  return {
    check(routeKey: RateRouteKey, clientIp: string): RateLimitResult {
      const maxReq = limits[routeKey];
      const bucketKey = `${routeKey}:${clientIp}`;
      const now = Date.now();

      pruneExpiredBuckets(rateBuckets, now);

      const timestamps = (rateBuckets.get(bucketKey) ?? []).filter(
        (ts) => now - ts < SERVER_RATE_LIMITS.windowMs
      );
      if (timestamps.length >= maxReq) {
        const oldest = timestamps[0] ?? now;
        const retryAfterSec = Math.max(
          1,
          Math.ceil((SERVER_RATE_LIMITS.windowMs - (now - oldest)) / 1000)
        );
        rateBuckets.set(bucketKey, timestamps);
        return { allowed: false, retryAfterSec };
      }

      timestamps.push(now);
      rateBuckets.set(bucketKey, timestamps);
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}

/**
 * Enforces per-route IP rate limiting and sends HTTP 429 with Retry-After when exceeded.
 */
export function enforceRateLimit(
  rateLimiter: RateLimiter,
  routeKey: RateRouteKey,
  req: Request,
  res: Response,
  errorMessage: string
): boolean {
  const clientIp = req.ip || 'unknown';
  const rate = rateLimiter.check(routeKey, clientIp);
  if (rate.allowed) return true;

  const correlationId = String(res.locals.correlationId ?? '');
  res.setHeader('Retry-After', String(rate.retryAfterSec));
  res.status(429).json({
    error: errorMessage,
    correlationId,
  });
  return false;
}

/**
 * In-memory fixed-window rate limiter — see SECURITY.md §5. Deliberately
 * not Redis-backed: this repo doesn't wire Redis in until a caching need
 * justifies it (DATABASE.md §8), and a single-process limiter is sufficient
 * for the dev/demo deployment target (one Next.js instance). A multi-instance
 * production deployment needs a shared (Redis) backend for this to be
 * effective across instances — noted here as a known limitation, not solved
 * speculatively ahead of that deployment shape existing (CLAUDE.md §55).
 */

interface Bucket {
  count: number;
  windowStartedAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
  now: number = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartedAt >= options.windowMs) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return { allowed: true, remaining: options.limit - 1, retryAfterMs: 0 };
  }

  if (existing.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: options.windowMs - (now - existing.windowStartedAt),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: options.limit - existing.count, retryAfterMs: 0 };
}

/** Test-only: clears all rate-limit state. */
export function resetRateLimitState(): void {
  buckets.clear();
}

/**
 * Lightweight in-memory rate limiter.
 *
 * Not cluster-safe and not persistent across restarts — adequate for a single-process
 * Node server protecting best-effort endpoints like password reset. For production at
 * scale, replace with Redis or a similar shared store.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

/**
 * Consumes one token from the bucket identified by `key`. If the bucket has no
 * tokens left, `allowed` is false and `retryAfterMs` tells the caller how long
 * to wait.
 */
export function consumeRateLimit(
  key: string,
  options: { max: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.max - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= options.max) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, remaining: options.max - bucket.count, retryAfterMs: 0 };
}

/** Test-only helper: clears all buckets so tests can isolate rate-limit state. */
export function __resetRateLimitStateForTests(): void {
  buckets.clear();
}

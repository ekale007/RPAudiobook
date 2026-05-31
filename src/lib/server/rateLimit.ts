type Bucket = { count: number; resetAt: number };

export type HourlyLimitSnapshot = {
  used: number;
  limit: number;
  resetAt: number;
  remaining: number;
};

const buckets = new Map<string, Bucket>();

/** Simple in-memory hourly limit (fine for beta; swap for Redis at scale). */
export function checkRateLimit(
  key: string,
  limitPerHour: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + hourMs };
    buckets.set(key, bucket);
  }

  if (bucket.count >= limitPerHour) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000),
    );
    return { ok: false, retryAfterSec };
  }

  bucket.count += 1;
  return { ok: true };
}

export function getRateLimitStatus(
  key: string,
  limitPerHour: number,
): HourlyLimitSnapshot {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + hourMs };
    buckets.set(key, bucket);
  }

  return {
    used: bucket.count,
    limit: limitPerHour,
    resetAt: bucket.resetAt,
    remaining: Math.max(0, limitPerHour - bucket.count),
  };
}

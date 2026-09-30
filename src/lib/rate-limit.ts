/** Rate-limit in-memory sederhana untuk MVP (per instance).
 *  OTP & booking juga dilindungi batas DB (attempts / konflik unik).
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): {
  allowed: boolean;
  retryAfterMs: number;
} {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    const retryAfterMs = windowMs - (now - arr[0]);
    hits.set(key, arr);
    return { allowed: false, retryAfterMs };
  }
  arr.push(now);
  hits.set(key, arr);
  return { allowed: true, retryAfterMs: 0 };
}

export function resetRateLimitForTest(): void {
  hits.clear();
}

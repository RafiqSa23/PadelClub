import { sql } from 'drizzle-orm';
import { db } from '@/db';

/**
 * Rate-limit fixed-window lintas-instance (tabel `rate_limits`, ADR 0012).
 * Dipakai endpoint sensitif (auth, booking, check-in) agar batas tetap berlaku
 * ketika aplikasi berjalan di beberapa instance. Endpoint jadwal yang di-polling
 * tetap memakai rate-limit in-memory (`rate-limit.ts`) demi menghemat roundtrip DB.
 */
export async function rateLimitDb(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const rows = (await db.execute(sql`
    INSERT INTO rate_limits (key, count, "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits."windowStart" < now() - make_interval(secs => ${windowSeconds}::double precision)
          THEN 1
        ELSE rate_limits.count + 1
      END,
      "windowStart" = CASE
        WHEN rate_limits."windowStart" < now() - make_interval(secs => ${windowSeconds}::double precision)
          THEN now()
        ELSE rate_limits."windowStart"
      END
    RETURNING count, "windowStart"
  `)) as unknown as Array<{ count: number; windowStart: Date | string }>;

  const row = rows[0];
  if (!row) return { allowed: true, retryAfterMs: 0 };

  const allowed = Number(row.count) <= limit;
  if (allowed) return { allowed: true, retryAfterMs: 0 };

  const startedAt = new Date(row.windowStart).getTime();
  const retryAfterMs = Math.max(0, startedAt + windowMs - Date.now());
  return { allowed: false, retryAfterMs };
}

/** Hapus baris lama (dipanggil cron berkala agar tabel tidak tumbuh tanpa batas). */
export async function cleanupRateLimits(): Promise<number> {
  const rows = (await db.execute(sql`
    DELETE FROM rate_limits
    WHERE "windowStart" < now() - interval '1 day'
    RETURNING 1
  `)) as unknown as Array<unknown>;
  return rows.length;
}

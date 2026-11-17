import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, courts, scanLogs, users } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { rateLimitDb } from '@/lib/rate-limit-db';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * Riwayat pemindaian gate (ADR 0014). Hanya admin bersesi; dipakai scanner
 * untuk memuat ulang log setelah reload/pergantian shift.
 */
export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const rl = await rateLimitDb(`scans:${admin.id}`, 120, 60_000);
  if (!rl.allowed) return jsonError('Terlalu banyak percobaan, coba lagi sebentar', 429);

  const raw = new URL(request.url).searchParams.get('limit');
  const parsed = raw === null ? DEFAULT_LIMIT : Number(raw);
  const limit = Number.isSafeInteger(parsed)
    ? Math.min(Math.max(parsed, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const rows = await db
    .select({
      id: scanLogs.id,
      code: scanLogs.code,
      outcome: scanLogs.outcome,
      reason: scanLogs.reason,
      createdAt: scanLogs.createdAt,
      adminUsername: scanLogs.adminUsername,
      guestName: bookings.guestName,
      userName: users.name,
      courtName: courts.name,
    })
    .from(scanLogs)
    .leftJoin(bookings, eq(scanLogs.bookingId, bookings.id))
    .leftJoin(users, eq(bookings.userId, users.id))
    .leftJoin(courts, eq(bookings.courtId, courts.id))
    .orderBy(desc(scanLogs.createdAt))
    .limit(limit);

  return jsonOk({
    scans: rows.map((row) => ({
      id: row.id,
      code: row.code,
      customerName: row.guestName ?? row.userName ?? null,
      courtName: row.courtName ?? null,
      outcome: row.outcome,
      reason: row.reason,
      adminUsername: row.adminUsername,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

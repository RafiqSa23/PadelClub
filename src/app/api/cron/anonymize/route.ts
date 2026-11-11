import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { userSessions, users } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';

export const GUEST_RETENTION_DAYS = 7; // ADR 0011

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev tanpa secret — produksi wajib set CRON_SECRET
  const header = request.headers.get('x-cron-secret');
  const auth = request.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const query = new URL(request.url).searchParams.get('secret');
  return header === secret || bearer === secret || query === secret;
}

/**
 * Cron anonimisasi user bayangan walk-in (ADR 0011): guest tanpa booking aktif
 * dan tanpa booking dalam 7 hari terakhir → nama "Tamu", HP/email dikosongkan.
 * Baris user & booking TIDAK dihapus (laporan F11 tetap utuh).
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) return jsonError('Unauthorized', 401);

  const cutoff = new Date(Date.now() - GUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.isGuest, true),
        isNull(users.anonymizedAt),
        sql`NOT EXISTS (
          SELECT 1 FROM bookings b
          WHERE b."userId" = ${users.id}
            AND b.status <> 'dibatalkan'
            AND b."bookingDate" >= CURRENT_DATE
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM bookings b
          WHERE b."userId" = ${users.id}
            AND b."createdAt" > now() - interval '${sql.raw(String(GUEST_RETENTION_DAYS))} days'
        )`,
      ),
    )
    .limit(500);

  let anonymized = 0;
  for (const row of rows) {
    await db
      .update(users)
      .set({
        name: 'Tamu',
        phone: null,
        email: null,
        anonymizedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, row.id), isNull(users.anonymizedAt)));
    anonymized += 1;
  }

  // Bersihkan sesi kedaluwarsa (rumah tangga, murah).
  await db.delete(userSessions).where(lt(userSessions.expiresAt, new Date()));

  return jsonOk({ anonymized, cutoff: cutoff.toISOString() });
}

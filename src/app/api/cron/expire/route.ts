import { and, eq, lt } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, payments } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { resolveCustomer } from '@/lib/bookings';
import { mockSendNotification } from '@/lib/notify-driver';

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
 * Cron expiry (F4 + ADR 0006): kedaluwarsakan booking `menunggu_pembayaran`
 * yang `expiresAt`-nya lewat (> 15 mnt) → `dibatalkan` + payment `expired`
 * + log `kadaluarsa`. Slot kembali `kosong` otomatis (dihitung dari status).
 * Dijadwalkan tiap menit via cron eksternal (Vercel Cron / cron-job.org).
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) return jsonError('Unauthorized', 401);

  const now = new Date();
  const stale = await db
    .select({ id: bookings.id, code: bookings.code })
    .from(bookings)
    .where(and(eq(bookings.status, 'menunggu_pembayaran'), lt(bookings.expiresAt, now)))
    .limit(200);

  const codes: string[] = [];
  for (const row of stale) {
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(bookings)
          .set({ status: 'dibatalkan', updatedAt: now })
          .where(and(eq(bookings.id, row.id), eq(bookings.status, 'menunggu_pembayaran')));
        await tx
          .update(payments)
          .set({ status: 'expired' })
          .where(and(eq(payments.bookingId, row.id), eq(payments.status, 'pending')));
      });
      codes.push(row.code);
      try {
        const full = await db.select().from(bookings).where(eq(bookings.id, row.id)).limit(1);
        const customer = full[0] ? await resolveCustomer(full[0]) : { phone: null };
        await mockSendNotification({
          bookingId: row.id,
          channel: 'whatsapp',
          type: 'kadaluarsa',
          to: customer.phone ?? '-',
          message: `Booking ${row.code} kedaluwarsa. Silakan buat booking baru.`,
        });
      } catch {
        // Notifikasi best-effort.
      }
    } catch {
      // Lanjut ke booking berikutnya — cron berikutnya mencoba lagi.
    }
  }

  return jsonOk({ expiredCount: codes.length, codes });
}

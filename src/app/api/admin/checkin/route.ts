import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Check-in oleh admin (F5): menandai pelanggan "sudah check-in" dari tiket.
 * Hanya admin bersesi — halaman tiket publik tidak boleh men-toggle sendiri.
 * Idempoten: check-in ganda mengembalikan `already: true`.
 */
export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const rl = rateLimit(`checkin:${admin.id}`, 30, 60_000);
  if (!rl.allowed) return jsonError('Terlalu banyak percobaan, coba lagi sebentar', 429);

  const body = (await request.json().catch(() => null)) as {
    code?: string;
  } | null;
  if (!body || typeof body.code !== 'string' || body.code.trim() === '') {
    return jsonError('code wajib diisi', 400);
  }
  const code = body.code.trim().toUpperCase();

  const rows = await db.select().from(bookings).where(eq(bookings.code, code)).limit(1);
  const booking = rows[0];
  if (!booking) return jsonError('Booking tidak ditemukan', 404);
  if (booking.status !== 'terkonfirmasi') {
    return jsonError('Hanya booking terkonfirmasi yang bisa check-in', 409);
  }
  if (booking.checkedInAt) {
    return jsonOk({
      ticket: {
        code: booking.code,
        checkedInAt: booking.checkedInAt.toISOString(),
        checkedInBy: booking.checkedInBy,
      },
      already: true,
    });
  }

  const now = new Date();
  const updated = await db
    .update(bookings)
    .set({ checkedInAt: now, checkedInBy: admin.username, updatedAt: now })
    .where(eq(bookings.id, booking.id))
    .returning({ checkedInAt: bookings.checkedInAt, checkedInBy: bookings.checkedInBy });

  return jsonOk({
    ticket: {
      code: booking.code,
      checkedInAt: updated[0].checkedInAt?.toISOString() ?? null,
      checkedInBy: updated[0].checkedInBy ?? null,
    },
  });
}

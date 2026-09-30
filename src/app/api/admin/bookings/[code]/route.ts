import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, payments } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';

/**
 * Aksi remediasi booking (F10): `confirm` (menunggu → terkonfirmasi,
 * payment → paid) atau `cancel` (aktif → dibatalkan, payment pending → expired).
 * Slot terbebas otomatis karena ketersediaan dihitung dari status.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const { code } = await params;
  const body = (await request.json().catch(() => null)) as {
    action?: string;
  } | null;
  if (body?.action !== 'confirm' && body?.action !== 'cancel') {
    return jsonError('action wajib "confirm" atau "cancel"', 400);
  }

  const rows = await db.select().from(bookings).where(eq(bookings.code, code)).limit(1);
  const booking = rows[0];
  if (!booking) return jsonError('Booking tidak ditemukan', 404);

  const now = new Date();

  if (body.action === 'confirm') {
    if (booking.status !== 'menunggu_pembayaran') {
      return jsonError('Hanya booking menunggu pembayaran yang bisa dikonfirmasi', 409);
    }
    await db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({ status: 'terkonfirmasi', expiresAt: null, updatedAt: now })
        .where(eq(bookings.id, booking.id));
      await tx
        .update(payments)
        .set({ status: 'paid', paidAt: now })
        .where(and(eq(payments.bookingId, booking.id), eq(payments.status, 'pending')));
    });
    return jsonOk({ booking: { code: booking.code, status: 'terkonfirmasi' } });
  }

  // cancel
  if (booking.status === 'dibatalkan') {
    return jsonError('Booking sudah dibatalkan', 409);
  }
  await db.transaction(async (tx) => {
    await tx
      .update(bookings)
      .set({ status: 'dibatalkan', updatedAt: now })
      .where(eq(bookings.id, booking.id));
    await tx
      .update(payments)
      .set({ status: 'expired' })
      .where(and(eq(payments.bookingId, booking.id), eq(payments.status, 'pending')));
  });
  return jsonOk({ booking: { code: booking.code, status: 'dibatalkan' } });
}

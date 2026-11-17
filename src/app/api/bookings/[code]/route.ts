import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookingSlots, bookings, courts, payments } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { resolveCustomer } from '@/lib/bookings';
import { getCurrentUser } from '@/lib/user-auth';

/**
 * Detail booking via kode — wajib login (PRD §4.4 Security & Privacy).
 * - Pelanggan hanya boleh melihat booking miliknya sendiri (userId cocok sesi).
 * - Admin boleh melihat semua booking (dipakai panel admin/gate).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const user = await getCurrentUser();
  const admin = await getCurrentAdmin();
  if (!user && !admin) return jsonError('Masuk ke akun terlebih dahulu', 401);

  const rows = await db.select().from(bookings).where(eq(bookings.code, code)).limit(1);
  const booking = rows[0];
  if (!booking) return jsonError('Booking tidak ditemukan', 404);

  // Pelanggan hanya boleh lihat booking miliknya sendiri.
  if (user && !admin && (!booking.userId || Number(booking.userId) !== user.id)) {
    return jsonError('Anda bukan pemilik booking ini', 403);
  }

  const [slotRows, courtRows, paymentRows] = await Promise.all([
    db.select().from(bookingSlots).where(eq(bookingSlots.bookingId, booking.id)),
    db.select().from(courts).where(eq(courts.id, booking.courtId)).limit(1),
    db.select().from(payments).where(eq(payments.bookingId, booking.id)).limit(1),
  ]);
  const customer = await resolveCustomer(booking);

  return jsonOk({
    booking: {
      code: booking.code,
      courtId: booking.courtId,
      courtName: courtRows[0]?.name ?? null,
      hourlyPrice: courtRows[0]?.hourlyPrice ?? null,
      date: booking.bookingDate,
      hours: slotRows.map((s) => s.hour).sort((a, b) => a - b),
      status: booking.status,
      source: booking.source,
      subtotal: booking.subtotal,
      expiresAt: booking.expiresAt?.toISOString() ?? null,
      customerName: customer.name,
      customerPhone: customer.phone,
      paymentStatus: paymentRows[0]?.status ?? null,
    },
  });
}

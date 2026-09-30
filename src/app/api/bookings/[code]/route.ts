import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookingSlots, bookings, courts, payments } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { resolveCustomer } from '@/lib/bookings';

/** Detail booking publik via kode (dipakai konfirmasi + tiket Batch 5). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const rows = await db.select().from(bookings).where(eq(bookings.code, code)).limit(1);
  const booking = rows[0];
  if (!booking) return jsonError('Booking tidak ditemukan', 404);

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

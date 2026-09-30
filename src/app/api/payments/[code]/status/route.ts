import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, payments } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';

/**
 * Status pembayaran (F4): polling fallback bila webhook tidak sampai.
 * Mengembalikan status booking + payment + expiry dalam satu panggilan.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const rows = await db.select().from(bookings).where(eq(bookings.code, code)).limit(1);
  const booking = rows[0];
  if (!booking) return jsonError('Booking tidak ditemukan', 404);

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, booking.id))
    .limit(1);
  const payment = paymentRows[0];

  return jsonOk({
    booking: {
      code: booking.code,
      status: booking.status,
      expiresAt: booking.expiresAt?.toISOString() ?? null,
    },
    payment: payment
      ? {
          orderId: payment.orderId,
          amount: payment.amount,
          status: payment.status,
          qrString:
            (payment.qrisPayload as { qrString?: string } | null)?.qrString ?? null,
          expiresAt: payment.expiresAt?.toISOString() ?? null,
          paidAt: payment.paidAt?.toISOString() ?? null,
        }
      : null,
  });
}

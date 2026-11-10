import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, payments } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { reconcileMidtransStatus } from '@/lib/settle-payment';

/**
 * Status pembayaran (F4): polling fallback bila webhook tidak sampai.
 * Bila booking masih menunggu dan gateway Midtrans, status asli ditanyakan
 * langsung ke Midtrans lalu DB diselaraskan — sehingga pembayaran terdeteksi
 * tanpa webhook (mis. development lokal tanpa URL publik).
 * Mengembalikan status booking + payment + expiry dalam satu panggilan.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const rows = await db.select().from(bookings).where(eq(bookings.code, code)).limit(1);
  let booking = rows[0];
  if (!booking) return jsonError('Booking tidak ditemukan', 404);

  let paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, booking.id))
    .limit(1);
  let payment = paymentRows[0];

  // Rekonsiliasi gateway: hanya saat masih menunggu agar idempoten dan murah.
  if (
    booking.status === 'menunggu_pembayaran' &&
    payment?.status === 'pending' &&
    payment.gateway === 'midtrans' &&
    payment.orderId
  ) {
    const result = await reconcileMidtransStatus(payment.orderId);
    if (result === 'paid' || result === 'expired') {
      const freshBooking = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, booking.id))
        .limit(1);
      if (freshBooking[0]) booking = freshBooking[0];
      paymentRows = await db
        .select()
        .from(payments)
        .where(eq(payments.bookingId, booking.id))
        .limit(1);
      payment = paymentRows[0];
    }
  }

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
          gateway: payment.gateway,
          qrString:
            (payment.qrisPayload as { qrString?: string } | null)?.qrString ?? null,
          qrImageUrl:
            (payment.qrisPayload as { qrImageUrl?: string } | null)?.qrImageUrl ?? null,
          snapToken:
            (payment.qrisPayload as { snapToken?: string } | null)?.snapToken ?? null,
          redirectUrl:
            (payment.qrisPayload as { redirectUrl?: string } | null)?.redirectUrl ?? null,
          expiresAt: payment.expiresAt?.toISOString() ?? null,
          paidAt: payment.paidAt?.toISOString() ?? null,
        }
      : null,
  });
}

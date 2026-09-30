import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, payments } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getPaymentDriver } from '@/lib/payment-driver';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Charge QRIS (F4): buat/ambil payload QR untuk booking `menunggu_pembayaran`.
 * Idempoten — charge ulang selama belum kedaluwarsa mengembalikan payload sama
 * (mock: `MOCK-QRIS:ORD-<kode>:<amount>`). Driver Midtrans menyusul (ADR 0007).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const rl = rateLimit(`payments-charge:${code}`, 10, 60_000);
  if (!rl.allowed) return jsonError('Terlalu banyak percobaan, coba lagi sebentar', 429);

  const rows = await db.select().from(bookings).where(eq(bookings.code, code)).limit(1);
  const booking = rows[0];
  if (!booking) return jsonError('Booking tidak ditemukan', 404);
  if (booking.status === 'terkonfirmasi') {
    return jsonError('Booking sudah terbayar', 409);
  }
  if (booking.status !== 'menunggu_pembayaran') {
    return jsonError('Booking sudah dibatalkan atau kedaluwarsa', 409);
  }
  if (booking.expiresAt && booking.expiresAt.getTime() <= Date.now()) {
    return jsonError('Batas waktu pembayaran 15 menit habis. Slot akan dibuka kembali.', 409);
  }

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, booking.id))
    .limit(1);
  let payment = paymentRows[0];
  if (!payment) {
    const inserted = await db
      .insert(payments)
      .values({
        bookingId: booking.id,
        gateway: 'mock',
        orderId: `ORD-${booking.code}`,
        amount: booking.subtotal,
        status: 'pending',
        expiresAt: booking.expiresAt,
      })
      .returning();
    payment = inserted[0];
  }
  if (payment.status === 'paid') {
    return jsonOk({
      payment: {
        orderId: payment.orderId,
        amount: payment.amount,
        status: payment.status,
        qrString: (payment.qrisPayload as { qrString?: string } | null)?.qrString ?? null,
        expiresAt: payment.expiresAt?.toISOString() ?? null,
      },
      booking: {
        code: booking.code,
        status: booking.status,
        expiresAt: booking.expiresAt?.toISOString() ?? null,
      },
      already: true,
    });
  }

  const driver = getPaymentDriver();
  const charge = await driver.createQrisCharge({
    orderId: payment.orderId ?? `ORD-${booking.code}`,
    amount: booking.subtotal,
    bookingCode: booking.code,
  });

  // Sumber kebenaran expiry tetap `bookings.expiresAt` (server-side, ADR 0006).
  const updated = await db
    .update(payments)
    .set({
      gateway: driver.name,
      status: 'pending',
      qrisPayload: { qrString: charge.qrString, raw: charge.raw },
      expiresAt: booking.expiresAt,
    })
    .where(eq(payments.id, payment.id))
    .returning();

  return jsonOk({
    payment: {
      orderId: updated[0].orderId,
      amount: updated[0].amount,
      status: updated[0].status,
      qrString: charge.qrString,
      expiresAt: booking.expiresAt?.toISOString() ?? null,
    },
    booking: {
      code: booking.code,
      status: booking.status,
      expiresAt: booking.expiresAt?.toISOString() ?? null,
    },
  });
}

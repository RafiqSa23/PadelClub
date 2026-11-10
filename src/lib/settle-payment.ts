import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, payments } from '@/db/schema';
import { getPaymentDriver, type PaymentStatusResult } from './payment-driver';
import { bumpSlotsVersion } from './slot-status';

/**
 * Transisi pembayaran terpusat (dipakai webhook + polling status) agar
 * keduanya tidak menduplikasi logika dan tetap idempoten.
 */

/** Booking lunas: `menunggu_pembayaran → terkonfirmasi`, payment `pending → paid`. */
export async function confirmBookingPaid(
  paymentId: number,
  bookingId: number,
  bookingDate: string,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(bookings)
      .set({ status: 'terkonfirmasi', expiresAt: null, updatedAt: now })
      .where(eq(bookings.id, bookingId));
    await tx
      .update(payments)
      .set({ status: 'paid', paidAt: now })
      .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending')));
  });
  bumpSlotsVersion(bookingDate);
}

/** Booking gagal/kedaluwarsa: booking → `dibatalkan`, payment `pending → expired`. */
export async function expireBookingPayment(
  paymentId: number,
  bookingId: number,
  bookingDate: string,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(bookings)
      .set({ status: 'dibatalkan', updatedAt: now })
      .where(eq(bookings.id, bookingId));
    await tx
      .update(payments)
      .set({ status: 'expired' })
      .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending')));
  });
  bumpSlotsVersion(bookingDate);
}

export type ReconcileResult = 'paid' | 'expired' | 'pending' | 'skipped';

/**
 * Tanyakan status asli ke gateway Midtrans lalu selaraskan DB (idempoten).
 * Dipakai polling `GET /api/payments/:code/status` agar pembayaran terdeteksi
 * tanpa menunggu webhook (mis. `APP_PUBLIC_URL` kosong di lokal).
 * Gagal menghubungi gateway → `'skipped'` (panggil fallback ke data DB).
 */
export async function reconcileMidtransStatus(orderId: string): Promise<ReconcileResult> {
  const driver = getPaymentDriver();
  if (driver.name !== 'midtrans') return 'skipped';

  let live: PaymentStatusResult | null;
  try {
    live = await driver.getStatus(orderId);
  } catch {
    return 'skipped';
  }
  if (!live) return 'skipped';

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .limit(1);
  const payment = paymentRows[0];
  if (!payment || payment.status !== 'pending') return 'skipped';

  const bookingRows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, payment.bookingId))
    .limit(1);
  const booking = bookingRows[0];
  if (!booking || booking.status !== 'menunggu_pembayaran') return 'skipped';

  if (live.status === 'paid') {
    await confirmBookingPaid(payment.id, booking.id, booking.bookingDate);
    return 'paid';
  }
  if (live.status === 'expired') {
    await expireBookingPayment(payment.id, booking.id, booking.bookingDate);
    return 'expired';
  }
  return 'pending';
}

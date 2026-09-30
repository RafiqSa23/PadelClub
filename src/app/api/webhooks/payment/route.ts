import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, payments } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { resolveCustomer } from '@/lib/bookings';
import { getPaymentDriver } from '@/lib/payment-driver';
import { mockSendNotification } from '@/lib/notify-driver';

const PAID_STATUSES = new Set(['paid', 'settlement', 'capture']);
const EXPIRED_STATUSES = new Set(['expire', 'expiry', 'cancel', 'cancelled', 'deny', 'failed']);

/**
 * Webhook pembayaran (F4): `PAID` → booking otomatis `terkonfirmasi`.
 * Idempoten (panggilan ganda aman) + verifikasi signature via PaymentDriver
 * (mock: cek orderId; Midtrans: SHA-512 — ADR 0007).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    orderId?: string;
    status?: string;
    amount?: number;
    signature?: string;
  } | null;
  if (!body || typeof body.orderId !== 'string' || typeof body.status !== 'string') {
    return jsonError('orderId dan status wajib diisi', 400);
  }

  const driver = getPaymentDriver();
  const valid = await driver.verifyWebhook({
    orderId: body.orderId,
    status: body.status,
    amount: body.amount,
    signature: body.signature,
  });
  if (!valid) return jsonError('Signature webhook tidak valid', 401);

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, body.orderId))
    .limit(1);
  const payment = paymentRows[0];
  if (!payment) return jsonError('Order tidak ditemukan', 404);

  const bookingRows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, payment.bookingId))
    .limit(1);
  const booking = bookingRows[0];
  if (!booking) return jsonError('Booking tidak ditemukan', 404);

  const normalized = body.status.toLowerCase();

  // Idempoten: sudah final dengan hasil yang sama → OK tanpa efek ganda.
  if (PAID_STATUSES.has(normalized) && booking.status === 'terkonfirmasi' && payment.status === 'paid') {
    return jsonOk({ booking: { code: booking.code, status: booking.status }, already: true });
  }

  const now = new Date();

  if (PAID_STATUSES.has(normalized)) {
    if (booking.status !== 'menunggu_pembayaran') {
      return jsonError('Booking sudah tidak menunggu pembayaran', 409);
    }
    await db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({ status: 'terkonfirmasi', expiresAt: null, updatedAt: now })
        .where(eq(bookings.id, booking.id));
      await tx
        .update(payments)
        .set({ status: 'paid', paidAt: now })
        .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')));
    });
    // Tiket dikirim otomatis (mock log; provider WA/Email final di Batch 6).
    try {
      const customer = await resolveCustomer(booking);
      await mockSendNotification({
        bookingId: booking.id,
        channel: 'whatsapp',
        type: 'tiket',
        to: customer.phone ?? '-',
        message: `Tiket ${booking.code} terkonfirmasi.`,
      });
    } catch {
      // Notifikasi best-effort — pembayaran tetap sah.
    }
    return jsonOk({ booking: { code: booking.code, status: 'terkonfirmasi' } });
  }

  if (EXPIRED_STATUSES.has(normalized)) {
    if (booking.status === 'dibatalkan') {
      return jsonOk({ booking: { code: booking.code, status: booking.status }, already: true });
    }
    await db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({ status: 'dibatalkan', updatedAt: now })
        .where(eq(bookings.id, booking.id));
      await tx
        .update(payments)
        .set({ status: 'expired' })
        .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')));
    });
    return jsonOk({ booking: { code: booking.code, status: 'dibatalkan' } });
  }

  return jsonError('Status webhook tidak dikenali', 400);
}

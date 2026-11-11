import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, payments } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getPaymentDriver } from '@/lib/payment-driver';
import { confirmBookingPaid, expireBookingPayment } from '@/lib/settle-payment';

const PAID_STATUSES = new Set(['paid', 'settlement', 'capture']);
const EXPIRED_STATUSES = new Set(['expire', 'expiry', 'cancel', 'cancelled', 'deny', 'failed']);

/**
 * Webhook pembayaran (F4): `PAID` → booking otomatis `terkonfirmasi`.
 * Idempoten (panggilan ganda aman) + verifikasi signature via PaymentDriver.
 *
 * Dua format body didukung:
 * - Mock/legacy (camelCase): `{ orderId, status, amount?, signature? }`
 * - Midtrans asli (snake_case): `{ order_id, transaction_status, status_code,
 *   gross_amount, signature_key, fraud_status, payment_type, ... }` —
 *   diverifikasi SHA-512(order_id+status_code+gross_amount+ServerKey) (ADR 0007).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError('Body JSON wajib diisi', 400);

  const isMidtransFormat =
    typeof body.order_id === 'string' || typeof body.signature_key === 'string';

  const orderId = isMidtransFormat
    ? (body.order_id as string | undefined)
    : (body.orderId as string | undefined);
  const rawStatus = isMidtransFormat
    ? (body.transaction_status as string | undefined)
    : (body.status as string | undefined);
  if (typeof orderId !== 'string' || typeof rawStatus !== 'string') {
    return jsonError('orderId/order_id dan status/transaction_status wajib diisi', 400);
  }

  const driver = getPaymentDriver();
  const valid = isMidtransFormat
    ? await driver.verifyWebhook({
        orderId,
        status: rawStatus,
        statusCode: body.status_code as string | undefined,
        grossAmount: body.gross_amount as string | number | undefined,
        signatureKey: body.signature_key as string | undefined,
        transactionStatus: rawStatus,
        fraudStatus: body.fraud_status as string | undefined,
        paymentType: body.payment_type as string | undefined,
      })
    : await driver.verifyWebhook({
        orderId,
        status: rawStatus,
        amount: body.amount as number | undefined,
        signature: body.signature as string | undefined,
      });
  if (!valid) return jsonError('Signature webhook tidak valid', 401);

  // Kriteria sukses Midtrans: status_code 200 + settlement/capture
  // (+ fraud accept bila field-nya ada; QRIS umumnya tanpa fraud_status).
  if (isMidtransFormat) {
    const statusCode = body.status_code as string | undefined;
    const fraudStatus = (body.fraud_status as string | undefined)?.toLowerCase();
    const normalized = rawStatus.toLowerCase();
    if (PAID_STATUSES.has(normalized)) {
      if (statusCode !== '200') return jsonError('Status code Midtrans bukan sukses', 400);
      if (fraudStatus && fraudStatus !== 'accept') {
        return jsonError('Transaksi belum dinyatakan accept oleh Midtrans', 409);
      }
    }
  }

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
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

  const normalized = rawStatus.toLowerCase();

  // Idempoten: sudah final dengan hasil yang sama → OK tanpa efek ganda.
  if (PAID_STATUSES.has(normalized) && booking.status === 'terkonfirmasi' && payment.status === 'paid') {
    return jsonOk({ booking: { code: booking.code, status: booking.status }, already: true });
  }

  if (PAID_STATUSES.has(normalized)) {
    if (booking.status !== 'menunggu_pembayaran') {
      return jsonError('Booking sudah tidak menunggu pembayaran', 409);
    }
    await confirmBookingPaid(payment.id, booking.id, booking.bookingDate);
    return jsonOk({ booking: { code: booking.code, status: 'terkonfirmasi' } });
  }

  if (EXPIRED_STATUSES.has(normalized)) {
    if (booking.status === 'dibatalkan') {
      return jsonOk({ booking: { code: booking.code, status: booking.status }, already: true });
    }
    await expireBookingPayment(payment.id, booking.id, booking.bookingDate);
    return jsonOk({ booking: { code: booking.code, status: 'dibatalkan' } });
  }

  return jsonError('Status webhook tidak dikenali', 400);
}

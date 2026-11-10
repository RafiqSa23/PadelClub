import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, payments } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { resolveCustomer } from '@/lib/bookings';
import {
  DuplicateOrderIdError,
  getPaymentDriver,
  type QrisChargeResult,
  type SnapTransactionResult,
} from '@/lib/payment-driver';
import { rateLimit } from '@/lib/rate-limit';

type StoredPayload = {
  qrString?: string;
  qrImageUrl?: string;
  snapToken?: string;
  redirectUrl?: string;
};

/**
 * Charge pembayaran (F4) untuk booking `menunggu_pembayaran`. Idempoten —
 * charge ulang selama belum kedaluwarsa mengembalikan payload sama.
 *
 * - Driver `midtrans` (ADR 0008): transaksi **Snap popup** (`snapToken`).
 * - Driver `mock`: QR berupa payload teks `MOCK-QRIS:…` (dekoratif).
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

  const stored = (payment.qrisPayload ?? null) as StoredPayload | null;
  const bookingPart = {
    code: booking.code,
    status: booking.status,
    expiresAt: booking.expiresAt?.toISOString() ?? null,
  };
  const storedResponse = () =>
    jsonOk({
      payment: {
        orderId: payment.orderId,
        amount: payment.amount,
        status: payment.status,
        gateway: payment.gateway,
        qrString: stored?.qrString ?? null,
        qrImageUrl: stored?.qrImageUrl ?? null,
        snapToken: stored?.snapToken ?? null,
        redirectUrl: stored?.redirectUrl ?? null,
        expiresAt: payment.expiresAt?.toISOString() ?? null,
      },
      booking: bookingPart,
      already: true,
    });

  if (payment.status === 'paid') return storedResponse();

  const driver = getPaymentDriver();
  const customer = await resolveCustomer(booking);
  let orderId = payment.orderId ?? `ORD-${booking.code}`;

  // ---- Jalur Snap (Midtrans) ----
  if (driver.name === 'midtrans') {
    const expiryMinutes = booking.expiresAt
      ? Math.max(1, Math.round((booking.expiresAt.getTime() - Date.now()) / 60_000))
      : 15;
    let snap: SnapTransactionResult;
    try {
      snap = await driver.createSnapTransaction({
        orderId,
        amount: booking.subtotal,
        bookingCode: booking.code,
        customerName: customer.name,
        customerPhone: customer.phone,
        expiryMinutes,
      });
    } catch (err) {
      if (!(err instanceof DuplicateOrderIdError)) throw err;
      // Order ID bentrok di Midtrans (406): cek status aslinya.
      const live = await driver.getStatus(orderId);
      if (live?.status === 'paid') {
        return jsonError('Pembayaran sudah tercatat lunas. Muat ulang status.', 409);
      }
      if (live?.status === 'pending' && stored?.snapToken) {
        return storedResponse();
      }
      // Transaksi lama expired/gagal/hilang — buat order ID baru sekali coba.
      orderId = `ORD-${booking.code}-R${Date.now().toString(36).toUpperCase()}`;
      await db.update(payments).set({ orderId }).where(eq(payments.id, payment.id));
      snap = await driver.createSnapTransaction({
        orderId,
        amount: booking.subtotal,
        bookingCode: booking.code,
        customerName: customer.name,
        customerPhone: customer.phone,
        expiryMinutes,
      });
    }

    // Sumber kebenaran expiry tetap `bookings.expiresAt` (server-side, ADR 0006).
    const updated = await db
      .update(payments)
      .set({
        gateway: driver.name,
        orderId: snap.orderId,
        status: 'pending',
        qrisPayload: {
          snapToken: snap.token,
          redirectUrl: snap.redirectUrl,
          raw: snap.raw,
        },
        expiresAt: booking.expiresAt,
      })
      .where(eq(payments.id, payment.id))
      .returning();

    return jsonOk({
      payment: {
        orderId: updated[0].orderId,
        amount: updated[0].amount,
        status: updated[0].status,
        gateway: driver.name,
        qrString: null,
        qrImageUrl: null,
        snapToken: snap.token,
        redirectUrl: snap.redirectUrl,
        expiresAt: booking.expiresAt?.toISOString() ?? null,
      },
      booking: bookingPart,
    });
  }

  // ---- Jalur QR mock ----
  let charge: QrisChargeResult;
  try {
    charge = await driver.createQrisCharge({
      orderId,
      amount: booking.subtotal,
      bookingCode: booking.code,
      customerPhone: customer.phone,
    });
  } catch (err) {
    if (!(err instanceof DuplicateOrderIdError)) throw err;
    if (stored?.qrString) return storedResponse();
    throw err;
  }

  // Sumber kebenaran expiry tetap `bookings.expiresAt` (server-side, ADR 0006).
  const updated = await db
    .update(payments)
    .set({
      gateway: driver.name,
      orderId: charge.orderId,
      gatewayRef: charge.transactionId ?? null,
      status: 'pending',
      qrisPayload: {
        qrString: charge.qrString,
        qrImageUrl: charge.qrImageUrl ?? null,
        transactionId: charge.transactionId ?? null,
        raw: charge.raw,
      },
      expiresAt: booking.expiresAt,
    })
    .where(eq(payments.id, payment.id))
    .returning();

  return jsonOk({
    payment: {
      orderId: updated[0].orderId,
      amount: updated[0].amount,
      status: updated[0].status,
      gateway: driver.name,
      qrString: charge.qrString,
      qrImageUrl: charge.qrImageUrl ?? null,
      snapToken: null,
      redirectUrl: null,
      expiresAt: booking.expiresAt?.toISOString() ?? null,
    },
    booking: bookingPart,
  });
}

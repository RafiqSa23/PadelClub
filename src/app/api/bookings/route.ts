import { cookies } from 'next/headers';
import { db } from '@/db';
import { courts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { jsonError, jsonOk } from '@/lib/api';
import { ConflictError, createBookingTx } from '@/lib/bookings';
import { verifyCustomerSession, CUSTOMER_SESSION_COOKIE } from '@/lib/session';
import { isValidDateString } from '@/lib/slots';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Buat booking online (F2): pelanggan terautentikasi (sesi OTP) menahan slot.
 * Hasil awal selalu `menunggu_pembayaran` (+15 mnt); pelunasan di Batch 4.
 */
export async function POST(request: Request) {
  const store = await cookies();
  const session = verifyCustomerSession(store.get(CUSTOMER_SESSION_COOKIE)?.value ?? '');
  if (!session) return jsonError('Login dengan OTP terlebih dahulu', 401);

  const rl = rateLimit(`bookings:${session.uid}`, 10, 60_000);
  if (!rl.allowed) return jsonError('Terlalu banyak percobaan, coba lagi sebentar', 429);

  const body = (await request.json().catch(() => null)) as {
    courtId?: number;
    date?: string;
    hours?: number[];
  } | null;
  if (!body || typeof body.courtId !== 'number' || !body.date || !Array.isArray(body.hours)) {
    return jsonError('courtId, date (YYYY-MM-DD), dan hours[] wajib diisi', 400);
  }
  if (!isValidDateString(body.date)) {
    return jsonError('Format date wajib YYYY-MM-DD', 400);
  }
  const today = new Date().toISOString().slice(0, 10);
  if (body.date < today) {
    return jsonError('Tanggal sudah lewat', 400);
  }

  try {
    const { booking, hours, payment } = await createBookingTx({
      courtId: body.courtId,
      date: body.date,
      hours: body.hours,
      userId: session.uid,
      source: 'online',
      paid: false,
      gateway: 'mock',
    });
    const courtRows = await db.select().from(courts).where(eq(courts.id, booking.courtId)).limit(1);
    return jsonOk(
      {
        booking: {
          code: booking.code,
          courtId: booking.courtId,
          courtName: courtRows[0]?.name ?? null,
          date: booking.bookingDate,
          hours,
          status: booking.status,
          subtotal: booking.subtotal,
          expiresAt: booking.expiresAt?.toISOString() ?? null,
        },
        payment: {
          orderId: payment.orderId,
          amount: payment.amount,
          status: payment.status,
          expiresAt: payment.expiresAt?.toISOString() ?? null,
        },
      },
      201,
    );
  } catch (err) {
    if (err instanceof ConflictError) return jsonError(err.message, 409);
    throw err;
  }
}

import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { bookingSlots, bookings, courts } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { CUSTOMER_SESSION_COOKIE, verifyCustomerSession } from '@/lib/session';

/** Riwayat booking milik sesi pelanggan (dipakai `/riwayat` Batch 2). */
export async function GET() {
  const store = await cookies();
  const session = verifyCustomerSession(store.get(CUSTOMER_SESSION_COOKIE)?.value ?? '');
  if (!session) return jsonError('Login dengan OTP terlebih dahulu', 401);

  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      courtId: bookings.courtId,
      courtName: courts.name,
      date: bookings.bookingDate,
      status: bookings.status,
      source: bookings.source,
      subtotal: bookings.subtotal,
      createdAt: bookings.createdAt,
      hour: bookingSlots.hour,
    })
    .from(bookings)
    .innerJoin(courts, eq(bookings.courtId, courts.id))
    .innerJoin(bookingSlots, eq(bookingSlots.bookingId, bookings.id))
    .where(eq(bookings.userId, session.uid));

  const byId = new Map<
    number,
    {
      code: string;
      courtId: number;
      courtName: string;
      date: string;
      status: string;
      source: string;
      subtotal: number;
      createdAt: Date;
      hours: number[];
    }
  >();
  for (const r of rows) {
    const entry = byId.get(r.id) ?? {
      code: r.code,
      courtId: r.courtId,
      courtName: r.courtName,
      date: r.date,
      status: r.status,
      source: r.source,
      subtotal: r.subtotal,
      createdAt: r.createdAt,
      hours: [],
    };
    entry.hours.push(r.hour);
    byId.set(r.id, entry);
  }
  const result = [...byId.values()].map((b) => ({
    ...b,
    hours: b.hours.sort((a, c) => a - c),
    createdAt: b.createdAt.toISOString(),
  }));

  return jsonOk({ bookings: result });
}

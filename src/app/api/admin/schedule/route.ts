import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookingSlots, bookings, users } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { getDaySchedule, isValidDateString } from '@/lib/slots';

/**
 * Jadwal harian untuk admin (F7 read-model): grid slot + detail booking
 * per slot untuk modal (tanpa pindah halaman).
 */
export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') ?? '';
  if (!isValidDateString(date)) {
    return jsonError('Parameter date wajib format YYYY-MM-DD', 400);
  }

  const schedule = await getDaySchedule(date);

  const rows = await db
    .select({
      bookingId: bookings.id,
      code: bookings.code,
      courtId: bookings.courtId,
      status: bookings.status,
      source: bookings.source,
      subtotal: bookings.subtotal,
      guestName: bookings.guestName,
      guestPhone: bookings.guestPhone,
      userName: users.name,
      userPhone: users.phone,
      hour: bookingSlots.hour,
    })
    .from(bookings)
    .innerJoin(bookingSlots, eq(bookingSlots.bookingId, bookings.id))
    .leftJoin(users, eq(bookings.userId, users.id))
    .where(eq(bookings.bookingDate, date));

  // Kelompokkan jam per booking.
  const byId = new Map<
    number,
    {
      id: number;
      code: string;
      courtId: number;
      status: string;
      source: string;
      subtotal: number;
      customerName: string | null;
      customerPhone: string | null;
      hours: number[];
    }
  >();
  for (const r of rows) {
    if (r.status === 'dibatalkan') continue;
    const entry = byId.get(r.bookingId) ?? {
      id: r.bookingId,
      code: r.code,
      courtId: r.courtId,
      status: r.status,
      source: r.source,
      subtotal: r.subtotal,
      customerName: r.guestName ?? r.userName ?? null,
      customerPhone: r.guestPhone ?? r.userPhone ?? null,
      hours: [],
    };
    entry.hours.push(r.hour);
    byId.set(r.bookingId, entry);
  }
  const bookingList = [...byId.values()].map((b) => ({ ...b, hours: b.hours.sort((x, y) => x - y) }));

  return jsonOk({ schedule, bookings: bookingList });
}

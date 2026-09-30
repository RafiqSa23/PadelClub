import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, closures } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { getDaySchedule, isValidDateString } from '@/lib/slots';
import { todayString } from '@/lib/format';

/**
 * Ringkasan harian untuk dashboard admin (F7): KPI omzet/okupansi/antrean,
 * daftar hampir-kedaluwarsa, dan status fisik lapangan (closure hari itu).
 */
export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') ?? todayString();
  if (!isValidDateString(date)) {
    return jsonError('Format date wajib YYYY-MM-DD', 400);
  }

  const schedule = await getDaySchedule(date);
  const totalSlots = schedule.slots.length;

  const dayBookings = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      courtId: bookings.courtId,
      status: bookings.status,
      source: bookings.source,
      subtotal: bookings.subtotal,
      expiresAt: bookings.expiresAt,
      guestName: bookings.guestName,
      guestPhone: bookings.guestPhone,
    })
    .from(bookings)
    .where(eq(bookings.bookingDate, date));

  const active = dayBookings.filter((b) => b.status !== 'dibatalkan');
  const confirmed = active.filter((b) => b.status === 'terkonfirmasi');
  const waiting = active.filter((b) => b.status === 'menunggu_pembayaran');
  const cancelled = dayBookings.filter((b) => b.status === 'dibatalkan').length;

  const omzet = confirmed.reduce((sum, b) => sum + b.subtotal, 0);
  const occupiedSlots = schedule.slots.filter((s) => s.status !== 'kosong').length;
  const occupancy = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

  const now = Date.now();
  const expiring = waiting
    .filter(
      (b) =>
        b.expiresAt &&
        b.expiresAt.getTime() > now &&
        b.expiresAt.getTime() <= now + 5 * 60_000,
    )
    .map((b) => ({
      code: b.code,
      courtId: b.courtId,
      customerName: b.guestName,
      customerPhone: b.guestPhone,
      expiresAt: b.expiresAt?.toISOString() ?? null,
    }));

  const closureRows = await db.select().from(closures).where(eq(closures.closureDate, date));

  return jsonOk({
    date,
    kpi: {
      omzet,
      occupancy,
      totalSlots,
      occupiedSlots,
      freeSlots: totalSlots - occupiedSlots,
      totalBookings: active.length,
      confirmed: confirmed.length,
      waiting: waiting.length,
      cancelled,
      expiringCount: expiring.length,
    },
    expiring,
    closures: closureRows,
  });
}

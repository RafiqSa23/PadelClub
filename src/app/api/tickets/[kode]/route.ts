import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookingSlots, bookings, closures, courts, payments } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { resolveCustomer } from '@/lib/bookings';

/**
 * Tiket publik via kode (F5): dibuka tanpa login (kode unik per booking).
 * Memuat seluruh field tiket (AC F5) + status check-in + pemberitahuan
 * jelas bila booking Batal atau jadwalnya ketiban penutupan (Tutup).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kode: string }> },
) {
  const { kode } = await params;

  const rows = await db.select().from(bookings).where(eq(bookings.code, kode)).limit(1);
  const booking = rows[0];
  if (!booking) return jsonError('Tiket tidak ditemukan', 404);

  const [slotRows, courtRows, paymentRows, closureRows] = await Promise.all([
    db.select().from(bookingSlots).where(eq(bookingSlots.bookingId, booking.id)),
    db.select().from(courts).where(eq(courts.id, booking.courtId)).limit(1),
    db.select().from(payments).where(eq(payments.bookingId, booking.id)).limit(1),
    db
      .select()
      .from(closures)
      .where(
        and(
          eq(closures.courtId, booking.courtId),
          eq(closures.closureDate, booking.bookingDate),
        ),
      ),
  ]);
  const customer = await resolveCustomer(booking);
  const hours = slotRows.map((s) => s.hour).sort((a, b) => a - b);

  // Penutupan yang menimpa jam booking (mis. maintenance susulan) → notice Tutup.
  let closureNotice: string | null = null;
  for (const c of closureRows) {
    const hits =
      c.startHour == null || c.endHour == null
        ? hours.length > 0
        : hours.some((h) => h >= c.startHour! && h < c.endHour!);
    if (hits) {
      closureNotice = c.reason
        ? `Jadwal ini terdampak penutupan: ${c.reason}. Hubungi resepsionis untuk penjadwalan ulang.`
        : 'Jadwal ini terdampak penutupan lapangan. Hubungi resepsionis untuk penjadwalan ulang.';
      break;
    }
  }

  const court = courtRows[0];
  const payment = paymentRows[0];

  return jsonOk({
    ticket: {
      code: booking.code,
      courtId: booking.courtId,
      courtName: court?.name ?? null,
      description: court?.description ?? null,
      isIndoor: court?.isIndoor ?? null,
      date: booking.bookingDate,
      hours,
      status: booking.status,
      source: booking.source,
      subtotal: booking.subtotal,
      expiresAt: booking.expiresAt?.toISOString() ?? null,
      customerName: customer.name,
      customerPhone: customer.phone,
      paymentStatus: payment?.status ?? null,
      paidAt: payment?.paidAt?.toISOString() ?? null,
      checkedInAt: booking.checkedInAt?.toISOString() ?? null,
      checkedInBy: booking.checkedInBy ?? null,
      closureNotice,
    },
  });
}

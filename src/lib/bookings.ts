import { and, eq, inArray, ne } from 'drizzle-orm';
import { db } from '@/db';
import {
  bookingSlots,
  bookings,
  closures,
  courtHours,
  courts,
  payments,
  users,
} from '@/db/schema';
import { uniqueBookingCode } from './booking-code';
import { dayOfWeekOf } from './slots';

export const BOOKING_EXPIRY_MINUTES = 15; // ADR 0006

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export interface CreateBookingInput {
  courtId: number;
  date: string;
  hours: number[];
  userId?: number | null;
  guestName?: string | null;
  guestPhone?: string | null;
  source: 'online' | 'walkin';
  /** true = langsung terkonfirmasi (walk-in tunai). Online selalu false saat create. */
  paid: boolean;
  gateway: string;
}

function isUniqueViolation(err: unknown): boolean {
  const code = (err as { cause?: { code?: string } })?.cause?.code
    ?? (err as { code?: string })?.code;
  return code === '23505';
}

async function courtPrice(courtId: number): Promise<{ price: number; name: string }> {
  const rows = await db.select().from(courts).where(eq(courts.id, courtId)).limit(1);
  const court = rows[0];
  if (!court || !court.isActive) throw new ConflictError('Lapangan tidak tersedia.');
  return { price: court.hourlyPrice, name: court.name };
}

async function openClose(courtId: number, dow: number): Promise<{ open: number; close: number }> {
  const rows = await db
    .select()
    .from(courtHours)
    .where(and(eq(courtHours.courtId, courtId), eq(courtHours.dayOfWeek, dow)))
    .limit(1);
  const row = rows[0];
  if (!row) return { open: 7, close: 23 };
  return {
    open: Number(String(row.openTime).slice(0, 2)),
    close: Number(String(row.closeTime).slice(0, 2)),
  };
}

/**
 * Buat booking dalam satu transaksi (anti-overbooking):
 * validasi berurutan → cek jam operasional → cek closure → cek slot aktif →
 * insert bookings + booking_slots + payments. Konflik unik → ConflictError (409).
 */
export async function createBookingTx(input: CreateBookingInput) {
  const hours = [...new Set(input.hours)].sort((a, b) => a - b);
  if (hours.length === 0) throw new ConflictError('Pilih minimal 1 jam.');
  if (hours.some((h) => !Number.isInteger(h) || h < 0 || h > 23)) {
    throw new ConflictError('Jam harus bilangan 0–23.');
  }
  if (hours[hours.length - 1] - hours[0] + 1 !== hours.length) {
    throw new ConflictError('Hanya jam berurutan dalam satu lapangan yang dibolehkan.');
  }

  const { price } = await courtPrice(input.courtId);
  const { open, close } = await openClose(input.courtId, dayOfWeekOf(input.date));
  if (hours.some((h) => h < open || h >= close)) {
    throw new ConflictError('Jam di luar operasional lapangan.');
  }

  const now = new Date();

  // Closure yang menabrak jam diminta?
  const closureRows = await db
    .select()
    .from(closures)
    .where(and(eq(closures.courtId, input.courtId), eq(closures.closureDate, input.date)));
  for (const c of closureRows) {
    if (c.startHour == null || c.endHour == null) {
      throw new ConflictError('Lapangan tutup sehari pada tanggal tersebut.');
    }
    if (hours.some((h) => h >= c.startHour! && h < c.endHour!)) {
      throw new ConflictError('Sebagian jam bersinggungan dengan jadwal tutup/maintenance.');
    }
  }

  // Slot yang sudah dihuni booking aktif?
  const taken = await db
    .select({ hour: bookingSlots.hour, expiresAt: bookings.expiresAt, status: bookings.status })
    .from(bookingSlots)
    .innerJoin(bookings, eq(bookingSlots.bookingId, bookings.id))
    .where(
      and(
        eq(bookingSlots.courtId, input.courtId),
        eq(bookingSlots.slotDate, input.date),
        inArray(bookingSlots.hour, hours),
        ne(bookings.status, 'dibatalkan'),
      ),
    );
  const blocked = taken.filter(
    (t) =>
      t.status === 'terkonfirmasi' ||
      (t.status === 'menunggu_pembayaran' &&
        (!t.expiresAt || t.expiresAt.getTime() > now.getTime())),
  );
  if (blocked.length > 0) {
    throw new ConflictError('Slot sudah dipesan pihak lain. Pilih jam lain.');
  }

  const subtotal = hours.length * price;
  const code = await uniqueBookingCode();
  const status = input.paid ? 'terkonfirmasi' : 'menunggu_pembayaran';
  const expiresAt = input.paid ? null : new Date(now.getTime() + BOOKING_EXPIRY_MINUTES * 60_000);

  try {
    return await db.transaction(async (tx) => {
      const insertedBooking = await tx
        .insert(bookings)
        .values({
          code,
          courtId: input.courtId,
          userId: input.userId ?? null,
          guestName: input.guestName ?? null,
          guestPhone: input.guestPhone ?? null,
          bookingDate: input.date,
          status,
          source: input.source,
          subtotal,
          expiresAt,
        })
        .returning();
      const booking = insertedBooking[0];

      await tx.insert(bookingSlots).values(
        hours.map((hour) => ({
          bookingId: booking.id,
          courtId: input.courtId,
          slotDate: input.date,
          hour,
        })),
      );

      const insertedPayment = await tx
        .insert(payments)
        .values({
          bookingId: booking.id,
          gateway: input.gateway,
          orderId: `ORD-${code}`,
          amount: subtotal,
          status: input.paid ? 'paid' : 'pending',
          expiresAt,
          paidAt: input.paid ? now : null,
        })
        .returning();
      const payment = insertedPayment[0];

      return { booking, hours, payment };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('Slot baru saja dipesan pihak lain. Pilih jam lain.');
    }
    throw err;
  }
}

/** Nama/HP penampil untuk booking (tamu diutamakan, fallback user). */
export async function resolveCustomer(
  booking: Pick<typeof bookings.$inferSelect, 'guestName' | 'guestPhone' | 'userId'>,
): Promise<{ name: string | null; phone: string | null }> {
  if (booking.guestName || booking.guestPhone) {
    return { name: booking.guestName, phone: booking.guestPhone };
  }
  if (booking.userId) {
    const rows = await db.select().from(users).where(eq(users.id, booking.userId)).limit(1);
    const u = rows[0];
    if (u) return { name: u.name, phone: u.phone };
  }
  return { name: null, phone: null };
}

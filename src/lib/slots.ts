import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { bookingSlots, bookings, closures, courtHours, courts } from '@/db/schema';

export type DaySlotStatus =
  | 'kosong'
  | 'menunggu_pembayaran'
  | 'terkonfirmasi'
  | 'tutup';

export interface DaySlot {
  courtId: number;
  hour: number;
  status: DaySlotStatus;
  code?: string | null;
  reason?: string | null;
}

export interface DaySchedule {
  date: string;
  dayOfWeek: number;
  courts: {
    id: number;
    name: string;
    hourlyPrice: number;
    isActive: boolean;
    isIndoor: boolean;
    description: string | null;
    openHour: number;
    closeHour: number;
  }[];
  slots: DaySlot[];
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

export function dayOfWeekOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

/**
 * Bangun jadwal 1 hari dari 4 sumber:
 * court_hours (jam operasional) + booking_slots⨝bookings (non-batal,
 * menunggu yang kedaluwarsa dianggap kosong) + closures.
 * Dipakai bersama F1 (customer), F7 (admin), F9 (closure).
 */
export async function getDaySchedule(dateStr: string): Promise<DaySchedule> {
  const dow = dayOfWeekOf(dateStr);
  const now = new Date();

  const [courtRows, hoursRows, bookingRows, closureRows] = await Promise.all([
    db
      .select({
        id: courts.id,
        name: courts.name,
        hourlyPrice: courts.hourlyPrice,
        isActive: courts.isActive,
        isIndoor: courts.isIndoor,
        description: courts.description,
      })
      .from(courts)
      .orderBy(courts.id),
    db.select().from(courtHours).where(eq(courtHours.dayOfWeek, dow)),
    db
      .select({
        courtId: bookingSlots.courtId,
        hour: bookingSlots.hour,
        status: bookings.status,
        code: bookings.code,
        expiresAt: bookings.expiresAt,
      })
      .from(bookingSlots)
      .innerJoin(bookings, eq(bookingSlots.bookingId, bookings.id))
      .where(
        and(eq(bookingSlots.slotDate, dateStr), ne(bookings.status, 'dibatalkan')),
      ),
    db.select().from(closures).where(eq(closures.closureDate, dateStr)),
  ]);

  const hoursByCourt = new Map<number, { openHour: number; closeHour: number }>();
  for (const h of hoursRows) {
    // court_hours.openTime/closeTime disimpan sebagai teks "HH:MM".
    const openHour = Number(String(h.openTime).slice(0, 2));
    const closeHour = Number(String(h.closeTime).slice(0, 2));
    if (Number.isFinite(openHour) && Number.isFinite(closeHour)) {
      hoursByCourt.set(h.courtId, { openHour, closeHour });
    }
  }

  // Default bila tidak ada baris court_hours untuk hari itu (seed awal hanya
  // men-contoh 1 hari): jam 07:00–23:00 agar grid tetap tampil.
  const scheduleCourts = courtRows.map((c) => {
    const fallback = { openHour: 7, closeHour: 23 };
    const hours = hoursByCourt.get(c.id) ?? fallback;
    return { ...c, ...hours };
  });

  // Booking aktif per (courtId, hour). Prioritas: terkonfirmasi > menunggu.
  const booked = new Map<string, { status: DaySlotStatus; code: string | null }>();
  for (const b of bookingRows) {
    if (b.status === 'menunggu_pembayaran' && b.expiresAt && b.expiresAt.getTime() < now.getTime()) {
      continue; // kedaluwarsa → dianggap kosong (dibersihkan cron expire)
    }
    const key = `${b.courtId}:${b.hour}`;
    const status: DaySlotStatus =
      b.status === 'terkonfirmasi' ? 'terkonfirmasi' : 'menunggu_pembayaran';
    const prev = booked.get(key);
    if (!prev || (prev.status === 'menunggu_pembayaran' && status === 'terkonfirmasi')) {
      booked.set(key, { status, code: b.code });
    }
  }

  const closedAt = (courtId: number, hour: number): string | null => {
    for (const c of closureRows) {
      if (c.courtId !== courtId) continue;
      if (c.startHour == null || c.endHour == null) return c.reason ?? 'Tutup';
      if (hour >= c.startHour && hour < c.endHour) return c.reason ?? 'Tutup';
    }
    return null;
  };

  const slots: DaySlot[] = [];
  for (const c of scheduleCourts) {
    if (!c.isActive) continue;
    for (let h = c.openHour; h < c.closeHour; h++) {
      const reason = closedAt(c.id, h);
      if (reason) {
        slots.push({ courtId: c.id, hour: h, status: 'tutup', reason });
        continue;
      }
      const b = booked.get(`${c.id}:${h}`);
      if (b) {
        slots.push({ courtId: c.id, hour: h, status: b.status, code: b.code });
      } else {
        slots.push({ courtId: c.id, hour: h, status: 'kosong' });
      }
    }
  }

  return { date: dateStr, dayOfWeek: dow, courts: scheduleCourts, slots };
}

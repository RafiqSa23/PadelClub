import { sql } from 'drizzle-orm';
import { db } from '@/db';

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
  /**
   * Batas bayar untuk slot `menunggu_pembayaran`. Dikirim ke klien supaya
   * kartu kuning bisa berubah hijau tepat saat kedaluwarsa tanpa menunggu poll.
   */
  expiresAt?: string | null;
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

export interface DaySummary {
  date: string;
  freeCount: number;
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

export function dayOfWeekOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

/** Jam operasional cadangan bila `court_hours` tidak punya baris untuk hari itu. */
const FALLBACK_OPEN = 7;
const FALLBACK_CLOSE = 23;

interface CourtRow {
  id: number;
  name: string;
  hourlyPrice: number;
  isActive: boolean;
  isIndoor: boolean;
  description: string | null;
}

interface HourRow {
  courtId: number;
  openTime: string;
  closeTime: string;
}

interface BookingRow {
  courtId: number;
  hour: number;
  status: string;
  code: string | null;
  expiresAt: string | null;
}

interface ClosureRow {
  courtId: number;
  startHour: number | null;
  endHour: number | null;
  reason: string | null;
}

/**
 * Semua bahan jadwal 1 hari dalam SATU roundtrip (4 CTE + json_agg).
 * Sebelumnya 4 query paralel — dengan pool `max: 5`, satu request menghabiskan
 * 4 koneksi sekaligus sehingga beberapa pengunjung bersamaan saling mengantre.
 */
async function fetchDayInputs(
  dateStr: string,
  dow: number,
): Promise<{
  courts: CourtRow[];
  hours: HourRow[];
  bookings: BookingRow[];
  closures: ClosureRow[];
}> {
  const rows = (await db.execute(sql`
    WITH day_courts AS (
      SELECT id, name, "hourlyPrice", "isActive", "isIndoor", description
      FROM courts
      ORDER BY id
    ), day_hours AS (
      SELECT "courtId", "openTime", "closeTime"
      FROM court_hours
      WHERE "dayOfWeek" = ${dow}
    ), day_bookings AS (
      SELECT bs."courtId", bs.hour, bk.status, bk.code, bk."expiresAt"
      FROM booking_slots bs
      JOIN bookings bk ON bk.id = bs."bookingId"
      WHERE bs."slotDate" = ${dateStr}::date
        AND bk.status <> 'dibatalkan'
    ), day_closures AS (
      SELECT "courtId", "startHour", "endHour", reason
      FROM closures
      WHERE "closureDate" = ${dateStr}::date
    )
    SELECT
      (SELECT COALESCE(json_agg(dc), '[]'::json) FROM day_courts dc) AS courts,
      (SELECT COALESCE(json_agg(dh), '[]'::json) FROM day_hours dh) AS hours,
      (SELECT COALESCE(json_agg(dbk), '[]'::json) FROM day_bookings dbk) AS bookings,
      (SELECT COALESCE(json_agg(dcl), '[]'::json) FROM day_closures dcl) AS closures
  `)) as unknown as Array<{
    courts: CourtRow[];
    hours: HourRow[];
    bookings: BookingRow[];
    closures: ClosureRow[];
  }>;

  const row = rows[0];
  return {
    courts: row?.courts ?? [],
    hours: row?.hours ?? [],
    bookings: row?.bookings ?? [],
    closures: row?.closures ?? [],
  };
}

function hourOf(value: string): number | null {
  const hour = Number(String(value).slice(0, 2));
  return Number.isFinite(hour) ? hour : null;
}

/**
 * Bangun jadwal 1 hari dari 4 sumber:
 * court_hours (jam operasional) + booking_slots⨝bookings (non-batal,
 * menunggu yang kedaluwarsa dianggap kosong) + closures.
 * Dipakai bersama F1 (customer), F7 (admin), F9 (closure).
 */
export async function getDaySchedule(dateStr: string): Promise<DaySchedule> {
  const dow = dayOfWeekOf(dateStr);
  const now = Date.now();
  const { courts, hours, bookings, closures } = await fetchDayInputs(dateStr, dow);

  const hoursByCourt = new Map<number, { openHour: number; closeHour: number }>();
  for (const h of hours) {
    const openHour = hourOf(h.openTime);
    const closeHour = hourOf(h.closeTime);
    if (openHour != null && closeHour != null) hoursByCourt.set(h.courtId, { openHour, closeHour });
  }

  const scheduleCourts = courts.map((c) => ({
    ...c,
    ...(hoursByCourt.get(c.id) ?? { openHour: FALLBACK_OPEN, closeHour: FALLBACK_CLOSE }),
  }));

  // Booking aktif per (courtId, hour). Prioritas: terkonfirmasi > menunggu.
  const booked = new Map<
    string,
    { status: DaySlotStatus; code: string | null; expiresAt: string | null }
  >();
  for (const b of bookings) {
    const expiresAtMs = b.expiresAt ? new Date(b.expiresAt).getTime() : null;
    if (b.status === 'menunggu_pembayaran' && expiresAtMs != null && expiresAtMs < now) {
      continue; // kedaluwarsa → dianggap kosong (dibersihkan cron expire)
    }
    const key = `${b.courtId}:${b.hour}`;
    const status: DaySlotStatus =
      b.status === 'terkonfirmasi' ? 'terkonfirmasi' : 'menunggu_pembayaran';
    const prev = booked.get(key);
    if (!prev || (prev.status === 'menunggu_pembayaran' && status === 'terkonfirmasi')) {
      booked.set(key, { status, code: b.code, expiresAt: b.expiresAt });
    }
  }

  const closedAt = (courtId: number, hour: number): string | null => {
    for (const c of closures) {
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
        slots.push({
          courtId: c.id,
          hour: h,
          status: b.status,
          code: b.code,
          expiresAt: b.status === 'menunggu_pembayaran' ? b.expiresAt : null,
        });
      } else {
        slots.push({ courtId: c.id, hour: h, status: 'kosong' });
      }
    }
  }

  return { date: dateStr, dayOfWeek: dow, courts: scheduleCourts, slots };
}

/**
 * Jumlah slot kosong untuk rentang tanggal (strip minggu di `/booking`).
 * Satu query untuk semua hari — menggantikan 7 request × 4 query per page load.
 */
export async function getDaysSummary(from: string, to: string): Promise<DaySummary[]> {
  const rows = (await db.execute(sql`
    WITH days AS (
      SELECT generate_series(${from}::date, ${to}::date, interval '1 day')::date AS day
    ), capacity AS (
      SELECT d.day, SUM(h.close_hour - h.open_hour)::int AS slots
      FROM days d
      JOIN courts c ON c."isActive"
      LEFT JOIN court_hours ch
        ON ch."courtId" = c.id AND ch."dayOfWeek" = EXTRACT(DOW FROM d.day)::int
      CROSS JOIN LATERAL (
        SELECT
          COALESCE(EXTRACT(HOUR FROM ch."openTime"::time)::int, ${FALLBACK_OPEN}) AS open_hour,
          COALESCE(EXTRACT(HOUR FROM ch."closeTime"::time)::int, ${FALLBACK_CLOSE}) AS close_hour
      ) h
      GROUP BY d.day
    ), booked AS (
      SELECT bs."slotDate" AS day, COUNT(*)::int AS slots
      FROM booking_slots bs
      JOIN bookings bk ON bk.id = bs."bookingId"
      WHERE bs."slotDate" BETWEEN ${from}::date AND ${to}::date
        AND bk.status <> 'dibatalkan'
        AND (bk.status = 'terkonfirmasi' OR bk."expiresAt" IS NULL OR bk."expiresAt" > now())
      GROUP BY bs."slotDate"
    ), closed AS (
      SELECT cl."closureDate" AS day, SUM(
        CASE
          WHEN cl."startHour" IS NULL OR cl."endHour" IS NULL THEN 24
          ELSE cl."endHour" - cl."startHour"
        END
      )::int AS slots
      FROM closures cl
      WHERE cl."closureDate" BETWEEN ${from}::date AND ${to}::date
      GROUP BY cl."closureDate"
    )
    SELECT
      to_char(d.day, 'YYYY-MM-DD') AS date,
      GREATEST(
        COALESCE(capacity.slots, 0) - COALESCE(booked.slots, 0) - COALESCE(closed.slots, 0),
        0
      )::int AS "freeCount"
    FROM days d
    LEFT JOIN capacity ON capacity.day = d.day
    LEFT JOIN booked ON booked.day = d.day
    LEFT JOIN closed ON closed.day = d.day
    ORDER BY d.day
  `)) as unknown as Array<{ date: string; freeCount: number }>;

  return rows.map((row) => ({ date: row.date, freeCount: row.freeCount }));
}

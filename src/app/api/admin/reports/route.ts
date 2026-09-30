import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { bookingSlots, bookings, courtHours, courts } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { isValidDateString } from '@/lib/slots';

const MAX_RANGE_DAYS = 366;

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysIso(base: string, offset: number): string {
  // Aritmetika UTC murni — kebal offset zona waktu server.
  const [y, m, d] = base.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + offset * 86_400_000).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDaysIso(d, 1)) {
    days.push(d);
    if (days.length > MAX_RANGE_DAYS) break;
  }
  return days;
}

/**
 * Laporan admin (F11): omzet, total booking, batal, okupansi per lapangan
 * untuk rentang tanggal — JSON untuk dashboard, CSV server-side untuk ekspor
 * (`?format=csv`). Metrik F11 §AC terpenuhi; PDF di luar MVP.
 */
export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const today = todayLocal();
  const from = searchParams.get('from') ?? addDaysIso(today, -29);
  const to = searchParams.get('to') ?? today;
  const courtIdParam = searchParams.get('courtId') ?? '';
  const format = searchParams.get('format') ?? 'json';

  if (!isValidDateString(from) || !isValidDateString(to)) {
    return jsonError('from/to wajib format YYYY-MM-DD', 400);
  }
  if (to < from) return jsonError('Rentang tanggal tidak valid (to < from)', 400);
  if (format !== 'json' && format !== 'csv') {
    return jsonError('format wajib "json" atau "csv"', 400);
  }
  let courtId: number | null = null;
  if (courtIdParam) {
    courtId = Number(courtIdParam);
    if (!Number.isInteger(courtId) || courtId <= 0) {
      return jsonError('courtId tidak valid', 400);
    }
  }

  const days = daysBetween(from, to);
  if (days.length > MAX_RANGE_DAYS) {
    return jsonError(`Rentang maksimal ${MAX_RANGE_DAYS} hari`, 400);
  }

  const conditions = [gte(bookings.bookingDate, from), lte(bookings.bookingDate, to)];
  if (courtId) conditions.push(eq(bookings.courtId, courtId));

  const rows = await db
    .select({
      id: bookings.id,
      courtId: bookings.courtId,
      courtName: courts.name,
      isIndoor: courts.isIndoor,
      date: bookings.bookingDate,
      status: bookings.status,
      subtotal: bookings.subtotal,
      hour: bookingSlots.hour,
    })
    .from(bookings)
    .innerJoin(courts, eq(bookings.courtId, courts.id))
    .innerJoin(bookingSlots, eq(bookingSlots.bookingId, bookings.id))
    .where(and(...conditions));

  // Agregat per lapangan.
  const byCourt = new Map<
    number,
    {
      courtId: number;
      name: string;
      isIndoor: boolean;
      bookingIds: Set<number>;
      revenue: number;
      confirmedCount: number;
      occupiedSlots: number;
    }
  >();
  let omzet = 0;
  let totalBookings = 0;
  let cancelled = 0;
  let waiting = 0;
  const seenBooking = new Set<number>();

  for (const r of rows) {
    let entry = byCourt.get(r.courtId);
    if (!entry) {
      entry = {
        courtId: r.courtId,
        name: r.courtName,
        isIndoor: r.isIndoor,
        bookingIds: new Set(),
        revenue: 0,
        confirmedCount: 0,
        occupiedSlots: 0,
      };
      byCourt.set(r.courtId, entry);
    }
    if (r.status === 'terkonfirmasi') {
      entry.occupiedSlots += 1;
      if (!entry.bookingIds.has(r.id)) {
        entry.bookingIds.add(r.id);
        entry.revenue += r.subtotal;
        entry.confirmedCount += 1;
      }
      if (!seenBooking.has(r.id)) {
        seenBooking.add(r.id);
        omzet += r.subtotal;
        totalBookings += 1;
      }
    } else if (r.status === 'dibatalkan') {
      if (!seenBooking.has(r.id)) {
        seenBooking.add(r.id);
        cancelled += 1;
      }
    } else if (!seenBooking.has(r.id)) {
      seenBooking.add(r.id);
      waiting += 1;
    }
  }

  // Kapasitas: jam operasional per lapangan × hari dalam rentang.
  const scopeCourts = courtId
    ? await db.select().from(courts).where(eq(courts.id, courtId)).limit(1)
    : await db.select().from(courts);
  const hoursRows = await db.select().from(courtHours);
  const hoursByCourtDow = new Map<string, { open: number; close: number }>();
  for (const h of hoursRows) {
    hoursByCourtDow.set(
      `${h.courtId}:${h.dayOfWeek}`,
      {
        open: Number(String(h.openTime).slice(0, 2)),
        close: Number(String(h.closeTime).slice(0, 2)),
      },
    );
  }

  const courtReports = scopeCourts.map((c) => {
    const entry = byCourt.get(c.id);
    let totalSlots = 0;
    for (const day of days) {
      const dow = new Date(`${day}T00:00:00`).getDay();
      const oc = hoursByCourtDow.get(`${c.id}:${dow}`) ?? { open: 7, close: 23 };
      totalSlots += Math.max(0, oc.close - oc.open);
    }
    const occupied = entry?.occupiedSlots ?? 0;
    return {
      courtId: c.id,
      name: c.name,
      isIndoor: c.isIndoor,
      bookingCount: entry?.confirmedCount ?? 0,
      revenue: entry?.revenue ?? 0,
      occupiedSlots: occupied,
      totalSlots,
      occupancyPct: totalSlots ? Math.round((occupied / totalSlots) * 100) : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const avgOccupancy = courtReports.length
    ? Math.round(courtReports.reduce((s, r) => s + r.occupancyPct, 0) / courtReports.length)
    : 0;

  if (format === 'csv') {
    const header = ['Lapangan', 'Periode', 'Booking terkonfirmasi', 'Omzet', 'Okupansi', 'Mulai', 'Sampai'];
    const lines = courtReports.map((r) =>
      [r.name, `${from} - ${to}`, String(r.bookingCount), String(r.revenue), `${r.occupancyPct}%`, from, to]
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = `﻿${[header.map((h) => `"${h}"`).join(','), ...lines].join('\n')}`;
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment; filename="laporan-padelclub-${from}-${to}.csv"`,
      },
    });
  }

  return jsonOk({
    from,
    to,
    summary: { omzet, totalBookings, cancelled, waiting, avgOccupancy },
    courts: courtReports,
  });
}

import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bookingSlots, bookings, courts, payments, users } from '@/db/schema';
import { isValidPhone, jsonError, jsonOk, normalizePhone } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { ConflictError, createBookingTx } from '@/lib/bookings';
import { isValidDateString } from '@/lib/slots';

const VALID_STATUS = ['menunggu_pembayaran', 'terkonfirmasi', 'dibatalkan'] as const;

/**
 * Daftar booking untuk admin (F10): filter status, cari
 * (nama/HP/kode/lapangan/tanggal), flag hampir-kedaluwarsa.
 */
export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'semua';
  const search = (searchParams.get('search') ?? '').trim();
  const date = searchParams.get('date') ?? '';
  const expiringOnly = searchParams.get('expiring') === '1';
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 50), 1), 200);
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0);

  if (status !== 'semua' && !(VALID_STATUS as readonly string[]).includes(status)) {
    return jsonError('Status tidak valid', 400);
  }
  if (date && !isValidDateString(date)) {
    return jsonError('Format date wajib YYYY-MM-DD', 400);
  }

  const conditions = [];
  if (status !== 'semua') {
    conditions.push(eq(bookings.status, status as (typeof VALID_STATUS)[number]));
  }
  if (date) conditions.push(eq(bookings.bookingDate, date));
  if (search) {
    const like = `%${search}%`;
    conditions.push(
      or(
        ilike(bookings.code, like),
        ilike(bookings.guestName, like),
        ilike(bookings.guestPhone, like),
        ilike(users.name, like),
        ilike(users.phone, like),
        ilike(courts.name, like),
      ),
    );
  }
  if (expiringOnly) {
    // Menunggu pembayaran yang kedaluwarsa ≤ 5 menit lagi (pengingat F10).
    conditions.push(eq(bookings.status, 'menunggu_pembayaran'));
    conditions.push(sql`${bookings.expiresAt} > now()`);
    conditions.push(sql`${bookings.expiresAt} <= now() + interval '5 minutes'`);
  }

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
      expiresAt: bookings.expiresAt,
      createdAt: bookings.createdAt,
      guestName: bookings.guestName,
      guestPhone: bookings.guestPhone,
      userName: users.name,
      userPhone: users.phone,
      paymentStatus: payments.status,
      checkedInAt: bookings.checkedInAt,
      hour: bookingSlots.hour,
    })
    .from(bookings)
    .innerJoin(courts, eq(bookings.courtId, courts.id))
    .leftJoin(users, eq(bookings.userId, users.id))
    .leftJoin(payments, eq(payments.bookingId, bookings.id))
    .innerJoin(bookingSlots, eq(bookingSlots.bookingId, bookings.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bookings.createdAt))
    .limit(500);

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
      expiresAt: string | null;
      createdAt: string;
      customerName: string | null;
      customerPhone: string | null;
      paymentStatus: string | null;
      checkedInAt: string | null;
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
      expiresAt: r.expiresAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      customerName: r.guestName ?? r.userName ?? null,
      customerPhone: r.guestPhone ?? r.userPhone ?? null,
      paymentStatus: r.paymentStatus ?? null,
      checkedInAt: r.checkedInAt?.toISOString() ?? null,
      hours: [],
    };
    if (!entry.hours.includes(r.hour)) entry.hours.push(r.hour);
    byId.set(r.id, entry);
  }
  const all = [...byId.values()].map((b) => ({ ...b, hours: b.hours.sort((a, c) => a - c) }));
  const total = all.length;
  const paged = all.slice(offset, offset + limit);

  return jsonOk({ bookings: paged, total, limit, offset });
}

/**
 * Booking manual walk-in/telepon (F8). `paid=true` (tunai) langsung
 * `terkonfirmasi`; `paid=false` menjadi `menunggu_pembayaran` (+15 mnt).
 */
export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const body = (await request.json().catch(() => null)) as {
    courtId?: number;
    date?: string;
    hours?: number[];
    name?: string;
    phone?: string;
    paid?: boolean;
  } | null;
  if (
    !body ||
    typeof body.courtId !== 'number' ||
    !body.date ||
    !Array.isArray(body.hours) ||
    !body.name?.trim()
  ) {
    return jsonError('courtId, date, hours[], dan name wajib diisi', 400);
  }
  if (!isValidDateString(body.date)) {
    return jsonError('Format date wajib YYYY-MM-DD', 400);
  }
  if (!body.phone || !isValidPhone(body.phone)) {
    return jsonError('Nomor HP tidak valid (gunakan format 08…)', 400);
  }
  const phone = normalizePhone(body.phone);
  const paid = body.paid === true;

  // Tautkan ke user bila nomor sudah terdaftar; jika belum, buat akun dasar.
  const existing = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  let userId: number | null = existing[0]?.id ?? null;
  if (!userId) {
    const inserted = await db
      .insert(users)
      .values({ phone, name: body.name.trim() })
      .returning({ id: users.id });
    userId = inserted[0].id;
  }

  try {
    const { booking, hours, payment } = await createBookingTx({
      courtId: body.courtId,
      date: body.date,
      hours: body.hours,
      userId,
      guestName: body.name.trim(),
      guestPhone: phone,
      source: 'walkin',
      paid,
      gateway: 'manual',
    });
    return jsonOk(
      {
        booking: {
          code: booking.code,
          courtId: booking.courtId,
          date: booking.bookingDate,
          hours,
          status: booking.status,
          subtotal: booking.subtotal,
          expiresAt: booking.expiresAt?.toISOString() ?? null,
        },
        payment: { orderId: payment.orderId, amount: payment.amount, status: payment.status },
      },
      201,
    );
  } catch (err) {
    if (err instanceof ConflictError) return jsonError(err.message, 409);
    throw err;
  }
}

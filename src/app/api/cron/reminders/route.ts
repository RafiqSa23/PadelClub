import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { bookingSlots, bookings, courts, notificationLogs, users } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { resolveCustomer } from '@/lib/bookings';
import { logNotification, mockSendNotification } from '@/lib/notify-driver';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev tanpa secret — produksi wajib set CRON_SECRET
  const header = request.headers.get('x-cron-secret');
  const auth = request.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const query = new URL(request.url).searchParams.get('secret');
  return header === secret || bearer === secret || query === secret;
}

function dateString(offsetDays: number): string {
  // Basis UTC murni + tanggal lokal server untuk hari ini (konsisten dengan bookingDate).
  const now = new Date();
  const local = new Date(now.getTime() + offsetDays * 86_400_000);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const d = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WINDOW_MS = 10 * 60_000; // cron tiap 5 mnt → tiap target kedapatan sekali
const H1_MS = 24 * 3600_000;
const H2_MS = 2 * 3600_000;
const MAX_ATTEMPTS = 3; // AC F6: upaya ulang otomatis 3x bila gagal

/**
 * Cron pengingat (F6): kirim H-1 & H-2jam untuk booking `terkonfirmasi`.
 * Idempoten (cek log `terkirim` per booking+tipe), retry 3x in-process,
 * channel WhatsApp wajib + Email bila tersedia. Dijadwalkan tiap 5 menit
 * via cron eksternal (Vercel Cron / cron-job.org).
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) return jsonError('Unauthorized', 401);

  const now = Date.now();
  const candidates = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      courtId: bookings.courtId,
      courtName: courts.name,
      bookingDate: bookings.bookingDate,
      guestName: bookings.guestName,
      guestPhone: bookings.guestPhone,
      userId: bookings.userId,
      hour: bookingSlots.hour,
    })
    .from(bookings)
    .innerJoin(courts, eq(bookings.courtId, courts.id))
    .innerJoin(bookingSlots, eq(bookingSlots.bookingId, bookings.id))
    .where(
      and(
        eq(bookings.status, 'terkonfirmasi'),
        gte(bookings.bookingDate, dateString(0)),
        lte(bookings.bookingDate, dateString(2)),
      ),
    );

  // Kelompokkan per booking → jam mulai paling awal.
  const byId = new Map<number, { row: (typeof candidates)[number]; startHour: number }>();
  for (const r of candidates) {
    const cur = byId.get(r.id);
    if (!cur || r.hour < cur.startHour) byId.set(r.id, { row: r, startHour: r.hour });
  }

  const sent: { code: string; type: string; channel: string }[] = [];
  const failed: { code: string; type: string; error: string }[] = [];
  let skipped = 0;

  for (const { row, startHour } of byId.values()) {
    const start = new Date(
      `${row.bookingDate}T${String(startHour).padStart(2, '0')}:00:00`,
    ).getTime();
    if (Number.isNaN(start) || start <= now) continue;

    const due: ('pengingat_h1' | 'pengingat_h2')[] = [];
    for (const [type, target] of [
      ['pengingat_h1', H1_MS],
      ['pengingat_h2', H2_MS],
    ] as const) {
      const lag = now - (start - target);
      if (lag >= 0 && lag <= WINDOW_MS) due.push(type);
    }
    if (due.length === 0) {
      skipped += 1;
      continue;
    }

    const customer = await resolveCustomer(row);
    const name = customer.name ?? row.guestName ?? 'Pemain';
    let email: string | null = null;
    if (row.userId) {
      const u = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
      email = u[0]?.email ?? null;
    }
    const dateLabel = new Date(`${row.bookingDate}T00:00:00`).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const message =
      `Pengingat PadelClub: ${name}, booking ${row.code} — ` +
      `${row.courtName}, ${dateLabel} pukul ${String(startHour).padStart(2, '0')}:00 WIB. ` +
      `Tunjukkan tiket di resepsionis.`;

    for (const type of due) {
      const already = await db
        .select({ id: notificationLogs.id })
        .from(notificationLogs)
        .where(
          and(
            eq(notificationLogs.bookingId, row.id),
            eq(notificationLogs.type, type),
            eq(notificationLogs.status, 'terkirim'),
          ),
        )
        .limit(1);
      if (already.length > 0) continue;

      const targets: { channel: 'whatsapp' | 'email'; to: string }[] = [];
      if (customer.phone) targets.push({ channel: 'whatsapp', to: customer.phone });
      if (email) targets.push({ channel: 'email', to: email });

      if (targets.length === 0) {
        await logNotification({
          bookingId: row.id,
          channel: 'whatsapp',
          type,
          status: 'gagal',
          error: 'Kontak tidak tersedia',
        });
        failed.push({ code: row.code, type, error: 'Kontak tidak tersedia' });
        continue;
      }

      for (const t of targets) {
        let lastError: string | null = null;
        let ok = false;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
          try {
            await mockSendNotification({
              bookingId: row.id,
              channel: t.channel,
              type,
              to: t.to,
              message,
            });
            ok = true;
            break;
          } catch (err) {
            lastError = err instanceof Error ? err.message : 'Gagal mengirim';
            if (attempt === MAX_ATTEMPTS) {
              await logNotification({
                bookingId: row.id,
                channel: t.channel,
                type,
                status: 'gagal',
                error: lastError,
              });
            }
          }
        }
        // mockSendNotification menulis log `terkirim` sendiri — tanpa log ganda.
        if (ok) {
          sent.push({ code: row.code, type, channel: t.channel });
        } else {
          failed.push({ code: row.code, type, error: lastError ?? 'Gagal mengirim' });
        }
      }
    }
  }

  return jsonOk({ checked: byId.size, skipped, sent, failed });
}

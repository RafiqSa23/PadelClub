import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, notificationLogs } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';

const VALID_TYPES = ['tiket', 'pengingat_h1', 'pengingat_h2', 'sisa_pembayaran', 'kadaluarsa'] as const;
const VALID_CHANNELS = ['whatsapp', 'email'] as const;
const VALID_STATUS = ['terkirim', 'gagal'] as const;

/**
 * Log notifikasi untuk admin (F6 audit): dibaca halaman `/admin/monitoring`.
 * Mencakup tiket/kedaluwarsa (Batch 4–5) + pengingat H-1/H-2jam (Batch 6).
 */
export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? '';
  const channel = searchParams.get('channel') ?? '';
  const status = searchParams.get('status') ?? '';
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 50), 1), 100);
  const offset = Math.max(Number(searchParams.get('offset') ?? 0), 0);

  if (type && !(VALID_TYPES as readonly string[]).includes(type)) {
    return jsonError('type tidak valid', 400);
  }
  if (channel && !(VALID_CHANNELS as readonly string[]).includes(channel)) {
    return jsonError('channel tidak valid', 400);
  }
  if (status && !(VALID_STATUS as readonly string[]).includes(status)) {
    return jsonError('status tidak valid', 400);
  }

  const rows = await db
    .select({
      id: notificationLogs.id,
      bookingId: notificationLogs.bookingId,
      code: bookings.code,
      channel: notificationLogs.channel,
      type: notificationLogs.type,
      status: notificationLogs.status,
      sentAt: notificationLogs.sentAt,
      error: notificationLogs.error,
    })
    .from(notificationLogs)
    .leftJoin(bookings, eq(notificationLogs.bookingId, bookings.id))
    .orderBy(desc(notificationLogs.sentAt))
    .limit(500);

  let filtered = rows;
  if (type) filtered = filtered.filter((r) => r.type === type);
  if (channel) filtered = filtered.filter((r) => r.channel === channel);
  if (status) filtered = filtered.filter((r) => r.status === status);

  const total = filtered.length;
  const logs = filtered
    .slice(offset, offset + limit)
    .map((r) => ({ ...r, sentAt: r.sentAt.toISOString() }));

  return jsonOk({ logs, total, limit, offset });
}

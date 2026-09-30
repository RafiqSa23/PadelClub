import { db } from '@/db';
import { notificationLogs } from '@/db/schema';

/** Notify driver adapter (ADR 0003): MVP memakai driver mock (log + console). */

export type NotifyChannel = 'whatsapp' | 'email';
export type NotifyType =
  | 'tiket'
  | 'pengingat_h1'
  | 'pengingat_h2'
  | 'sisa_pembayaran'
  | 'kadaluarsa';

export async function logNotification(input: {
  bookingId?: number | null;
  channel: NotifyChannel;
  type: NotifyType;
  status: 'terkirim' | 'gagal';
  error?: string | null;
}): Promise<void> {
  await db.insert(notificationLogs).values({
    bookingId: input.bookingId ?? null,
    channel: input.channel,
    type: input.type,
    status: input.status,
    error: input.error ?? null,
  });
}

/** Mock send: selalu "terkirim" + tulis log (diganti provider WA/Email di Q5). */
export async function mockSendNotification(input: {
  bookingId?: number | null;
  channel: NotifyChannel;
  type: NotifyType;
  to: string;
  message: string;
}): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[notify:${input.channel}:${input.type}] to=${input.to} msg=${input.message}`);
  }
  await logNotification({
    bookingId: input.bookingId,
    channel: input.channel,
    type: input.type,
    status: 'terkirim',
  });
}

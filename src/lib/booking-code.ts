import { createHash, randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings } from '@/db/schema';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomBookingCode(): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `PD-${suffix}`;
}

/** Generate kode unik PD-XXXXXX dengan retry bila konflik. */
export async function uniqueBookingCode(tries = 5): Promise<string> {
  for (let i = 0; i < tries; i++) {
    const code = randomBookingCode();
    const existing = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.code, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
  // Fallback: tambahkan hash waktu agar praktis unik.
  const fallback =
    randomBookingCode() +
    createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 2).toUpperCase();
  return fallback.slice(0, 9);
}

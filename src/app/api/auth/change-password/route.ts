import { and, eq, ne } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { userSessions, users } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from '@/lib/password';
import { rateLimitDb } from '@/lib/rate-limit-db';
import { CUSTOMER_SESSION_COOKIE, sha256Hex } from '@/lib/session';
import { getCurrentUser } from '@/lib/user-auth';

/**
 * Ganti password mandiri saat sudah login (ADR 0012).
 * - Verifikasi password lama (bukan email/OTP).
 * - Sesi perangkat lain dicabut; sesi perangkat ini tetap aktif.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError('Masuk ke akun terlebih dahulu', 401);

  const rl = await rateLimitDb(`change-password:${user.id}`, 10, 60_000);
  if (!rl.allowed) return jsonError('Terlalu banyak percobaan, coba lagi sebentar', 429);

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: string;
    newPassword?: string;
  } | null;
  const currentPassword = body?.currentPassword ?? '';
  const newPassword = body?.newPassword ?? '';
  if (!currentPassword || !newPassword) {
    return jsonError('Password lama dan password baru wajib diisi', 400);
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return jsonError(`Password baru minimal ${MIN_PASSWORD_LENGTH} karakter`, 400);
  }

  const rows = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const stored = rows[0]?.passwordHash;
  if (!stored) return jsonError('Akun ini tidak memakai password', 409);

  const valid = await verifyPassword(currentPassword, stored);
  if (!valid) return jsonError('Password lama salah', 401);

  const passwordHash = await hashPassword(newPassword);
  const currentToken = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value ?? '';
  const currentHash = sha256Hex(currentToken);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await tx
      .delete(userSessions)
      .where(and(eq(userSessions.userId, user.id), ne(userSessions.tokenHash, currentHash)));
  });

  return jsonOk({ changed: true });
}

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { userSessions, users } from '@/db/schema';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { jsonError, jsonOk } from '@/lib/api';
import { MIN_PASSWORD_LENGTH, hashPassword } from '@/lib/password';

/**
 * Reset password pemain oleh admin (ADR 0009; PRD Q7 — reset mandiri belum ada).
 * Mengakhiri seluruh sesi user tersebut.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return jsonError('ID user tidak valid', 400);
  }
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? '';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return jsonError(`Password minimal ${MIN_PASSWORD_LENGTH} karakter`, 400);
  }

  const rows = await db.select({ id: users.id, isGuest: users.isGuest }).from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) return jsonError('User tidak ditemukan', 404);
  if (user.isGuest) return jsonError('User bayangan tidak punya password', 409);

  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
    await tx.delete(userSessions).where(eq(userSessions.userId, userId));
  });
  return jsonOk({ userId });
}

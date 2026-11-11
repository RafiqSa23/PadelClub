import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { adminSessions, admins } from '@/db/schema';
import { ADMIN_SESSION_COOKIE } from './constants';
import { hashPassword, verifyPassword } from './password';

export const ADMIN_SESSION_TTL_MS = 12 * 3600 * 1000; // 12 jam

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Hash password admin dengan scrypt (format: scrypt$N$r$p$salt$derived). */
export async function hashAdminPassword(password: string): Promise<string> {
  return hashPassword(password);
}

export async function verifyAdminPassword(password: string, stored: string): Promise<boolean> {
  return verifyPassword(password, stored);
}

export async function createAdminSession(adminId: number): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
  await db.insert(adminSessions).values({
    adminId,
    tokenHash: sha256Hex(token),
    expiresAt,
  });
  return { token, expiresAt };
}

export async function getAdminFromToken(
  token: string | undefined | null,
): Promise<{ id: number; username: string } | null> {
  if (!token) return null;
  const rows = await db
    .select({ id: admins.id, username: admins.username, expiresAt: adminSessions.expiresAt })
    .from(adminSessions)
    .innerJoin(admins, eq(adminSessions.adminId, admins.id))
    .where(eq(adminSessions.tokenHash, sha256Hex(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return { id: row.id, username: row.username };
}

/** Baca admin dari cookie request saat ini (untuk route handler). */
export async function getCurrentAdmin(): Promise<{
  id: number;
  username: string;
} | null> {
  const store = await cookies();
  return getAdminFromToken(store.get(ADMIN_SESSION_COOKIE)?.value);
}

export function adminCookieValue(token: string): string {
  return `${ADMIN_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
    ADMIN_SESSION_TTL_MS / 1000,
  )}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function clearAdminCookieValue(): string {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

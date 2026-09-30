import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { adminSessions, admins } from '@/db/schema';
import { ADMIN_SESSION_COOKIE } from './constants';

const scrypt = (
  password: string,
  salt: string,
  keylen: number,
  opts?: { N?: number; r?: number; p?: number; maxmem?: number },
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const cb = (err: Error | null, derived: Buffer) =>
      err ? reject(err) : resolve(derived);
    if (opts) _scrypt(password, salt, keylen, opts, cb);
    else _scrypt(password, salt, keylen, cb);
  });

export const ADMIN_SESSION_TTL_MS = 12 * 3600 * 1000; // 12 jam

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Hash password admin dengan scrypt (format: scrypt$N$r$p$salt$derived). */
export async function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$16384$8$1$${salt}$${derived.toString('hex')}`;
}

export async function verifyAdminPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts[0] !== 'scrypt' || parts.length !== 6) return false;
  const [, n, r, p, salt, expectedHex] = parts;
  const derived = (await scrypt(password, salt, 64, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 32 * 1024 * 1024,
  })) as Buffer;
  const a = Buffer.from(derived.toString('hex'));
  const b = Buffer.from(expectedHex);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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

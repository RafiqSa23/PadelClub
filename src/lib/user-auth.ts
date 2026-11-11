import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { userSessions, users } from '@/db/schema';
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_TTL_SECONDS,
  sha256Hex,
} from './session';

/** Sesi pemain berbasis DB (ADR 0009): token opaque, hash SHA-256 tersimpan. */
export const USER_SESSION_TTL_MS = CUSTOMER_SESSION_TTL_SECONDS * 1000;

export interface CurrentUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
}

export async function createUserSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await db.insert(userSessions).values({
    userId,
    tokenHash: sha256Hex(token),
    expiresAt: new Date(Date.now() + USER_SESSION_TTL_MS),
  });
  return token;
}

export async function destroyUserSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.delete(userSessions).where(eq(userSessions.tokenHash, sha256Hex(token)));
}

export async function getUserFromToken(token: string | undefined | null): Promise<CurrentUser | null> {
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isGuest: users.isGuest,
      expiresAt: userSessions.expiresAt,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(eq(userSessions.tokenHash, sha256Hex(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  // User bayangan tidak boleh punya sesi login.
  if (row.isGuest) return null;
  return { id: row.id, name: row.name, email: row.email, phone: row.phone };
}

/** Baca sesi pemain dari cookie request saat ini (route handler / server component). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  return getUserFromToken(store.get(CUSTOMER_SESSION_COOKIE)?.value);
}

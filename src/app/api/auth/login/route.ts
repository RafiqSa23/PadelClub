import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { verifyPassword } from '@/lib/password';
import { rateLimitDb } from '@/lib/rate-limit-db';
import { customerCookieValue } from '@/lib/session';
import { createUserSession } from '@/lib/user-auth';

/** Login akun pemain (F3, ADR 0009). Pesan error tidak membocorkan mana yang salah. */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  const rl = await rateLimitDb(`auth-login:${ip}`, 10, 60_000);
  if (!rl.allowed) return jsonError('Terlalu banyak percobaan, coba lagi sebentar', 429);

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase() ?? '';
  const password = body?.password ?? '';
  if (!email || !password) return jsonError('Email dan password wajib diisi', 400);

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || user.isGuest || !user.passwordHash) {
    return jsonError('Email atau password salah', 401);
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return jsonError('Email atau password salah', 401);

  const token = await createUserSession(user.id);
  const res = jsonOk({
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
  });
  res.headers.append('Set-Cookie', customerCookieValue(token));
  return res;
}

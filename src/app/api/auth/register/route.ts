import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { isValidPhone, jsonError, jsonOk, normalizePhone } from '@/lib/api';
import { MIN_PASSWORD_LENGTH, hashPassword } from '@/lib/password';
import { rateLimitDb } from '@/lib/rate-limit-db';
import { createUserSession } from '@/lib/user-auth';
import { customerCookieValue } from '@/lib/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registrasi akun pemain (F3, ADR 0009): email unik + password (scrypt).
 * Tanpa verifikasi email/OTP; akun langsung aktif + sesi `padel_session`.
 */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  const rl = await rateLimitDb(`auth-register:${ip}`, 5, 60 * 60_000);
  if (!rl.allowed) return jsonError('Terlalu banyak pendaftaran, coba lagi nanti', 429);

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
  } | null;
  const name = body?.name?.trim() ?? '';
  const email = body?.email?.trim().toLowerCase() ?? '';
  const password = body?.password ?? '';
  const phoneInput = body?.phone?.trim() ?? '';

  if (!name) return jsonError('Nama wajib diisi', 400);
  if (!EMAIL_RE.test(email)) return jsonError('Email tidak valid', 400);
  if (password.length < MIN_PASSWORD_LENGTH) {
    return jsonError(`Password minimal ${MIN_PASSWORD_LENGTH} karakter`, 400);
  }
  if (!phoneInput || !isValidPhone(phoneInput)) {
    return jsonError('Nomor HP tidak valid (contoh: 0812…)', 400);
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) return jsonError('Email sudah terdaftar', 409);

  const passwordHash = await hashPassword(password);
  const inserted = await db
    .insert(users)
    .values({ name, email, passwordHash, phone: normalizePhone(phoneInput), isGuest: false })
    .returning({ id: users.id, name: users.name, email: users.email, phone: users.phone });
  const user = inserted[0];

  const token = await createUserSession(user.id);
  const res = jsonOk({ user }, 201);
  res.headers.append('Set-Cookie', customerCookieValue(token));
  return res;
}

import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { otpCodes, users } from '@/db/schema';
import { isValidPhone, jsonError, jsonOk, normalizePhone } from '@/lib/api';
import { OTP_MAX_ATTEMPTS, otpMatches } from '@/lib/otp';
import { rateLimit } from '@/lib/rate-limit';
import { customerCookieValue, signCustomerSession } from '@/lib/session';

/**
 * Verifikasi OTP (F3): cocok → akun otomatis dibuat bila baru (upsert by phone),
 * sesi `padel_session` diset via cookie HttpOnly.
 */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  const rl = rateLimit(`otp-verify:${ip}`, 30, 60_000);
  if (!rl.allowed) return jsonError('Terlalu banyak percobaan, coba lagi sebentar', 429);

  const body = (await request.json().catch(() => null)) as {
    phone?: string;
    code?: string;
    name?: string;
  } | null;
  if (!body?.phone || !isValidPhone(body.phone)) {
    return jsonError('Nomor HP tidak valid', 400);
  }
  if (!body?.code || !/^\d{6}$/.test(body.code.trim())) {
    return jsonError('Kode OTP harus 6 digit', 400);
  }
  const phone = normalizePhone(body.phone);
  const code = body.code.trim();

  const rows = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  const otp = rows[0];
  if (!otp || otp.expiresAt.getTime() < Date.now()) {
    return jsonError('Kode kedaluwarsa atau tidak ditemukan. Minta kode baru.', 401);
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    return jsonError('Terlalu banyak percobaan gagal. Minta kode baru.', 429);
  }
  if (!otpMatches(code, otp.codeHash)) {
    await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
    return jsonError('Kode OTP salah.', 401);
  }

  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));

  // Akun otomatis (AC F3): buat bila nomor baru, pakai nama dari form bila ada.
  const name = body.name?.trim() || 'Pemain Padel';
  const existing = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  let user = existing[0];
  if (!user) {
    const inserted = await db.insert(users).values({ phone, name }).returning();
    user = inserted[0];
  }

  const token = signCustomerSession(user.id, user.phone);
  const res = jsonOk({ user: { id: user.id, name: user.name, phone: user.phone } });
  res.headers.append('Set-Cookie', customerCookieValue(token));
  return res;
}

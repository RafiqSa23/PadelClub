import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { otpCodes } from '@/db/schema';
import { isValidPhone, jsonError, jsonOk, normalizePhone } from '@/lib/api';
import { generateOtpCode, hashOtpCode, OTP_RESEND_MS, OTP_TTL_MS } from '@/lib/otp';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Minta OTP via WhatsApp (F3). MVP: driver mock — kode dicetak ke log server
 * dan (khusus non-produksi) dikembalikan di respons agar alur dapat diuji
 * end-to-end tanpa penyedia WA (PRD Q5 masih terbuka).
 */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  const rl = rateLimit(`otp-request:${ip}`, 20, 60_000);
  if (!rl.allowed) return jsonError('Terlalu banyak permintaan, coba lagi sebentar', 429);

  const body = (await request.json().catch(() => null)) as {
    phone?: string;
    name?: string;
  } | null;
  if (!body?.phone || !isValidPhone(body.phone)) {
    return jsonError('Nomor HP tidak valid (gunakan format 08…)', 400);
  }
  const phone = normalizePhone(body.phone);

  // Aturan kirim-ulang 60 detik: tolak bila OTP aktif dibuat < 60 dtk lalu.
  const recent = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  const latest = recent[0];
  if (
    latest &&
    latest.expiresAt.getTime() > Date.now() &&
    Date.now() - latest.createdAt.getTime() < OTP_RESEND_MS
  ) {
    const waitSec = Math.ceil(
      (OTP_RESEND_MS - (Date.now() - latest.createdAt.getTime())) / 1000,
    );
    return jsonError(`Tunggu ${waitSec} detik sebelum meminta kode baru`, 429);
  }

  const code = generateOtpCode();
  await db.insert(otpCodes).values({
    phone,
    codeHash: hashOtpCode(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  // Driver mock (ganti provider WA saat Q5 terjawab).
  console.log(`[otp:mock] to=${phone} code=${code}`);

  return jsonOk(
    {
      sentTo: phone,
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      // Hanya non-produksi agar frontend/dev dapat melanjutkan tanpa WA asli.
      ...(process.env.NODE_ENV === 'production' ? {} : { debugCode: code }),
    },
    201,
  );
}

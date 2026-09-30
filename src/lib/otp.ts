import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_TTL_MS = 5 * 60 * 1000; // 5 menit (AC F3)
export const OTP_RESEND_MS = 60 * 1000; // kirim-ulang min 60 detik
export const OTP_MAX_ATTEMPTS = 5; // blokir sementara setelah 5 gagal

export function generateOtpCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

export function hashOtpCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function otpMatches(input: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtpCode(input.trim()));
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

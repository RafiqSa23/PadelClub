/**
 * Format payload QR tiket (isomorphic, tanpa crypto) — dipakai server untuk
 * menandatangani/memverifikasi dan scanner untuk membaca kode tanpa membongkar
 * tanda tangan di browser.
 *
 * Format: `v1.<KODE>.<expEpochDetik>.<hmacBase64Url>`
 * - `KODE` selalu uppercase `PD-XXXXXX`.
 * - `exp` detik Unix; token kedaluwarsa setelah TTL pendek (lihat ADR 0014).
 * - Tanda tangan HMAC-SHA256 dihitung server atas `v1.<KODE>.<exp>`.
 */

export const TICKET_QR_VERSION = "v1";
/** Umur payload QR. Halaman tiket memperbarui lebih cepat dari ini. */
export const TICKET_QR_TTL_SECONDS = 5 * 60;

const CODE_RE = /^PD-[A-Z0-9]{4,12}$/;
const SIGNATURE_RE = /^[A-Za-z0-9_-]{20,}$/;
const EXP_RE = /^\d{1,12}$/;

export interface ParsedTicketQr {
  version: string;
  code: string;
  /** Detik Unix. */
  expiresAt: number;
  signature: string;
  /** Bagian yang ditandatangani: `v1.<KODE>.<exp>`. */
  signed: string;
}

export function isTicketCode(value: string): boolean {
  return CODE_RE.test(value.trim().toUpperCase());
}

export function normalizeTicketCode(value: string): string {
  return value.trim().toUpperCase();
}

export function buildTicketQrPayload(
  code: string,
  expiresAt: number,
  signature: string,
): string {
  return `${TICKET_QR_VERSION}.${normalizeTicketCode(code)}.${expiresAt}.${signature}`;
}

/** Parse payload bertanda tangan; `null` bila bukan format QR tiket yang sah. */
export function parseTicketQrPayload(token: string): ParsedTicketQr | null {
  const parts = token.trim().split(".");
  if (parts.length !== 4) return null;

  const [version, rawCode, rawExp, signature] = parts;
  if (version !== TICKET_QR_VERSION) return null;

  const code = rawCode.toUpperCase();
  if (!CODE_RE.test(code)) return null;
  if (!EXP_RE.test(rawExp)) return null;
  if (!SIGNATURE_RE.test(signature)) return null;

  const expiresAt = Number(rawExp);
  if (!Number.isSafeInteger(expiresAt)) return null;

  return {
    version,
    code,
    expiresAt,
    signature,
    signed: `${version}.${code}.${rawExp}`,
  };
}

/**
 * Ambil kode booking dari apa pun yang dipindai/diketik: payload bertanda
 * tangan, URL tiket (`/tiket/PD-XXXXXX`), atau kode polos.
 */
export function extractTicketCode(payload: string): string | null {
  const trimmed = payload.trim();
  const parsed = parseTicketQrPayload(trimmed);
  if (parsed) return parsed.code;

  const fromUrl = trimmed.match(/\/tiket\/([A-Za-z0-9-]+)/);
  const candidate = (fromUrl?.[1] ?? trimmed).replace(/^#/, "").toUpperCase();
  return CODE_RE.test(candidate) ? candidate : null;
}

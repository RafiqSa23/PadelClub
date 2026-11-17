import { createHmac, timingSafeEqual } from "node:crypto";
import {
  TICKET_QR_TTL_SECONDS,
  TICKET_QR_VERSION,
  buildTicketQrPayload,
  normalizeTicketCode,
  parseTicketQrPayload,
} from "./ticket-qr-format";

/**
 * QR tiket bertanda tangan (anti-forgery) + rotasi pendek (anti-reuse
 * screenshot). Hanya server yang memegang `TICKET_QR_SECRET`; scanner
 * memverifikasi lewat `GET /api/tickets/:kode?qr=<payload>`.
 */

const DEV_SECRET = "padelclub-dev-ticket-qr-secret-min-16";
const MIN_SECRET_LENGTH = 16;

function getSecret(): string {
  const secret = process.env.TICKET_QR_SECRET?.trim();
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
  // Jangan pernah menandatangani dengan secret default di produksi.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `TICKET_QR_SECRET wajib diisi (minimal ${MIN_SECRET_LENGTH} karakter) di produksi`,
    );
  }
  return DEV_SECRET;
}

function sign(signed: string): string {
  return createHmac("sha256", getSecret()).update(signed).digest("base64url");
}

export interface SignedTicketQr {
  payload: string;
  expiresAt: Date;
}

export function signTicketQr(
  code: string,
  now: Date = new Date(),
  ttlSeconds: number = TICKET_QR_TTL_SECONDS,
): SignedTicketQr {
  const normalized = normalizeTicketCode(code);
  const expiresAt = Math.floor(now.getTime() / 1000) + ttlSeconds;
  const signed = `${TICKET_QR_VERSION}.${normalized}.${expiresAt}`;
  return {
    payload: buildTicketQrPayload(normalized, expiresAt, sign(signed)),
    expiresAt: new Date(expiresAt * 1000),
  };
}

export type TicketQrInvalidReason = "format" | "code" | "expired" | "signature";

export type TicketQrVerification =
  | { valid: true; code: string; expiresAt: Date }
  | { valid: false; reason: TicketQrInvalidReason };

export function verifyTicketQr(
  payload: string,
  expectedCode: string,
  now: Date = new Date(),
): TicketQrVerification {
  const parsed = parseTicketQrPayload(payload);
  if (!parsed) return { valid: false, reason: "format" };

  const code = normalizeTicketCode(expectedCode);
  if (parsed.code !== code) return { valid: false, reason: "code" };

  const provided = Buffer.from(parsed.signature, "base64url");
  const expected = Buffer.from(sign(parsed.signed), "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { valid: false, reason: "signature" };
  }

  const expiresAt = new Date(parsed.expiresAt * 1000);
  if (expiresAt.getTime() <= now.getTime()) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, code: parsed.code, expiresAt };
}

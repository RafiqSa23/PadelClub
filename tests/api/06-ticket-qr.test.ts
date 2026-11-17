import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  extractTicketCode,
  parseTicketQrPayload,
  TICKET_QR_VERSION,
} from "../../src/lib/ticket-qr-format";
import { signTicketQr, verifyTicketQr } from "../../src/lib/ticket-qr";

/**
 * Unit test QR tiket bertanda tangan (ADR 0014), tanpa HTTP: valid, rusak,
 * kode salah, kedaluwarsa, dan payload sampah.
 */

const SECRET = "unit-test-ticket-qr-secret-16";
let originalSecret: string | undefined;

beforeAll(() => {
  originalSecret = process.env.TICKET_QR_SECRET;
  process.env.TICKET_QR_SECRET = SECRET;
});

afterAll(() => {
  if (originalSecret === undefined) delete process.env.TICKET_QR_SECRET;
  else process.env.TICKET_QR_SECRET = originalSecret;
});

describe("QR tiket bertanda tangan (ADR 0014)", () => {
  it("payload yang ditandatangani lolos verifikasi", () => {
    const code = "PD-ABC123";
    const signed = signTicketQr(code);
    expect(signed.payload).toMatch(/^v1\.PD-ABC123\.\d+\.[A-Za-z0-9_-]+$/);
    expect(signed.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const result = verifyTicketQr(signed.payload, code);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.code).toBe(code);
  });

  it("kode booking lowercase tetap dinormalisasi", () => {
    const signed = signTicketQr("pd-abc123");
    const result = verifyTicketQr(signed.payload, "pd-abc123");
    expect(result.valid).toBe(true);
  });

  it("tanda tangan yang diubah ditolak", () => {
    const signed = signTicketQr("PD-ABC123");
    // Ubah karakter pertama segmen signature (bukan karakter terakhir: bit
    // padding base64url bisa membuat byte hasil decode tetap sama).
    const sigStart = signed.payload.lastIndexOf(".") + 1;
    const replacement = signed.payload[sigStart] === "A" ? "B" : "A";
    const tampered =
      signed.payload.slice(0, sigStart) + replacement + signed.payload.slice(sigStart + 1);
    const result = verifyTicketQr(tampered, "PD-ABC123");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("signature");
  });

  it("payload untuk kode lain ditolak", () => {
    const signed = signTicketQr("PD-ABC123");
    const result = verifyTicketQr(signed.payload, "PD-ZZZ999");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("code");
  });

  it("token kedaluwarsa ditolak", () => {
    const signed = signTicketQr("PD-ABC123", new Date("2026-01-01T00:00:00Z"), 60);
    const result = verifyTicketQr(signed.payload, "PD-ABC123", new Date("2026-01-01T00:02:00Z"));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("expired");
  });

  it("secret berbeda membuat tanda tangan tidak valid", () => {
    const signed = signTicketQr("PD-ABC123");
    process.env.TICKET_QR_SECRET = "secret-lain-yang-cukup-panjang";
    try {
      const result = verifyTicketQr(signed.payload, "PD-ABC123");
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("signature");
    } finally {
      process.env.TICKET_QR_SECRET = SECRET;
    }
  });

  it("payload sampah / versi salah ditolak dengan alasan format", () => {
    for (const payload of ["", "PD-ABC123", "v1.PD-ABC123", "v1.PD-ABC123.12", "v2.PD-ABC123.12.abcdefghijklmnopqrstuv"]) {
      const result = verifyTicketQr(payload, "PD-ABC123");
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toBe("format");
    }
  });

  it("parse membaca kode + expiry dari token", () => {
    const signed = signTicketQr("PD-ABC123", new Date("2026-01-01T00:00:00Z"), 120);
    const parsed = parseTicketQrPayload(signed.payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(TICKET_QR_VERSION);
    expect(parsed?.code).toBe("PD-ABC123");
    expect(parsed?.expiresAt).toBe(Math.floor(new Date("2026-01-01T00:02:00Z").getTime() / 1000));
  });

  it("extract kode menerima token, URL tiket, dan kode polos", () => {
    const signed = signTicketQr("PD-ABC123");
    expect(extractTicketCode(signed.payload)).toBe("PD-ABC123");
    expect(extractTicketCode("https://padelclub.test/tiket/PD-ABC123")).toBe("PD-ABC123");
    expect(extractTicketCode(" pd-abc123 ")).toBe("PD-ABC123");
    expect(extractTicketCode("bukan-tiket")).toBeNull();
  });
});

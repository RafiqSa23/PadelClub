import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiClient,
  cleanupTestData,
  closeTestDb,
  isoDate,
  requireServer,
  TEST_DATE,
  TEST_PHONE,
} from "../helpers/api";

/**
 * Alur pelanggan F1–F5 lewat HTTP: cari slot → OTP → booking → bayar (mock) →
 * webhook → tiket. Satu nomor HP, satu sesi, ±15 request.
 */

const client = apiClient();

let courtId = 0;
let hour = 0;
let bookingCode = "";
let orderId = "";
let otpCode = "";
let slotVersion = 0;

beforeAll(async () => {
  await requireServer();
  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await closeTestDb();
});

describe("alur pelanggan (F1–F5)", () => {
  it("health endpoint terhubung ke DB", async () => {
    const res = await client.get<{ ok: boolean; db: string }>("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.db).toBe("connected");
  });

  it("daftar lapangan aktif (F1)", async () => {
    const res = await client.get<{ courts: { id: number }[] }>("/api/courts");
    expect(res.status).toBe(200);
    expect(res.body.courts.length).toBeGreaterThan(0);
  });

  it("jadwal slot harian punya jam kosong (F1)", async () => {
    const res = await client.get<{
      schedule: { slots: { courtId: number; hour: number; status: string }[] };
      v: number;
    }>(`/api/slots?date=${TEST_DATE}`);
    expect(res.status).toBe(200);
    expect(res.body.schedule.slots.length).toBeGreaterThan(0);
    expect(typeof res.body.v).toBe("number");
    slotVersion = res.body.v;

    const free = res.body.schedule.slots.find((slot) => slot.status === "kosong");
    expect(free).toBeDefined();
    courtId = free!.courtId;
    hour = free!.hour;
  });

  it("ringkasan mingguan satu request (F1)", async () => {
    const res = await client.get<{ days: { date: string; freeCount: number }[] }>(
      `/api/slots?from=${TEST_DATE}&to=${isoDate(51)}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.days.length).toBe(7);
    for (const day of res.body.days) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(day.freeCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("minta OTP mengembalikan debugCode di mode non-produksi (F3)", async () => {
    const res = await client.post<{ sentTo: string; debugCode?: string }>("/api/otp/request", {
      phone: TEST_PHONE,
    });
    expect(res.status).toBe(201);
    expect(res.body.sentTo).toBe(TEST_PHONE);
    expect(res.body.debugCode).toMatch(/^\d{6}$/);
    otpCode = res.body.debugCode!;
  });

  it("kirim ulang OTP dalam 60 detik ditolak 429 (F3)", async () => {
    const res = await client.post("/api/otp/request", { phone: TEST_PHONE });
    expect(res.status).toBe(429);
  });

  it("verifikasi OTP membuat sesi pelanggan (F3)", async () => {
    const res = await client.post("/api/otp/verify", {
      phone: TEST_PHONE,
      code: otpCode,
      name: "Pemain Test",
    });
    expect(res.status).toBe(200);
    expect(client.hasCookie("padel_session")).toBe(true);
  });

  it("booking online menahan slot 15 menit (F2)", async () => {
    const res = await client.post<{
      booking: { code: string; status: string; expiresAt: string | null };
    }>("/api/bookings", { courtId, date: TEST_DATE, hours: [hour] });
    expect(res.status).toBe(201);
    expect(res.body.booking.status).toBe("menunggu_pembayaran");
    expect(res.body.booking.expiresAt).not.toBeNull();
    bookingCode = res.body.booking.code;
  });

  it("booking slot yang sama ditolak 409 (anti-overbooking)", async () => {
    const res = await client.post("/api/bookings", { courtId, date: TEST_DATE, hours: [hour] });
    expect(res.status).toBe(409);
  });

  it("delta jadwal menandai slot yang baru dipesan", async () => {
    const res = await client.get<{
      v: number;
      full: boolean;
      slots?: { courtId: number; hour: number; status: string }[];
    }>(`/api/slots/status?date=${TEST_DATE}&v=${slotVersion}`);
    expect(res.status).toBe(200);
    expect(res.body.v).toBeGreaterThan(slotVersion);
    expect(res.body.full).toBe(false);
    const changed = res.body.slots?.find((s) => s.courtId === courtId && s.hour === hour);
    expect(changed).toBeDefined();
    expect(changed!.status).toBe("menunggu_pembayaran");
    slotVersion = res.body.v;
  });

  it("polling tanpa perubahan dibalas 304", async () => {
    const res = await client.get(`/api/slots/status?date=${TEST_DATE}&v=${slotVersion}`);
    expect(res.status).toBe(304);
  });

  it("charge membuat transaksi mock (F4)", async () => {
    const res = await client.post<{
      payment: { orderId: string; gateway: string; qrString: string | null; status: string };
    }>(`/api/payments/${bookingCode}/charge`);
    expect(res.status).toBe(200);
    expect(res.body.payment.gateway).toBe("mock");
    expect(res.body.payment.status).toBe("pending");
    expect(res.body.payment.qrString).toMatch(/^MOCK-QRIS:/);
    orderId = res.body.payment.orderId;
  });

  it("status pembayaran masih pending sebelum dibayar (F4)", async () => {
    const res = await client.get<{
      booking: { status: string };
      payment: { status: string };
    }>(`/api/payments/${bookingCode}/status`);
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("menunggu_pembayaran");
    expect(res.body.payment.status).toBe("pending");
  });

  it("webhook PAID mengonfirmasi booking + tiket (F4)", async () => {
    const res = await client.post<{ booking: { status: string } }>("/api/webhooks/payment", {
      orderId,
      status: "PAID",
    });
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("terkonfirmasi");
  });

  it("webhook ganda idempoten (F4)", async () => {
    const res = await client.post<{ already?: boolean }>("/api/webhooks/payment", {
      orderId,
      status: "PAID",
    });
    expect(res.status).toBe(200);
    expect(res.body.already).toBe(true);
  });

  it("tiket publik memuat status lunas + jam (F5)", async () => {
    const res = await client.get<{
      ticket: { code: string; status: string; paymentStatus: string; hours: number[] };
    }>(`/api/tickets/${bookingCode}`);
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("terkonfirmasi");
    expect(res.body.ticket.paymentStatus).toBe("paid");
    expect(res.body.ticket.hours).toEqual([hour]);
  });

  it("riwayat booking milik sesi memuat kode ini (F5)", async () => {
    const res = await client.get<{ bookings: { code: string }[] }>("/api/me/bookings");
    expect(res.status).toBe(200);
    expect(res.body.bookings.map((b) => b.code)).toContain(bookingCode);
  });

  it("detail booking publik mengembalikan nomor HP ternormalisasi", async () => {
    const res = await client.get<{ booking: { code: string; customerPhone: string | null } }>(
      `/api/bookings/${bookingCode}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.booking.code).toBe(bookingCode);
    expect(res.body.booking.customerPhone).toBe(TEST_PHONE);
  });
});

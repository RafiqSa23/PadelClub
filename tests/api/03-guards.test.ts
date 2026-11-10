import { afterAll, describe, expect, it } from "vitest";
import {
  apiClient,
  closeTestDb,
  isoDate,
  requireServer,
  requestCountSoFar,
} from "../helpers/api";

/**
 * Guard keamanan & validasi input. Tidak menulis data (kecuali cron, dan itu
 * hanya bila CRON_SECRET tidak diset — karena itu request-nya dilewati).
 * ±7 request.
 */

const anonymous = apiClient();

afterAll(async () => {
  await closeTestDb();
});

describe("guard & validasi API", () => {
  it("server test hidup", async () => {
    await requireServer();
    expect(true).toBe(true);
  });

  it("riwayat pelanggan butuh sesi (401)", async () => {
    const res = await anonymous.get<{ ok: boolean; message: string }>("/api/me/bookings");
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("endpoint admin butuh sesi admin (401)", async () => {
    const res = await anonymous.get<{ ok: boolean }>("/api/admin/overview");
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("daftar booking admin butuh sesi admin (401)", async () => {
    const res = await anonymous.get<{ ok: boolean }>("/api/admin/bookings");
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("tiket dengan kode asing 404", async () => {
    const res = await anonymous.get<{ ok: boolean }>("/api/tickets/TIDAK-ADA");
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it("nomor HP tidak valid ditolak 400", async () => {
    const res = await anonymous.post<{ ok: boolean }>("/api/otp/request", { phone: "123" });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it("parameter tanggal invalid ditolak 400", async () => {
    const res = await anonymous.get<{ ok: boolean }>("/api/slots?date=bukan-tanggal");
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it("cron tanpa secret ditolak 401", async () => {
    if (!process.env.CRON_SECRET) {
      // Tanpa CRON_SECRET endpoint sengaja terbuka untuk dev — jangan dipanggil
      // supaya tidak mengubah data. Di .env.test nilainya selalu diisi.
      return;
    }
    const res = await anonymous.get<{ ok: boolean }>("/api/cron/expire");
    expect(res.status).toBe(401);
  });

  it("laporan admin menolak tanggal invalid (400)", async () => {
    await requireServer();
    const client = apiClient();
    const login = await client.post("/api/admin/login", {
      username: process.env.SEED_ADMIN_USER ?? "admin",
      password: process.env.SEED_ADMIN_PASSWORD ?? "admin123",
    });
    expect(login.status).toBe(200);

    const res = await client.get<{ ok: boolean }>("/api/admin/reports?from=2026-13-01");
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(isoDate(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("jumlah request tetap di bawah anggaran", () => {
    expect(requestCountSoFar()).toBeLessThanOrEqual(12);
  });
});

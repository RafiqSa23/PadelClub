import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiClient,
  cleanupTestData,
  closeTestDb,
  requireServer,
  TEST_DATE,
  TEST_DATE_CLOSURE,
  TEST_PHONE_WALKIN,
} from "../helpers/api";

/**
 * Alur admin F7–F11 lewat HTTP: login → dashboard/jadwal → walk-in → check-in →
 * tutup lapangan → notifikasi → laporan. Satu sesi admin, ±14 request.
 */

const admin = apiClient();

let courtId = 0;
let hour = 0;
let walkinCode = "";
let closureId = 0;

beforeAll(async () => {
  await requireServer();
  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await closeTestDb();
});

describe("alur admin (F7–F11)", () => {
  it("login admin membuat sesi", async () => {
    const res = await admin.post<{ admin: { username: string } }>("/api/admin/login", {
      username: process.env.SEED_ADMIN_USER ?? "admin",
      password: process.env.SEED_ADMIN_PASSWORD ?? "admin123",
    });
    expect(res.status).toBe(200);
    expect(res.body.admin.username).toBeTruthy();
    expect(admin.hasCookie("padelclub_admin")).toBe(true);
  });

  it("sesi admin dikenali /api/admin/me", async () => {
    const res = await admin.get<{ admin: { username: string } }>("/api/admin/me");
    expect(res.status).toBe(200);
    expect(res.body.admin.username).toBeTruthy();
  });

  it("dashboard harian mengembalikan KPI (F7)", async () => {
    const res = await admin.get<{
      kpi: { totalSlots: number; totalBookings: number };
      date: string;
    }>(`/api/admin/overview?date=${TEST_DATE}`);
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(TEST_DATE);
    expect(res.body.kpi.totalSlots).toBeGreaterThan(0);
  });

  it("grid jadwal admin memuat slot + booking (F7)", async () => {
    const res = await admin.get<{
      schedule: { slots: { courtId: number; hour: number; status: string }[] };
      bookings: unknown[];
    }>(`/api/admin/schedule?date=${TEST_DATE}`);
    expect(res.status).toBe(200);
    expect(res.body.schedule.slots.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.bookings)).toBe(true);

    const free = res.body.schedule.slots.find((slot) => slot.status === "kosong");
    expect(free).toBeDefined();
    courtId = free!.courtId;
    hour = free!.hour;
  });

  it("daftar booking bisa dicari nomor HP (F10)", async () => {
    const res = await admin.get<{ bookings: unknown[]; total: number }>(
      `/api/admin/bookings?search=${TEST_PHONE_WALKIN}`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bookings)).toBe(true);
    expect(typeof res.body.total).toBe("number");
  });

  it("booking walk-in tunai langsung terkonfirmasi (F8)", async () => {
    const res = await admin.post<{ booking: { code: string; status: string } }>(
      "/api/admin/bookings",
      {
        courtId,
        date: TEST_DATE,
        hours: [hour],
        name: "Tes Walkin",
        phone: TEST_PHONE_WALKIN,
        paid: true,
      },
    );
    expect(res.status).toBe(201);
    expect(res.body.booking.status).toBe("terkonfirmasi");
    walkinCode = res.body.booking.code;
  });

  it("check-in tiket oleh admin (F5)", async () => {
    const res = await admin.post<{ ticket: { checkedInBy: string | null } }>("/api/admin/checkin", {
      code: walkinCode,
    });
    expect(res.status).toBe(200);
    expect(res.body.ticket.checkedInBy).toBeTruthy();
  });

  it("check-in ganda idempoten", async () => {
    const res = await admin.post<{ already?: boolean }>("/api/admin/checkin", { code: walkinCode });
    expect(res.status).toBe(200);
    expect(res.body.already).toBe(true);
  });

  it("daftar penutupan lapangan bisa dibaca (F9)", async () => {
    const res = await admin.get<{ closures: unknown[] }>(
      `/api/admin/closures?date=${TEST_DATE_CLOSURE}`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.closures)).toBe(true);
  });

  it("tutup lapangan lalu batalkan penutupan (F9)", async () => {
    const created = await admin.post<{ closure: { id: number } }>("/api/admin/closures", {
      courtId,
      date: TEST_DATE_CLOSURE,
      reason: "TEST-closure",
    });
    expect(created.status).toBe(201);
    closureId = created.body.closure.id;
    expect(closureId).toBeGreaterThan(0);

    const deleted = await admin.del<{ deleted: { id: number } }>(
      `/api/admin/closures/${closureId}`,
    );
    expect(deleted.status).toBe(200);
    expect(deleted.body.deleted.id).toBe(closureId);
  });

  it("endpoint log notifikasi sudah dipensiunkan (404)", async () => {
    expect(await admin.status("/api/admin/notifications")).toBe(404);
  });

  it("laporan JSON memuat ringkasan + per lapangan (F11)", async () => {
    const res = await admin.get<{
      from: string;
      to: string;
      summary: { omzet: number; totalBookings: number; avgOccupancy: number };
      courts: unknown[];
    }>(`/api/admin/reports?from=${TEST_DATE}&to=${TEST_DATE}`);
    expect(res.status).toBe(200);
    expect(res.body.from).toBe(TEST_DATE);
    expect(typeof res.body.summary.omzet).toBe("number");
    expect(Array.isArray(res.body.courts)).toBe(true);
  });

  it("cancel booking walk-in mengembalikan slot (F10)", async () => {
    const res = await admin.patch<{ booking: { status: string } }>(
      `/api/admin/bookings/${walkinCode}`,
      { action: "cancel" },
    );
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("dibatalkan");
  });
});

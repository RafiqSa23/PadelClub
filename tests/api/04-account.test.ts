import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiClient,
  cleanupTestData,
  closeTestDb,
  isoDate,
  requireServer,
  requestCountSoFar,
  TEST_EMAIL,
  TEST_PASSWORD,
  TEST_PHONE,
  TEST_PHONE_WALKIN,
} from "../helpers/api";

/**
 * Akun: ganti password mandiri (ADR 0012) + reset password oleh admin.
 * Satu akun + alur walk-in, ±17 request; cleanup memakai email/HP test yang sama.
 */

const NEW_PASSWORD = "rahasia-baru-456";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

const customer = apiClient();

beforeAll(async () => {
  await requireServer();
  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await closeTestDb();
});

describe("akun: ganti & reset password (ADR 0012)", () => {
  it("registrasi akun untuk uji password", async () => {
    const res = await customer.post<{ user: { email: string } }>("/api/auth/register", {
      name: "Pemain Password",
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      phone: TEST_PHONE,
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(customer.hasCookie("padel_session")).toBe(true);
  });

  it("ganti password dengan password lama salah ditolak 401", async () => {
    const res = await customer.post<{ ok: boolean }>("/api/auth/change-password", {
      currentPassword: "password-keliru-123",
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("ganti password dengan password baru terlalu pendek ditolak 400", async () => {
    const res = await customer.post<{ ok: boolean }>("/api/auth/change-password", {
      currentPassword: TEST_PASSWORD,
      newPassword: "pendek",
    });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it("ganti password berhasil dan sesi berjalan tetap aktif", async () => {
    const res = await customer.post<{ changed: boolean }>("/api/auth/change-password", {
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(true);

    const me = await customer.get<{ user: { email: string } }>("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(TEST_EMAIL);
  });

  it("password lama tidak bisa dipakai login lagi (401)", async () => {
    const fresh = apiClient();
    const res = await fresh.post<{ ok: boolean }>("/api/auth/login", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("password baru bisa dipakai login (200)", async () => {
    const fresh = apiClient();
    const res = await fresh.post<{ user: { email: string } }>("/api/auth/login", {
      email: TEST_EMAIL,
      password: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
  });

  it("admin dapat mencari akun pemain", async () => {
    const admin = apiClient();
    const login = await admin.post("/api/admin/login", {
      username: process.env.SEED_ADMIN_USER ?? "admin",
      password: ADMIN_PASSWORD,
    });
    expect(login.status).toBe(200);

    const res = await admin.get<{ users: { id: number; email: string | null }[] }>(
      `/api/admin/users?q=${encodeURIComponent(TEST_EMAIL)}`,
    );
    expect(res.status).toBe(200);
    const found = res.body.users.find((user) => user.email === TEST_EMAIL);
    expect(found).toBeDefined();
    expect(found!.id).toBeGreaterThan(0);
  });

  it("reset password admin mengakhiri sesi user", async () => {
    const admin = apiClient();
    await admin.post("/api/admin/login", {
      username: process.env.SEED_ADMIN_USER ?? "admin",
      password: ADMIN_PASSWORD,
    });
    const list = await admin.get<{ users: { id: number; email: string | null }[] }>(
      `/api/admin/users?q=${encodeURIComponent(TEST_EMAIL)}`,
    );
    const target = list.body.users.find((user) => user.email === TEST_EMAIL);
    expect(target).toBeDefined();

    const reset = await admin.post<{ userId: number }>(
      `/api/admin/users/${target!.id}/reset-password`,
      { password: TEST_PASSWORD },
    );
    expect(reset.status).toBe(200);
    expect(reset.body.userId).toBe(target!.id);

    // Sesi perangkat lama (setelah ganti password) ikut dicabut.
    const me = await customer.get("/api/auth/me");
    expect(me.status).toBe(401);
  });

  it("reset password user bayangan ditolak 409", async () => {
    const date = isoDate(48);
    const admin = apiClient();
    const login = await admin.post("/api/admin/login", {
      username: process.env.SEED_ADMIN_USER ?? "admin",
      password: ADMIN_PASSWORD,
    });
    expect(login.status).toBe(200);

    const schedule = await admin.get<{
      schedule: { slots: { courtId: number; hour: number; status: string }[] };
    }>(`/api/admin/schedule?date=${date}`);
    const free = schedule.body.schedule.slots.find((slot) => slot.status === "kosong");
    expect(free).toBeDefined();

    const created = await admin.post<{ booking: { code: string } }>("/api/admin/bookings", {
      courtId: free!.courtId,
      date,
      hours: [free!.hour],
      name: "Tes Guest Password",
      phone: TEST_PHONE_WALKIN,
      paid: true,
    });
    expect(created.status).toBe(201);

    const list = await admin.get<{
      users: { id: number; phone: string | null; isGuest: boolean }[];
    }>(`/api/admin/users?q=${TEST_PHONE_WALKIN}`);
    const guest = list.body.users.find((user) => user.phone === TEST_PHONE_WALKIN && user.isGuest);
    expect(guest).toBeDefined();

    const reset = await admin.post<{ ok: boolean; message: string }>(
      `/api/admin/users/${guest!.id}/reset-password`,
      { password: TEST_PASSWORD },
    );
    expect(reset.status).toBe(409);
    expect(reset.body.ok).toBe(false);
    expect(reset.body.message).toContain("User bayangan");
  });

  it("jumlah request tetap di bawah anggaran", () => {
    expect(requestCountSoFar()).toBeLessThanOrEqual(18);
  });
});

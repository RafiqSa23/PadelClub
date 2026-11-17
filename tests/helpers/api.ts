import postgres from "postgres";

/**
 * Helper test HTTP — kecil dan serial.
 *
 * Prinsip:
 * - Hit API sungguhan (server dev) lewat `fetch`, bukan import handler.
 * - Cookie jar per klien (sesi akun/admin) supaya tidak login berulang.
 * - Cleanup menghapus HANYA baris milik `TEST_EMAIL`/`TEST_PHONE` + closure berlabel `TEST-`.
 */

export const BASE_URL = (process.env.TEST_BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
export const TEST_PHONE = process.env.TEST_PHONE ?? "6280000000001";
export const TEST_EMAIL = process.env.TEST_EMAIL ?? "pemain-test@padelclub.test";
export const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "rahasia-test-123";
export const TEST_PHONE_WALKIN = "6280000000002";
/** Akun kedua — dipakai menguji akses 403 (bukan pemilik tiket/booking). */
export const TEST_OTHER_EMAIL = "pemain-lain@padelclub.test";
export const TEST_OTHER_PHONE = "6280000000003";

/** Tanggal jauh ke depan supaya tidak bentrok dengan booking asli. */
export const TEST_DATE = isoDate(45);
export const TEST_DATE_CLOSURE = isoDate(46);

/** Batas request per run — mencegah test jadi beban server. */
export const REQUEST_BUDGET = 70;

export interface ApiResponse<T = Record<string, unknown>> {
  status: number;
  body: T;
}

export interface ApiClient {
  get<T = Record<string, unknown>>(path: string): Promise<ApiResponse<T>>;
  post<T = Record<string, unknown>>(path: string, body?: unknown): Promise<ApiResponse<T>>;
  patch<T = Record<string, unknown>>(path: string, body?: unknown): Promise<ApiResponse<T>>;
  del<T = Record<string, unknown>>(path: string): Promise<ApiResponse<T>>;
  /** Hanya status — untuk route yang balasannya bukan JSON (mis. halaman 404 Next). */
  status(path: string): Promise<number>;
  hasCookie(name: string): boolean;
}

let requestCount = 0;

export function requestCountSoFar(): number {
  return requestCount;
}

export function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Pastikan server test hidup; tidak retry berkali-kali (hemat beban). */
export async function requireServer(): Promise<void> {
  let detail = "";
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    if (res.ok && body?.ok) return;
    detail = body?.message ? `: ${body.message}` : ` (HTTP ${res.status})`;
  } catch (error) {
    detail = `: ${error instanceof Error ? error.message : String(error)}`;
  }
  throw new Error(
    `Server test tidak sehat di ${BASE_URL}${detail}. Jalankan "npm run dev:test" di terminal lain ` +
      "dan pastikan DATABASE_URL di .env.test menunjuk DB test yang sudah dimigrasi.",
  );
}

export function apiClient(): ApiClient {
  const cookies = new Map<string, string>();
  // IP unik per klien uji supaya rate-limit in-memory server tidak menumpuk
  // antar-run (limit registrasi 5/jam, login 10/menit).
  const forwardedFor = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;

  async function send(method: string, path: string, body?: unknown): Promise<Response> {
    requestCount += 1;
    const headers = new Headers();
    headers.set("x-forwarded-for", forwardedFor);
    if (body !== undefined) headers.set("content-type", "application/json");
    if (cookies.size > 0) {
      headers.set(
        "cookie",
        [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; "),
      );
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });

    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value === "" || /max-age=0/i.test(raw)) cookies.delete(name);
      else cookies.set(name, value);
    }

    return res;
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await send(method, path, body);
    const text = await res.text();
    const parsed = text ? (JSON.parse(text) as T) : ({} as T);
    return { status: res.status, body: parsed };
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    patch: (path, body) => request("PATCH", path, body),
    del: (path) => request("DELETE", path),
    status: async (path) => (await send("GET", path)).status,
    hasCookie: (name) => cookies.has(name),
  };
}

let sqlClient: ReturnType<typeof postgres> | null = null;

function sql(): ReturnType<typeof postgres> {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL tidak diset — jalankan lewat `npm run test:api`.");
    sqlClient = postgres(url, { prepare: false, max: 1, idle_timeout: 5 });
  }
  return sqlClient;
}

/** Hapus data uji sisa run sebelumnya / run ini (hanya baris milik test). */
export async function cleanupTestData(): Promise<void> {
  const db = sql();
  const phones = [TEST_PHONE, TEST_PHONE_WALKIN, TEST_OTHER_PHONE];
  for (const phone of phones) {
    // Kolom camelCase karena schema Drizzle memakai identifier ber-quote.
    const rows = await db`
      SELECT id FROM bookings
      WHERE "guestPhone" = ${phone}
         OR "userId" IN (SELECT id FROM users WHERE phone = ${phone} OR email = ${TEST_EMAIL})
    `;
    const ids = rows.map((row) => Number(row.id));
    if (ids.length > 0) {
      await db`DELETE FROM payments WHERE "bookingId" IN ${db(ids)}`;
      await db`DELETE FROM booking_slots WHERE "bookingId" IN ${db(ids)}`;
      await db`DELETE FROM bookings WHERE id IN ${db(ids)}`;
    }
    await db`DELETE FROM users WHERE phone = ${phone}`;
  }
  await db`DELETE FROM users WHERE email IN (${TEST_EMAIL}, ${TEST_OTHER_EMAIL})`;
  await db`DELETE FROM closures WHERE reason LIKE ${"TEST-%"}`;
}

export async function closeTestDb(): Promise<void> {
  if (!sqlClient) return;
  const client = sqlClient;
  sqlClient = null;
  await client.end({ timeout: 5 });
}

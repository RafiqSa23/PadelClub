import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { BASE_URL, apiClient, requireServer } from "../helpers/api";
import { securityHeaders } from "../../src/lib/security-headers";
import {
  DEFAULT_SCAN_LOG_RETENTION_DAYS,
  MAX_SCAN_LOG_RETENTION_DAYS,
  MIN_SCAN_LOG_RETENTION_DAYS,
  scanLogCutoff,
  scanLogRetentionDays,
} from "../../src/lib/scan-log-retention";

/**
 * Hardening produksi (ADR 0015): header keamanan global + retensi audit gate.
 * ±3 request HTTP + beberapa query DB; tidak menyentuh data selain baris
 * berlabel `TEST-RETENTION-`.
 */

const TEST_LOG_PREFIX = "TEST-RETENTION-";

let sqlClient: ReturnType<typeof postgres> | null = null;

function sql(): ReturnType<typeof postgres> {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL tidak diset — jalankan lewat `npm run test:api`.");
    sqlClient = postgres(url, { prepare: false, max: 1, idle_timeout: 5 });
  }
  return sqlClient;
}

async function deleteRetentionRows(): Promise<void> {
  await sql()`DELETE FROM scan_logs WHERE code LIKE ${`${TEST_LOG_PREFIX}%`}`;
}

beforeAll(async () => {
  await requireServer();
  await deleteRetentionRows();
});

afterAll(async () => {
  await deleteRetentionRows();
  if (sqlClient) {
    const client = sqlClient;
    sqlClient = null;
    await client.end({ timeout: 5 });
  }
});

describe("header keamanan respons (ADR 0015)", () => {
  it("mengirim header dasar pada respons API", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.ok).toBe(true);
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("permissions-policy")).toContain("camera=(self)");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("HSTS hanya ditambahkan di produksi", () => {
    const dev = securityHeaders({ isProduction: false });
    const prod = securityHeaders({ isProduction: true });
    expect(dev.some((h) => h.key === "Strict-Transport-Security")).toBe(false);
    const hsts = prod.find((h) => h.key === "Strict-Transport-Security");
    expect(hsts?.value).toContain("max-age=31536000");
  });
});

describe("retensi audit scan_logs (ADR 0015)", () => {
  it("nilai env dijepit dan default 90 hari", () => {
    expect(scanLogRetentionDays(undefined)).toBe(DEFAULT_SCAN_LOG_RETENTION_DAYS);
    expect(scanLogRetentionDays("")).toBe(DEFAULT_SCAN_LOG_RETENTION_DAYS);
    expect(scanLogRetentionDays("bukan-angka")).toBe(DEFAULT_SCAN_LOG_RETENTION_DAYS);
    expect(scanLogRetentionDays("1")).toBe(MIN_SCAN_LOG_RETENTION_DAYS);
    expect(scanLogRetentionDays("9999")).toBe(MAX_SCAN_LOG_RETENTION_DAYS);
    expect(scanLogRetentionDays("30")).toBe(30);
  });

  it("cutoff dihitung mundur dari waktu acuan", () => {
    const cutoff = scanLogCutoff(7, new Date("2026-11-17T00:00:00Z"));
    expect(cutoff.toISOString()).toBe("2026-11-10T00:00:00.000Z");
  });

  it("cron anonimisasi menghapus log lama saja", async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return; // dev tanpa secret — endpoint sengaja terbuka

    const db = sql();
    await db`
      INSERT INTO scan_logs (code, outcome, "createdAt")
      VALUES (${`${TEST_LOG_PREFIX}OLD`}, 'ok', now() - interval '400 days'),
             (${`${TEST_LOG_PREFIX}NEW`}, 'ok', now())
    `;

    const client = apiClient();
    const res = await client.get<{ ok: boolean; scanLogsDeleted: number; scanLogRetentionDays: number }>(
      `/api/cron/anonymize?secret=${encodeURIComponent(secret)}`,
    );
    expect(res.status).toBe(200);
    expect(typeof res.body.scanLogsDeleted).toBe("number");
    expect(res.body.scanLogRetentionDays).toBeGreaterThanOrEqual(MIN_SCAN_LOG_RETENTION_DAYS);

    const rows = await db`
      SELECT code FROM scan_logs WHERE code LIKE ${`${TEST_LOG_PREFIX}%`} ORDER BY code
    `;
    expect(rows.map((row) => row.code)).toEqual([`${TEST_LOG_PREFIX}NEW`]);
  });
});

#!/usr/bin/env node
/**
 * Penjalan test HTTP (nggak banyak, serial, tanpa load test).
 *
 * Guard:
 * - Base URL harus localhost (kecuali ALLOW_REMOTE_TESTS=1).
 * - DATABASE_URL harus database TEST (kecuali ALLOW_NON_TEST_DB=1).
 * - Server TIDAK dinyalakan otomatis: jalankan `npm run dev:test` dulu.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertSafeTestDatabase } from "./test-db-guard.mjs";

const ENV_FILE = ".env.test";

try {
  process.loadEnvFile(ENV_FILE);
} catch {
  console.error(
    `[test] File ${ENV_FILE} belum ada.\n` +
      "  1. Salin .env.test.example menjadi .env.test\n" +
      "  2. Isi DATABASE_URL ke database TEST (bukan DB dev/produksi)\n" +
      "  3. npm run db:migrate:test && npm run db:seed:test\n" +
      "  4. npm run dev:test",
  );
  process.exit(1);
}

let target;
try {
  target = assertSafeTestDatabase(process.env.DATABASE_URL, "test");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("  Panduan lengkap: README §Testing.");
  process.exit(1);
}
console.log(`[test] DB uji: ${target.host}/${target.name}`);

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3100";
let host;
try {
  host = new URL(baseUrl).hostname;
} catch {
  console.error(`[test] TEST_BASE_URL tidak valid: ${baseUrl}`);
  process.exit(1);
}
const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
if (!isLocal && process.env.ALLOW_REMOTE_TESTS !== "1") {
  console.error(
    `[test] Menolak menembak host non-lokal (${host}). Set ALLOW_REMOTE_TESTS=1 bila benar-benar perlu.`,
  );
  process.exit(1);
}

console.log(`[test] Base URL: ${baseUrl} · serial, ±70 request, tanpa load test`);

// Preflight: pastikan server + DB sehat sebelum vitest jalan (gagal cepat,
// bukan 3 file test gagal dengan pesan "server tidak terjangkau").
{
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      console.error(
        `[test] Server hidup tapi tidak sehat (HTTP ${res.status}): ${body?.message ?? "tanpa pesan"}.`,
      );
      console.error(
        "  Biasanya DATABASE_URL di .env.test salah / DB belum dimigrasi. Jalankan:\n" +
          "  npm run db:migrate:test && npm run db:seed:test, lalu restart `npm run dev:test`.",
      );
      process.exit(1);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[test] Server tidak menjawab di ${baseUrl} (${reason}).`);
    console.error('  Jalankan "npm run dev:test" di terminal lain dulu.');
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

// Jalankan entri vitest lewat node langsung (menghindari spawn .cmd di Windows).
const vitestEntry = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));

const child = spawn(process.execPath, [vitestEntry, "run", "tests/api"], {
  stdio: "inherit",
  env: { ...process.env, TEST_BASE_URL: baseUrl },
});

child.on("error", (error) => {
  console.error(`[test] Gagal menjalankan vitest: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

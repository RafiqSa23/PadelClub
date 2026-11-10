#!/usr/bin/env node
/**
 * Jalankan perintah apa pun dengan env dari `.env.test` (DB TEST terpisah).
 * Dipakai untuk migrate/seed/dev server/test supaya tidak menyentuh DB dev.
 *
 * Pakai: node scripts/with-env-test.mjs <perintah> [argumen...]
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertSafeTestDatabase } from "./test-db-guard.mjs";

const ENV_FILE = ".env.test";

try {
  process.loadEnvFile(ENV_FILE);
} catch {
  console.error(
    `[env-test] File ${ENV_FILE} belum ada.\n` +
      "  Salin .env.test.example menjadi .env.test, lalu isi DATABASE_URL ke database TEST.",
  );
  process.exit(1);
}

try {
  const target = assertSafeTestDatabase(process.env.DATABASE_URL, "env-test");
  console.log(`[env-test] DB uji: ${target.host}/${target.name}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("[env-test] Tidak ada perintah. Contoh: node scripts/with-env-test.mjs next dev -p 3100");
  process.exit(1);
}

// Jalankan entri lokal lewat `node` langsung — tanpa shell, tanpa .cmd (Windows).
const ENTRIES = {
  next: "../node_modules/next/dist/bin/next",
  "drizzle-kit": "../node_modules/drizzle-kit/bin.cjs",
  tsx: "../node_modules/tsx/dist/cli.mjs",
};

const entry = ENTRIES[command];
const child = entry
  ? spawn(process.execPath, [fileURLToPath(new URL(entry, import.meta.url)), ...args], {
      stdio: "inherit",
      env: process.env,
    })
  : spawn(command, args, {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });

child.on("error", (error) => {
  console.error(`[env-test] Gagal menjalankan ${command}: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

/**
 * Guard database uji — satu tempat, dipakai `dev:test`, `db:migrate:test`,
 * `db:seed:test`, dan `test:api`.
 *
 * Aturan:
 * 1. Placeholder template (`user:password@host`) selalu ditolak.
 * 2. DB test tidak boleh SAMA dengan DB di `.env` (dev/produksi) — ini bahaya
 *    utama karena test menghapus baris data.
 * 3. Selain itu, nama database/host harus mengandung "test", ATAU pemanggil
 *    menyatakan sadar lewat `TEST_DB_CONFIRMED=1` (untuk Neon yang default-nya
 *    `neondb`), ATAU override keras `ALLOW_NON_TEST_DB=1`.
 */
import fs from "node:fs";

const PLACEHOLDER = [/@host[:\/]/, /user:password@/];

export function parseDatabaseUrl(raw) {
  try {
    const url = new URL(raw);
    return {
      host: url.hostname,
      name: url.pathname.replace(/^\//, ""),
      // Identitas DB = host + nama database (kredensial tidak ikut dibandingkan).
      id: `${url.hostname}${url.pathname}`,
    };
  } catch {
    return null;
  }
}

/** Baca satu nilai dari file .env tanpa mengubah process.env. */
function readEnvValue(file, key) {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || match[1] !== key) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return null;
}

function devDatabaseUrl() {
  return readEnvValue(".env", "DATABASE_URL");
}

/**
 * Lempar Error dengan pesan siap-tampil bila DB test tidak aman.
 * `label` dipakai di pesan ("test" / "env-test").
 */
export function assertSafeTestDatabase(databaseUrl, label) {
  if (!databaseUrl) {
    throw new Error(`[${label}] DATABASE_URL kosong di .env.test.`);
  }

  if (PLACEHOLDER.some((pattern) => pattern.test(databaseUrl))) {
    throw new Error(
      `[${label}] DATABASE_URL di .env.test masih placeholder ("user:password@host").\n` +
        "  Isi dengan connection string database TEST dari dashboard Neon.",
    );
  }

  const target = parseDatabaseUrl(databaseUrl);
  if (!target) {
    throw new Error(`[${label}] DATABASE_URL tidak bisa dibaca sebagai URL Postgres.`);
  }

  const allowNonTestDb = process.env.ALLOW_NON_TEST_DB === "1";
  const confirmed = process.env.TEST_DB_CONFIRMED === "1";

  const dev = devDatabaseUrl();
  if (dev && parseDatabaseUrl(dev)?.id === target.id && !allowNonTestDb) {
    throw new Error(
      `[${label}] DATABASE_URL menunjuk DB yang SAMA dengan .env (${target.host}/${target.name}).\n` +
        "  Test menghapus baris data — pakai database/branch Neon terpisah.\n" +
        "  Kalau memang sadar ingin memakainya, jalankan dengan ALLOW_NON_TEST_DB=1.",
    );
  }

  const looksLikeTest = /test/i.test(target.name) || /test/i.test(target.host);
  if (!looksLikeTest && !confirmed && !allowNonTestDb) {
    throw new Error(
      `[${label}] DB tujuan: ${target.host}/${target.name} — namanya tidak mengandung "test".\n` +
        '  Pilih salah satu:\n' +
        '  1. Rename database/branch Neon jadi mis. "padelclub_test" (paling aman), atau\n' +
        '  2. Tambahkan TEST_DB_CONFIRMED="1" di .env.test bila DB itu memang khusus test, atau\n' +
        "  3. Jalankan sekali dengan ALLOW_NON_TEST_DB=1.",
    );
  }

  return target;
}

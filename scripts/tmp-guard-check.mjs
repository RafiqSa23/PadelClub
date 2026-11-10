// Sementara: uji guard DB test. Dihapus setelah verifikasi.
import fs from "node:fs";
import { assertSafeTestDatabase } from "./test-db-guard.mjs";

const devUrl = /^DATABASE_URL=(.*)$/m.exec(fs.readFileSync(".env", "utf8"))[1].replace(/^"|"$/g, "");

const cases = [
  {
    name: "placeholder ditolak",
    url: "postgresql://user:password@host/padelclub_test?sslmode=require",
    env: {},
    expect: "error",
  },
  {
    name: "DB sama dengan .env ditolak",
    url: devUrl,
    env: {},
    expect: "error",
  },
  {
    name: "neondb tanpa konfirmasi ditolak",
    url: "postgresql://u:p@ep-fake-abc.aws.neon.tech/neondb?sslmode=require",
    env: {},
    expect: "error",
  },
  {
    name: "neondb + TEST_DB_CONFIRMED=1 lolos",
    url: "postgresql://u:p@ep-fake-abc.aws.neon.tech/neondb?sslmode=require",
    env: { TEST_DB_CONFIRMED: "1" },
    expect: "ok",
  },
  {
    name: "nama mengandung test lolos",
    url: "postgresql://u:p@ep-fake-abc.aws.neon.tech/padelclub_test?sslmode=require",
    env: {},
    expect: "ok",
  },
  {
    name: "DB sama + ALLOW_NON_TEST_DB=1 lolos",
    url: devUrl,
    env: { ALLOW_NON_TEST_DB: "1" },
    expect: "ok",
  },
];

const saved = { ...process.env };
let failed = 0;
for (const testCase of cases) {
  for (const key of ["TEST_DB_CONFIRMED", "ALLOW_NON_TEST_DB"]) delete process.env[key];
  Object.assign(process.env, testCase.env);
  let result = "ok";
  let message = "";
  try {
    assertSafeTestDatabase(testCase.url, "guard");
  } catch (error) {
    result = "error";
    message = error.message.split("\n")[0];
  }
  const pass = result === testCase.expect;
  if (!pass) failed += 1;
  console.log(`${pass ? "PASS" : "FAIL"} ${testCase.name}${message ? ` -> ${message}` : ""}`);
}
process.env = saved;
process.exit(failed === 0 ? 0 : 1);

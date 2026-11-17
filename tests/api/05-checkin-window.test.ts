import { describe, expect, it } from "vitest";
import { CHECKIN_EARLY_MINUTES, evaluateCheckinWindow } from "../../src/lib/checkin-window";

/**
 * Unit test jendela check-in (tanpa HTTP): batas buka/tutup, hari-H, dan
 * perhitungan WIB (bukan zona waktu server).
 */

const DATE = "2026-11-17";
const HOURS = [18, 19];

describe("jendela check-in gate (F5)", () => {
  it("dibuka tepat 30 menit sebelum jam pertama", () => {
    const result = evaluateCheckinWindow(DATE, HOURS, new Date(`${DATE}T17:30:00+07:00`));
    expect(CHECKIN_EARLY_MINUTES).toBe(30);
    expect(result.allowed).toBe(true);
  });

  it("masih ditolak 1 detik sebelum jendela dibuka", () => {
    const result = evaluateCheckinWindow(DATE, HOURS, new Date(`${DATE}T17:29:59+07:00`));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("dibuka");
    expect(result.reason).toContain("17:30");
  });

  it("diterima saat sesi berjalan", () => {
    expect(evaluateCheckinWindow(DATE, HOURS, new Date(`${DATE}T18:00:00+07:00`)).allowed).toBe(true);
    expect(evaluateCheckinWindow(DATE, HOURS, new Date(`${DATE}T19:59:59+07:00`)).allowed).toBe(true);
  });

  it("ditutup tepat saat sesi terakhir berakhir", () => {
    const result = evaluateCheckinWindow(DATE, HOURS, new Date(`${DATE}T20:00:00+07:00`));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("sudah berakhir");
  });

  it("tanggal lain ditolak dengan pesan hari-H", () => {
    const tomorrow = evaluateCheckinWindow("2026-11-18", HOURS, new Date(`${DATE}T18:00:00+07:00`));
    expect(tomorrow.allowed).toBe(false);
    expect(tomorrow.reason).toContain("hari-H");

    const yesterday = evaluateCheckinWindow("2026-11-16", HOURS, new Date(`${DATE}T18:00:00+07:00`));
    expect(yesterday.allowed).toBe(false);
    expect(yesterday.reason).toContain("sudah berakhir");
  });

  it("memakai WIB, bukan zona waktu server", () => {
    // 10:00 UTC = 17:00 WIB → belum masuk jendela (dibuka 17:30 WIB).
    const result = evaluateCheckinWindow(DATE, HOURS, new Date(`${DATE}T10:00:00Z`));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("17:30");
  });

  it("jam kosong / tanggal invalid ditolak dengan pesan jelas", () => {
    expect(evaluateCheckinWindow(DATE, [], new Date(`${DATE}T18:00:00+07:00`)).reason).toContain(
      "tidak valid",
    );
    expect(
      evaluateCheckinWindow("2026-13-01", HOURS, new Date(`${DATE}T18:00:00+07:00`)).reason,
    ).toContain("tidak valid");
  });

  it("jam tidak berurutan tetap memakai jam paling awal/akhir", () => {
    const result = evaluateCheckinWindow(DATE, [20, 18], new Date(`${DATE}T19:30:00+07:00`));
    expect(result.allowed).toBe(true);
  });
});

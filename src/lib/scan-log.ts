import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { scanLogs } from "@/db/schema";
import { scanLogCutoff, scanLogRetentionDays } from "@/lib/scan-log-retention";

export type ScanOutcome = "ok" | "already" | "rejected";

export interface ScanLogInput {
  bookingId?: number | null;
  code: string;
  adminId?: number | null;
  adminUsername?: string | null;
  outcome: ScanOutcome;
  reason?: string | null;
}

/**
 * Simpan audit pemindaian gate (best-effort). Kegagalan log tidak boleh
 * menggagalkan check-in — cukup dicatat ke server log.
 */
export async function recordScan(input: ScanLogInput): Promise<void> {
  try {
    await db.insert(scanLogs).values({
      bookingId: input.bookingId ?? null,
      code: input.code.trim().toUpperCase(),
      adminId: input.adminId ?? null,
      adminUsername: input.adminUsername ?? null,
      outcome: input.outcome,
      reason: input.reason ?? null,
    });
  } catch (error) {
    console.error("[scan-log] gagal menyimpan log pemindaian", error);
  }
}

/**
 * Hapus audit pemindaian yang lebih tua dari retensi (ADR 0015). Dipanggil
 * cron harian bersama anonimisasi. Best-effort: kegagalan tidak boleh
 * menggagalkan cron lain, jadi jumlah 0 dikembalikan dan error dicatat.
 */
export async function cleanupScanLogs(
  retentionDays: number = scanLogRetentionDays(),
): Promise<number> {
  try {
    const cutoff = scanLogCutoff(retentionDays);
    // Hitung dulu (satu agregat, bukan memuat semua id) lalu hapus. Cron harian
    // dan delete bersifat idempotent, jadi celah balapan insert tidak masalah.
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scanLogs)
      .where(lt(scanLogs.createdAt, cutoff));
    const count = row?.count ?? 0;
    if (count === 0) return 0;

    await db.delete(scanLogs).where(lt(scanLogs.createdAt, cutoff));
    return count;
  } catch (error) {
    console.error("[scan-log] gagal membersihkan log lama", error);
    return 0;
  }
}

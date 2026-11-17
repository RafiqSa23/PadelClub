import { db } from "@/db";
import { scanLogs } from "@/db/schema";

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

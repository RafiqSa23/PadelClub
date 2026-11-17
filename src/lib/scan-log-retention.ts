/**
 * Kebijakan retensi audit `scan_logs` (ADR 0015).
 *
 * Dipisah dari `scan-log.ts` supaya bisa diuji tanpa koneksi DB. Default 90
 * hari; nilai env dijepit ke rentang aman agar salah konfigurasi tidak
 * menghapus audit terlalu cepat (atau menahannya selamanya).
 */
export const DEFAULT_SCAN_LOG_RETENTION_DAYS = 90;
export const MIN_SCAN_LOG_RETENTION_DAYS = 7;
export const MAX_SCAN_LOG_RETENTION_DAYS = 365;

export function scanLogRetentionDays(
  raw: string | undefined = process.env.SCAN_LOG_RETENTION_DAYS,
): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SCAN_LOG_RETENTION_DAYS;
  return Math.min(MAX_SCAN_LOG_RETENTION_DAYS, Math.max(MIN_SCAN_LOG_RETENTION_DAYS, parsed));
}

export function scanLogCutoff(retentionDays: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

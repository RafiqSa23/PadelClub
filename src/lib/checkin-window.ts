/**
 * Jendela check-in gate (F5): hanya hari-H, dibuka 30 menit sebelum jam pertama
 * dan ditutup tepat saat sesi terakhir berakhir. Semua perhitungan memakai WIB
 * (UTC+7, tanpa DST) supaya perilaku sama di server lokal maupun Vercel (UTC).
 */

export const CHECKIN_EARLY_MINUTES = 30;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export interface CheckinWindowResult {
  allowed: boolean;
  /** Pesan siap tampil ke resepsionis saat `allowed: false`. */
  reason?: string;
  startsAt?: Date;
  endsAt?: Date;
  opensAt?: Date;
}

function wibParts(date: Date) {
  const wib = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    year: wib.getUTCFullYear(),
    month: String(wib.getUTCMonth() + 1).padStart(2, "0"),
    day: String(wib.getUTCDate()).padStart(2, "0"),
    hour: wib.getUTCHours(),
    minute: wib.getUTCMinutes(),
  };
}

function wibDate(date: Date): string {
  const { year, month, day } = wibParts(date);
  return `${year}-${month}-${day}`;
}

function wibClock(date: Date): string {
  const { hour, minute } = wibParts(date);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` + jam (0–23) di WIB → Date absolut. */
function atWib(dateStr: string, hour: number): Date {
  return new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00+07:00`);
}

export function evaluateCheckinWindow(
  bookingDate: string,
  hours: number[],
  now: Date = new Date(),
): CheckinWindowResult {
  const sorted = hours
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23)
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return { allowed: false, reason: "Jadwal tiket tidak valid. Hubungi resepsionis." };
  }

  const startsAt = atWib(bookingDate, sorted[0]);
  const endsAt = atWib(bookingDate, sorted[sorted.length - 1] + 1);
  const opensAt = new Date(startsAt.getTime() - CHECKIN_EARLY_MINUTES * MINUTE_MS);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { allowed: false, reason: "Tanggal tiket tidak valid. Hubungi resepsionis." };
  }

  const session = `${wibClock(startsAt)}–${wibClock(endsAt)} WIB`;

  if (wibDate(now) !== bookingDate) {
    return {
      allowed: false,
      reason:
        now < startsAt
          ? `Tiket ini untuk ${bookingDate}; check-in hanya pada hari-H.`
          : `Sesi ${bookingDate} ${session} sudah berakhir.`,
      startsAt,
      endsAt,
      opensAt,
    };
  }

  if (now < opensAt) {
    return {
      allowed: false,
      reason: `Check-in dibuka ${wibClock(opensAt)} WIB (${CHECKIN_EARLY_MINUTES} menit sebelum sesi ${session}).`,
      startsAt,
      endsAt,
      opensAt,
    };
  }

  if (now >= endsAt) {
    return {
      allowed: false,
      reason: `Sesi ${session} sudah berakhir.`,
      startsAt,
      endsAt,
      opensAt,
    };
  }

  return { allowed: true, startsAt, endsAt, opensAt };
}

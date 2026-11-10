import { jsonError, jsonOk } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { getDaysSummary, isValidDateString } from '@/lib/slots';
import { getSlotsVersion, readDaySchedule } from '@/lib/slot-status';

const MAX_RANGE_DAYS = 31;

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/**
 * Jadwal slot (F1).
 * - `?date=YYYY-MM-DD` → grid penuh 1 hari + versi (dipakai saat halaman dibuka).
 * - `?from=&to=` → jumlah slot kosong per hari (strip tanggal, satu query).
 */
export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  const rl = rateLimit(`slots:${ip}`, 120, 60_000);
  if (!rl.allowed) return jsonError('Terlalu banyak permintaan jadwal, coba lagi sebentar', 429);

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (from || to) {
    if (!from || !to || !isValidDateString(from) || !isValidDateString(to)) {
      return jsonError('Parameter from dan to wajib format YYYY-MM-DD', 400);
    }
    const span = daysBetween(from, to);
    if (span < 0) return jsonError('Parameter from harus sebelum to', 400);
    if (span >= MAX_RANGE_DAYS) {
      return jsonError(`Rentang maksimal ${MAX_RANGE_DAYS} hari`, 400);
    }
    const days = await getDaysSummary(from, to);
    return jsonOk({ days });
  }

  const date = searchParams.get('date') ?? '';
  if (!isValidDateString(date)) {
    return jsonError('Parameter date wajib format YYYY-MM-DD', 400);
  }
  const schedule = await readDaySchedule(date);
  return jsonOk({ schedule, v: getSlotsVersion(date) });
}

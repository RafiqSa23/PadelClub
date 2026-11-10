import { jsonError, jsonOk } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { isValidDateString } from '@/lib/slots';
import { getSlotDelta } from '@/lib/slot-status';

/**
 * Polling ringan jadwal: klien mengirim versi terakhir, server balas 304 bila
 * tidak ada perubahan. Ini yang membuat refresh 10 detik tidak membebani DB.
 */
export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  const rl = rateLimit(`slots-status:${ip}`, 120, 60_000);
  if (!rl.allowed) return jsonError('Terlalu banyak permintaan jadwal, coba lagi sebentar', 429);

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') ?? '';
  if (!isValidDateString(date)) {
    return jsonError('Parameter date wajib format YYYY-MM-DD', 400);
  }

  const rawVersion = Number(searchParams.get('v') ?? '-1');
  const clientV = Number.isInteger(rawVersion) ? rawVersion : -1;

  const delta = await getSlotDelta(date, clientV);

  if (delta.kind === 'not-modified') {
    return new Response(null, { status: 304, headers: { 'Cache-Control': 'no-store' } });
  }
  if (delta.kind === 'full') {
    return jsonOk({ v: delta.v, full: true, schedule: delta.schedule });
  }
  return jsonOk({ v: delta.v, full: false, slots: delta.changes });
}

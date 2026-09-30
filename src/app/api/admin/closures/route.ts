import { eq, gte } from 'drizzle-orm';
import { db } from '@/db';
import { closures } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { isValidDateString } from '@/lib/slots';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') ?? '';
  if (date) {
    if (!isValidDateString(date)) {
      return jsonError('Parameter date wajib format YYYY-MM-DD', 400);
    }
    const rows = await db.select().from(closures).where(eq(closures.closureDate, date));
    return jsonOk({ closures: rows });
  }
  // Tanpa date: kembalikan penutupan hari ini ke depan (max 100).
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(closures)
    .where(gte(closures.closureDate, today))
    .limit(100);
  return jsonOk({ closures: rows });
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const body = (await request.json().catch(() => null)) as {
    courtId?: number;
    date?: string;
    startHour?: number | null;
    endHour?: number | null;
    reason?: string;
  } | null;
  if (!body || typeof body.courtId !== 'number' || !body.date || !isValidDateString(body.date)) {
    return jsonError('courtId (number) dan date (YYYY-MM-DD) wajib diisi', 400);
  }
  const { courtId, date, reason } = body;
  let { startHour = null, endHour = null } = body;
  // Tutup seluruh hari bila start/end null; bila isi, validasi rentang.
  if (startHour != null || endHour != null) {
    if (
      typeof startHour !== 'number' ||
      typeof endHour !== 'number' ||
      !Number.isInteger(startHour) ||
      !Number.isInteger(endHour) ||
      startHour < 0 ||
      endHour > 24 ||
      startHour >= endHour
    ) {
      return jsonError('Rentang jam tidak valid (0–24, startHour < endHour)', 400);
    }
  } else {
    startHour = null;
    endHour = null;
  }

  const inserted = await db
    .insert(closures)
    .values({ courtId, closureDate: date, startHour, endHour, reason: reason ?? null })
    .returning();
  return jsonOk({ closure: inserted[0] }, 201);
}

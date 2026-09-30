import { db } from '@/db';
import { courtHours, courts } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';

/** Tambah lapangan baru (ADR 0004: jumlah lapangan configurable). */
export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    hourlyPrice?: number;
    isIndoor?: boolean;
    description?: string;
  } | null;

  const name = body?.name?.trim() || 'Lapangan Baru';
  const hourlyPrice = body?.hourlyPrice ?? 35000;
  if (!Number.isInteger(hourlyPrice) || hourlyPrice <= 0) {
    return jsonError('hourlyPrice harus bilangan positif', 400);
  }

  const inserted = await db
    .insert(courts)
    .values({
      name,
      hourlyPrice,
      isActive: true,
      isIndoor: body?.isIndoor ?? true,
      description: body?.description ?? 'Lapangan baru',
    })
    .returning();
  const court = inserted[0];

  for (let dow = 0; dow < 7; dow++) {
    await db.insert(courtHours).values({
      courtId: court.id,
      dayOfWeek: dow,
      openTime: '08:00',
      closeTime: '22:00',
    });
  }
  return jsonOk({ court }, 201);
}

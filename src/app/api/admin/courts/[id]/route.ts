import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { courtHours, courts } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';

/**
 * Kelola lapangan (F9 sisi konfigurasi, ADR 0004): harga, status aktif,
 * dan jam operasional (disamakan 7 hari untuk MVP).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const { id } = await params;
  const courtId = Number(id);
  if (!Number.isInteger(courtId)) return jsonError('ID lapangan tidak valid', 400);

  const body = (await request.json().catch(() => null)) as {
    hourlyPrice?: number;
    isActive?: boolean;
    openHour?: number;
    closeHour?: number;
    name?: string;
    description?: string;
    isIndoor?: boolean;
  } | null;
  if (!body) return jsonError('Body JSON wajib diisi', 400);

  const patch: Partial<typeof courts.$inferInsert> = { updatedAt: new Date() };
  if (body.hourlyPrice !== undefined) {
    if (!Number.isInteger(body.hourlyPrice) || body.hourlyPrice <= 0) {
      return jsonError('hourlyPrice harus bilangan positif', 400);
    }
    patch.hourlyPrice = body.hourlyPrice;
  }
  if (body.isActive !== undefined) patch.isActive = body.isActive;
  if (body.name !== undefined) patch.name = body.name;
  if (body.description !== undefined) patch.description = body.description;
  if (body.isIndoor !== undefined) patch.isIndoor = body.isIndoor;

  if (body.openHour !== undefined || body.closeHour !== undefined) {
    const open = body.openHour;
    const close = body.closeHour;
    if (
      typeof open !== 'number' ||
      typeof close !== 'number' ||
      !Number.isInteger(open) ||
      !Number.isInteger(close) ||
      open < 0 ||
      close > 24 ||
      open >= close
    ) {
      return jsonError('Jam operasional tidak valid (0–24, open < close)', 400);
    }
    const openText = `${String(open).padStart(2, '0')}:00`;
    const closeText = `${String(close).padStart(2, '0')}:00`;
    for (let dow = 0; dow < 7; dow++) {
      const existing = await db
        .select()
        .from(courtHours)
        .where(eq(courtHours.courtId, courtId));
      const row = existing.find((r) => r.dayOfWeek === dow);
      if (row) {
        await db
          .update(courtHours)
          .set({ openTime: openText, closeTime: closeText })
          .where(eq(courtHours.id, row.id));
      } else {
        await db.insert(courtHours).values({
          courtId,
          dayOfWeek: dow,
          openTime: openText,
          closeTime: closeText,
        });
      }
    }
  }

  const updated = await db
    .update(courts)
    .set(patch)
    .where(eq(courts.id, courtId))
    .returning();
  if (updated.length === 0) return jsonError('Lapangan tidak ditemukan', 404);
  return jsonOk({ court: updated[0] });
}

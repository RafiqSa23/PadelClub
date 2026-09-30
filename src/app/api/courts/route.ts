import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { courtHours, courts } from '@/db/schema';
import { jsonOk } from '@/lib/api';
import { dayOfWeekOf } from '@/lib/slots';
import { todayString } from '@/lib/format';

export async function GET() {
  const rows = await db
    .select({
      id: courts.id,
      name: courts.name,
      hourlyPrice: courts.hourlyPrice,
      isActive: courts.isActive,
      isIndoor: courts.isIndoor,
      description: courts.description,
    })
    .from(courts)
    .orderBy(courts.id);

  // Sertakan jam operasional hari ini agar kartu lapangan bisa tampil tanpa
  // request tambahan (fallback 07:00–23:00 bila tak ada baris).
  const dow = dayOfWeekOf(todayString());
  const hoursRows = await db.select().from(courtHours).where(eq(courtHours.dayOfWeek, dow));
  const hoursByCourt = new Map(
    hoursRows.map((h) => [
      h.courtId,
      {
        openHour: Number(String(h.openTime).slice(0, 2)),
        closeHour: Number(String(h.closeTime).slice(0, 2)),
      },
    ]),
  );
  const courtsWithHours = rows
    .filter((c) => c.isActive)
    .map((c) => ({ ...c, ...(hoursByCourt.get(c.id) ?? { openHour: 7, closeHour: 23 }) }));
  return jsonOk({ courts: courtsWithHours });
}

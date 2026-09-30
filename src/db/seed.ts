import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from './index';
import { admins, courtHours, courts } from './schema';
import { hashAdminPassword } from '../lib/admin-auth';

const COURTS = [
  { name: 'Lapangan 1', hourlyPrice: 35000, isIndoor: false, description: 'Outdoor, pasir sintetis' },
  { name: 'Lapangan 2', hourlyPrice: 35000, isIndoor: false, description: 'Outdoor, pasir sintetis' },
  { name: 'Lapangan 3', hourlyPrice: 40000, isIndoor: true, description: 'Indoor, pencahayaan penuh' },
  { name: 'Lapangan 4', hourlyPrice: 40000, isIndoor: true, description: 'Indoor, pencahayaan penuh' },
  { name: 'Lapangan 5', hourlyPrice: 30000, isIndoor: false, description: 'Outdoor, taman' },
  { name: 'Lapangan 6', hourlyPrice: 45000, isIndoor: true, description: 'Glass Court — favorit' },
] as const;

// Jam operasional default per lapangan (openHour-closeHour), disamakan 7 hari.
// Sumber: src/lib/mock.ts (mock hanya men-contoh dayOfWeek 0).
const HOURS: Record<number, { open: string; close: string }> = {
  1: { open: '07:00', close: '23:00' },
  2: { open: '08:00', close: '22:00' },
  3: { open: '08:00', close: '22:00' },
  4: { open: '08:00', close: '22:00' },
  5: { open: '09:00', close: '21:00' },
  6: { open: '07:00', close: '23:00' },
};

async function main() {
  // Courts (idempotent by name).
  const existing = await db.select({ id: courts.id, name: courts.name }).from(courts);
  const byName = new Map(existing.map((c) => [c.name, c.id]));

  for (const [index, c] of COURTS.entries()) {
    const courtId = index + 1;
    if (!byName.has(c.name)) {
      await db.insert(courts).values({
        name: c.name,
        hourlyPrice: c.hourlyPrice,
        isActive: true,
        isIndoor: c.isIndoor,
        description: c.description,
      });
      console.log(`seed court: ${c.name}`);
    } else {
      // Backfill kolom baru untuk DB yang di-seed sebelum kolom ada.
      await db
        .update(courts)
        .set({ isIndoor: c.isIndoor, description: c.description })
        .where(eq(courts.name, c.name));
    }
    void courtId;
  }

  const allCourts = await db.select({ id: courts.id, name: courts.name }).from(courts);
  const nameToId = new Map(allCourts.map((c) => [c.name, c.id]));

  // Court hours 7 hari (idempotent: cek per court+day).
  for (const [index, c] of COURTS.entries()) {
    const id = nameToId.get(c.name);
    if (!id) continue;
    const h = HOURS[index + 1];
    for (let dow = 0; dow < 7; dow++) {
      const rows = await db.select().from(courtHours).where(eq(courtHours.courtId, id));
      if (rows.some((r) => r.dayOfWeek === dow)) continue;
      await db.insert(courtHours).values({
        courtId: id,
        dayOfWeek: dow,
        openTime: h.open,
        closeTime: h.close,
      });
    }
  }
  console.log('seed court_hours: 7 hari per lapangan OK');

  // Admin default (idempotent by username). Password dari env atau admin123.
  const username = process.env.SEED_ADMIN_USER ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
  const found = await db.select().from(admins).where(eq(admins.username, username)).limit(1);
  if (found.length === 0) {
    await db.insert(admins).values({ username, passwordHash: await hashAdminPassword(password) });
    console.log(`seed admin: ${username} OK`);
  } else {
    console.log(`seed admin: ${username} sudah ada, dilewati`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('seed gagal:', err);
  process.exit(1);
});

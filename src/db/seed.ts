import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from './index';
import { admins, courtHours, courts, users } from './schema';
import { hashAdminPassword } from '../lib/admin-auth';
import { MIN_PASSWORD_LENGTH, hashPassword } from '../lib/password';
import { normalizePhone } from '../lib/phone';

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

// Akun pemain demo untuk login lewat /login (bukan user bayangan walk-in).
// Email sengaja berbeda dari akun test (pemain-test@…) supaya cleanup test
// tidak menghapus baris seed.
const DEMO_USERS = [
  { name: 'Pemain Demo', email: 'pemain@padelclub.test', phone: '081234567890' },
  { name: 'Pemain Demo 2', email: 'pemain2@padelclub.test', phone: '081234567891' },
] as const;

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

  // Akun pemain demo (login email + password, ADR 0009). Idempotent by email;
  // password hanya ditimpa bila SEED_DEMO_RESET_PASSWORD=1.
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'pemain123';
  if (demoPassword.length < MIN_PASSWORD_LENGTH) {
    console.error(`seed user gagal: SEED_DEMO_PASSWORD minimal ${MIN_PASSWORD_LENGTH} karakter`);
    process.exit(1);
  }
  const resetDemoPassword = process.env.SEED_DEMO_RESET_PASSWORD === '1';

  for (const demo of DEMO_USERS) {
    const email = demo.email.trim().toLowerCase();
    const foundUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (foundUser.length === 0) {
      await db.insert(users).values({
        name: demo.name,
        email,
        phone: normalizePhone(demo.phone),
        passwordHash: await hashPassword(demoPassword),
        isGuest: false,
      });
      console.log(`seed user: ${email} OK`);
    } else if (resetDemoPassword) {
      await db
        .update(users)
        .set({ passwordHash: await hashPassword(demoPassword), updatedAt: new Date() })
        .where(eq(users.id, foundUser[0].id));
      console.log(`seed user: ${email} password direset`);
    } else {
      console.log(`seed user: ${email} sudah ada, dilewati`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('seed gagal:', err);
  process.exit(1);
});

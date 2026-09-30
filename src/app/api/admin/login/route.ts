import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { admins } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { adminCookieValue, createAdminSession, verifyAdminPassword } from '@/lib/admin-auth';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  const rl = rateLimit(`admin-login:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return jsonError('Terlalu banyak percobaan, coba lagi sebentar', 429);
  }

  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;
  if (!body?.username || !body?.password) {
    return jsonError('Username dan password wajib diisi', 400);
  }

  const rows = await db.select().from(admins).where(eq(admins.username, body.username)).limit(1);
  const admin = rows[0];
  if (!admin || !(await verifyAdminPassword(body.password, admin.passwordHash))) {
    return jsonError('Username atau password salah', 401);
  }

  const session = await createAdminSession(admin.id);
  const res = jsonOk({ admin: { id: admin.id, username: admin.username } });
  res.headers.append('Set-Cookie', adminCookieValue(session.token));
  return res;
}

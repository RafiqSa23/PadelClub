import { desc, ilike, or } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { jsonError, jsonOk } from '@/lib/api';

const MAX_RESULTS = 25;

/**
 * Daftar akun pemain untuk halaman admin `/admin/users` (ADR 0012).
 * Dipakai admin untuk mencari user lalu melakukan reset password.
 */
export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  const pattern = `%${q}%`;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isGuest: users.isGuest,
      anonymizedAt: users.anonymizedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      q
        ? or(ilike(users.name, pattern), ilike(users.email, pattern), ilike(users.phone, pattern))
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(MAX_RESULTS);

  return jsonOk({ users: rows });
}

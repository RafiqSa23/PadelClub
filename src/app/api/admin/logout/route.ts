import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { adminSessions } from '@/db/schema';
import { jsonOk } from '@/lib/api';
import { ADMIN_SESSION_COOKIE } from '@/lib/constants';
import { clearAdminCookieValue } from '@/lib/admin-auth';

export async function POST() {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (token) {
    const hash = createHash('sha256').update(token).digest('hex');
    await db.delete(adminSessions).where(eq(adminSessions.tokenHash, hash));
  }
  const res = jsonOk({ loggedOut: true });
  res.headers.append('Set-Cookie', clearAdminCookieValue());
  return res;
}

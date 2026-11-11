import { cookies } from 'next/headers';
import { jsonOk } from '@/lib/api';
import { CUSTOMER_SESSION_COOKIE, clearCustomerCookieValue } from '@/lib/session';
import { destroyUserSession } from '@/lib/user-auth';

/** Logout pemain: hapus sesi DB + cookie. */
export async function POST() {
  const store = await cookies();
  await destroyUserSession(store.get(CUSTOMER_SESSION_COOKIE)?.value);
  const res = jsonOk({});
  res.headers.append('Set-Cookie', clearCustomerCookieValue());
  return res;
}
